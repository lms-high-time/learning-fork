import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// learning-services#636: the course page as a student's path, not a shop
// window — and a visitor's page without the outline flashing before the map.

const { maps, stub } = vi.hoisted(() => ({
	maps: [] as {
		data: unknown
		error: unknown
		fetched: boolean
		reset: () => void
	}[],
	stub: (name: string, template = '<div />') => ({
		default: { name, props: ['membership', 'path'], template },
	}),
}))

vi.mock('@/stores/space', () => ({
	PERSONAL: 'personal',
	useSpace: () => ({
		load: () => Promise.resolve(),
		paramFor: () => 'personal',
		enrolFor: () => 'personal',
	}),
}))
vi.mock('frappe-ui', () => ({
	Badge: { template: '<span><slot /></span>' },
	call: vi.fn(() => Promise.resolve()),
	createResource: (opts: { url: string }) => {
		const resource = reactive({
			url: opts.url,
			data: null as unknown,
			error: null as unknown,
			fetched: false,
			loading: false,
			fetch: vi.fn(() => Promise.resolve()),
			reset() {
				resource.data = null
				resource.error = null
				resource.fetched = false
			},
		})
		if (opts.url === 'lms_frappe_app.api.public.course_map') maps.push(resource)
		return resource
	},
}))
vi.mock('vue-router', () => ({
	useRoute: () => ({ query: {} }),
	useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/utils/', () => ({
	formatAmount: (a: unknown) => String(a),
	formatRating: (r: unknown) => String(r),
}))

vi.mock('@/components/CourseCardOverlay.vue', () => stub('CourseCardOverlay'))
vi.mock('@/components/CourseDocumentCard.vue', () => stub('CourseDocumentCard'))
vi.mock('@/components/CourseOutline.vue', () =>
	stub('CourseOutline', '<div data-testid="outline" />')
)
vi.mock('@/components/SkeletonLoader.vue', () => stub('SkeletonLoader'))
vi.mock('@/components/CourseReviews.vue', () =>
	stub('CourseReviews', '<div data-testid="reviews" />')
)
vi.mock('@/components/CourseInstructors.vue', () => stub('CourseInstructors'))
vi.mock('@/components/UserAvatar.vue', () => stub('UserAvatar'))
vi.mock('@/components/RelatedCourses.vue', () => stub('RelatedCourses'))
vi.mock('@/components/CourseProgram/CourseChapters.vue', () =>
	stub('CourseChapters', '<div data-testid="course-chapters" />')
)

import CourseOverview from '@/pages/Courses/CourseOverview.vue'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, number) =>
				typeof args[number] !== 'undefined' ? String(args[number]) : match
			),
	}
}
vi.stubGlobal('__', __)

const program = (passed: boolean) => ({
	data: {
		course: 'c-1',
		title: 'Курс',
		next_lesson: passed ? 'l-2' : 'l-1',
		chapters: [
			{
				title: 'Глава',
				status: passed ? 'passed' : 'in_progress',
				lessons_total: 1,
				lessons_passed: passed ? 1 : 0,
				lessons: [
					{
						id: 'l-1',
						number: 1,
						title: 'Урок',
						hook: null,
						objectives: [],
						completed: passed,
					},
				],
			},
			{
				title: 'Вторая',
				status: 'not_started',
				lessons_total: 1,
				lessons_passed: 0,
				lessons: [
					{
						id: 'l-2',
						number: 2,
						title: 'Урок 2',
						hook: null,
						objectives: [],
						completed: false,
					},
				],
			},
		],
	},
})

const course = (membership: boolean) => ({
	data: {
		name: 'c-1',
		title: 'Курс',
		enrollments: 4,
		instructors: [],
		short_introduction: 'Коротко',
		description:
			'<p>Опора — [patterns.sociocracy30.org](https://patterns.sociocracy30.org/), CC BY-SA.</p>',
		membership: membership ? { name: 'm-1', progress: 0 } : null,
	},
})

