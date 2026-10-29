// «Мои документы» as a list (learning-services#462): each document says why
// it is there, how full it is and when it last changed. Kept apart from the
// page so the wording and the order are tested without a server.

import { pageLang } from '@/utils/lang'

export type DocumentSummary = {
	artifact: string
	title: string
	purpose?: string | null
	modified?: string | null
	blocks_total: number
	blocks_filled: number
}

export type CourseDocuments = {
	id: string
	title: string
	completion?: number
	documents: DocumentSummary[]
}

/** How full a document is: a whole percent, and whether it is done. */
export function fillOf(
	doc: Pick<DocumentSummary, 'blocks_total' | 'blocks_filled'>
) {
	const percent = doc.blocks_total
		? Math.round((doc.blocks_filled / doc.blocks_total) * 100)
		: 0
	return {
		percent,
		done: doc.blocks_total > 0 && doc.blocks_filled >= doc.blocks_total,
		empty: doc.blocks_filled === 0,
	}
}

const sameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate()

/**
 * When a document changed, short for the row and in full for the hint: the
 * time today, the day this year, the date before. The row keeps it short —
 * the date beside every document took the room of its purpose.
 */
export function changedAt(
	modified: string | null | undefined,
	now: Date = new Date(),
	lang: string = pageLang()
): { short: string; full: string } | null {
	if (!modified) return null
	const at = new Date(modified)
	if (Number.isNaN(at.getTime())) return null
	const time = at.toLocaleTimeString(lang, {
		hour: '2-digit',
		minute: '2-digit',
	})
	const short = sameDay(at, now)
		? time
		: at.getFullYear() === now.getFullYear()
		? at.toLocaleDateString(lang, { day: 'numeric', month: 'short' })
		: at.toLocaleDateString(lang)
	const day = dateInSentence(at, lang)
	return { short, full: __('Changed {0}, {1}').format(day, time) }
}

/**
 * The full date as it goes inside a sentence: «28 сентября 2026», «September
 * 28, 2026». What a language puts after the year — the Russian «г.» — is cut,
 * since the sentence goes on after it.
 */
function dateInSentence(at: Date, lang: string): string {
	const parts = new Intl.DateTimeFormat(lang, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	}).formatToParts(at)
	let end = parts.length
	while (end > 0 && parts[end - 1].type === 'literal') end--
	return parts
		.slice(0, end)
		.map((part) => part.value)
		.join('')
}

const latest = (course: CourseDocuments) =>
	course.documents.reduce(
		(last, doc) => (doc.modified && doc.modified > last ? doc.modified : last),
		''
	)

/**
 * Courses whose documents changed most recently come first; untouched ones
 * keep the order they came in, after them.
 */
export function byRecent(courses: CourseDocuments[]): CourseDocuments[] {
	return courses
		.map((course, index) => ({ course, index, last: latest(course) }))
		.sort((a, b) =>
			a.last === b.last ? a.index - b.index : a.last > b.last ? -1 : 1
		)
		.map(({ course }) => course)
}
