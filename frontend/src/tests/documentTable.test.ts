import { describe, expect, it } from 'vitest'
import {
	cellOptions,
	columnGroups,
	filterRows,
	flagColumns,
	formatCell,
	isMissing,
	isToClarify,
	matrix,
	reportRows,
	sortRows,
	type DocBlock,
	type DocTable,
} from '@/utils/documentTable'

// learning-services#331: the risk register as the page arranges it.

const block = (key: string, title: string): DocBlock =>
	({
		key,
		title,
		hint: '',
		lesson: null,
		span: 1,
		kind: 'text',
		accept: [],
		content: '',
		file: null,
		url: null,
		preview: null,
	} as DocBlock)

const blocks = [
	block('risks', 'Риски'),
	block('assessment', 'Оценка'),
	block('responses', 'Ответы'),
]

const scale: DocTable = {
	name: 'probability_scale',
	title: 'Шкала вероятности',
	owner: 'probability_scale',
	prefix: 'P',
	views: [],
	markdown: '',
	columns: [
		{ key: 'score', title: 'Балл', type: 'number', block: 'probability_scale' },
		{
			key: 'level',
			title: 'Уровень',
			type: 'text',
			block: 'probability_scale',
		},
	],
	rows: [
		{ id: 'P1', score: 1, level: 'Редко' },
		{ id: 'P4', score: 4, level: 'Вероятно' },
	],
}

const register: DocTable = {
	name: 'register',
	title: 'Реестр',
	owner: 'risks',
	prefix: 'R',
	markdown: '',
	views: [
		{ type: 'matrix', x: 'impact', y: 'probability', highlight: 'in_work' },
		{
			type: 'report',
			filter: 'sponsor',
			columns: ['event', 'rank'],
			field: 'next_report',
		},
	],
	columns: [
		{
			key: 'event',
			title: 'Событие',
			type: 'text',
			block: 'risks',
			required: true,
		},
		{
			key: 'kind',
			title: 'Вид',
			type: 'select',
			block: 'risks',
			options: ['угроза', 'возможность'],
		},
		{
			key: 'probability',
			title: 'Вероятность',
			type: 'scale',
			block: 'assessment',
			min: 1,
			max: 5,
			labels: 'probability_scale',
			required: true,
		},
		{
			key: 'impact',
			title: 'Влияние',
			type: 'scale',
			block: 'assessment',
			min: 1,
			max: 5,
			required: true,
		},
		{ key: 'rank', title: 'Ранг', type: 'formula', block: 'assessment' },
		{ key: 'in_work', title: 'В работе', type: 'formula', block: 'assessment' },
		{
			key: 'measure',
			title: 'Мера',
			type: 'text',
			block: 'responses',
			required: 'in_work',
		},
		{ key: 'sponsor', title: 'Спонсору', type: 'check', block: 'responses' },
	],
	rows: [
		{
			id: 'R1',
			event: 'Подрядчик уйдёт',
			kind: 'угроза',
			probability: 4,
			impact: 4,
			rank: 16,
			in_work: true,
			sponsor: true,
		},
		{
			id: 'R2',
			event: 'Отпуск Анны',
			kind: 'угроза',
			probability: 2,
			impact: 3,
			rank: 6,
			in_work: false,
		},
		{
			id: 'R10',
			event: 'Готовый модуль',
			kind: 'возможность',
			measure: 'уточнить у Игоря',
			in_work: null,
		},
	],
}

