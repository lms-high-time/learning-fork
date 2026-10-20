import { describe, expect, it } from 'vitest'
import {
	chapterProgress,
	coverage,
	flattenLessons,
	coursePath,
	lessonStatus,
	openChapter,
	topicCount,
	type ProgramLesson,
} from '@/utils/courseProgram'

// learning-services#322: the course program's rules, pinned apart from the
// components that draw them.

const lesson = (overrides: Partial<ProgramLesson> = {}): ProgramLesson => ({
	id: 'l-1',
	number: 1,
	title: 'Риск как событие',
	hook: null,
	objectives: [],
	completed: false,
	...overrides,
})

describe('lessonStatus', () => {
	it('shows nothing to a visitor, who has no progress', () => {
		expect(lessonStatus(lesson({ completed: undefined }), 'l-1')).toBe('none')
	})

	it('puts a closed lesson first, even when it would be next', () => {
		expect(lessonStatus(lesson({ completed: true }), 'l-1')).toBe('completed')
	})

	it('calls a lesson with a report but still open in progress', () => {
		const reported = lesson({
			objectives: [{ text: 'a', status: 'touched' }, { text: 'b' }],
		})
		expect(lessonStatus(reported, 'l-2')).toBe('in-progress')
		expect(lessonStatus(reported, 'l-1')).toBe('in-progress')
	})

	it('marks the first open lesson as next, the rest as ahead', () => {
		expect(lessonStatus(lesson(), 'l-1')).toBe('next')
		expect(lessonStatus(lesson(), 'l-2')).toBe('ahead')
	})
})

describe('topicCount and coverage', () => {
	const objectives = [
		{ text: 'a', status: 'covered' as const },
		{ text: 'b', status: 'touched' as const },
		{ text: 'c' },
		{ text: 'd' },
	]

	it('counts only covered topics as mastered', () => {
		expect(topicCount(objectives)).toEqual({ covered: 1, total: 4 })
		expect(coverage(objectives)).toBe(0.25)
	})

	it('gives a lesson without topics no coverage rather than NaN', () => {
		expect(coverage([])).toBe(0)
	})
})

describe('openChapter', () => {
	const chapter = (ids: string[], status?: 'passed' | 'in_progress') => ({
		title: 't',
		status,
		lessons: ids.map((id) => lesson({ id })),
	})

	it('opens the chapter with the next lesson for a student', () => {
		const chapters = [
			chapter(['l-1'], 'passed'),
			chapter(['l-2', 'l-3'], 'in_progress'),
		]
		expect(openChapter(chapters, 'l-3')).toBe(1)
	})

	it('opens the first chapter for a visitor', () => {
		expect(openChapter([chapter(['l-1']), chapter(['l-2'])], undefined)).toBe(0)
	})

	it('opens the first chapter not passed when no next lesson is named', () => {
		const chapters = [
			chapter(['l-1'], 'passed'),
			chapter(['l-2'], 'in_progress'),
		]
		expect(openChapter(chapters, undefined)).toBe(1)
	})

	it('opens none once the course is finished', () => {
		expect(openChapter([chapter(['l-1'], 'passed')], null)).toBeNull()
	})

	it('has nothing to open without chapters', () => {
		expect(openChapter([], 'l-1')).toBeNull()
	})
})

describe('coursePath', () => {
	const data = (next: string | null, done: boolean[]) => ({
		course: 'c',
		title: 'c',
		next_lesson: next,
		chapters: [
			{ title: 'a', lessons: [lesson({ id: 'l-1', completed: done[0] })] },
			{
				title: 'b',
				lessons: [
					lesson({ id: 'l-2', completed: done[1] }),
					lesson({ id: 'l-3', completed: done[2] }),
				],
			},
		],
	})

	it('says where the student is and how much is passed', () => {
		expect(coursePath(data('l-3', [true, true, false]))).toEqual({
			passed: 2,
			total: 3,
			chapters: 2,
			chapter: 2,
			lesson: 3,
			done: false,
			started: true,
		})
	})

	it('counts a lesson talked through as started before it is closed', () => {
		const half = data('l-1', [false, false, false])
		expect(coursePath(half)?.started).toBe(false)
		half.chapters[0].lessons[0].objectives = [{ text: 'a', status: 'touched' }]
		expect(coursePath(half)?.started).toBe(true)
	})

	it('knows a finished course', () => {
		expect(coursePath(data(null, [true, true, true]))).toMatchObject({
			passed: 3,
			chapter: null,
			lesson: null,
			done: true,
		})
	})

	it('has nothing to say to a visitor', () => {
		const visitor = data(null, [true, true, true])
		visitor.chapters.forEach((c) =>
			c.lessons.forEach((l) => delete (l as { completed?: boolean }).completed)
		)
		expect(coursePath(visitor)).toBeNull()
	})
})

describe('flattenLessons', () => {
	it('keeps program order and each lesson its chapter', () => {
		const flat = flattenLessons([
			{ title: 'Рамка', lessons: [lesson({ id: 'l-1' })] },
			{
				title: 'Выявление',
				lessons: [lesson({ id: 'l-2' }), lesson({ id: 'l-3' })],
			},
		])
		expect(flat.map((l) => [l.id, l.chapter, l.chapterIndex])).toEqual([
			['l-1', 'Рамка', 0],
			['l-2', 'Выявление', 1],
			['l-3', 'Выявление', 1],
		])
	})
})

// learning-services#547: a chapter's progress, as `course_outline` counts it.
describe('chapterProgress', () => {
	it('counts the lessons passed and knows a passed chapter', () => {
		expect(
			chapterProgress({
				title: 'Рамка',
				status: 'in_progress',
				lessons_total: 3,
				lessons_passed: 1,
				lessons: [],
			})
		).toEqual({ passed: 1, total: 3, done: false })
		expect(
			chapterProgress({
				title: 'Рамка',
				status: 'passed',
				lessons_total: 2,
				lessons_passed: 2,
				lessons: [],
			})
		).toEqual({ passed: 2, total: 2, done: true })
	})

	it('gives a visitor none', () => {
		expect(
			chapterProgress({ title: 'Рамка', description: 'О главе', lessons: [] })
		).toBeNull()
	})
})
