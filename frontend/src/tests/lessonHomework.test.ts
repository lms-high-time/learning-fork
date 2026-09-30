import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// The homework block under a lesson (learning-services#439): what the learner
// sees and what one save sends.

const answers: Record<string, unknown> = {}
const fetched: { url: string; params: unknown }[] = []
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock('frappe-ui', () => ({
	createResource: (config: {
		url: string
		makeParams?: () => unknown
	}) => {
		const resource = reactive({
			data: null as unknown,
			fetch: vi.fn(async () => {
				fetched.push({ url: config.url, params: config.makeParams?.() })
				resource.data = answers[config.url] ?? null
			}),
			reload: vi.fn(async () => {
				resource.data = answers[config.url] ?? null
			}),
		})
		return resource
	},
	toast,
	Button: {
		props: ['label', 'loading', 'variant', 'disabled', 'type'],
		template:
			'<button :type="type || \'button\'" :disabled="disabled">{{ label }}<slot /></button>',
	},
}))

vi.mock('@/stores/space', () => ({
	PERSONAL: 'personal',
	useSpace: () => ({
		load: () => Promise.resolve(),
		paramFor: () => 'org-1',
	}),
}))

import LessonHomework from '@/components/Homework/LessonHomework.vue'
import type { LessonHomeworkData, Submission } from '@/utils/homework'

const URL = 'lms_frappe_app.api.student.homework'

const homework = (
	overrides: Partial<NonNullable<LessonHomeworkData['homework']>> = {}
) => ({
	lesson: 'L1',
	title: 'Встреча со спонсором',
	description: 'Проведите **встречу** и пришлите протокол.',
	answer_mode: 'text_and_files' as const,
	due: { mode: 'relative' as const, days: 5, date: null },
	...overrides,
})

const submission = (overrides: Partial<Submission> = {}): Submission => ({
	id: 'HS-1',
	status: 'Submitted',
	due_at: '2030-01-15 23:59:59',
	overdue: false,
	version: 1,
	assigned_at: '2030-01-10 10:00:00',
	submitted_at: '2030-01-11 12:00:00',
	answer: 'Провёл',
	files: [
		{
			id: 'F-1',
			name: 'protocol.pdf',
			type: 'application/pdf',
			size: 2048,
			uploaded_at: '2030-01-11 12:00:00',
			url: '/private/files/protocol.pdf',
		},
	],
	history: [
		{
			event: 'submitted',
			by: 'student@x',
			at: '2030-01-11 12:00:00',
			version: 1,
			comment: null,
			due_at: null,
		},
	],
	versions: [
		{
			version: 1,
			saved_at: '2030-01-11 12:00:00',
			answer: 'Провёл',
			files: [],
		},
	],
	...overrides,
})

const answer = (data: Partial<LessonHomeworkData>) => {
	answers[URL] = {
		ok: true,
		data: {
			space: 'org-1',
			lesson_url: '/lms/courses/c/learn/1-1',
			homework: null,
			submission: null,
			...data,
		},
	}
}

const mountBlock = async () => {
	const wrapper = mount(LessonHomework, {
		props: { lesson: 'L1', course: 'C1' },
		global: { mocks: { __: (globalThis as any).__ } },
	})
	await flushPromises()
	return wrapper
}

const fetchMock = vi.fn()

beforeEach(() => {
	for (const key of Object.keys(answers)) delete answers[key]
	fetched.length = 0
	toast.error.mockReset()
	toast.success.mockReset()
	fetchMock.mockReset()
	fetchMock.mockResolvedValue({
		ok: true,
		json: async () => ({ message: { ok: true, data: {} } }),
	})
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
	// setup.ts stubs `__` globally; unstubbing all takes it too.
	vi.stubGlobal('__', (message: string) => {
		if (!/{\d+}/.test(message)) return message
		return {
			format: (...args: unknown[]) =>
				message.replace(/{(\d+)}/g, (m, i) =>
					args[Number(i)] === undefined ? m : String(args[Number(i)])
				),
		}
	})
})

