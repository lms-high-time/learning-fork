import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// The homework block under a lesson (learning-services#439): what the learner
// sees and what one save sends.

const answers: Record<string, unknown> = {}
const fetched: { url: string; params: unknown }[] = []
const resources: { reload: ReturnType<typeof vi.fn> }[] = []
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
		resources.push(resource)
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

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: 'student@x' }),
}))

import LessonHomework from '@/components/Homework/LessonHomework.vue'
import type {
	HomeworkEvent,
	LessonHomeworkData,
	Submission,
} from '@/utils/homework'

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

const event = (overrides: Partial<HomeworkEvent> = {}): HomeworkEvent => ({
	event: 'submitted',
	by: 'student@x',
	by_name: 'Анна Ученица',
	at: '2030-01-11 12:00:00',
	version: 1,
	comment: null,
	due_at: null,
	...overrides,
})

const tutor = { by: 'tutor@x', by_name: 'Тьютор Иванов' }

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
	history: [event()],
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

const serverAnswers = (message: unknown, status = 200) =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => ({ message }),
	}) as Response

let fetchMock: ReturnType<typeof vi.spyOn>

const attach = async (
	wrapper: Awaited<ReturnType<typeof mountBlock>>,
	file: File
) => {
	const input = wrapper.find('input[type="file"]')
	Object.defineProperty(input.element, 'files', {
		value: [file],
		configurable: true,
	})
	await input.trigger('change')
}

beforeEach(() => {
	for (const key of Object.keys(answers)) delete answers[key]
	fetched.length = 0
	resources.length = 0
	toast.error.mockReset()
	toast.success.mockReset()
	fetchMock = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(serverAnswers({ ok: true, data: {} }))
})

