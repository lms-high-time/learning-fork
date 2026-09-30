import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// The tutor's card of one submission (learning-services#452): the assignment,
// the answer, what changed since the last review, and the actions the server
// offers.

const answers: Record<string, unknown> = {}
const fetched: { url: string; params: unknown }[] = []
const reloaded: string[] = []
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock('frappe-ui', () => ({
	createResource: (config: { url: string; makeParams?: () => unknown }) => {
		const resource = reactive({
			data: null as unknown,
			fetch: vi.fn(async () => {
				fetched.push({ url: config.url, params: config.makeParams?.() })
				resource.data = answers[config.url] ?? null
			}),
			reload: vi.fn(async () => {
				reloaded.push(config.url)
				resource.data = answers[config.url] ?? null
			}),
		})
		return resource
	},
	toast,
	LoadingIndicator: { template: '<span />' },
	Button: {
		props: ['label', 'loading', 'variant', 'disabled', 'type', 'theme'],
		template:
			'<button :type="type || \'button\'" :disabled="disabled">{{ label }}<slot /></button>',
	},
	// The real Dialog's contract: open by v-model:open, the body in the default
	// slot, each action a button whose onClick gets `close`.
	Dialog: {
		props: ['open', 'title', 'message', 'actions'],
		emits: ['update:open'],
		template: `<div v-if="open" data-testid="dialog">
			<h3>{{ title }}</h3><p>{{ message }}</p><slot />
			<button
				v-for="a in actions"
				:key="a.label"
				data-testid="dialog-action"
				:disabled="a.disabled"
				@click="a.onClick({ close: () => $emit('update:open', false) })"
			>{{ a.label }}</button>
		</div>`,
	},
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: 'tutor@x' }),
}))

import HomeworkReview from '@/components/Homework/HomeworkReview.vue'
import type { ReviewCard } from '@/utils/homework'

const READ = 'lms_frappe_app.api.review.submission'

const card = (overrides: Partial<ReviewCard> = {}): ReviewCard => ({
	submission: {
		id: 'HS-1',
		status: 'Submitted',
		due_at: '2030-01-15 23:59:59',
		overdue: false,
		version: 2,
		assigned_at: '2030-01-10 10:00:00',
		submitted_at: '2030-01-12 12:00:00',
		answer: 'Провёл две встречи',
		files: [
			{
				id: 'F-2',
				name: 'minutes.pdf',
				type: 'application/pdf',
				size: 2048,
				uploaded_at: '2030-01-12 12:00:00',
				url: '/private/files/minutes.pdf',
			},
		],
		history: [
			{
				event: 'returned',
				by: 'tutor@x',
				by_name: 'Тьютор',
				at: '2030-01-11 09:00:00',
				version: 1,
				comment: 'Нет протокола',
				due_at: null,
			},
			{
				event: 'submitted',
				by: null,
				by_name: 'Анна Ученица',
				at: '2030-01-12 12:00:00',
				version: 2,
				comment: null,
				due_at: null,
			},
		],
		versions: [
			{
				version: 1,
				saved_at: '2030-01-10 12:00:00',
				answer: 'Провёл встречу',
				files: [
					{
						id: 'F-1',
						name: 'draft.pdf',
						type: 'application/pdf',
						size: 1024,
						uploaded_at: '2030-01-10 12:00:00',
						url: '/private/files/draft.pdf',
					},
				],
			},
			{
				version: 2,
				saved_at: '2030-01-12 12:00:00',
				answer: 'Провёл две встречи',
				files: [],
			},
		],
	},
	homework: {
		lesson: 'L1',
		title: 'Встреча со спонсором',
		description: 'Проведите **встречу**.',
		answer_mode: 'text_and_files',
		due: { mode: 'relative', days: 5, date: null },
	},
	student: { name: 'Анна Ученица' },
	course: 'c-1',
	course_title: 'Проектный менеджмент',
	lesson: 'L1',
	lesson_title: 'Спонсор',
	lesson_url: '/lms/courses/c-1/learn/1-2',
	organization: 'org-1',
	organization_title: 'Кофейни',
	reviewed_version: 1,
	actions: ['accept', 'send_back'],
	...overrides,
})

