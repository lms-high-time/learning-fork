import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// «Homework» (learning-services#439): the learner's homework of every course,
// each a way back to its lesson; for a tutor, also the queue to review
// (learning-services#452).

const answers: Record<string, unknown> = {}
const reloads: { url: string; params: unknown }[] = []
const failures: Record<string, Error> = {}

vi.mock('frappe-ui', () => ({
	createResource: (config: { url: string; makeParams?: () => unknown }) => {
		const resource = reactive({
			data: null as unknown,
			loading: false,
			fetch: vi.fn(async () => {
				reloads.push({ url: config.url, params: config.makeParams?.() })
				// frappe-ui rethrows a failed request after its onError.
				if (failures[config.url]) throw failures[config.url]
				resource.data = answers[config.url] ?? null
			}),
			reload: vi.fn(async () => {
				resource.data = answers[config.url] ?? null
			}),
		})
		return resource
	},
	LoadingIndicator: { template: '<span />' },
	usePageMeta: vi.fn(),
}))

vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))

const space = reactive({
	current: 'org-1',
	load: vi.fn(() => Promise.resolve()),
})
vi.mock('@/stores/space', () => ({ useSpace: () => space }))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ isLoggedIn: true, user: 'a@x' }),
}))

const user = reactive({ data: { roles: ['LMS Student'] } as unknown })
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: user }),
}))

// The tab and the card live in the address: `?tab=queue`, `?submission=`.
const route = reactive({ query: {} as Record<string, string> })
const router = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
}))
vi.mock('vue-router', () => ({
	useRoute: () => route,
	useRouter: () => router,
}))

// The queue and the card have their own tests; here they only have to appear.
vi.mock('@/components/Homework/HomeworkQueue.vue', () => ({
	default: { template: '<div data-testid="queue" />' },
}))
vi.mock('@/components/Homework/HomeworkReview.vue', () => ({
	default: {
		props: ['submission'],
		template: '<div data-testid="card">{{ submission }}</div>',
	},
}))

import Homework from '@/pages/Homework/Homework.vue'
import type { HomeworkRow } from '@/utils/homework'

const URL = 'lms_frappe_app.api.student.my_homework'

const row = (overrides: Partial<HomeworkRow> = {}): HomeworkRow => ({
	id: 'HS-1',
	course: 'c-1',
	course_title: 'Проектный менеджмент',
	lesson: 'L1',
	lesson_title: 'Спонсор',
	lesson_url: '/lms/courses/c-1/learn/1-2',
	title: 'Встреча со спонсором',
	status: 'Submitted',
	due_at: '2030-01-15 23:59:59',
	overdue: false,
	version: 1,
	last_comment: null,
	...overrides,
})

const open = async () => {
	const wrapper = mount(Homework, {
		global: {
			mocks: { __: (globalThis as any).__ },
			stubs: {
				'router-link': {
					props: ['to'],
					template: '<a :href="to"><slot /></a>',
				},
			},
		},
	})
	await flushPromises()
	return wrapper
}

// The route and the user are shared: a page left mounted would follow them.
enableAutoUnmount(afterEach)

beforeEach(() => {
	route.query = {}
	user.data = { roles: ['LMS Student'] }
	router.push.mockReset()
	router.replace.mockReset()
	router.replace.mockImplementation(({ query }) => (route.query = query))
	reloads.length = 0
	for (const key of Object.keys(answers)) delete answers[key]
	for (const key of Object.keys(failures)) delete failures[key]
})

