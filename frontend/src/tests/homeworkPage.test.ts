import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// «Homework» (learning-services#439): the learner's homework of every course,
// each a way back to its lesson.

const answers: Record<string, unknown> = {}
const reloads: { url: string; params: unknown }[] = []

vi.mock('frappe-ui', () => ({
	createResource: (config: { url: string; makeParams?: () => unknown }) => {
		const resource = reactive({
			data: null as unknown,
			loading: false,
			fetch: vi.fn(async () => {
				reloads.push({ url: config.url, params: config.makeParams?.() })
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
	sessionStore: () => ({ isLoggedIn: true }),
}))

import Homework from '@/pages/Homework/Homework.vue'
import { lessonPath, type HomeworkRow } from '@/utils/homework'

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

beforeEach(() => {
	reloads.length = 0
	for (const key of Object.keys(answers)) delete answers[key]
})

describe('lessonPath', () => {
	it('takes the lesson route without the SPA base, to the homework block', () => {
		expect(lessonPath('/lms/courses/c-1/learn/1-2')).toBe(
			'/courses/c-1/learn/1-2#homework'
		)
		expect(lessonPath('https://x.test/lms/courses/c-1/learn/1-2')).toBe(
			'/courses/c-1/learn/1-2#homework'
		)
		expect(lessonPath('/study/courses/c-1/learn/1-2', 'study')).toBe(
			'/courses/c-1/learn/1-2#homework'
		)
		expect(lessonPath(null)).toBeNull()
	})
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

	it('says there is no homework yet', async () => {
		answers[URL] = { ok: true, data: { space: 'org-1', items: [] } }
		const wrapper = await open()
		expect(wrapper.find('[data-testid="homework-empty"]').text()).toContain(
			'No homework yet'
		)
	})
})
