import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// learning-services#301: an enrolled student continues straight into the
// agent session on the next open lesson; without an answer from
// lms_frappe_app the reader link stays.

const entryResource = reactive<{
	data: unknown
	fetch: ReturnType<typeof vi.fn>
}>({
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

const programsResource = reactive<{
	data: unknown
	fetch: ReturnType<typeof vi.fn>
}>({
	data: null,
	fetch: vi.fn(() => Promise.resolve()),
})

vi.mock('frappe-ui', () => ({
	createResource: (config: { url: string }) =>
		config.url === 'lms_frappe_app.api.public.lesson_entry'
			? entryResource
			: config.url === 'lms_frappe_app.api.public.course_programs'
			? programsResource
			: reactive({ data: null, fetch: vi.fn() }),
	call: vi.fn(() => Promise.resolve()),
	toast: { success: vi.fn(), warning: vi.fn() },
	Badge: { template: '<span><slot /></span>' },
	Button: { template: '<button><slot name="prefix" /><slot /></button>' },
}))
vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import CourseCardOverlay from '@/components/CourseCardOverlay.vue'
import { call } from 'frappe-ui'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, number) =>
				typeof args[number] !== 'undefined' ? String(args[number]) : match
			),
	}
}

const mountOverlay = (path: Record<string, unknown> | null = null) =>
	mount(CourseCardOverlay, {
		props: {
			path: path as never,
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
				// `to` comes out as an attribute: a test can check where a link goes.
				RouterLink: {
					props: ['to'],
					template:
						'<a data-testid="reader" :data-to="JSON.stringify(to)"><slot /></a>',
				},
			},
		},
	})

beforeEach(() => {
	vi.stubGlobal('__', __)
	entryResource.data = null
	entryResource.fetch.mockClear()
	programsResource.data = null
})

describe('CourseCardOverlay in a program (#405)', () => {
	const program = (locked: boolean, { last = false } = {}) => ({
		ok: true,
		data: {
			programs: [
				{
					program: 'p-1',
					title: 'Работа между отделами',
					number: 2,
					total: 3,
					member: true,
					next: last ? null : { id: 'c-3', title: 'Недельный ритм' },
					locked_by: locked
						? { id: 'c-0', title: 'Где теряется работа' }
						: null,
				},
			],
		},
	})

	it('names the course the program goes on to (#443)', async () => {
		programsResource.data = program(false)
		const wrapper = mountOverlay()
		await flushPromises()

		const link = wrapper.get('[data-testid="course-program-next"]')
		expect(link.text()).toBe('Next course: «Недельный ритм»')
		expect(JSON.parse(link.attributes('data-to') ?? '{}')).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'c-3' },
		})
	})

	it('has no next course at the end of the program (#443)', async () => {
		programsResource.data = program(false, { last: true })
		const wrapper = mountOverlay()
		await flushPromises()

		expect(wrapper.find('[data-testid="course-program-next"]').exists()).toBe(
			false
		)
	})

	it('shows where the course stands in the program', async () => {
		programsResource.data = program(false)
		const wrapper = mountOverlay()
		await flushPromises()

		expect(wrapper.get('[data-testid="course-programs"]').text()).toContain(
			'Course 2 of 3 in the program «Работа между отделами»'
		)
		expect(wrapper.find('[data-testid="course-program-lock"]').exists()).toBe(
			false
		)
	})

	it('leaves an announcement to its release notice', async () => {
		programsResource.data = program(true)
		const wrapper = mount(CourseCardOverlay, {
			props: {
				course: {
					data: { name: 'course-2', upcoming: true, instructors: [] },
				} as never,
			},
			global: {
				mocks: { __ },
				provide: { $user: { data: { name: 'pupil@example.com' } } },
				stubs: {
					VideoPreview: true,
					CertificationLinks: true,
					RouterLink: { template: '<a><slot /></a>' },
				},
			},
		})
		await flushPromises()

		expect(wrapper.find('[data-testid="course-program-lock"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="course-notify"]').exists()).toBe(true)
		expect(wrapper.get('[data-testid="course-programs"]').text()).toContain(
			'Course 2 of 3'
		)
	})

	it('sends to the previous course instead of studying a shut one', async () => {
		programsResource.data = program(true)
		entryResource.data = {
			ok: true,
			data: {
				title: 'Цели',
				completed: false,
				study: {
					channel: 'web',
					url: 'https://lms.example.com/chat?lesson=l-2',
				},
			},
		}
		const wrapper = mountOverlay()
		await flushPromises()

		expect(wrapper.get('[data-testid="course-program-lock"]').text()).toContain(
			'first pass «Где теряется работа»'
		)
		expect(wrapper.find('[data-testid="course-study"]').exists()).toBe(false)
	})
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
				study: {
					channel: 'web',
					url: 'https://lms.example.com/chat?lesson=l-2',
				},
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

