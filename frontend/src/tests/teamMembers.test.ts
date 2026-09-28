import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

// Members in «Команда» and joining by link (learning-services#363).

const answers: Record<string, unknown> = {}
const calls: { method: string; params: unknown }[] = []

vi.mock('frappe-ui', () => ({
	createResource: ({
		url,
		makeParams,
		auto,
	}: {
		url: string
		makeParams?: () => unknown
		auto?: boolean
	}) => {
		const resource = reactive({
			data: null as unknown,
			loading: false,
			reload: vi.fn(async () => {
				resource.data = answers[url] ?? null
			}),
		})
		if (auto) {
			makeParams?.()
			resource.reload()
		}
		return resource
	},
	call: vi.fn(async (method: string, params: unknown) => {
		calls.push({ method, params })
		return answers[method] ?? { ok: true, data: {} }
	}),
	toast: { error: vi.fn(), success: vi.fn() },
	Button: {
		props: ['loading', 'variant'],
		template: '<button><slot /></button>',
	},
	FormControl: { props: ['modelValue', 'options'], template: '<select />' },
	LoadingIndicator: { template: '<span />' },
	usePageMeta: vi.fn(),
}))

const session = { isLoggedIn: true }
vi.mock('@/stores/session', () => ({ sessionStore: () => session }))

import TeamMembers from '@/components/Team/TeamMembers.vue'
import Join from '@/pages/Team/Join.vue'
import { canRemove, readersBeforeJoining, type TeamData } from '@/utils/team'

const mocks = {
	__: (t: string) =>
		({
			format: (x: string) => t.replace('{0}', x),
			toString: () => t,
		} as unknown as string),
}

const team = (canManage: boolean, canChangeRoles: boolean): TeamData => ({
	organization: 'org-1',
	title: 'Кофейни',
	can_see_report: canManage,
	can_manage: canManage,
	can_change_roles: canChangeRoles,
	members: [
		{
			user: 'm@x',
			full_name: 'Мария',
			role: 'Member',
			left: false,
			left_on: null,
		},
		{
			user: 'b@x',
			full_name: 'Борис',
			role: 'Manager',
			left: false,
			left_on: null,
		},
	],
	courses: [],
})

beforeEach(() => {
	calls.length = 0
	for (const key of Object.keys(answers)) delete answers[key]
	session.isLoggedIn = true
})

describe('who can mark whom as left', () => {
	it('a manager marks members, an administrator anyone', () => {
		const member = team(true, false).members[0]
		const manager = team(true, false).members[1]

		expect(canRemove(member, team(true, false))).toBe(true)
		expect(canRemove(manager, team(true, false))).toBe(false)
		expect(canRemove(manager, team(true, true))).toBe(true)
		expect(canRemove(member, team(false, false))).toBe(false)
	})

	it('tells who will read the documents before joining', () => {
		expect(readersBeforeJoining('managers', 'Кофейни')).toContain('managers')
		expect(readersBeforeJoining('members', 'Кофейни')).toContain('everyone')
	})
})

describe('the members list', () => {
	it('offers inviting and marking a member as left to a manager', async () => {
		const wrapper = mount(TeamMembers, {
			props: { team: team(true, false) },
			global: { mocks },
		})
		await flushPromises()

		expect(wrapper.find('[data-testid="team-invite"]').exists()).toBe(true)
		await wrapper.find('[data-testid="remove-m@x"]').trigger('click')
		await flushPromises()

		expect(calls[0]).toEqual({
			method: 'lms_frappe_app.api.team.remove_member',
			params: { organization: 'org-1', user: 'm@x' },
		})
		expect(wrapper.find('[data-testid="remove-b@x"]').exists()).toBe(false)
	})

	it('offers nothing to manage to a member', async () => {
		const wrapper = mount(TeamMembers, {
			props: { team: team(false, false) },
			global: { mocks },
		})
		await flushPromises()

		expect(wrapper.find('[data-testid="team-invite"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="remove-m@x"]').exists()).toBe(false)
	})
})

describe('joining by link', () => {
	const open = async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/join/:token', name: 'JoinTeam', component: Join },
				{ path: '/team', name: 'Team', component: { template: '<div />' } },
			],
		})
		router.push('/join/k3')
		await router.isReady()
		const wrapper = mount(Join, { global: { plugins: [router], mocks } })
		await flushPromises()
		return wrapper
	}

	it('says what joining means before the button', async () => {
		answers['lms_frappe_app.api.team.invite_info'] = {
			ok: true,
			data: {
				organization: 'org-1',
				title: 'Кофейни',
				documents_visible_to: 'managers',
				member: false,
			},
		}
		const wrapper = await open()

		expect(wrapper.find('[data-testid="join-terms"]').text()).toContain(
			'The company will see which of its courses you have already passed.'
		)
		await wrapper.find('[data-testid="join-accept"]').trigger('click')
		expect(calls[0]).toEqual({
			method: 'lms_frappe_app.api.team.accept_invite',
			params: { token: 'k3' },
		})
	})

	it('says plainly that a revoked link is not valid', async () => {
		answers['lms_frappe_app.api.team.invite_info'] = {
			ok: false,
			error: { code: 'invite_not_found', message: '' },
		}
		const wrapper = await open()

		expect(wrapper.find('[data-testid="join-invalid"]').exists()).toBe(true)
	})
})

describe('joining an organization nobody verified', () => {
	it('warns before the button', async () => {
		answers['lms_frappe_app.api.team.invite_info'] = {
			ok: true,
			data: {
				organization: 'org-2',
				title: 'Своя',
				documents_visible_to: 'managers',
				verified: false,
				member: false,
			},
		}
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/join/:token', name: 'JoinTeam', component: Join },
				{ path: '/team', name: 'Team', component: { template: '<div />' } },
			],
		})
		router.push('/join/k4')
		await router.isReady()
		const wrapper = mount(Join, { global: { plugins: [router], mocks } })
		await flushPromises()

		expect(wrapper.find('[data-testid="join-unverified"]').exists()).toBe(true)
	})
})
