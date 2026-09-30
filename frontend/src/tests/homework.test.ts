import { describe, expect, it } from 'vitest'
import {
	canEdit,
	dueLabel,
	isFilesAllowed,
	isTextAllowed,
	lastComment,
	lastEvent,
	newFilesTooLarge,
	statusLabel,
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
		).toContain('15')
	})

	it('prefers the deadline the submission was given', () => {
		const label = dueLabel(
			{ mode: 'relative', days: 5, date: null },
			'2030-02-20 23:59:59'
		)
		expect(label).toContain('20')
		expect(label).not.toContain('after the lesson')
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
	const history = [
		{ event: 'assigned', by: 'a', at: '1', version: null, comment: null, due_at: null },
		{ event: 'returned', by: 't', at: '2', version: 1, comment: 'old', due_at: null },
		{ event: 'submitted', by: 'a', at: '3', version: 2, comment: null, due_at: null },
		{ event: 'returned', by: 't', at: '4', version: 2, comment: 'new', due_at: null },
	]

	it('finds the last comment of the tutor', () => {
		expect(lastComment(history)).toBe('new')
		expect(lastComment([])).toBeNull()
	})

	it('finds the last row of an event', () => {
		expect(lastEvent(history, 'returned')?.at).toBe('4')
		expect(lastEvent(history, 'accepted')).toBeNull()
	})
})
