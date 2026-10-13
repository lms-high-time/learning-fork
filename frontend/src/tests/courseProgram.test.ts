import { describe, expect, it } from 'vitest'
import {
	chapterProgress,
	coverage,
	flattenLessons,
	lessonStatus,
	startIndex,
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

describe('startIndex', () => {
	const lessons = [{ id: 'l-1' }, { id: 'l-2' }, { id: 'l-3' }]

	it('opens on the next lesson', () => {
		expect(startIndex(lessons, 'l-2')).toBe(1)
	})

	it('opens on the first lesson for a visitor and a finished course', () => {
		expect(startIndex(lessons, undefined)).toBe(0)
		expect(startIndex(lessons, null)).toBe(0)
	})
})

describe('flattenLessons', () => {
	it('keeps program order and each lesson its chapter', () => {
		const flat = flattenLessons([
			{ title: 'Рамка', lessons: [lesson({ id: 'l-1' })] },
			{ title: 'Выявление', lessons: [lesson({ id: 'l-2' }), lesson({ id: 'l-3' })] },
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
