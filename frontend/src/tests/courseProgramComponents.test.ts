import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { type ProgramData } from '@/utils/courseProgram'

// learning-services#322, #636: the programme as a list of chapters, as the
// student and a visitor meet it.

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

import CourseChapters from '@/components/CourseProgram/CourseChapters.vue'

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
			description: 'Что считать риском',
			status: 'passed',
			lessons_total: 1,
			lessons_passed: 1,
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
			description: null,
			status: 'in_progress',
			lessons_total: 2,
			lessons_passed: 0,
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
	chapters: enrolled.chapters.map(
		({ status, lessons_total, lessons_passed, ...chapter }) => ({
			...chapter,
			lessons: chapter.lessons.map(({ completed, ...lesson }) => ({
				...lesson,
				objectives: lesson.objectives.map(({ text }) => ({ text })),
			})),
		})
	),
}

const global = { mocks: { __ } }

beforeEach(() => {
	vi.stubGlobal('__', __)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

const open = (program: ProgramData) =>
	mount(CourseChapters, {
		props: { program, courseName: 'course-1' },
		global,
	})

describe('CourseChapters', () => {
	it('lists every chapter with how far the student is in it', () => {
		const wrapper = open(enrolled)
		const chapters = wrapper.findAll('[data-testid="course-chapter"]')
		expect(chapters).toHaveLength(2)
		expect(
			wrapper.findAll('[data-testid="chapter-count"]').map((c) => c.text())
		).toEqual(['1 of 1', '0 of 2'])
	})

	it('opens the student’s chapter and marks the next lesson', () => {
		const wrapper = open(enrolled)
		const chapters = wrapper.findAll('[data-testid="course-chapter"]')
		expect(chapters.map((c) => c.attributes('open'))).toEqual([undefined, ''])
		expect(
			wrapper
				.findAll('[data-testid="course-lesson"]')
				.map((l) => l.attributes('data-status'))
		).toEqual(['completed', 'in-progress', 'next'])
		expect(wrapper.text()).toContain('Up next')
	})

	it('opens the first chapter to a visitor and shows no progress', () => {
		const wrapper = open(guest)
		const chapters = wrapper.findAll('[data-testid="course-chapter"]')
		expect(chapters.map((c) => c.attributes('open'))).toEqual(['', undefined])
		expect(
			wrapper.findAll('[data-testid="chapter-count"]').map((c) => c.text())
		).toEqual(['{0} lesson'.replace('{0}', '1'), '2 lessons'])
		expect(
			wrapper
				.findAll('[data-testid="course-lesson"]')
				.map((l) => l.attributes('data-status'))
		).toEqual(['none', 'none', 'none'])
		expect(wrapper.text()).not.toContain('covered')
	})

	it('says the course’s size', () => {
		expect(open(enrolled).text()).toContain('2 chapters · 3 lessons')
	})

	it('links each lesson to its page', () => {
		const links = open(enrolled)
			.findAll('[data-testid="lesson-open"]')
			.map((a) => a.attributes('href'))
		expect(links).toEqual([
			'/lms/courses/course-1/learn/1-1',
			'/lms/courses/course-1/learn/2-1',
			'/lms/courses/course-1/learn/2-2',
		])
	})

	it('keeps the lesson’s opening and topics under it', () => {
		const wrapper = open(enrolled)
		const first = wrapper.findAll('[data-testid="course-lesson"]')[0]
		expect(first.text()).toContain('Зачем это вам')
		expect(first.find('[data-testid="lesson-objectives"]').exists()).toBe(true)
	})

	it('opens none once every chapter is passed', () => {
		const finished: ProgramData = {
			...enrolled,
			next_lesson: null,
			chapters: enrolled.chapters.map((chapter) => ({
				...chapter,
				status: 'passed',
			})),
		}
		const wrapper = open(finished)
		expect(
			wrapper
				.findAll('[data-testid="course-chapter"]')
				.some((c) => c.attributes('open') === '')
		).toBe(false)
	})

	it('remembers a chapter the student opened', async () => {
		const wrapper = open(enrolled)
		const first = wrapper.findAll('[data-testid="course-chapter"]')[0]
		;(first.element as HTMLDetailsElement).open = true
		await first.trigger('toggle')
		expect(first.attributes('open')).toBe('')
	})
})
