/**
 * A course document as the page shows it (learning-services#331, #515): each
 * section of the course's release is a block of the document — filled once
 * (`one`, its columns are fields) or row by row (`many`). Every value is
 * text. The server owns the data and what counts as filled; this only
 * arranges what `artifact` returned.
 */

import { pageLang } from '@/utils/lang'
import type { PluralForms } from '@/utils/plural'

/** Rows shown of all; the noun goes with the total (learning-services#765). */
export const ROWS_OF: PluralForms = {
	one: '{0} of {1} row',
	other: '{0} of {1} rows',
}

/** The longest text a cell or a field takes; the server refuses more. */
export const MAX_TEXT = 4000

/** A cell or a field as the server keeps it: text; blank is not sent at all. */
export type CellValue = string | null | undefined

/**
 * Whether a column must be filled: always, never, or when another column of
 * the same row (of the same section, for `one`) is filled.
 */
export type ColumnRequired = boolean | { if_column: string }

export interface DocColumn {
	key: string
	title: string
	required: ColumnRequired
}

export interface DocRow {
	id: string
	[key: string]: CellValue
}

export interface EmptyCell {
	row?: string
	column?: string
	field?: string
}

interface SectionBase {
	key: string
	title: string
	/** What the section is for, written for the student. */
	description?: string | null
	lesson: string | null
	columns: DocColumn[]
	filled?: boolean
	empty_cells?: EmptyCell[]
}

/** A section filled row by row: a table. */
export interface ManyBlock extends SectionBase {
	rows: 'many'
	items: DocRow[]
}

/** A section filled once: its columns are fields. */
export interface OneBlock extends SectionBase {
	rows: 'one'
	values: Record<string, CellValue>
}

export type DocBlock = ManyBlock | OneBlock

export interface DocumentData {
	course: string
	artifact: string
	title: string
	purpose?: string | null
	blocks: DocBlock[]
	/** When the student's document last changed; null before the first write. */
	modified?: string | null
	/** How many times it has been saved. */
	version?: number
}

export const isMany = (block: DocBlock): block is ManyBlock =>
	block.rows === 'many'

/** Blank as the server counts it: nothing or an empty string. */
export const isBlank = (value: CellValue): boolean =>
	value === null || value === undefined || String(value).trim() === ''

/** «уточнить у Марины до пятницы» — filled, by the course's rule, but flagged. */
// Not `\b`: in a JS regex it knows Latin letters only.
export const isToClarify = (value: CellValue): boolean =>
	typeof value === 'string' && /^\s*уточнить(?:\s|$)/i.test(value)

/**
 * Whether the cell must be filled for this row — or the field for this
 * section: `values` is the row of a `many` section, the fields of a `one`.
 */
export function isRequired(
	column: DocColumn,
	values: Record<string, CellValue>
): boolean {
	if (column.required === true) return true
	if (column.required && typeof column.required === 'object')
		return !isBlank(values[column.required.if_column])
	return false
}

export const isMissing = (
	column: DocColumn,
	values: Record<string, CellValue>
): boolean => isRequired(column, values) && isBlank(values[column.key])

/** The title of the column a conditional one depends on, for its hint. */
export function conditionTitle(
	column: DocColumn,
	columns: DocColumn[]
): string | null {
	if (!column.required || typeof column.required !== 'object') return null
	const key = column.required.if_column
	return columns.find((c) => c.key === key)?.title ?? key
}

/**
 * The first always-required column, else the first column: what names a row
 * where there is room for one cell. No course's key is special here — a
 * document is the course's data (learning-services#360).
 */
export const titleColumn = (columns: DocColumn[]): DocColumn | undefined =>
	columns.find((c) => c.required === true) ?? columns[0]

export interface RowFilter {
	search?: string
	/** Only rows with a required cell still empty. */
	missing?: boolean
}

