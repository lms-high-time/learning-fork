import { describe, expect, it } from 'vitest'
import {
	canEdit,
	dueLabel,
	isFilesAllowed,
	isTextAllowed,
	lastComment,
	lastEvent,
	lessonPath,
	newFilesTooLarge,
	statusLabel,
	whoLabel,
	type HomeworkEvent,
} from '@/utils/homework'

// A lesson's homework (learning-services#439): the wording and the rules the
// block and the «Homework» page share.

describe('statusLabel', () => {
	it('names every status, and the absence of a submission', () => {
		expect(statusLabel('Assigned')).toBe('Assigned')
		expect(statusLabel('Submitted')).toBe('Submitted')
		expect(statusLabel('Returned')).toBe('Returned for revision')
		expect(statusLabel('Accepted')).toBe('Accepted')
		expect(statusLabel(null)).toBe('Not submitted')
	})
})

describe('dueLabel', () => {
	it('counts the days of a relative deadline', () => {
		expect(dueLabel({ mode: 'relative', days: 5, date: null })).toBe(
			'5 days after the lesson'
		)
		expect(dueLabel({ mode: 'relative', days: 1, date: null })).toBe(
			'1 day after the lesson'
		)
	})

	it('names the day of an absolute deadline', () => {
		expect(
			dueLabel({ mode: 'absolute', days: null, date: '2030-01-15' })
		).toBe('Due 15 января 2030 г.')
	})

	it('prefers the deadline the submission was given', () => {
		const label = dueLabel(
			{ mode: 'relative', days: 5, date: null },
			'2030-02-20 23:59:59'
		)
		expect(label).toBe('Due 20 февраля 2030 г.')
	})

	it('says there is no deadline', () => {
		expect(dueLabel({ mode: 'none', days: null, date: null })).toBe(
			'No deadline'
		)
	})
})

describe('what the learner may do', () => {
	it('keeps an accepted homework read-only', () => {
		expect(canEdit('Accepted')).toBe(false)
		expect(canEdit('Returned')).toBe(true)
		expect(canEdit(null)).toBe(true)
	})

	it('offers only the fields of the answer mode', () => {
		expect(isFilesAllowed('text')).toBe(false)
		expect(isTextAllowed('text')).toBe(true)
		expect(isTextAllowed('files')).toBe(false)
		expect(isFilesAllowed('text_and_files')).toBe(true)
	})

	it('stops new files over 30 MB before they reach the server', () => {
		const mb = 1024 * 1024
		expect(newFilesTooLarge([{ size: 20 * mb }, { size: 10 * mb }])).toBe(false)
		expect(newFilesTooLarge([{ size: 20 * mb }, { size: 11 * mb }])).toBe(true)
	})
})

describe('the journal', () => {
	const row = (
		event: HomeworkEvent['event'],
		at: string,
		comment: string | null = null
	): HomeworkEvent => ({
		event,
		by: 't@x',
		by_name: 'Тьютор',
		at,
		version: 1,
		comment,
		due_at: null,
	})
	const history = [
		row('assigned', '1'),
		row('returned', '2', 'old'),
		row('submitted', '3'),
		row('returned', '4', 'new'),
	] satisfies readonly HomeworkEvent[]

	it('finds the last comment of the tutor', () => {
		expect(lastComment(history)).toBe('new')
		expect(lastComment([])).toBeNull()
	})

	it('finds the last row of an event', () => {
		expect(lastEvent(history, 'returned')?.at).toBe('4')
		expect(lastEvent(history, 'accepted')).toBeNull()
	})

	it('names the person, and the reader as «You»', () => {
		expect(whoLabel({ by: 't@x', by_name: 'Тьютор' }, 'a@x')).toBe('Тьютор')
		expect(whoLabel({ by: 'a@x', by_name: 'Анна' }, 'a@x')).toBe('You')
		expect(whoLabel({ by: 't@x', by_name: null }, 'a@x')).toBe('t@x')
		expect(whoLabel({ by: null, by_name: null })).toBe('—')
	})
})

describe('lessonPath', () => {
	it('takes the lesson route without the SPA base, to the homework block', () => {
		expect(lessonPath('/lms/courses/c-1/learn/1-2')).toBe(
			'/courses/c-1/learn/1-2#homework'
		)
		expect(lessonPath('https://x.test/lms/courses/c-1/learn/1-2')).toBe(
			'/courses/c-1/learn/1-2#homework'
		)
		expect(lessonPath('/study/courses/c-1/learn/1-2', 'study')).toBe(
			'/courses/c-1/learn/1-2#homework'
		)
		expect(lessonPath(null)).toBeNull()
	})
})
