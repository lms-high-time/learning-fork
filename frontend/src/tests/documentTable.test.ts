import { describe, expect, it } from 'vitest'
import {
	blockState,
	conditionTitle,
	defaultView,
	filterRows,
	isMissing,
	isRequired,
	isToClarify,
	lessonAhead,
	outline,
	sortRows,
	titleColumn,
	type DocBlock,
	type DocColumn,
	type DocumentData,
	type ManyBlock,
	type OneBlock,
} from '@/utils/documentTable'

// learning-services#515: a document is the release's sections — rows for a
// `many` section, fields for a `one` — and every value is text.

const columns: DocColumn[] = [
	{ key: 'topic', title: 'Тема', required: true },
	{ key: 'driver', title: 'Драйвер', required: false },
	{ key: 'area', title: 'Область', required: { if_column: 'driver' } },
]

const agreements: ManyBlock = {
	key: 'agreements',
	title: 'Договорённости',
	description: 'Что сюда записывают',
	lesson: 'l1',
	rows: 'many',
	columns,
	items: [
		{ id: 'A1', topic: 'Ретро раз в две недели', driver: 'Сроки' },
		{ id: 'A2', topic: 'Созвоны по вторникам', area: 'уточнить у Анны' },
		{ id: 'A10', topic: 'Демо в пятницу' },
	],
	filled: false,
	empty_cells: [{ row: 'A1', column: 'area' }],
}

const howWeDecide: OneBlock = {
	key: 'how_we_decide',
	title: 'Как мы решаем',
	lesson: 'l2',
	rows: 'one',
	columns: [
		{ key: 'default_method', title: 'Способ', required: true },
		{ key: 'exception', title: 'Исключение', required: false },
		{
			key: 'who_decides',
			title: 'Кто решает',
			required: { if_column: 'exception' },
		},
	],
	values: { default_method: 'Согласие' },
	filled: true,
	empty_cells: [],
}

describe('columns and rows', () => {
	it('requires a cell always, or when its condition is filled', () => {
		const [topic, driver, area] = columns
		expect(isRequired(topic, {})).toBe(true)
		expect(isRequired(driver, { driver: 'x' })).toBe(false)
		expect(isRequired(area, {})).toBe(false)
		expect(isRequired(area, { driver: '  ' })).toBe(false)
		expect(isRequired(area, { driver: 'Сроки' })).toBe(true)
		expect(isMissing(area, agreements.items[0])).toBe(true)
		expect(isMissing(area, agreements.items[1])).toBe(false)
		expect(isMissing(topic, agreements.items[2])).toBe(false)
	})

	it('holds a field of a `one` section to the same rule', () => {
		const [, , who] = howWeDecide.columns
		expect(isMissing(who, howWeDecide.values)).toBe(false)
		expect(isMissing(who, { exception: 'Бюджет' })).toBe(true)
	})

	it('names the column a condition depends on', () => {
		expect(conditionTitle(columns[2], columns)).toBe('Драйвер')
		expect(conditionTitle(columns[0], columns)).toBeNull()
		expect(
			conditionTitle(
				{ key: 'x', title: 'X', required: { if_column: 'gone' } },
				columns
			)
		).toBe('gone')
	})

	it('flags «уточнить у …» as filled but worth a look', () => {
		expect(isToClarify('уточнить у Анны')).toBe(true)
		expect(isToClarify('Уточнить')).toBe(true)
		expect(isToClarify('уточнитель')).toBe(false)
		expect(isToClarify(null)).toBe(false)
	})

	it('filters by empty cells and by text', () => {
		const ids = (rows: { id: string }[]) => rows.map((r) => r.id)
		expect(
			ids(filterRows(agreements.items, columns, { missing: true }))
		).toEqual(['A1'])
		expect(
			ids(filterRows(agreements.items, columns, { search: 'ДЕМО' }))
		).toEqual(['A10'])
		expect(
			ids(filterRows(agreements.items, columns, { search: 'a2' }))
		).toEqual(['A2'])
	})

	it('sorts IDs by their number and text by the alphabet, blanks last', () => {
		const ids = (key: string, direction?: 'asc' | 'desc') =>
			sortRows(agreements.items, key, direction).map((r) => r.id)
		expect(ids('id')).toEqual(['A1', 'A2', 'A10'])
		expect(ids('id', 'desc')).toEqual(['A10', 'A2', 'A1'])
		expect(ids('topic')).toEqual(['A10', 'A1', 'A2'])
		expect(ids('driver', 'desc')).toEqual(['A1', 'A2', 'A10'])
		expect(sortRows(agreements.items, null)).toBe(agreements.items)
	})

	// learning-services#765: the alphabet is the page's, not Russian always.
	it('sorts text by the alphabet of the page language', () => {
		const rows = [
			{ id: 'A1', topic: 'zebra' },
			{ id: 'A2', topic: 'äpple' },
		]
		const ids = (lang: string) =>
			sortRows(rows, 'topic', 'asc', lang).map((r) => r.id)
		expect(ids('en')).toEqual(['A2', 'A1'])
		expect(ids('sv')).toEqual(['A1', 'A2'])
		document.documentElement.lang = 'sv'
		try {
			expect(sortRows(rows, 'topic').map((r) => r.id)).toEqual(['A1', 'A2'])
		} finally {
			document.documentElement.lang = ''
		}
	})

	it('names a row by the first always-required column, whatever its key', () => {
		// No course's key is special (learning-services#360).
		expect(titleColumn(columns)?.key).toBe('topic')
		expect(titleColumn([columns[1], columns[2]])?.key).toBe('driver')
		expect(titleColumn([])).toBeUndefined()
	})
})

