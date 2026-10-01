/**
 * A course document's table as the page shows it (learning-services#331):
 * columns grouped by the block that adds them, sorting, filters, the cells a
 * block still lacks, the matrix and the report. The server owns the
 * data and the formulas; this only arranges what `artifact` returned.
 */

export type ColumnType =
	| 'text'
	| 'longtext'
	| 'number'
	| 'scale'
	| 'date'
	| 'select'
	| 'ref'
	| 'check'
	| 'formula'

export interface DocColumn {
	key: string
	title: string
	type: ColumnType
	block: string
	options?: string[]
	min?: number
	max?: number
	labels?: string
	ref?: string
	formula?: string
	required?: boolean | string
	hint?: string
}

export interface DocField {
	key: string
	title: string
	type: Exclude<ColumnType, 'scale' | 'ref' | 'check'>
	options?: string[]
	required?: boolean
	/** A formula field's expression; the server computes its value (#351). */
	formula?: string
	value?: CellValue
}

export type CellValue = string | number | boolean | null | undefined

export interface DocRow {
	id: string
	[key: string]: CellValue
}

export interface MatrixView {
	type: 'matrix'
	title?: string
	x: string
	y: string
	highlight?: string
}

export interface ColumnsView {
	type: 'columns'
	title: string
	columns: string[]
}

export interface ReportView {
	type: 'report'
	title?: string
	filter?: string
	columns: string[]
	field?: string
}

export interface DocTable {
	name: string
	title: string
	owner: string
	prefix: string
	columns: DocColumn[]
	views: (MatrixView | ReportView | ColumnsView)[]
	rows: DocRow[]
	/** The rows are still the author's untouched preset. */
	preset?: boolean
	markdown: string
}

export interface EmptyCell {
	row?: string
	column?: string
	field?: string
}

export interface DocBlock {
	key: string
	title: string
	hint: string
	lesson: string | null
	span: number
	kind: 'text' | 'file' | 'link'
	accept: string[]
	content: string
	file: { name: string; type: string; size: number; url: string } | null
	url: string | null
	preview: string | null
	fields?: DocField[]
	table?: string | null
	columns?: DocColumn[]
	filled?: boolean
	empty_cells?: EmptyCell[]
}

export interface DocumentData {
	course: string
	artifact: string
	title: string
	layout: 'sections' | 'canvas'
	blocks: DocBlock[]
	tables: Record<string, DocTable>
	fields: Record<string, CellValue>
	/** When the student's document last changed; null before the first write. */
	modified?: string | null
	/** How many times it has been saved. */
	version?: number
	/** The blocks laid out as one sheet — the Lean Canvas (#351). */
	canvas?: CanvasSpec | null
}

/**
 * The document as one sheet (learning-services#351): rows of block keys in
 * the shape of CSS grid-template-areas, short titles for the cells, the
 * block holding the student's first sketch, and what each cell shows.
 */
export interface CanvasSpec {
	grid: string[]
	labels?: Record<string, string>
	sketch?: string | null
	summary?: Record<string, string[]>
}

export interface ColumnGroup {
	block: string
	title: string
	columns: DocColumn[]
}

/** Blank as the server counts it: nothing, an empty string or an unticked box. */
export const isBlank = (value: CellValue): boolean =>
	value === null || value === undefined || value === '' || value === false

/** «уточнить у Марины до пятницы» — filled, by the course's rule, but flagged. */
// Not `\b`: in a JS regex it knows Latin letters only.
export const isToClarify = (value: CellValue): boolean =>
	typeof value === 'string' && /^\s*уточнить(?:\s|$)/i.test(value)

/** The table's columns under the block that adds them, in schema order. */
export function columnGroups(
	table: DocTable,
	blocks: DocBlock[]
): ColumnGroup[] {
	const titles = new Map(blocks.map((b) => [b.key, b.title]))
	const groups: ColumnGroup[] = []
	for (const column of table.columns) {
		const last = groups[groups.length - 1]
		if (last && last.block === column.block) last.columns.push(column)
		else
			groups.push({
				block: column.block,
				title: titles.get(column.block) ?? column.block,
				columns: [column],
			})
	}
	return groups
}

/** Whether the cell is one its block must fill for this row. */
export function isRequired(column: DocColumn, row: DocRow): boolean {
	if (column.required === true) return true
	if (typeof column.required === 'string') return !isBlank(row[column.required])
	return false
}