const serve = (value: ReviewCard) => {
	answers[READ] = { ok: true, data: value }
}

const serverAnswers = (message: unknown) =>
	({ ok: true, status: 200, json: async () => ({ message }) } as Response)

let fetchMock: ReturnType<typeof vi.spyOn>

const open = async (id = 'HS-1') => {
	const wrapper = mount(HomeworkReview, {
		props: { submission: id },
		global: {
			mocks: { __: (globalThis as any).__ },
			stubs: {
				'router-link': {
					props: ['to'],
					template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
				},
			},
		},
	})
	await flushPromises()
	return wrapper
}

const button = (wrapper: Awaited<ReturnType<typeof open>>, label: string) =>
	wrapper.findAll('button').find((b) => b.text() === label)

beforeEach(() => {
	for (const key of Object.keys(answers)) delete answers[key]
	fetched.length = 0
	reloaded.length = 0
	toast.error.mockReset()
	toast.success.mockReset()
	fetchMock = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(serverAnswers({ ok: true, data: card() }))
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('HomeworkReview', () => {
	it('asks for the submission it shows', async () => {
		serve(card())
		await open('HS-7')
		expect(fetched).toEqual([{ url: READ, params: { submission: 'HS-7' } }])
	})

	it('shows the assignment, the learner and the answer', async () => {
		serve(card())
		const wrapper = await open()
		const text = wrapper.text()
		expect(text).toContain('Встреча со спонсором')
		expect(text).toContain('Анна Ученица')
		expect(text).toContain('Проектный менеджмент · Спонсор')
		expect(text).toContain('Кофейни')
		expect(text).toContain('Submitted')
		expect(wrapper.find('[data-testid="review-answer"]').text()).toBe(
			'Провёл две встречи'
		)
		expect(wrapper.find('strong').text()).toBe('встречу')
		expect(text).toContain('minutes.pdf')
		// The lesson itself, not the tutor's own homework block under it.
		const lesson = wrapper.find('[data-testid="review-lesson"]')
		expect(JSON.parse(lesson.attributes('data-to')!)).toBe(
			'/courses/c-1/learn/1-2'
		)
	})

	it('compares the answer with the version reviewed last', async () => {
		serve(card())
		const wrapper = await open()
		const diff = wrapper.find('[data-testid="homework-diff"]')
		expect(diff.text()).toContain('Changes since version 1')
		expect(diff.find('del').text()).toBe('встречу')
		expect(diff.find('ins').text()).toBe('две встречи')
		expect(diff.find('[data-testid="diff-added"]').text()).toContain(
			'minutes.pdf'
		)
		expect(diff.find('[data-testid="diff-removed"]').text()).toContain(
			'draft.pdf'
		)
	})

	it('compares nothing before the first review, or when it is the same', async () => {
		serve(card({ reviewed_version: null }))
		expect((await open()).find('[data-testid="homework-diff"]').exists()).toBe(
			false
		)
		serve(card({ reviewed_version: 2 }))
		expect((await open()).find('[data-testid="homework-diff"]').exists()).toBe(
			false
		)
	})

	it('shows the journal and the versions', async () => {
		serve(card())
		const wrapper = await open()
		const summaries = wrapper.findAll('details > summary').map((s) => s.text())
		expect(summaries).toContain('History')
		expect(summaries).toContain('Versions')
		const rows = wrapper.findAll('details li').map((row) => row.text())
		expect(rows[0]).toContain('Returned for revision · You ·')
		expect(rows[1]).toContain('Submitted · Анна Ученица ·')
	})

	it('offers the actions the server gives, and no others', async () => {
		serve(card())
		let wrapper = await open()
		expect(button(wrapper, 'Accept')).toBeTruthy()
		expect(button(wrapper, 'Return for revision')).toBeTruthy()
		expect(button(wrapper, 'Cancel acceptance')).toBeFalsy()

		serve(card({ actions: ['reopen'] }))
		wrapper = await open()
		expect(button(wrapper, 'Accept')).toBeFalsy()
		expect(button(wrapper, 'Cancel acceptance')).toBeTruthy()

		serve(card({ actions: [] }))
		wrapper = await open()
		expect(wrapper.find('[data-testid="review-actions"]').exists()).toBe(false)
	})

	it('accepts the version on screen', async () => {
		serve(card())
		const wrapper = await open()
		await button(wrapper, 'Accept')!.trigger('click')
		await flushPromises()

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
		expect(url).toBe('/api/method/lms_frappe_app.api.review.accept')
		const form = init.body as FormData
		expect(form.get('submission')).toBe('HS-1')
		expect(form.get('version')).toBe('2')
		expect(form.has('comment')).toBe(false)
		expect(toast.success).toHaveBeenCalledWith('Homework accepted')
		expect(reloaded).toContain(READ)
	})

	it('returns with a comment, and not without one', async () => {
		serve(card())
		const wrapper = await open()
		await button(wrapper, 'Return for revision')!.trigger('click')
		const dialog = wrapper.find('[data-testid="dialog"]')
		const send = dialog.find('[data-testid="dialog-action"]')
		expect(send.attributes('disabled')).toBeDefined()
		await dialog.find('textarea').setValue('   ')
		expect(send.attributes('disabled')).toBeDefined()

		await dialog.find('textarea').setValue('Добавьте решения')
		expect(send.attributes('disabled')).toBeUndefined()
		await send.trigger('click')
		await flushPromises()

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
		expect(url).toBe('/api/method/lms_frappe_app.api.review.send_back')
		expect((init.body as FormData).get('comment')).toBe('Добавьте решения')
		expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false)
	})

	it('cancels an acceptance with a comment', async () => {
		serve(card({ actions: ['reopen'] }))
		const wrapper = await open()
		await button(wrapper, 'Cancel acceptance')!.trigger('click')
		const dialog = wrapper.find('[data-testid="dialog"]')
		await dialog.find('textarea').setValue('Нет подписи')
		await dialog.find('[data-testid="dialog-action"]').trigger('click')
		await flushPromises()
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
		expect(url).toBe('/api/method/lms_frappe_app.api.review.reopen')
		expect((init.body as FormData).get('comment')).toBe('Нет подписи')
	})

	it('reads the card again when the learner saved a new version', async () => {
		serve(card())
		fetchMock.mockResolvedValue(
			serverAnswers({
				ok: false,
				error: { code: 'stale_version', message: 'x', version: 3 },
			})
		)
		const wrapper = await open()
		await button(wrapper, 'Accept')!.trigger('click')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith(
			'The learner saved a new version. Look at it first.'
		)
		expect(reloaded).toContain(READ)
	})

	it('says why the server refused, and reads again when it changed', async () => {
		serve(card())
		fetchMock.mockResolvedValue(
			serverAnswers({
				ok: false,
				error: { code: 'wrong_status', message: 'Сдачу уже проверили' },
			})
		)
		const wrapper = await open()
		await button(wrapper, 'Accept')!.trigger('click')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith('Сдачу уже проверили')
		expect(reloaded).toContain(READ)

		reloaded.length = 0
		fetchMock.mockResolvedValue(
			serverAnswers({
				ok: false,
				error: { code: 'not_allowed', message: 'Нет права' },
			})
		)
		await button(wrapper, 'Accept')!.trigger('click')
		await flushPromises()
		expect(toast.error).toHaveBeenLastCalledWith('Нет права')
		expect(reloaded).toEqual([])
	})

	it('says when the submission cannot be read', async () => {
		answers[READ] = {
			ok: false,
			error: { code: 'not_allowed', message: 'Нет доступа к сдаче' },
		}
		const wrapper = await open()
		expect(wrapper.find('[data-testid="review-error"]').text()).toBe(
			'Нет доступа к сдаче'
		)
	})

	it('leads back to the queue', async () => {
		serve(card())
		const wrapper = await open()
		const back = wrapper.find('[data-testid="review-back"]')
		expect(JSON.parse(back.attributes('data-to')!)).toEqual({
			name: 'Homework',
			query: { tab: 'queue' },
		})
	})
})