// learning-services#389: an announced course takes no enrolment; the card
// offers to write when it opens instead.
const mountAnnounced = (
	props: { notify?: boolean } = {},
	user: { data: { name: string } | null } = {
		data: { name: 'pupil@example.com' },
	}
) =>
	mount(CourseCardOverlay, {
		props: {
			course: {
				data: {
					name: 'course-ops',
					upcoming: 1,
					membership: null,
					instructors: [],
				},
			} as never,
			...props,
		},
		global: {
			mocks: { __ },
			provide: { $user: user },
			stubs: {
				VideoPreview: true,
				CertificationLinks: true,
				RouterLink: { template: '<a><slot /></a>' },
			},
		},
	})

describe('CourseCardOverlay for an announced course', () => {
	beforeEach(() => {
		vi.mocked(call).mockReset()
	})

	it('offers to notify instead of enrolling', () => {
		const wrapper = mountAnnounced()

		expect(wrapper.find('[data-testid="course-upcoming"]').exists()).toBe(true)
		expect(wrapper.text()).toContain('Course in the works')
		expect(wrapper.text()).not.toContain('Free')
		expect(wrapper.text()).not.toContain('Enroll Now')
		expect(wrapper.find('[data-testid="course-notify"]').exists()).toBe(true)
	})

	it('subscribes through the contract and says so', async () => {
		vi.mocked(call).mockResolvedValue({ ok: true, data: { notify: true } })
		const wrapper = mountAnnounced()

		await wrapper.get('[data-testid="course-notify"]').trigger('click')
		await flushPromises()

		expect(call).toHaveBeenCalledWith(
			'lms_frappe_app.api.student.notify_when_released',
			{ course: 'course-ops' }
		)
		expect(wrapper.find('[data-testid="course-notify"]').exists()).toBe(false)
		expect(wrapper.get('[data-testid="course-notify-done"]').text()).toContain(
			'pupil@example.com'
		)
	})

	it('unsubscribes and offers the button again', async () => {
		vi.mocked(call).mockResolvedValue({ ok: true, data: { notify: false } })
		const wrapper = mountAnnounced({ notify: true })

		await wrapper.get('[data-testid="course-unnotify"]').trigger('click')
		await flushPromises()

		expect(call).toHaveBeenCalledWith(
			'lms_frappe_app.api.student.notify_when_released',
			{ course: 'course-ops', notify: false }
		)
		expect(wrapper.find('[data-testid="course-notify"]').exists()).toBe(true)
	})

	it('shows the subscription the viewer already has', () => {
		const wrapper = mountAnnounced({ notify: true })

		expect(wrapper.find('[data-testid="course-notify"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="course-notify-done"]').exists()).toBe(
			true
		)
	})

	it('sends a guest to log in rather than calling the server', async () => {
		const wrapper = mountAnnounced({}, { data: null })

		await wrapper.get('[data-testid="course-notify"]').trigger('click')
		await flushPromises()

		expect(call).not.toHaveBeenCalled()
	})
})

describe('CourseCardOverlay: where the student is (#636)', () => {
	const entry = {
		ok: true,
		data: {
			title: 'Разобраться в напряжении',
			completed: false,
			study: { channel: 'web', url: 'https://lms.example.com/chat' },
		},
	}

	it('leads with the chapter and lesson, not the price', async () => {
		entryResource.data = entry
		const wrapper = mountOverlay({
			passed: 4,
			total: 21,
			chapters: 7,
			chapter: 2,
			lesson: 5,
			done: false,
			started: true,
		})
		await flushPromises()
		const path = wrapper.get('[data-testid="course-path"]')
		expect(path.text()).toContain('Chapter 2 of 7 · lesson 5 of 21')
		expect(path.text()).toContain('Lessons passed: 4 of 21')
		expect(wrapper.text()).not.toContain('Free')
		expect(wrapper.text()).toContain('Continue with the agent')
	})

	it('starts rather than continues before the first lesson', async () => {
		entryResource.data = entry
		const wrapper = mountOverlay({
			passed: 0,
			total: 21,
			chapters: 7,
			chapter: 1,
			lesson: 1,
			done: false,
			started: false,
		})
		await flushPromises()
		expect(wrapper.text()).toContain('Start with the agent')
	})

	it('continues a lesson already talked through, though none is closed', async () => {
		entryResource.data = entry
		const wrapper = mountOverlay({
			passed: 0,
			total: 21,
			chapters: 7,
			chapter: 1,
			lesson: 1,
			done: false,
			started: true,
		})
		await flushPromises()
		expect(wrapper.text()).toContain('Continue with the agent')
	})

	it('says the course is passed', async () => {
		const wrapper = mountOverlay({
			passed: 21,
			total: 21,
			chapters: 7,
			chapter: null,
			lesson: null,
			done: true,
			started: true,
		})
		await flushPromises()
		expect(wrapper.get('[data-testid="course-path"]').text()).toContain(
			'You have passed the course'
		)
	})

	it('shows a student no price even without the map', async () => {
		const wrapper = mountOverlay(null)
		await flushPromises()
		expect(wrapper.text()).not.toContain('Free')
	})
})