describe('Homework page', () => {
	it('asks for the homework of the current space', async () => {
		answers[URL] = { ok: true, data: { space: 'org-1', items: [] } }
		await open()
		expect(reloads).toEqual([{ url: URL, params: { space: 'org-1' } }])
	})

	it('groups the homework by course and leads to the lesson', async () => {
		answers[URL] = {
			ok: true,
			data: {
				space: 'org-1',
				items: [
					row(),
					row({
						id: 'HS-2',
						lesson: 'L2',
						title: 'Устав проекта',
						status: 'Returned',
						overdue: true,
						last_comment: 'Нет целей',
					}),
					row({
						id: 'HS-3',
						course: 'c-2',
						course_title: 'Продажи',
						title: 'Скрипт звонка',
						lesson_url: '/lms/courses/c-2/learn/1-1',
					}),
				],
			},
		}
		const wrapper = await open()
		const groups = wrapper.findAll('[data-testid="homework-course"]')
		expect(groups).toHaveLength(2)
		expect(groups[0].find('h2').text()).toBe('Проектный менеджмент')
		expect(groups[0].findAll('[data-testid="homework-row"]')).toHaveLength(2)
		expect(groups[1].find('h2').text()).toBe('Продажи')

		const returned = groups[0].findAll('[data-testid="homework-row"]')[1]
		expect(returned.text()).toContain('Устав проекта')
		expect(returned.text()).toContain('Returned for revision')
		expect(returned.text()).toContain('Overdue')
		expect(returned.text()).toContain('Нет целей')
		expect(returned.find('a').attributes('href')).toBe(
			'/courses/c-1/learn/1-2#homework'
		)
	})

	it('says what the server refused instead of an empty list', async () => {
		answers[URL] = {
			ok: false,
			error: { code: 'space_not_available', message: 'Пространство недоступно' },
		}
		const wrapper = await open()
		expect(wrapper.find('[data-testid="homework-error"]').text()).toBe(
			'Пространство недоступно'
		)
		expect(wrapper.find('[data-testid="homework-empty"]').exists()).toBe(false)
	})

	it('stops waiting when the request fails', async () => {
		failures[URL] = new Error('502')
		const wrapper = await open()
		expect(wrapper.find('[data-testid="homework-loading"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="homework-error"]').text()).toBe(
			'Could not load homework'
		)
	})

	it('leaves a row without a lesson unlinked', async () => {
		answers[URL] = {
			ok: true,
			data: { space: 'org-1', items: [row({ lesson_url: null })] },
		}
		const wrapper = await open()
		const item = wrapper.find('[data-testid="homework-row"]')
		expect(item.find('a').exists()).toBe(false)
		expect(item.html()).not.toContain('hover:')
	})

	it('says there is no homework yet', async () => {
		answers[URL] = { ok: true, data: { space: 'org-1', items: [] } }
		const wrapper = await open()
		expect(wrapper.find('[data-testid="homework-empty"]').text()).toContain(
			'No homework yet'
		)
	})
})

describe('the tutor\'s tabs', () => {
	beforeEach(() => {
		answers[URL] = { ok: true, data: { space: 'org-1', items: [] } }
	})

	it('offers a learner no tabs', async () => {
		const wrapper = await open()
		expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
		expect(wrapper.find('h1').text()).toBe('Mine')
	})

	it('keeps a learner on their own list whatever the address says', async () => {
		route.query = { tab: 'queue' }
		const wrapper = await open()
		expect(wrapper.find('[data-testid="queue"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="homework-empty"]').exists()).toBe(true)
	})

	it('gives a tutor both lists', async () => {
		user.data = { roles: ['Organization Manager'] }
		const wrapper = await open()
		const tabs = wrapper.findAll('[role="tab"]')
		expect(tabs.map((tab) => tab.text())).toEqual(['Mine', 'Awaiting review'])
		expect(tabs[0].attributes('aria-selected')).toBe('true')

		await tabs[1].trigger('click')
		await flushPromises()
		expect(router.replace).toHaveBeenCalledWith({
			query: { tab: 'queue' },
		})
		expect(wrapper.find('[data-testid="queue"]').exists()).toBe(true)
		expect(
			wrapper.findAll('[role="tab"]')[1].attributes('aria-selected')
		).toBe('true')
	})

	it('moves between the tabs with the arrows', async () => {
		user.data = { roles: [], is_moderator: 1 }
		const wrapper = await open()
		await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'End' })
		await flushPromises()
		expect(route.query).toEqual({ tab: 'queue' })
	})

	it('opens the queue and the card from the address', async () => {
		user.data = { roles: [], is_instructor: 1 }
		route.query = { tab: 'queue' }
		let wrapper = await open()
		expect(wrapper.find('[data-testid="queue"]').exists()).toBe(true)
		// The queue does not ask for the tutor's own homework.
		expect(reloads).toEqual([])

		route.query = { tab: 'queue', submission: 'HS-9' }
		wrapper = await open()
		expect(wrapper.find('[data-testid="queue"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="card"]').text()).toBe('HS-9')
	})
})