describe('columns and rows', () => {
	it('groups columns under the block that adds them', () => {
		expect(
			columnGroups(register, blocks).map((g) => [g.title, g.columns.length])
		).toEqual([
			['Риски', 2],
			['Оценка', 4],
			['Ответы', 2],
		])
	})

	it('requires a cell always or when its condition holds', () => {
		const measure = register.columns.find((c) => c.key === 'measure')!
		expect(isMissing(measure, register.rows[0])).toBe(true) // in work, no measure
		expect(isMissing(measure, register.rows[1])).toBe(false) // not in work
		const probability = register.columns.find((c) => c.key === 'probability')!
		expect(isMissing(probability, register.rows[2])).toBe(true)
	})

	it('flags «уточнить у …» as filled but worth a look', () => {
		expect(isToClarify('уточнить у Игоря')).toBe(true)
		expect(isToClarify('Договор до 1 марта')).toBe(false)
	})

	it('offers boolean formulas as filters', () => {
		expect(flagColumns(register).map((c) => c.key)).toEqual(['in_work'])
	})

	it('filters by flag, by empty cells and by text', () => {
		expect(filterRows(register, { flag: 'in_work' }).map((r) => r.id)).toEqual([
			'R1',
		])
		expect(filterRows(register, { missing: true }).map((r) => r.id)).toEqual([
			'R1',
			'R10',
		])
		expect(filterRows(register, { search: 'анны' }).map((r) => r.id)).toEqual([
			'R2',
		])
	})

	it('sorts numbers, IDs by their number, blanks last', () => {
		expect(sortRows(register.rows, 'rank', 'desc').map((r) => r.id)).toEqual([
			'R1',
			'R2',
			'R10',
		])
		expect(sortRows(register.rows, 'id', 'desc').map((r) => r.id)).toEqual([
			'R10',
			'R2',
			'R1',
		])
		expect(sortRows(register.rows, 'rank', 'asc').map((r) => r.id)).toEqual([
			'R2',
			'R1',
			'R10',
		])
	})
})

describe('pickers and text', () => {
	it('labels a scale from its table', () => {
		const probability = register.columns.find((c) => c.key === 'probability')!
		const options = cellOptions(probability, { probability_scale: scale })
		expect(options).toHaveLength(5)
		expect(options[3]).toEqual({ value: 4, label: '4 — Вероятно' })
		expect(options[2]).toEqual({ value: 3, label: '3' })
	})

	it('offers a reference by the row it points at', () => {
		const goals: DocTable = {
			...scale,
			name: 'goals',
			columns: [
				{
					key: 'goal',
					title: 'Цель',
					type: 'text',
					block: 'goals',
					required: true,
				},
			],
			rows: [{ id: 'G1', goal: 'Запуск до сезона' }],
		}
		const options = cellOptions(
			{ key: 'goal', title: 'Цель', type: 'ref', block: 'risks', ref: 'goals' },
			{ goals }
		)
		expect(options).toEqual([{ value: 'G1', label: 'G1 — Запуск до сезона' }])
	})

	it('writes dates the Russian way and ticks as a mark', () => {
		expect(formatCell({ type: 'date' }, '2027-03-05')).toBe('05.03.2027')
		expect(formatCell({ type: 'check' }, true)).toBe('✓')
		expect(formatCell({ type: 'formula' }, 16)).toBe('16')
	})
})

describe('views', () => {
	it('places scored rows on the matrix, the rest apart', () => {
		const grid = matrix(register, register.views[0] as never)
		expect(grid.ys).toEqual([5, 4, 3, 2, 1])
		const cell = grid.cells[grid.ys.indexOf(4)][grid.xs.indexOf(4)]
		expect(cell.rows.map((r) => r.id)).toEqual(['R1'])
		expect(cell.highlighted).toBe(true)
		expect(grid.unplaced.map((r) => r.id)).toEqual(['R10'])
	})

	it('reports the ticked rows in the chosen columns', () => {
		const report = reportRows(register, register.views[1] as never)
		expect(report.rows.map((r) => r.id)).toEqual(['R1'])
		expect(report.columns.map((c) => c.key)).toEqual(['event', 'rank'])
	})
})

// ---------------------------------------------------------------- workspace (#342)

import {
	blockState,
	defaultView,
	lessonAhead,
	outline,
	readyLine,
	TABLE_VIEW,
	titleColumn,
	viewColumns,
	type DocumentData,
} from '@/utils/documentTable'