export const isMissing = (column: DocColumn, row: DocRow): boolean =>
	column.type !== 'formula' &&
	isRequired(column, row) &&
	isBlank(row[column.key])

/**
 * The first required text column, else the first text column: what names a
 * row where there is room for one cell. No course's key is special here — a
 * document is the course's data (learning-services#360).
 */
export function titleColumn(table: DocTable): DocColumn | undefined {
	return (
		table.columns.find((c) => c.type === 'text' && c.required === true) ??
		table.columns.find((c) => c.type === 'text')
	)
}

/** Boolean formulas — «в работе» — which make sense as a filter. */
export const flagColumns = (table: DocTable): DocColumn[] =>
	table.columns.filter(
		(c) =>
			c.type === 'formula' &&
			table.rows.some((r) => typeof r[c.key] === 'boolean')
	)

export interface RowFilter {
	search?: string
	/** Only rows where this column is true. */
	flag?: string | null
	/** Only rows with a required cell still empty. */
	missing?: boolean
	/** Only rows with this value in a select column. */
	select?: { column: string; value: string } | null
}

export function filterRows(table: DocTable, filter: RowFilter): DocRow[] {
	const search = (filter.search ?? '').trim().toLowerCase()
	return table.rows.filter((row) => {
		if (filter.flag && row[filter.flag] !== true) return false
		if (filter.missing && !table.columns.some((c) => isMissing(c, row)))
			return false
		if (filter.select && row[filter.select.column] !== filter.select.value)
			return false
		if (search) {
			const text = [row.id, ...table.columns.map((c) => row[c.key])]
				.filter((v) => v !== null && v !== undefined)
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
 * R10 after R9, not after R1.
 */
export function sortRows(
	rows: DocRow[],
	key: string | null,
	direction: SortDirection = 'asc'
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
		if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign
		if (typeof x === 'boolean' || typeof y === 'boolean')
			return (Number(y) - Number(x)) * sign
		return String(x).localeCompare(String(y), 'ru') * sign
	})
}

/** A scale's labels from the table its column names: «4 — Вероятно». */
export function scaleLabels(
	column: DocColumn,
	tables: Record<string, DocTable>
): Map<number, string> {
	const labels = new Map<number, string>()
	const source = column.labels ? tables[column.labels] : undefined
	if (!source) return labels
	const value = source.columns.find(
		(c) => c.type === 'number' || c.type === 'scale'
	)
	const label = source.columns.find((c) => c.type === 'text')
	if (!value || !label) return labels
	for (const row of source.rows) {
		const n = Number(row[value.key])
		if (Number.isFinite(n) && typeof row[label.key] === 'string')
			labels.set(n, row[label.key] as string)
	}
	return labels
}

/** What a select, scale or ref cell may hold, as options for a picker. */
export function cellOptions(
	column: DocColumn,
	tables: Record<string, DocTable>
): { value: string | number; label: string }[] {
	if (column.type === 'select')
		return (column.options ?? []).map((o) => ({ value: o, label: o }))
	if (column.type === 'scale') {
		const labels = scaleLabels(column, tables)
		const out = []
		for (let n = column.min ?? 1; n <= (column.max ?? 5); n++)
			out.push({
				value: n,
				label: labels.has(n) ? `${n} — ${labels.get(n)}` : String(n),
			})
		return out
	}
	if (column.type === 'ref' && column.ref && tables[column.ref]) {
		const target = tables[column.ref]
		const name = titleColumn(target)
		return target.rows.map((r) => ({
			value: r.id,
			label: name && !isBlank(r[name.key]) ? `${r.id} — ${r[name.key]}` : r.id,
		}))
	}
	return []
}

export interface MatrixCell {
	x: number
	y: number
	rows: DocRow[]
	highlighted: boolean
}

/**
 * The matrix: a cell per pair of scale values, the rows that fall in it.
 * Rows lacking either score stay off the grid and are counted apart.
 */
export function matrix(
	table: DocTable,
	view: MatrixView
): { cells: MatrixCell[][]; xs: number[]; ys: number[]; unplaced: DocRow[] } {
	const axis = (key: string): number[] => {
		const column = table.columns.find((c) => c.key === key)
		const min = column?.min ?? 1
		const max = column?.max ?? 5
		return Array.from({ length: max - min + 1 }, (_, i) => min + i)
	}
	const xs = axis(view.x)
	// Top row is the highest: the eye reads «likely» first.
	const ys = axis(view.y).reverse()
	const unplaced: DocRow[] = []
	const cells = ys.map((y) =>
		xs.map((x) => ({ x, y, rows: [] as DocRow[], highlighted: false }))
	)
	for (const row of table.rows) {
		const x = Number(row[view.x])
		const y = Number(row[view.y])
		const cell = cells[ys.indexOf(y)]?.[xs.indexOf(x)]
		if (isBlank(row[view.x]) || isBlank(row[view.y]) || !cell) {
			unplaced.push(row)
			continue
		}
		cell.rows.push(row)
		if (view.highlight && row[view.highlight] === true) cell.highlighted = true
	}
	return { cells, xs, ys, unplaced }
}

/** The report's rows — ticked in its filter column — and columns. */
export function reportRows(
	table: DocTable,
	view: ReportView
): { columns: DocColumn[]; rows: DocRow[] } {
	const columns = view.columns
		.map((key) => table.columns.find((c) => c.key === key))
		.filter((c): c is DocColumn => Boolean(c))
	const rows = view.filter
		? table.rows.filter((r) => r[view.filter as string] === true)
		: table.rows
	return { columns, rows }
}

/** A cell as text: numbers without «.0», ticks as «да», dates as the locale writes them. */
export function formatCell(
	column: Pick<DocColumn, 'type'>,
	value: CellValue
): string {
	if (isBlank(value)) return ''
	if (column.type === 'check' || typeof value === 'boolean')
		return value ? '✓' : ''
	if (column.type === 'date' && typeof value === 'string') {
		const [y, m, d] = value.split('-')
		return y && m && d ? `${d}.${m}.${y}` : value
	}
	return String(value)
}

// ---------------------------------------------------------------- workspace
//
// The document as a workspace (learning-services#342): each lesson's block is
// its own document, grouped under its lesson, with the whole table and the
// report on top.

export type BlockState = 'done' | 'progress' | 'preset' | 'empty'

/**
 * One word for where a block stands. What exactly is missing is not listed —
 * there are too many kinds of «missing»; the table highlights it in place.
 */
export function blockState(block: DocBlock, doc: DocumentData): BlockState {
	const filled =
		block.filled ?? Boolean(block.content || block.file || block.url)
	if (filled) return 'done'
	const table = block.table ? doc.tables[block.table] : undefined
	if (table?.preset && table.owner === block.key) return 'preset'
	const own = (block.columns ?? []).filter((c) => c.type !== 'formula')
	// A formula field has a value the student never wrote (#351).
	const touched =
		Boolean(block.content || block.file || block.url) ||
		(block.fields ?? []).some(
			(f) => f.type !== 'formula' && !isBlank(doc.fields[f.key])
		) ||
		(table?.rows ?? []).some((r) => own.some((c) => !isBlank(r[c.key])))
	return touched ? 'progress' : 'empty'
}

/**
 * «Готов, когда …» from the author's hint: the one sentence the student
 * needs. The rest of the hint is written for the agent and folds away.
 */
export function readyLine(hint: string): string | null {
	const found = hint.match(/Готов[аоы]?,?\s+когда[^.]*\./)
	return found ? found[0] : null
}

/** A table more than one block adds columns to: the document's whole table. */
export const isSharedTable = (table: DocTable): boolean =>
	new Set(table.columns.map((c) => c.block)).size > 1

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

export const TABLE_VIEW = 'table'
export const REPORT_VIEW = 'report'
export const CANVAS_VIEW = 'canvas'
export const COMPARE_VIEW = 'compare'

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
 * the lesson it grows on next, after it the whole canvas or the whole table.
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
		const open = current.blocks.find((b) => blockState(b, doc) !== 'done')
		return (open ?? current.blocks[0]).key
	}
	// The sheet is what the course builds up to (#351).
	if (doc.canvas) return CANVAS_VIEW
	if (Object.values(doc.tables).some(isSharedTable)) return TABLE_VIEW
	return doc.blocks[0]?.key ?? TABLE_VIEW
}

