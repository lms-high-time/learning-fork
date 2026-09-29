import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// One page of a program for everyone: the path in steps and one action
// (learning-services#417).

const detailsResource = reactive<{
	data: unknown
	error: unknown
	reload: ReturnType<typeof vi.fn>
}>({ data: null, error: null, reload: vi.fn(() => Promise.resolve()) })
const calls: { method: string; params: unknown }[] = []

vi.mock('frappe-ui', () => ({
	createResource: () => detailsResource,
	call: vi.fn(async (method: string, params: unknown) => {
		calls.push({ method, params })
		return { ok: true }
	}),
	toast: { success: vi.fn(), error: vi.fn() },
	usePageMeta: vi.fn(),
	Badge: { template: '<span data-testid="badge"><slot /></span>' },
	Button: { template: '<button><slot /></button>' },
}))
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))
vi.mock('@/components/ProgressBar.vue', () => ({
	default: { template: '<div />' },
}))

import ProgramDetail from '@/pages/Programs/ProgramDetail.vue'
import {
	nextStep,
	stepStatus,
	type ProgramDetails,
} from '@/utils/learningProgram'

const __ = (message: string) =>
	Object.assign(new String(message), {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (_, i) => String(args[Number(i)])),
	})

const program = (over: Partial<ProgramDetails> = {}): ProgramDetails => ({
	name: 'Операционное управление',
	title: 'Операционное управление',
	description: 'Для руководителей отделов.',
	enforce_course_order: 1,
	is_member: false,
	progress: 0,
	courses: [
		{ name: 'c-1', title: 'Стыки', upcoming: 1, eligible: true },
		{ name: 'c-2', title: 'Признаки', upcoming: 1, eligible: false },
	],
	...over,
})

const open = async (user: unknown = { data: { name: 'pupil@x' } }) => {
	const wrapper = mount(ProgramDetail, {
		props: { programName: 'Операционное управление' },
		global: {
			mocks: { __ },
			provide: { $user: user },
			stubs: {
				RouterLink: {
					props: ['to'],
					template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
				},
			},
		},
	})
	await flushPromises()
	return wrapper
}

beforeEach(() => {
	vi.stubGlobal('__', __)
	calls.length = 0
	detailsResource.data = null
	detailsResource.reload.mockClear()
})

describe('the steps of a program', () => {
	const base = program({
		is_member: true,
		courses: [
			{ name: 'a', title: 'A', eligible: true, membership: { progress: 100 } },
			{ name: 'b', title: 'B', eligible: true, membership: { progress: 40 } },
			{ name: 'c', title: 'C', eligible: false },
			{ name: 'd', title: 'D', upcoming: 1, eligible: false },
		],
	})

	it('names each step by where the member stands', () => {
		expect(base.courses.map((c) => stepStatus(c, base))).toEqual([
			'completed',
			'in_progress',
			'locked',
			'upcoming',
		])
	})

	it('does not shut a step for someone outside the program', () => {
		const outside = { ...base, is_member: false }
		expect(stepStatus(base.courses[2], outside)).toBe('open')
	})

	it('leads a member to the first course they can take', () => {
		expect(nextStep(base)?.name).toBe('b')
	})
})

describe('the program page', () => {
	it('shows the path to someone who has not joined, with one way in', async () => {
		detailsResource.data = program()
		const wrapper = await open()

		expect(wrapper.get('[data-testid="program-description"]').text()).toBe(
			'Для руководителей отделов.'
		)
		expect(wrapper.get('[data-testid="program-step-2"]').text()).toContain(
			'Признаки'
		)
		expect(wrapper.find('[data-testid="program-join"]').exists()).toBe(true)
		expect(
			wrapper.find('[data-testid="program-upcoming-note"]').exists()
		).toBe(true)
	})

	it('joining asks to hear when the first course opens', async () => {
		detailsResource.data = program()
		const wrapper = await open()

		await wrapper.get('[data-testid="program-join"]').trigger('click')
		await flushPromises()

		expect(calls).toEqual([
			{
				method: 'lms.lms.utils.enroll_in_program',
				params: { program: 'Операционное управление' },
			},
			{
				method: 'lms_frappe_app.api.student.notify_when_released',
				params: { course: 'c-1' },
			},
		])
		expect(detailsResource.reload).toHaveBeenCalled()
	})

	it('sends a guest to log in rather than offering to join', async () => {
		detailsResource.data = program()
		const wrapper = await open({ data: null })

		expect(wrapper.find('[data-testid="program-join"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="program-login"]').exists()).toBe(true)
	})

	it('offers a member the next course to go on with', async () => {
		detailsResource.data = program({
			is_member: true,
			courses: [
				{ name: 'c-1', title: 'Стыки', eligible: true, membership: { progress: 30 } },
				{ name: 'c-2', title: 'Признаки', eligible: false },
			],
		})
		const wrapper = await open()

		expect(wrapper.get('[data-testid="program-continue"]').text()).toContain(
			'Continue: Стыки'
		)
		expect(wrapper.find('[data-testid="program-join"]').exists()).toBe(false)
	})
})