describe('workspace', () => {
	const lesson = (key: string, lessonId: string | null, extra = {}) =>
		({ ...block(key, key), lesson: lessonId, ...extra } as DocBlock)
	const doc = (blocks: DocBlock[], tables = {}): DocumentData =>
		({
			course: 'c1',
			artifact: 'risk_register',
			title: 'Реестр',
			layout: 'sections',
			blocks,
			tables,
			fields: {},
		} as DocumentData)

	it('names where a document stands in one word', () => {
		const register = {
			...scale,
			name: 'probability_scale',
			owner: 'scale',
			preset: true,
		}
		const d = doc([], { probability_scale: register })
		expect(blockState(lesson('a', null, { filled: true }), d)).toBe('done')
		expect(
			blockState(
				lesson('scale', null, {
					table: 'probability_scale',
					columns: scale.columns,
					filled: false,
				}),
				d
			)
		).toBe('preset')
		expect(
			blockState(
				lesson('b', null, {
					content: 'черновик',
					filled: false,
					columns: [],
					fields: [],
				}),
				d
			)
		).toBe('progress')
		expect(blockState(lesson('c', null), d)).toBe('empty')
	})

	it('takes «Готов, когда…» out of the hint', () => {
		expect(readyLine('Для агента. Готов, когда шкалы записаны. Ещё')).toBe(
			'Готов, когда шкалы записаны.'
		)
		expect(readyLine('Без критерия')).toBeNull()
	})

	it('groups documents by lesson in course order, the rest last', () => {
		const d = doc([
			lesson('worries', 'l1'),
			lesson('goals', 'l2'),
			lesson('stages', 'l2'),
			lesson('free', null),
		])
		const groups = outline(d, [
			{ id: 'l1', number: 1, title: 'Риск' },
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

	it('opens on the current lesson, then on the whole table after the course', () => {
		const d = doc(
			[
				lesson('goals', 'l2', { filled: true }),
				lesson('stages', 'l2', { filled: false }),
			],
			{ register }
		)
		const groups = outline(d, [{ id: 'l2', number: 2, title: 'Цели' }])
		expect(defaultView(d, groups, 'l2')).toBe('stages')
		expect(defaultView(d, groups, null)).toBe(TABLE_VIEW)
	})

	it('names the lesson the document grows on next, not the course’s next', () => {
		// The course's next lesson may build nothing of this document: the
		// card said «Урок 1» for a register begun on lesson 4 (#462).
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
		// Its lessons are behind, or the course is: no lesson to name.
		expect(
			lessonAhead(lessons.slice(0, 3), 'l3', builds)
		).toBeNull()
		expect(lessonAhead(lessons, null, builds)).toBeNull()
	})

	it('opens on the lesson the document grows on next', () => {
		const d = doc([
			lesson('worries', 'l1', { filled: true }),
			lesson('review', 'l4', { filled: false }),
		])
		const course = [
			{ id: 'l1', number: 1, title: 'Риск' },
			{ id: 'l2', number: 2, title: 'Цели' },
			{ id: 'l4', number: 4, title: 'Ревью' },
		]
		const groups = outline(d, course)
		// Lesson 2 builds nothing of it: the first block is lesson 1's, already
		// behind — the document opens on lesson 4, where it is written next.
		expect(defaultView(d, groups, 'l2', course)).toBe('review')
		expect(defaultView(d, groups, 'l1', course)).toBe('worries')
	})

	it('names a row by the first required text column, whatever its key', () => {
		// No course's key is special (learning-services#360): a column keyed
		// `event` names the row only when the generic rule picks it.
		const columns = [
			{ key: 'event', title: 'Событие', type: 'text', block: 'a' },
			{
				key: 'problem',
				title: 'Проблема',
				type: 'text',
				block: 'a',
				required: true,
			},
		] as DocTable['columns']
		expect(titleColumn({ ...register, columns })?.key).toBe('problem')
		expect(titleColumn({ ...register, columns: [columns[0]] })?.key).toBe(
			'event'
		)
		expect(titleColumn(register)?.key).toBe('event')
	})

	it('shows a lesson the name, earlier formulas and its own columns', () => {
		expect(viewColumns(register, 'responses').map((c) => c.key)).toEqual([
			'event',
			'rank',
			'in_work',
			'measure',
			'sponsor',
		])
		// Its own formulas lead: the rank is what a row is read by.
		expect(viewColumns(register, 'assessment').map((c) => c.key)).toEqual([
			'event',
			'rank',
			'in_work',
			'probability',
			'impact',
		])
	})
})