/**
 * A lesson's view of the whole table: the row's name, the computed columns —
 * the numbers a row is read by — then the lesson's own columns.
 */
export function viewColumns(table: DocTable, blockKey: string): DocColumn[] {
	const name = titleColumn(table)
	const own = table.columns.filter(
		(c) => c.block === blockKey && c.key !== name?.key
	)
	// Formulas of earlier lessons only: «Оценка» shows no residual rank from
	// «Ответы», «Ответы» show the rank «Оценка» computed.
	const first = table.columns.findIndex((c) => c.block === blockKey)
	const formulas = table.columns.filter(
		(c, i) => c.type === 'formula' && c.block !== blockKey && i < first
	)
	// The lesson's own formulas lead its columns too: the rank is what a row
	// is read by, and at the far end it scrolls out of sight.
	const ownFormulas = own.filter((c) => c.type === 'formula')
	const ownInputs = own.filter((c) => c.type !== 'formula')
	return [...(name ? [name] : []), ...formulas, ...ownFormulas, ...ownInputs]
}

// ---------------------------------------------------------------- the whole table

/**
 * Columns worth filtering by value: choices, references, and text with a
 * handful of distinct values — an owner or a stage, not a row's name.
 */
export function filterableColumns(table: DocTable): DocColumn[] {
	return table.columns.filter((c) => {
		if (c.type === 'select' || c.type === 'ref') return true
		if (c.type !== 'text') return false
		const values = new Set(
			table.rows.map((r) => r[c.key]).filter((v) => !isBlank(v))
		)
		return (
			values.size >= 2 && values.size <= 10 && values.size < table.rows.length
		)
	})
}