export function filterRows(
	rows: DocRow[],
	columns: DocColumn[],
	filter: RowFilter
): DocRow[] {
	const search = (filter.search ?? '').trim().toLowerCase()
	return rows.filter((row) => {
		if (filter.missing && !columns.some((c) => isMissing(c, row))) return false
		if (search) {
			const text = [row.id, ...columns.map((c) => row[c.key])]
				.filter((v) => !isBlank(v))
				.join(' ')
				.toLowerCase()
			if (!text.includes(search)) return false
		}
		return true
	})
}

export type SortDirection = 'asc' | 'desc'

/**
 * Sorted by a column; blanks last whichever way. IDs sort by their number:
 * A10 after A9, not after A1.
 */
export function sortRows(
	rows: DocRow[],
	key: string | null,
	direction: SortDirection = 'asc',
	lang: string = pageLang()
): DocRow[] {
	if (!key) return rows
	const sign = direction === 'asc' ? 1 : -1
	const idNumber = (id: string): number => Number(id.replace(/\D/g, '')) || 0
	return [...rows].sort((a, b) => {
		const x = a[key]
		const y = b[key]
		if (isBlank(x) && isBlank(y)) return 0
		if (isBlank(x)) return 1
		if (isBlank(y)) return -1
		if (key === 'id') return (idNumber(String(x)) - idNumber(String(y))) * sign
		return String(x).localeCompare(String(y), lang) * sign
	})
}

// ---------------------------------------------------------------- workspace
//
// The document as a workspace (learning-services#342): each lesson's block is
// its own page, grouped under its lesson.

export type BlockState = 'done' | 'progress' | 'empty'

/** Whether the student has written anything into the block. */
export const isTouched = (block: DocBlock): boolean =>
	isMany(block)
		? (block.items ?? []).length > 0
		: Object.values(block.values ?? {}).some((v) => !isBlank(v))

/**
 * One word for where a block stands. What exactly is missing is not listed —
 * the block highlights it in place.
 */
export function blockState(block: DocBlock): BlockState {
	if (block.filled) return 'done'
	return isTouched(block) ? 'progress' : 'empty'
}

export interface OutlineLesson {
	id: string
	number: number
	title: string
}

export interface OutlineGroup {
	lesson: OutlineLesson | null
	blocks: DocBlock[]
}

/** Blocks under their lessons, in course order; blocks with no lesson last. */
export function outline(
	doc: DocumentData,
	lessons: OutlineLesson[]
): OutlineGroup[] {
	const groups: OutlineGroup[] = []
	for (const lesson of lessons) {
		const blocks = doc.blocks.filter((b) => b.lesson === lesson.id)
		if (blocks.length) groups.push({ lesson, blocks })
	}
	const placed = new Set(groups.flatMap((g) => g.blocks.map((b) => b.key)))
	const rest = doc.blocks.filter((b) => !placed.has(b.key))
	if (rest.length) groups.push({ lesson: null, blocks: rest })
	return groups
}

/**
 * The lesson a document grows on next: the current one when it builds the
 * document, otherwise the first after it that does. The course's next lesson
 * may build nothing of this document — named as is, it pointed at a lesson the
 * document has no part in (learning-services#462).
 */
export function lessonAhead<T extends { id: string }>(
	lessons: T[],
	current: string | null | undefined,
	builds: (lesson: T) => boolean
): T | null {
	const from = lessons.findIndex((l) => l.id === current)
	return from < 0 ? null : lessons.slice(from).find(builds) ?? null
}

/**
 * Where the document opens: during the course the first unfinished block of
 * the lesson it grows on next, after it the first block.
 */
export function defaultView(
	doc: DocumentData,
	groups: OutlineGroup[],
	currentLesson: string | null | undefined,
	lessons: { id: string }[]
): string {
	const ahead = lessonAhead(lessons, currentLesson, (l) =>
		groups.some((g) => g.lesson?.id === l.id)
	)
	const current = groups.find(
		(g) => g.lesson?.id === (ahead?.id ?? currentLesson)
	)
	if (current) {
		const open = current.blocks.find((b) => blockState(b) !== 'done')
		return (open ?? current.blocks[0]).key
	}
	return doc.blocks[0]?.key ?? ''
}
