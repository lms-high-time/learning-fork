/**
 * A course document's table as the page shows it (learning-services#331):
 * columns grouped by the block that adds them, sorting, filters, the cells a
 * block still lacks, the matrix and the sponsor report. The server owns the
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
	type: Exclude<ColumnType, 'scale' | 'ref' | 'check' | 'formula'>
	options?: string[]
	required?: boolean
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
	views: (MatrixView | ReportView)[]
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

/** The first text column: what names a row where there is room for one cell. */
export function titleColumn(table: DocTable): DocColumn | undefined {
	return (
		table.columns.find((c) => c.key === 'event') ??
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
// its own document, grouped under its lesson, with the whole register and the
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
	const touched =
		Boolean(block.content || block.file || block.url) ||
		(block.fields ?? []).some((f) => !isBlank(doc.fields[f.key])) ||
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

/** A table more than one block adds columns to: the register. */
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

export const REGISTER_VIEW = 'register'
export const REPORT_VIEW = 'report'

/**
 * Where the document opens: during the course the current lesson's first
 * unfinished block, after it the whole register.
 */
export function defaultView(
	doc: DocumentData,
	groups: OutlineGroup[],
	currentLesson: string | null | undefined
): string {
	const current = groups.find((g) => g.lesson?.id === currentLesson)
	if (current) {
		const open = current.blocks.find((b) => blockState(b, doc) !== 'done')
		return (open ?? current.blocks[0]).key
	}
	if (Object.values(doc.tables).some(isSharedTable)) return REGISTER_VIEW
	return doc.blocks[0]?.key ?? REGISTER_VIEW
}

/**
 * A lesson's view of the register: the row's name, the computed columns —
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