describe('LessonHomework', () => {
	it('asks for the lesson in the chosen space', async () => {
		answer({})
		await mountBlock()
		expect(fetched[0]).toEqual({
			url: URL,
			params: { lesson: 'L1', space: 'org-1' },
		})
	})

	it('draws nothing for a lesson without homework', async () => {
		answer({ homework: null })
		const wrapper = await mountBlock()
		expect(wrapper.find('[data-testid="lesson-homework"]').exists()).toBe(false)
	})

	it('draws nothing when the server refuses', async () => {
		answers[URL] = { ok: false, error: { code: 'not_enrolled', message: 'x' } }
		const wrapper = await mountBlock()
		expect(wrapper.find('[data-testid="lesson-homework"]').exists()).toBe(false)
	})

	it('shows the assignment, its deadline and the status', async () => {
		answer({ homework: homework() })
		const wrapper = await mountBlock()
		const block = wrapper.find('[data-testid="lesson-homework"]')
		expect(block.attributes('id')).toBe('homework')
		expect(block.text()).toContain('Встреча со спонсором')
		expect(block.text()).toContain('5 days after the lesson')
		expect(block.find('[data-testid="homework-status"]').text()).toBe(
			'Not submitted'
		)
		expect(block.find('strong').text()).toBe('встречу')
		expect(block.find('button[type="submit"]').text()).toBe('Hand in')
	})

	it('offers files alone for a files-only homework', async () => {
		answer({ homework: homework({ answer_mode: 'files' }) })
		const wrapper = await mountBlock()
		expect(wrapper.find('textarea').exists()).toBe(false)
		expect(wrapper.find('input[type="file"]').exists()).toBe(true)
	})

	it('offers text alone for a text-only homework', async () => {
		answer({ homework: homework({ answer_mode: 'text' }) })
		const wrapper = await mountBlock()
		expect(wrapper.find('textarea').exists()).toBe(true)
		expect(wrapper.find('input[type="file"]').exists()).toBe(false)
	})

	it('puts the tutor comment of a returned homework on top', async () => {
		answer({
			homework: homework(),
			submission: submission({
				status: 'Returned',
				overdue: true,
				history: [
					{
						event: 'returned',
						by: 'tutor@x',
						at: '2030-01-12 09:00:00',
						version: 1,
						comment: 'Добавьте решения встречи',
						due_at: null,
					},
				],
			}),
		})
		const wrapper = await mountBlock()
		expect(wrapper.find('[data-testid="homework-comment"]').text()).toContain(
			'Добавьте решения встречи'
		)
		expect(wrapper.find('[data-testid="homework-overdue"]').exists()).toBe(true)
		expect(wrapper.find('button[type="submit"]').text()).toBe('Save')
	})

	it('keeps an accepted homework read-only', async () => {
		answer({
			homework: homework(),
			submission: submission({
				status: 'Accepted',
				history: [
					{
						event: 'accepted',
						by: 'tutor@x',
						at: '2030-01-12 09:00:00',
						version: 1,
						comment: null,
						due_at: null,
					},
				],
			}),
		})
		const wrapper = await mountBlock()
		expect(wrapper.find('form').exists()).toBe(false)
		expect(wrapper.find('textarea').exists()).toBe(false)
		expect(wrapper.find('[data-testid="homework-accepted"]').text()).toContain(
			'tutor@x'
		)
		expect(wrapper.text()).toContain('Провёл')
	})

	it('sends the answer, the removed files and the new ones in one form', async () => {
		answer({ homework: homework(), submission: submission() })
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('Провёл, протокол ниже')
		await wrapper.find('[data-testid="homework-remove-F-1"]').trigger('click')
		const input = wrapper.find('input[type="file"]')
		const file = new File(['hi'], 'minutes.txt', { type: 'text/plain' })
		Object.defineProperty(input.element, 'files', { value: [file] })
		await input.trigger('change')
		await wrapper.find('form').trigger('submit')
		await flushPromises()

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('/api/method/lms_frappe_app.api.student.submit_homework')
		expect(init.method).toBe('POST')
		const form = init.body as FormData
		expect(form.get('lesson')).toBe('L1')
		expect(form.get('space')).toBe('org-1')
		expect(form.get('answer')).toBe('Провёл, протокол ниже')
		expect(JSON.parse(form.get('remove_files') as string)).toEqual(['F-1'])
		expect((form.getAll('file')[0] as File).name).toBe('minutes.txt')
		expect(toast.success).toHaveBeenCalled()
	})

	it('sends no text for a files-only homework', async () => {
		answer({ homework: homework({ answer_mode: 'files' }) })
		const wrapper = await mountBlock()
		const input = wrapper.find('input[type="file"]')
		const file = new File(['hi'], 'a.txt', { type: 'text/plain' })
		Object.defineProperty(input.element, 'files', { value: [file] })
		await input.trigger('change')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		const form = fetchMock.mock.calls[0][1].body as FormData
		expect(form.has('answer')).toBe(false)
		expect(form.getAll('file')).toHaveLength(1)
	})

	it('stops new files over the limit before sending', async () => {
		answer({ homework: homework() })
		const wrapper = await mountBlock()
		const input = wrapper.find('input[type="file"]')
		const big = new File(['x'], 'big.mov')
		Object.defineProperty(big, 'size', { value: 31 * 1024 * 1024 })
		Object.defineProperty(input.element, 'files', { value: [big] })
		await input.trigger('change')
		expect(wrapper.find('[data-testid="homework-too-large"]').exists()).toBe(
			true
		)
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('says what the server refused', async () => {
		answer({ homework: homework() })
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				message: {
					ok: false,
					error: { code: 'empty_answer', message: 'Ответ пуст' },
				},
			}),
		})
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('x')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith('Ответ пуст')
	})

	it('folds the history and the versions away', async () => {
		answer({ homework: homework(), submission: submission() })
		const wrapper = await mountBlock()
		const summaries = wrapper.findAll('details > summary').map((s) => s.text())
		expect(summaries).toContain('History')
		expect(summaries).toContain('Versions')
	})
})