/** The distinct values a column holds, for its filter. */
export const columnValues = (table: DocTable, key: string): string[] =>
	[
		...new Set(
			table.rows
				.map((r) => r[key])
				.filter((v) => !isBlank(v))
				.map(String)
		),
	].sort((a, b) => a.localeCompare(b, 'ru'))

/** The first numeric formula — the rank — sorts the whole table, highest first. */
export const rankColumn = (table: DocTable): DocColumn | undefined =>
	table.columns.find(
		(c) =>
			c.type === 'formula' &&
			table.rows.some((r) => typeof r[c.key] === 'number')
	)

/**
 * The dates the whole table lives by — the date fields of the blocks that add
 * to it — with how far off they are.
 */
export interface TableDate {
	key: string
	title: string
	value: string
	/** Days from today; below zero once the date has passed. */
	days: number
}

export function tableDates(
	table: DocTable,
	doc: DocumentData,
	today: Date = new Date()
): TableDate[] {
	const blocks = new Set(table.columns.map((c) => c.block))
	const out: TableDate[] = []
	for (const block of doc.blocks) {
		if (!blocks.has(block.key)) continue
		for (const field of block.fields ?? []) {
			const value = doc.fields[field.key]
			if (field.type !== 'date' || typeof value !== 'string') continue
			const day = new Date(`${value}T00:00:00`)
			const start = new Date(
				today.getFullYear(),
				today.getMonth(),
				today.getDate()
			)
			const days = Math.round((day.getTime() - start.getTime()) / 86400000)
			out.push({ key: field.key, title: field.title, value, days })
		}
	}
	return out
}

/** The document's report: the first table with a report view, and the view. */
export function reportOf(
	doc: DocumentData
): { table: DocTable; view: ReportView } | null {
	for (const table of Object.values(doc.tables)) {
		const view = table.views.find((v) => v.type === 'report') as
			| ReportView
			| undefined
		if (view) return { table, view }
	}
	return null
}

/**
 * The rows and columns on screen as CSV, labels instead of scale numbers.
 * Numbers stay bare, not in groups of digits: a spreadsheet would read
 * «900 000» as text (learning-services#386).
 */