afterEach(() => {
	vi.restoreAllMocks()
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
					event({
						...tutor,
						event: 'returned',
						comment: 'Добавьте решения встречи',
					}),
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
					event({ ...tutor, event: 'accepted', at: '2030-01-12 09:00:00' }),
				],
			}),
		})
		const wrapper = await mountBlock()
		expect(wrapper.find('form').exists()).toBe(false)
		expect(wrapper.find('textarea').exists()).toBe(false)
		expect(wrapper.find('[data-testid="homework-accepted"]').text()).toBe(
			'Accepted · Тьютор Иванов · 12 января 2030 г., 09:00'
		)
		expect(wrapper.text()).toContain('Провёл')
	})

	it('sends the answer, the removed files and the new ones in one form', async () => {
		answer({ homework: homework(), submission: submission() })
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('Провёл, протокол ниже')
		await wrapper.find('[data-testid="homework-remove-F-1"]').trigger('click')
		await attach(
			wrapper,
			new File(['hi'], 'minutes.txt', { type: 'text/plain' })
		)
		await wrapper.find('form').trigger('submit')
		await flushPromises()

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
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
		await attach(wrapper, new File(['hi'], 'a.txt', { type: 'text/plain' }))
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		const form = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData
		expect(form.has('answer')).toBe(false)
		expect(form.getAll('file')).toHaveLength(1)
	})

	it('stops new files over the limit before sending', async () => {
		answer({ homework: homework() })
		const wrapper = await mountBlock()
		const big = new File(['x'], 'big.mov')
		Object.defineProperty(big, 'size', { value: 31 * 1024 * 1024 })
		await attach(wrapper, big)
		const warning = wrapper.find('[data-testid="homework-too-large"]')
		expect(warning.attributes('role')).toBe('alert')
		expect(
			wrapper.find('button[type="submit"]').attributes('aria-describedby')
		).toBe(warning.attributes('id'))
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('says what the server refused', async () => {
		answer({ homework: homework() })
		fetchMock.mockResolvedValue(
			serverAnswers({
				ok: false,
				error: { code: 'empty_answer', message: 'Ответ пуст' },
			})
		)
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('x')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith('Ответ пуст')
	})

	it('scrolls itself into view when the link names it', async () => {
		answer({ homework: homework() })
		const scrolled = vi.fn()
		const original = Element.prototype.scrollIntoView
		Element.prototype.scrollIntoView = scrolled
		window.location.hash = '#homework'
		try {
			const wrapper = mount(LessonHomework, {
				props: { lesson: 'L1', course: 'C1' },
				global: { mocks: { __: (globalThis as any).__ } },
				attachTo: document.body,
			})
			await flushPromises()
			expect(scrolled).toHaveBeenCalled()
			wrapper.unmount()
		} finally {
			window.location.hash = ''
			Element.prototype.scrollIntoView = original
		}
	})

	it('folds the history and the versions away', async () => {
		answer({ homework: homework(), submission: submission() })
		const wrapper = await mountBlock()
		const summaries = wrapper.findAll('details > summary').map((s) => s.text())
		expect(summaries).toContain('History')
		expect(summaries).toContain('Versions')
	})

	it('names people in the journal, and the reader as «You»', async () => {
		answer({
			homework: homework(),
			submission: submission({
				status: 'Returned',
				history: [
					event(),
					event({ ...tutor, event: 'returned', comment: 'Ещё раз' }),
				],
			}),
		})
		const wrapper = await mountBlock()
		const rows = wrapper.findAll('details li').map((row) => row.text())
		expect(rows[0]).toContain('Submitted · You ·')
		expect(rows[1]).toContain('Returned for revision · Тьютор Иванов ·')
		expect(wrapper.text()).not.toContain('tutor@x')
	})

	it('names the file a Detach button takes out', async () => {
		answer({ homework: homework(), submission: submission() })
		const wrapper = await mountBlock()
		expect(
			wrapper.find('[data-testid="homework-remove-F-1"]').attributes('aria-label')
		).toBe('Detach protocol.pdf')
	})

	it('keeps Hand in off while the answer is empty', async () => {
		answer({ homework: homework() })
		const wrapper = await mountBlock()
		const button = wrapper.find('button[type="submit"]')
		expect(button.attributes('disabled')).toBeDefined()
		await wrapper.find('textarea').setValue('   ')
		expect(button.attributes('disabled')).toBeDefined()
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(fetchMock).not.toHaveBeenCalled()
		await wrapper.find('textarea').setValue('Сделал')
		expect(button.attributes('disabled')).toBeUndefined()
	})

	it('sends once when the form is submitted twice', async () => {
		answer({ homework: homework() })
		let finish: (value: Response) => void = () => {}
		fetchMock.mockReturnValue(new Promise<Response>((r) => (finish = r)))
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('Сделал')
		await wrapper.find('form').trigger('submit')
		await wrapper.find('form').trigger('submit')
		finish(serverAnswers({ ok: true, data: {} }))
		await flushPromises()
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('says it could not save when the connection drops', async () => {
		answer({ homework: homework() })
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('Сделал')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith('Could not save the answer')
		expect(toast.success).not.toHaveBeenCalled()
	})

	it('says the files are too large when nginx turns them away', async () => {
		answer({ homework: homework() })
		fetchMock.mockResolvedValue(serverAnswers(null, 413))
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('Сделал')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith(
			'The files are too large to send at once'
		)
	})

	it('does not report a saved answer as failed when the read-back fails', async () => {
		answer({ homework: homework() })
		const wrapper = await mountBlock()
		resources[0].reload.mockRejectedValue(new Error('502'))
		await wrapper.find('textarea').setValue('Сделал')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(toast.success).toHaveBeenCalledWith('Homework submitted')
		expect(toast.error).not.toHaveBeenCalled()
	})

	it('starts the form over from the saved version', async () => {
		answer({ homework: homework(), submission: submission() })
		const wrapper = await mountBlock()
		await wrapper.find('textarea').setValue('Черновик')
		await attach(wrapper, new File(['hi'], 'minutes.txt'))
		answer({
			homework: homework(),
			submission: submission({ version: 2, answer: 'Сохранённый ответ' }),
		})
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(
			(wrapper.find('textarea').element as HTMLTextAreaElement).value
		).toBe('Сохранённый ответ')
		expect(wrapper.text()).not.toContain('minutes.txt')
	})

	it('ignores an answer for another lesson', async () => {
		answer({ homework: homework({ lesson: 'L2' }) })
		const wrapper = await mountBlock()
		expect(wrapper.find('[data-testid="lesson-homework"]').exists()).toBe(false)
	})
})
