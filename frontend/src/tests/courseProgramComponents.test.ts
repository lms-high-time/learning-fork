import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { centeredIndex, type ProgramData } from '@/utils/courseProgram'

// learning-services#322: the program's map, slide and slider as the student
// meets them.

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label', 'disabled'],
		template:
			'<button :aria-label="label" :disabled="disabled" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>',
	},
}))
vi.mock('vue-router', () => ({
	useRouter: () => ({
		resolve: (to: {
			params: { chapterNumber: number; lessonNumber: number }
		}) => ({
			href: `/lms/courses/course-1/learn/${to.params.chapterNumber}-${to.params.lessonNumber}`,
		}),
	}),
}))
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: false }),
}))

import ProgramMap from '@/components/CourseProgram/ProgramMap.vue'
import LessonSlide from '@/components/CourseProgram/LessonSlide.vue'
import CourseProgram from '@/components/CourseProgram/CourseProgram.vue'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, number) =>
				typeof args[number] !== 'undefined' ? String(args[number]) : match
			),
	}
}

const enrolled: ProgramData = {
	course: 'course-1',
	title: 'Риски проекта',
	next_lesson: 'l-3',
	chapters: [
		{
			title: 'Рамка',
			lessons: [
				{
					id: 'l-1',
					number: 1,
					title: 'Риск как событие',
					hook: 'Зачем это вам',
					completed: true,
					objectives: [{ text: 'a', status: 'covered' }],
				},
			],
		},
		{
			title: 'Выявление',
			lessons: [
				{
					id: 'l-2',
					number: 2,
					title: 'Цели и источники',
					hook: null,
					completed: false,
					objectives: [
						{ text: 'a', status: 'covered' },
						{ text: 'b', status: 'touched' },
						{ text: 'c' },
					],
				},
				{
					id: 'l-3',
					number: 3,
					title: 'Оценка и порог',
					hook: null,
					completed: false,
					objectives: [{ text: 'a' }, { text: 'b' }],
				},
			],
		},
	],
}

const guest: ProgramData = {
	...enrolled,
	next_lesson: undefined,
	chapters: enrolled.chapters.map((chapter) => ({
		...chapter,
		lessons: chapter.lessons.map(({ completed, ...lesson }) => ({
			...lesson,
			objectives: lesson.objectives.map(({ text }) => ({ text })),
		})),
	})),
}

const global = { mocks: { __ } }

