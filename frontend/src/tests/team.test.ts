import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// «Команда» (learning-services#358): the wording and the page's states. Access
// is the server's; the page must say plainly what it cannot show.

const answers: Record<string, unknown> = {}
const reloads: { url: string; params: unknown }[] = []

vi.mock('frappe-ui', () => ({
	createResource: ({ url }: { url: string }) => {
		const resource = reactive({
			data: null as unknown,
			loading: false,
			reload: vi.fn(async (params?: unknown) => {
				reloads.push({ url, params })
				resource.data = answers[url] ?? null
			}),
		})
		return resource
	},
	FormControl: {
		props: ['modelValue', 'options'],
		template:
			'<select data-testid="picker"><option v-for="o in options" :value="o.value">{{ o.label }}</option></select>',
	},
	LoadingIndicator: { template: '<span />' },
	usePageMeta: vi.fn(),
}))

vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))

const space = reactive({
	isOrganization: true,
	current: 'org-1',
	load: vi.fn(() => Promise.resolve()),
})
vi.mock('@/stores/space', () => ({ useSpace: () => space }))

import Team from '@/pages/Team/Team.vue'
import { firstDocument, isEmpty, percent, statusLabel } from '@/utils/team'

const TEAM = 'lms_frappe_app.api.team.team'
const DOCUMENTS = 'lms_frappe_app.api.team.team_documents'

const team = (canSeeReport: boolean) => ({
	ok: true,
	data: {
		organization: 'org-1',
		title: 'Кофейни',
		can_see_report: canSeeReport,
		members: [
			{
				user: 'a@x',
				full_name: 'Анна',
				role: 'Member',
				left: false,
				left_on: null,
			},
			{
				user: 'b@x',
				full_name: 'Борис',
				role: 'Member',
				left: true,
				left_on: '2026-09-20',
			},
		],
		courses: [
			{
				id: 'c-1',
				title: 'P3',
				documents: [{ artifact: 'summary', title: 'Резюме' }],
			},
		],
	},
})

const entry = (user: string, content: string) => ({
	user,
	full_name: user,
	left: false,
	filled: Boolean(content),
	content,
	file: null,
	url: null,
	table_markdown: null,
})

const open = async () => {
	const wrapper = mount(Team, {
		global: {
			mocks: {
				__: (t: string) =>
					({ format: () => t, toString: () => t } as unknown as string),
			},
			directives: {
				'safe-html': (el: HTMLElement, b: { value: string }) =>
					(el.innerHTML = b.value),
			},
		},
	})
	await flushPromises()
	return wrapper
}

beforeEach(() => {
	reloads.length = 0
	for (const key of Object.keys(answers)) delete answers[key]
	space.isOrganization = true
	answers[DOCUMENTS] = {
		ok: true,
		data: {
			title: 'Резюме',
			authors: [
				{
					user: 'a@x',
					full_name: 'Анна',
					left: false,
					blocks_filled: 1,
					blocks_total: 1,
				},
			],
			blocks: [
				{
					key: 'goal',
					title: 'Цель',
					entries: [entry('a@x', 'Открыть кофейню'), entry('b@x', '')],
				},
			],
		},
	}
})

describe('team wording', () => {
	it('names statuses and shares', () => {
		expect(statusLabel('completed')).toBe('Completed')
		expect(percent(0.426)).toBe('43%')
	})

	it('opens on the first course that builds a document', () => {
		expect(
			firstDocument([
				{ id: 'none', title: null, documents: [] },
				{
					id: 'c-1',
					title: null,
					documents: [{ artifact: 'summary', title: '' }],
				},
			])
		).toEqual({ course: 'c-1', artifact: 'summary' })
		expect(firstDocument([])).toBeNull()
	})

	it('tells a gap from an entry', () => {
		expect(isEmpty(entry('a', ''))).toBe(true)
		expect(isEmpty(entry('a', 'текст'))).toBe(false)
	})
})

describe('the team page', () => {
	it('in the personal space says a team belongs to an organization', async () => {
		space.isOrganization = false
		const wrapper = await open()

		expect(wrapper.find('[data-testid="team-personal"]').exists()).toBe(true)
		expect(reloads.some((r) => r.url === TEAM)).toBe(false)
	})

	it('says the team is closed when the server refuses', async () => {
		answers[TEAM] = {
			ok: false,
			error: { code: 'team_not_available', message: '' },
		}
		const wrapper = await open()

		expect(wrapper.find('[data-testid="team-closed"]').exists()).toBe(true)
	})

	it('compares a block across members, a gap included', async () => {
		answers[TEAM] = team(false)
		const wrapper = await open()

		expect(reloads.find((r) => r.url === DOCUMENTS)?.params).toEqual({
			organization: 'org-1',
			course: 'c-1',
			artifact: 'summary',
		})
		const block = wrapper.find('[data-testid="team-block-goal"]')
		expect(block.text()).toContain('Открыть кофейню')
		expect(block.text()).toContain('Not filled yet')
	})

	it('shows the report tab to a manager only', async () => {
		answers[TEAM] = team(false)
		const member = await open()
		expect(member.find('[data-testid="team-tab-report"]').exists()).toBe(false)

		answers[TEAM] = team(true)
		const manager = await open()
		expect(manager.find('[data-testid="team-tab-report"]').exists()).toBe(true)
	})

	it('lists who left with the date', async () => {
		answers[TEAM] = team(false)
		const wrapper = await open()
		await wrapper.find('[data-testid="team-tab-members"]').trigger('click')

		expect(wrapper.find('[data-testid="team-members"]').text()).toContain(
			'Борис'
		)
	})
})
