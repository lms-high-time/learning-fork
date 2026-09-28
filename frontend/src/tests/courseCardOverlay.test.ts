import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// learning-services#301: an enrolled student continues straight into the
// agent session on the next open lesson; without an answer from
// lms_frappe_app the reader link stays.

const entryResource = reactive<{ data: unknown; fetch: ReturnType<typeof vi.fn> }>({
	data: null,
	fetch: vi.fn(() => Promise.resolve()),
})

// The learner's space (learning-services#347): a personal space with no
// organization, which is Learning as it was before spaces.
vi.mock('@/stores/space', () => ({
	PERSONAL: 'personal',
	useSpace: () => ({
		load: () => Promise.resolve(),
		paramFor: () => 'personal',
		enrolFor: () => 'personal',
		isOrganization: false,
		hasOrganizations: false,
		current: 'personal',
		spaces: [],
		myCourseIds: [],
		catalogIds: [],
	}),
}))

vi.mock('frappe-ui', () => ({
	createResource: (config: { url: string }) =>
		config.url === 'lms_frappe_app.api.public.lesson_entry'
			? entryResource
			: reactive({ data: null, fetch: vi.fn() }),
	call: vi.fn(() => Promise.resolve()),
	toast: { success: vi.fn(), warning: vi.fn() },
	Badge: { template: '<span><slot /></span>' },
	Button: { template: '<button><slot name="prefix" /><slot /></button>' },
}))
vi.mock('frappe-ui/frappe', () => ({ useTelemetry: () => ({ capture: vi.fn() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import CourseCardOverlay from '@/components/CourseCardOverlay.vue'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, number) =>
				typeof args[number] !== 'undefined' ? String(args[number]) : match
			),
	}
}

const mountOverlay = () =>
	mount(CourseCardOverlay, {
		props: {
			course: {
				data: {
					name: 'course-1',
					membership: { name: 'enr-1' },
					current_lesson: '1-1',
					instructors: [],
					lessons: 2,
				},
			} as never,
		},
		global: {
			mocks: { __ },
			provide: { $user: { data: { name: 'pupil@example.com' } } },
			stubs: {
				VideoPreview: true,
				CertificationLinks: true,
				RouterLink: { template: '<a data-testid="reader"><slot /></a>' },
			},
		},
	})

beforeEach(() => {
	vi.stubGlobal('__', __)
	entryResource.data = null
	entryResource.fetch.mockClear()
})

describe('CourseCardOverlay for an enrolled student', () => {
	it('asks for the next open lesson of this course', async () => {
		mountOverlay()
		await flushPromises()

		expect(entryResource.fetch).toHaveBeenCalled()
	})

	it('continues straight into the agent session', async () => {
		entryResource.data = {
			ok: true,
			data: {
				title: 'Цели и источники',
				completed: false,
				study: { channel: 'web', url: 'https://lms.example.com/chat?lesson=l-2' },
			},
		}
		const wrapper = mountOverlay()
		await flushPromises()

		expect(wrapper.get('[data-testid="course-study"]').attributes('href')).toBe(
			'https://lms.example.com/chat?lesson=l-2'
		)
		expect(wrapper.text()).toContain('Continue with the agent')
		expect(wrapper.text()).toContain('Next: Цели и источники')
		expect(wrapper.find('[data-testid="reader"]').exists()).toBe(false)
	})

	it('sends to the own-agent page once the trial lessons are used up', async () => {
		entryResource.data = {
			ok: true,
			data: {
				title: 'Цели и источники',
				completed: false,
				study: { channel: 'agent', url: '/agent' },
			},
		}
		const wrapper = mountOverlay()
		await flushPromises()

		expect(wrapper.get('[data-testid="course-study"]').attributes('href')).toBe(
			'/agent'
		)
		expect(wrapper.text()).toContain('Connect your agent')
	})

	it('keeps the reader link while there is no answer', async () => {
		const wrapper = mountOverlay()
		await flushPromises()

		expect(wrapper.find('[data-testid="course-study"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="reader"]').exists()).toBe(true)
	})
})