export function toCsv(
	columns: DocColumn[],
	rows: DocRow[],
	tables: Record<string, DocTable>
): string {
	const quote = (text: string) =>
		/[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
	const cell = (column: DocColumn, row: DocRow) => {
		const option = cellOptions(column, tables).find(
			(o) => String(o.value) === String(row[column.key])
		)
		if (column.type === 'formula' && typeof row[column.key] === 'boolean')
			return row[column.key] ? '✓' : ''
		return option && column.type !== 'select'
			? option.label
			: formatCell(column, row[column.key])
	}
	const lines = [
		['ID', ...columns.map((c) => c.title)],
		...rows.map((r) => [r.id, ...columns.map((c) => cell(c, r))]),
	]
	return lines.map((l) => l.map((v) => quote(String(v))).join(',')).join('\n')
}

/** Tables whose rows point at this one: a table of issues at the one they arise from. */
export const referringTables = (
	table: DocTable,
	tables: Record<string, DocTable>
): { table: DocTable; column: DocColumn }[] =>
	Object.values(tables).flatMap((other) =>
		other.columns
			.filter(
				(c) =>
					c.type === 'ref' && c.ref === table.name && c.block === other.owner
			)
			.map((column) => ({ table: other, column }))
	)

// ---------------------------------------------------------------- the whole canvas
//
// The document as one sheet (learning-services#351): the blocks placed as the
// course's canvas lays them out, each cell a summary of its block.

/** Rows of cells; a short row is padded with empty cells, CSS wants a rectangle. */
export function canvasRows(canvas: CanvasSpec): string[][] {
	const rows = canvas.grid
		.map((line) => line.trim().split(/\s+/).filter(Boolean))
		.filter((row) => row.length)
	const width = Math.max(0, ...rows.map((r) => r.length))
	return rows.map((row) => [
		...row,
		...Array<string>(width - row.length).fill('.'),
	])
}

/** A block key as a grid area name: a CSS identifier, whatever the key. */
export const canvasArea = (key: string): string =>
	`a-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`

/** The grid as `grid-template-areas`; «.» stays an empty cell. */
export const canvasAreas = (canvas: CanvasSpec): string =>
	canvasRows(canvas)
		.map(
			(row) =>
				`"${row
					.map((key) => (/^\.+$/.test(key) ? '.' : canvasArea(key)))
					.join(' ')}"`
		)
		.join(' ')

/** The cells in reading order — first appearance — for a phone and for tests. */
export const canvasKeys = (canvas: CanvasSpec): string[] => [
	...new Set(
		canvasRows(canvas)
			.flat()
			.filter((key) => !/^\.+$/.test(key))
	),
]

/** A cell's short title: the canvas's label, else the block's title. */
export const canvasLabel = (
	canvas: CanvasSpec,
	key: string,
	blocks: DocBlock[]
): string =>
	canvas.labels?.[key] || blocks.find((b) => b.key === key)?.title || key

export interface CanvasLine {
	text: string
	/** The field's title, where the line would not say what it is. */
	label?: string
	/**
	 * A yes/no formula, its title as the text: «✓ Title» when true, «Title: no»
	 * when false (learning-services#386).
	 */
	flag?: boolean
}

// Four digits stay whole (1000, not 1 000), as Russian typesetting does.
const NUMBER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const SHORT = new Intl.NumberFormat('ru-RU', {
	maximumFractionDigits: 2,
	useGrouping: false,
})

/**
 * A value to read, not to edit: numbers rounded and in groups of digits —
 * 900 000, 33,33 — as a Russian reader counts money and people.
 */
export function formatValue(
	field: { type: ColumnType },
	value: CellValue
): string {
	if (typeof value === 'number')
		return (Math.abs(value) < 10000 ? SHORT : NUMBER).format(value)
	return formatCell(field, value)
}

/** Markdown as a line of plain text, cut at a word near `limit`. */
export function plainExcerpt(markdown: string, limit = 200): string {
	const text = markdown
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
		.replace(/[*_`~|#]+/g, '')
		.replace(/\s+/g, ' ')
		.trim()
	if (text.length <= limit) return text
	const cut = text.slice(0, limit)
	const space = cut.lastIndexOf(' ')
	return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** A field's value: the document's live copy, else what the block carries. */
const fieldValue = (field: DocField, doc: DocumentData): CellValue =>
	field.key in doc.fields ? doc.fields[field.key] : field.value

function fieldLine(
	field: DocField,
	doc: DocumentData,
	label: boolean
): CanvasLine | null {
	const value = fieldValue(field, doc)
	if (field.type === 'formula' && typeof value === 'boolean')
		return { text: field.title, flag: value }
	if (isBlank(value)) return null
	const text = formatValue(field, value)
	return label ? { text, label: field.title } : { text }
}

/**
 * Each row as its name followed by the columns' values, « · » between. A row
 * the columns say nothing about stays out; the name counts when it is asked.
 */
function rowLines(table: DocTable, columns: DocColumn[]): CanvasLine[] {
	const name = titleColumn(table)
	const named = columns.some((c) => c.key === name?.key)
	const rest = columns.filter((c) => c.key !== name?.key)
	const lines: CanvasLine[] = []
	for (const row of table.rows) {
		const title = name ? formatCell(name, row[name.key]) : ''
		const values = rest
			.map((c) => formatValue(c, row[c.key]))
			.filter((v) => v !== '')
		if (!values.length && !(named && title)) continue
		lines.push({ text: [title || row.id, ...values].join(' · ') })
	}
	return lines
}

/**
 * What a canvas cell shows of its block. The canvas may name the fields and
 * columns; otherwise the block's filled fields, the rows it fills, or the
 * start of its text.
 */
export function cellSummary(
	block: DocBlock,
	doc: DocumentData,
	canvas?: CanvasSpec | null
): CanvasLine[] {
	const keys = canvas?.summary?.[block.key]
	return keys?.length
		? namedSummary(block, doc, keys, canvas?.sketch)
		: defaultSummary(block, doc)
}

type RowGroup = { table: DocTable; columns: DocColumn[] }

function namedSummary(
	block: DocBlock,
	doc: DocumentData,
	keys: string[],
	sketch?: string | null
): CanvasLine[] {
	// The block's own fields and table first; the sketch's fields are keyed
	// by the canvas's block keys and would shadow a column of the same name.
	const own = block.table ? doc.tables[block.table] : undefined
	const tables = [
		...(own ? [own] : []),
		...Object.values(doc.tables).filter((t) => t !== own),
	]
	const others = doc.blocks
		.filter((b) => b !== block && b.key !== sketch)
		.flatMap((b) => b.fields ?? [])
	const findColumn = (key: string) => {
		for (const table of tables) {
			const column = table.columns.find((c) => c.key === key)
			if (column) return { table, column }
		}
		return null
	}
	// Columns of one table make one line per row, where the first of them is.
	const parts: (CanvasLine | RowGroup)[] = []
	for (const key of keys) {
		const field =
			(block.fields ?? []).find((f) => f.key === key) ??
			(findColumn(key) ? undefined : others.find((f) => f.key === key))
		if (field) {
			// A bare number says nothing in a cell: «10» of what.
			const line = fieldLine(
				field,
				doc,
				field.type === 'number' || field.type === 'formula'
			)
			if (line) parts.push(line)
			continue
		}
		const found = findColumn(key)
		if (!found) continue
		const group = parts.find(
			(p): p is RowGroup => 'table' in p && p.table === found.table
		)
		if (group) group.columns.push(found.column)
		else parts.push({ table: found.table, columns: [found.column] })
	}
	return parts.flatMap((p) =>
		'table' in p ? rowLines(p.table, p.columns) : [p]
	)
}

function defaultSummary(block: DocBlock, doc: DocumentData): CanvasLine[] {
	const lines = (block.fields ?? [])
		.map((f) => fieldLine(f, doc, true))
		.filter((l): l is CanvasLine => Boolean(l))
	const table = block.table ? doc.tables[block.table] : undefined
	if (table) {
		const own = (block.columns ?? table.columns).filter(
			(c) => c.block === block.key
		)
		lines.push(...rowLines(table, own))
	}
	if (lines.length) return lines
	const text = block.content ? plainExcerpt(block.content) : ''
	if (text) return [{ text }]
	if (block.file) return [{ text: block.file.name }]
	if (block.url) return [{ text: block.url }]
	return []
}

/** The student's first sketch of a cell, from the canvas's sketch block. */
export function sketchValue(
	doc: DocumentData,
	canvas: CanvasSpec,
	key: string
): string {
	const sketch = doc.blocks.find((b) => b.key === canvas.sketch)
	const field = sketch?.fields?.find((f) => f.key === key)
	if (!field) return ''
	// The block's own copy first: the sketch's field keys are the canvas's
	// block keys and may name something else in the flat `fields`.
	const value = field.value !== undefined ? field.value : doc.fields[key]
	return isBlank(value) ? '' : formatValue(field, value)
}