const open = async (membership: boolean) => {
	const wrapper = mount(CourseOverview, {
		props: { course: course(membership) as never },
		global: {
			provide: { $user: { data: { name: 'a@b.c' } } },
			mocks: { __ },
			directives: {
				'safe-html': (el: HTMLElement, binding: { value: string }) => {
					el.innerHTML = binding.value
				},
			},
		},
	})
	await flushPromises()
	return wrapper
}

// The map answers: what frappe-ui sets once a request comes back.
const answer = (data: unknown) => {
	maps[0].data = data
	maps[0].fetched = true
}

beforeEach(() => {
	maps.length = 0
})

describe('the course page (#636)', () => {
	it('waits for the map rather than flashing the outline', async () => {
		const wrapper = await open(false)
		expect(wrapper.find('[data-testid="outline"]').exists()).toBe(false)
		expect(
			wrapper.find('[data-testid="course-program-loading"]').exists()
		).toBe(true)
		answer(program(false))
		await flushPromises()
		expect(wrapper.find('[data-testid="course-chapters"]').exists()).toBe(true)
	})

	it('settles on an empty answer rather than waiting for good', async () => {
		const wrapper = await open(false)
		answer(null)
		await flushPromises()
		expect(
			wrapper.find('[data-testid="course-program-loading"]').exists()
		).toBe(false)
	})

	it('drops the last course’s map when another course opens', async () => {
		const props = reactive({ course: course(true) })
		const wrapper = mount(CourseOverview, {
			props: props as never,
			global: {
				provide: { $user: { data: { name: 'a@b.c' } } },
				mocks: { __ },
				directives: { 'safe-html': () => {} },
			},
		})
		await flushPromises()
		answer(program(false))
		await flushPromises()
		expect(wrapper.find('[data-testid="course-chapters"]').exists()).toBe(true)
		const next = course(true)
		next.data.name = 'c-2'
		await wrapper.setProps({ course: next } as never)
		await flushPromises()
		expect(wrapper.find('[data-testid="course-chapters"]').exists()).toBe(false)
		expect(
			wrapper.find('[data-testid="course-program-loading"]').exists()
		).toBe(true)
		const card = wrapper.findAllComponents({ name: 'CourseCardOverlay' })[0]
		expect(card.props('path')).toBeNull()
	})

	it('falls back to the outline when the map cannot come', async () => {
		const wrapper = await open(false)
		maps[0].error = new Error('no app')
		await flushPromises()
		expect(
			wrapper.find('[data-testid="course-program-loading"]').exists()
		).toBe(false)
		expect(wrapper.text()).toContain('Course content')
	})

	it('turns a Markdown link in the description into a link', async () => {
		const wrapper = await open(false)
		const link = wrapper.get('[data-testid="course-about"] a')
		expect(link.attributes('href')).toBe('https://patterns.sociocracy30.org/')
		expect(link.text()).toBe('patterns.sociocracy30.org')
		expect(wrapper.text()).not.toContain('](')
	})

	it('keeps «About» open and the student count for a visitor', async () => {
		const wrapper = await open(false)
		expect(wrapper.get('[data-testid="course-about"]').attributes('open')).toBe(
			''
		)
		expect(wrapper.text()).toContain('4 students')
	})

	it('folds «About» and drops the student count for a student', async () => {
		const wrapper = await open(true)
		expect(
			wrapper.get('[data-testid="course-about"]').attributes('open')
		).toBeUndefined()
		expect(wrapper.text()).not.toContain('students')
	})

	it('hands the course card where the student is', async () => {
		const wrapper = await open(true)
		answer(program(false))
		await flushPromises()
		const card = wrapper.findAllComponents({ name: 'CourseCardOverlay' })[0]
		expect(card.props('path')).toMatchObject({
			passed: 0,
			total: 2,
			chapter: 1,
		})
	})

	it('asks for a review only once a chapter is passed', async () => {
		const wrapper = await open(true)
		answer(program(false))
		await flushPromises()
		const reviews = () =>
			wrapper.findComponent({ name: 'CourseReviews' }).props('membership')
		expect(reviews()).toBeNull()
		answer(program(true))
		await flushPromises()
		expect(reviews()).toMatchObject({ name: 'm-1' })
	})
})