describe('workspace', () => {
	const many = (key: string, lesson: string | null, extra = {}): DocBlock => ({
		...agreements,
		key,
		title: key,
		lesson,
		items: [],
		filled: false,
		...extra,
	})
	const doc = (blocks: DocBlock[]): DocumentData => ({
		course: 'c1',
		artifact: 'agreements_log',
		title: 'Журнал',
		blocks,
	})

	it('names where a document stands in one word', () => {
		expect(blockState(agreements)).toBe('progress')
		expect(blockState({ ...agreements, filled: true })).toBe('done')
		expect(blockState({ ...agreements, items: [] })).toBe('empty')
		expect(blockState({ ...howWeDecide, filled: false })).toBe('progress')
		expect(
			blockState({ ...howWeDecide, filled: false, values: { a: ' ' } })
		).toBe('empty')
	})

	it('groups documents by lesson in course order, the rest last', () => {
		const d = doc([
			many('worries', 'l1'),
			many('goals', 'l2'),
			many('stages', 'l2'),
			many('free', null),
		])
		const groups = outline(d, [
			{ id: 'l1', number: 1, title: 'Первый' },
			{ id: 'l2', number: 2, title: 'Цели' },
			{ id: 'l3', number: 3, title: 'Пусто' },
		])
		expect(
			groups.map((g) => [g.lesson?.id ?? null, g.blocks.map((b) => b.key)])
		).toEqual([
			['l1', ['worries']],
			['l2', ['goals', 'stages']],
			[null, ['free']],
		])
	})

	it('names the lesson the document grows on next, not the course’s next', () => {
		// The course's next lesson may build nothing of this document (#462).
		const lessons = [
			{ id: 'l1', builds: false },
			{ id: 'l2', builds: true },
			{ id: 'l3', builds: false },
			{ id: 'l4', builds: true },
		]
		const builds = (l: { builds: boolean }) => l.builds
		expect(lessonAhead(lessons, 'l1', builds)?.id).toBe('l2')
		expect(lessonAhead(lessons, 'l2', builds)?.id).toBe('l2')
		expect(lessonAhead(lessons, 'l3', builds)?.id).toBe('l4')
		expect(lessonAhead(lessons.slice(0, 3), 'l3', builds)).toBeNull()
		expect(lessonAhead(lessons, null, builds)).toBeNull()
	})

	it('opens on the lesson the document grows on next, else on its first block', () => {
		const d = doc([
			many('worries', 'l1', { filled: true }),
			many('goals', 'l4', { filled: true }),
			many('review', 'l4', { filled: false }),
		])
		const course = [
			{ id: 'l1', number: 1, title: 'Первый' },
			{ id: 'l2', number: 2, title: 'Цели' },
			{ id: 'l4', number: 4, title: 'Ревью' },
		]
		const groups = outline(d, course)
		// The first unfinished block of that lesson.
		expect(defaultView(d, groups, 'l2', course)).toBe('review')
		expect(defaultView(d, groups, 'l1', course)).toBe('worries')
		// After the course: the first block.
		expect(defaultView(d, groups, null, course)).toBe('worries')
		expect(defaultView(doc([]), [], null, [])).toBe('')
	})
})