beforeEach(() => {
	vi.stubGlobal('__', __)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('ProgramMap', () => {
	it('draws each lesson with its status and says it in words', () => {
		const wrapper = mount(ProgramMap, {
			props: { chapters: enrolled.chapters, nextLesson: 'l-3', current: 2 },
			global,
		})
		const dots = wrapper.findAll('button')

		expect(dots.map((dot) => dot.attributes('data-status'))).toEqual([
			'completed',
			'in-progress',
			'next',
		])
		expect(dots[1].attributes('aria-label')).toBe(
			'Lesson 2. Цели и источники — in progress — 1 of 3 topics'
		)
		expect(dots[2].attributes('aria-current')).toBe('step')
		expect(dots[2].attributes('data-next')).toBe('')
	})

	it('groups the dots by chapter without writing the titles out', () => {
		// learning-services#326: the titles over the dots looked poor; the
		// chapter is on the slide, and a hover still names the group.
		const wrapper = mount(ProgramMap, {
			props: { chapters: enrolled.chapters, nextLesson: 'l-3', current: 0 },
			global,
		})
		const groups = wrapper.findAll('[data-testid="map-chapter"]')
		expect(groups.map((g) => g.attributes('title'))).toEqual([
			'Рамка',
			'Выявление',
		])
		expect(groups.map((g) => g.findAll('button').length)).toEqual([1, 2])
		expect(wrapper.text()).not.toContain('Рамка')
	})

	it('reports the slide a dot stands for', async () => {
		const wrapper = mount(ProgramMap, {
			props: { chapters: enrolled.chapters, nextLesson: 'l-3', current: 0 },
			global,
		})
		await wrapper.findAll('button')[1].trigger('click')
		expect(wrapper.emitted('select')?.[0]).toEqual([1])
	})

	it('shows a visitor no progress', () => {
		const wrapper = mount(ProgramMap, {
			props: { chapters: guest.chapters, current: 0 },
			global,
		})
		const dot = wrapper.findAll('button')[1]
		expect(dot.attributes('data-status')).toBe('none')
		expect(dot.attributes('aria-label')).toBe('Lesson 2. Цели и источники')
	})
})

describe('LessonSlide', () => {
	const slide = (props: Record<string, unknown>) =>
		mount(LessonSlide, {
			props: {
				lesson: { ...enrolled.chapters[1].lessons[0], chapter: 'Выявление' },
				status: 'in-progress',
				position: 2,
				total: 3,
				lessonUrl: '/lms/courses/course-1/learn/2-1',
				...props,
			},
			global,
		})

	it('counts covered topics and marks each one', () => {
		const wrapper = slide({})
		expect(wrapper.get('[data-testid="slide-count"]').text()).toContain(
			'1 of 3 covered'
		)
		expect(
			wrapper.findAll('li').map((li) => li.attributes('data-status'))
		).toEqual(['covered', 'touched', 'none'])
	})

	it('links to the lesson page, not a second button into the session', () => {
		// learning-services#326: the course card holds the one button.
		const link = slide({}).get('[data-testid="slide-action"]')
		expect(link.attributes('href')).toBe('/lms/courses/course-1/learn/2-1')
		expect(link.text()).toBe('Open lesson')
		expect(slide({}).find('button').exists()).toBe(false)
	})

	it('hides topics past six behind a count', async () => {
		const many = Array.from({ length: 8 }, (_, i) => ({ text: `t${i}` }))
		const wrapper = slide({
			lesson: {
				...enrolled.chapters[1].lessons[0],
				objectives: many,
				chapter: 'Выявление',
			},
		})
		expect(wrapper.findAll('li')).toHaveLength(6)
		await wrapper.get('button').trigger('click')
		expect(wrapper.findAll('li')).toHaveLength(8)
	})

	it('gives a visitor no count, and the same way to the lesson', () => {
		const wrapper = slide({ status: 'none' })
		expect(wrapper.find('[data-testid="slide-count"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="slide-status"]').exists()).toBe(false)
		expect(wrapper.get('[data-testid="slide-action"]').attributes('href')).toBe(
			'/lms/courses/course-1/learn/2-1'
		)
	})
})

describe('CourseProgram', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	it('opens on the next lesson and links each slide to its page', async () => {
		const wrapper = mount(CourseProgram, {
			props: { program: enrolled, courseName: 'course-1' },
			global,
		})
		await flushPromises()

		expect(
			wrapper.get('[aria-current="step"]').attributes('aria-label')
		).toContain('Lesson 3')
		expect(
			wrapper
				.get('.slide.is-current [data-testid="slide-action"]')
				.attributes('href')
		).toBe('/lms/courses/course-1/learn/2-2')
		// Where to study is the course card's question now: no request per slide.
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('moves to the lesson picked on the map', async () => {
		const wrapper = mount(CourseProgram, {
			props: { program: enrolled, courseName: 'course-1' },
			global,
		})
		await flushPromises()
		await wrapper.findAll('nav button')[0].trigger('click')
		await flushPromises()

		expect(wrapper.get('.slide.is-current').attributes('data-index')).toBe('0')
		expect(
			wrapper
				.get('.slide.is-current [data-testid="slide-action"]')
				.attributes('href')
		).toBe('/lms/courses/course-1/learn/1-1')
	})

	it('keeps the lesson an arrow chose while the slides pass the middle', async () => {
		// learning-services#402: slides passing the middle during the smooth
		// scroll took over, and the dots ran one ahead of the card in front.
		vi.useFakeTimers()
		const wrapper = mount(CourseProgram, {
			props: { program: enrolled, courseName: 'course-1' },
			global,
		})
		await flushPromises()
		const before = Number(
			wrapper.get('.slide.is-current').attributes('data-index')
		)
		// The key goes the same way as the arrow button: select(current - 1).
		await wrapper
			.get('[role="region"]')
			.trigger('keydown', { key: 'ArrowLeft' })
		// jsdom lays every slide at 0: the one «in the middle» is the first.
		await wrapper.get('[data-testid="program-slides"]').trigger('scroll')
		vi.advanceTimersByTime(200)
		await flushPromises()

		expect(wrapper.get('.slide.is-current').attributes('data-index')).toBe(
			String(before - 1)
		)
		expect(
			wrapper.get('[aria-current="step"]').attributes('aria-label')
		).toContain(`Lesson ${before}`)
		vi.useRealTimers()
	})

	it('points a visitor at the lesson page too', async () => {
		const wrapper = mount(CourseProgram, {
			props: { program: guest, courseName: 'course-1' },
			global,
		})
		await flushPromises()

		expect(
			wrapper
				.get('.slide.is-current [data-testid="slide-action"]')
				.attributes('href')
		).toBe('/lms/courses/course-1/learn/1-1')
	})
})

describe('centeredIndex', () => {
	it('picks the slide whose centre is nearest to the middle', () => {
		const slides = [
			{ left: 0, width: 600 },
			{ left: 616, width: 600 },
			{ left: 1232, width: 600 },
		]
		expect(centeredIndex(slides, 916)).toBe(1)
		expect(centeredIndex(slides, 1300)).toBe(2)
		expect(centeredIndex(slides, 10)).toBe(0)
		expect(centeredIndex([], 100)).toBe(-1)
	})
})
