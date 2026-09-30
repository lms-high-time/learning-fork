// A lesson's homework (learning-services#439): the author's assignment, and the
// learner's answer to it in one space. Shapes and wording live here so they
// are tested without a server; the lesson block and the «Homework» page only
// draw them.

import { getLmsBasePath } from '@/utils/basePath'
import { plural, type PluralForms } from '@/utils/plural'
import { formatDay } from '@/utils/team'

export type HomeworkStatus = 'Assigned' | 'Submitted' | 'Returned' | 'Accepted'
export type AnswerMode = 'text' | 'files' | 'text_and_files'

export type HomeworkDue = {
	mode: 'none' | 'relative' | 'absolute'
	days: number | null
	date: string | null
}

export type Homework = {
	lesson: string
	title: string
	description: string | null
	answer_mode: AnswerMode
	due: HomeworkDue
}

export type HomeworkFile = {
	id: string
	name: string
	type: string | null
	size: number | null
	uploaded_at: string | null
	url: string
}

export type HomeworkEvent = {
	event: 'assigned' | 'submitted' | 'returned' | 'accepted' | 'reopened'
	by: string | null
	/** The person's full name; the server falls back to `by`. */
	by_name: string | null
	at: string | null
	version: number | null
	comment: string | null
	due_at: string | null
}

export type HomeworkVersion = {
	version: number
	saved_at: string | null
	answer: string | null
	files: HomeworkFile[]
}

export type Submission = {
	id: string
	status: HomeworkStatus
	due_at: string | null
	overdue: boolean
	version: number | null
	assigned_at: string | null
	submitted_at: string | null
	answer: string | null
	files: HomeworkFile[]
	history: HomeworkEvent[]
	versions?: HomeworkVersion[]
}

/** `student.homework`: the lesson page asks it always; no homework is `null`. */
export type LessonHomeworkData = {
	space: string | null
	lesson_url: string | null
	homework: Homework | null
	submission: Submission | null
}

/** A row of `student.my_homework`. */
export type HomeworkRow = {
	id: string
	course: string
	course_title: string | null
	lesson: string
	lesson_title: string | null
	lesson_url: string | null
	title: string
	status: HomeworkStatus
	due_at: string | null
	overdue: boolean
	version: number | null
	last_comment: string | null
}

const STATUS: Record<HomeworkStatus, string> = {
	Assigned: 'Assigned',
	Submitted: 'Submitted',
	Returned: 'Returned for revision',
	Accepted: 'Accepted',
}

export function statusLabel(status: HomeworkStatus | null | undefined): string {
	return status ? __(STATUS[status]) : __('Not submitted')
}

// The badge colours, the way StateBadge colours a document.
export const STATUS_CLASSES: Record<HomeworkStatus | 'none', string> = {
	Assigned: 'bg-surface-blue-1 text-ink-blue-7',
	Submitted: 'bg-surface-amber-2 text-ink-amber-8',
	Returned: 'bg-surface-red-2 text-ink-red-7',
	Accepted: 'bg-surface-green-2 text-ink-green-8',
	none: 'bg-surface-gray-2 text-ink-gray-6',
}

/** An accepted homework is the tutor's verdict; the learner no longer edits it. */
export function canEdit(status: HomeworkStatus | null | undefined): boolean {
	return status !== 'Accepted'
}

export const isTextAllowed = (mode: AnswerMode): boolean => mode !== 'files'
export const isFilesAllowed = (mode: AnswerMode): boolean => mode !== 'text'

export const DAYS_AFTER_LESSON: PluralForms = {
	one: '{0} day after the lesson',
	few: '{0} days after the lesson [few]',
	many: '{0} days after the lesson [many]',
	other: '{0} days after the lesson',
}

/**
 * The deadline in words. The submission's own `due_at` wins: it is the date the
 * learner was given when the lesson closed, and the author's rule changing
 * later does not move it.
 */
export function dueLabel(due: HomeworkDue, dueAt?: string | null): string {
	if (dueAt) return __('Due {0}').format(formatDay(dueAt))
	if (due.mode === 'absolute' && due.date)
		return __('Due {0}').format(formatDay(due.date))
	if (due.mode === 'relative' && due.days)
		return plural(due.days, DAYS_AFTER_LESSON)
	return __('No deadline')
}

/**
 * One save carries at most this much in new files. `Why:` the server refuses
 * more with `answer_too_large` — the stand's nginx would answer 413 first — so
 * the form says it before sending.
 */
export const SAVE_LIMIT_MB = 30

export const newFilesTooLarge = (files: { size: number }[]): boolean =>
	files.reduce((sum, file) => sum + file.size, 0) > SAVE_LIMIT_MB * 1024 * 1024

export const lastEvent = (
	history: readonly HomeworkEvent[],
	event: HomeworkEvent['event']
): HomeworkEvent | null =>
	[...history].reverse().find((row) => row.event === event) ?? null

/** The tutor's last word: the comment of the last return. */
export const lastComment = (
	history: readonly HomeworkEvent[]
): string | null =>
	lastEvent(history, 'returned')?.comment ?? null

const EVENTS: Record<HomeworkEvent['event'], string> = {
	assigned: 'Assigned',
	submitted: 'Submitted',
	returned: 'Returned for revision',
	accepted: 'Accepted',
	reopened: 'Reopened',
}

export const eventLabel = (event: HomeworkEvent['event']): string =>
	__(EVENTS[event] ?? event)

/** Who did it: «You» for the reader, otherwise the name. */
export const whoLabel = (
	row: Pick<HomeworkEvent, 'by' | 'by_name'>,
	me?: string | null
): string => {
	if (row.by && me && row.by === me) return __('You')
	return row.by_name || row.by || '—'
}

/** A moment of the journal, in the reader's words. */
export const formatMoment = (iso: string | null): string => {
	if (!iso) return '—'
	const time = iso.slice(11, 16)
	return time ? `${formatDay(iso)}, ${time}` : formatDay(iso)
}

export const formatSize = (bytes: number | null): string => {
	if (!bytes) return ''
	if (bytes < 1024 * 1024) return __('{0} KB').format(Math.max(1, Math.round(bytes / 1024)))
	return __('{0} MB').format((bytes / 1024 / 1024).toFixed(1))
}

/**
 * The SPA route of a lesson's homework block, from the lesson's address the
 * server gives. The base is the site's (`/lms` by default, router.js), not
 * written in here.
 */
export function lessonPath(
	url: string | null | undefined,
	base: string = getLmsBasePath()
): string | null {
	if (!url) return null
	let path: string
	try {
		path = new URL(url, 'http://host').pathname
	} catch {
		return null
	}
	const prefix = `/${base}`
	if (path === prefix || path.startsWith(`${prefix}/`))
		path = path.slice(prefix.length) || '/'
	return `${path}#homework`
}
