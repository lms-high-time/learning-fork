import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import {
	blockState,
	canvasAreas,
	canvasArea,
	canvasKeys,
	canvasLabel,
	canvasRows,
	cellSummary,
	CANVAS_VIEW,
	defaultView,
	outline,
	plainExcerpt,
	sketchValue,
	type CanvasSpec,
	type DocBlock,
	type DocTable,
	type DocumentData,
} from '@/utils/documentTable'

// learning-services#351: the whole canvas, «было → стало» and the fields the
// server computes.

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label'],
		emits: ['click'],
		template:
			'<button type="button" @click="$emit(\'click\')">{{ label }}<slot name="prefix" /></button>',
	},
}))
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: false }),
}))

import BlockFields from '@/components/Documents/BlockFields.vue'
import CanvasPanel from '@/components/Documents/CanvasPanel.vue'
import ComparePanel from '@/components/Documents/ComparePanel.vue'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (m, n) =>
				args[Number(n)] === undefined ? m : String(args[Number(n)])
			),
	}
}
const global = {
	mocks: { __ },
	stubs: {
		'router-link': {
			props: ['to'],
			template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
		},
	},
}
beforeEach(() => vi.stubGlobal('__', __))

const block = (key: string, title: string, extra = {}): DocBlock =>
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
		fields: [],
		...extra,
	} as DocBlock)

const segments: DocTable = {
	name: 'segments',
	title: 'Сегменты',
	owner: 'segments',
	prefix: 'S',
	markdown: '',
	views: [],
	columns: [
		{
			key: 'name',
			title: 'Сегмент',
			type: 'text',
			block: 'segments',
			required: true,
		},
		{ key: 'size', title: 'Размер', type: 'number', block: 'segments' },
		{ key: 'early', title: 'Ранний', type: 'text', block: 'segments' },
	],
	rows: [
		{ id: 'S1', name: 'Кофейни', size: 120, early: 'да' },
		{ id: 'S2', name: 'Пекарни', size: null, early: '' },
	],
}

const canvas: CanvasSpec = {
	grid: ['problem uvp segments', 'metrics uvp segments', 'costs costs costs'],
	labels: { uvp: 'Обещание' },
	sketch: 'first_sketch',
	summary: { problem: ['pain', 'alternative'], segments: ['size'] },
}

const blocks: DocBlock[] = [
	block('first_sketch', 'Первый набросок', {
		lesson: 'l1',
		fields: [
			{
				key: 'problem',
				title: 'Проблема',
				type: 'longtext',
				value: 'Ищут подрядчика',
			},
			{ key: 'uvp', title: 'Обещание', type: 'longtext', value: null },
		],
	}),
	block('problem', 'Проблема', {
		fields: [
			{ key: 'pain', title: 'Боль', type: 'longtext' },
			{ key: 'alternative', title: 'Альтернатива', type: 'text' },
			{ key: 'note', title: 'Заметка', type: 'text' },
		],
	}),
	block('uvp', 'Уникальное ценностное предложение', {
		content:
			'## Обещание\n\n**Ремонт** за [30 дней](https://x.ru), без _сюрпризов_.',
	}),
	block('segments', 'Сегменты', {
		table: 'segments',
		columns: segments.columns,
	}),
	block('metrics', 'Метрики', {
		fields: [
			{ key: 'price', title: 'Цена', type: 'number' },
			{
				key: 'ratio',
				title: 'Доля',
				type: 'formula',
				formula: 'stage_goal / price',
			},
			{ key: 'fits', title: 'Сходится', type: 'formula', formula: 'x' },
		],
	}),
	block('costs', 'Издержки'),
]

const doc: DocumentData = {
	course: 'c1',
	artifact: 'lean_canvas',
	title: 'Lean Canvas',
	layout: 'canvas',
	blocks,
	tables: { segments },
	fields: {
		pain: 'Долгий поиск',
		alternative: 'Сарафан',
		note: 'не на холст',
		price: 5000,
		ratio: 0.33333,
		fits: true,
	},
	canvas,
}

describe('canvas helpers', () => {
	it('turns the grid into areas, padding a short row and keeping «.»', () => {
		expect(canvasAreas(canvas)).toBe(
			'"a-problem a-uvp a-segments" "a-metrics a-uvp a-segments" "a-costs a-costs a-costs"'
		)
		expect(canvasRows({ grid: ['a b c', 'd .'] })).toEqual([
			['a', 'b', 'c'],
			['d', '.', '.'],
		])
		expect(canvasAreas({ grid: ['x.y 1st', '. .'] })).toBe(
			'"a-x_y a-1st" ". ."'
		)
		expect(canvasArea('проблема')).toMatch(/^a-[\w-]+$/)
	})

	it('reads the cells in order of first appearance', () => {
		expect(canvasKeys(canvas)).toEqual([
			'problem',
			'uvp',
			'segments',
			'metrics',
			'costs',
		])
	})

	it('titles a cell by its label, else by its block', () => {
		expect(canvasLabel(canvas, 'uvp', blocks)).toBe('Обещание')
		expect(canvasLabel(canvas, 'metrics', blocks)).toBe('Метрики')
	})

	it('summarises a cell by the keys the canvas names', () => {
		expect(cellSummary(blocks[1], doc, canvas)).toEqual([
			{ text: 'Долгий поиск' },
			{ text: 'Сарафан' },
		])
		// A column: each row by its name, then the value; a row without one
		// stays out.
		expect(cellSummary(blocks[3], doc, canvas)).toEqual([
			{ text: 'Кофейни · 120' },
		])
	})

	it('summarises by default: fields, a yes/no formula as a flag, rows, text', () => {
		expect(cellSummary(blocks[4], doc, canvas)).toEqual([
			{ text: '5000', label: 'Цена' },
			{ text: '0.33', label: 'Доля' },
			{ text: 'Сходится', flag: true },
		])
		expect(cellSummary(blocks[3], doc)).toEqual([
			{ text: 'Кофейни · 120 · да' },
			{ text: 'Пекарни' },
		])
		expect(cellSummary(blocks[2], doc, canvas)).toEqual([
			{ text: 'Обещание Ремонт за 30 дней, без сюрпризов.' },
		])
		expect(cellSummary(blocks[5], doc, canvas)).toEqual([])
	})

	it('cuts long text at a word', () => {
		const text = plainExcerpt('слово '.repeat(60))
		expect(text.length).toBeLessThanOrEqual(201)
		expect(text.endsWith('слово…')).toBe(true)
	})

	it('reads the first sketch from the sketch block', () => {
		expect(sketchValue(doc, canvas, 'problem')).toBe('Ищут подрядчика')
		expect(sketchValue(doc, canvas, 'uvp')).toBe('')
		expect(sketchValue(doc, canvas, 'costs')).toBe('')
	})

	it('does not count a computed field as the student starting', () => {
		const d = { ...doc, fields: { fits: true } }
		expect(blockState(blocks[4], d)).toBe('empty')
	})

	it('opens on the canvas after the course, on the lesson during it', () => {
		const groups = outline(doc, [{ id: 'l1', number: 1, title: 'Набросок' }])
		expect(defaultView(doc, groups, null)).toBe(CANVAS_VIEW)
		expect(defaultView(doc, groups, 'l1')).toBe('first_sketch')
		expect(defaultView({ ...doc, canvas: null }, groups, null)).toBe(
			'first_sketch'
		)
	})
})

describe('BlockFields', () => {
	const fields = (values: DocumentData['fields']) =>
		mount(BlockFields, {
			props: {
				fields: [
					{ key: 'price', title: 'Цена', type: 'number', required: true },
					{
						key: 'ratio',
						title: 'Доля',
						type: 'formula',
						formula: 'a / b',
						required: true,
					},
					{ key: 'fits', title: 'Сходится', type: 'formula', formula: 'x' },
				],
				values,
			},
			global,
		})

	it('shows a formula as a value, not an input, and never as missing', () => {
		const wrapper = fields({ price: 5000, ratio: 0.33333, fits: true })
		expect(wrapper.findAll('input')).toHaveLength(1)
		const ratio = wrapper.get('[data-testid="formula-ratio"]')
		expect(ratio.text()).toBe('0.33')
		expect(wrapper.text()).toContain('Доля')
		expect(wrapper.findAll('.is-missing')).toHaveLength(0)
	})

	it('shows a yes/no formula as a badge', () => {
		const yes = fields({ fits: true }).get('[data-testid="formula-fits"] span')
		expect(yes.text()).toBe('Yes')
		expect(yes.classes()).toContain('text-ink-green-8')
		const no = fields({ fits: false }).get('[data-testid="formula-fits"] span')
		expect(no.text()).toBe('No')
		expect(no.classes()).toContain('text-ink-red-7')
		expect(
			fields({ ratio: null }).get('[data-testid="formula-ratio"]').text()
		).toBe('—')
	})
})

describe('CanvasPanel', () => {
	const panel = () =>
		mount(CanvasPanel, {
			props: { document: doc, canvas, courseTitle: 'Lean-старт' },
			global,
		})

	it('lays the cells out in the grid with labels and summaries', () => {
		const wrapper = panel()
		expect(wrapper.get('h1').text()).toBe('The whole canvas')
		expect(wrapper.text()).toContain('Lean-старт')
		const grid = wrapper.get('[data-testid="canvas-grid"]')
		expect(grid.attributes('style')).toContain('grid-template-areas')
		const cell = (key: string) =>
			wrapper.get(`[data-testid="canvas-cell-${key}"]`)
		expect(cell('uvp').attributes('data-area')).toBe('a-uvp')
		expect(cell('uvp').attributes('style')).toContain('grid-area: a-uvp')
		expect(cell('uvp').get('[data-testid="canvas-label"]').text()).toBe(
			'Обещание'
		)
		expect(cell('problem').text()).toContain('Долгий поиск')
		expect(cell('problem').text()).not.toContain('не на холст')
		expect(cell('metrics').get('[data-flag]').text()).toBe('✓ Сходится')
		expect(cell('costs').get('[data-testid="canvas-empty"]').text()).toBe(
			'empty'
		)
		expect(
			cell('costs').get('[data-testid="canvas-state"]').attributes('data-state')
		).toBe('empty')
	})

	it('opens a block from its cell', () => {
		const to = JSON.parse(
			panel()
				.get('[data-testid="canvas-cell-segments"]')
				.attributes('data-to') as string
		)
		expect(to).toEqual({
			name: 'Document',
			params: { courseName: 'c1', artifact: 'lean_canvas', view: 'segments' },
		})
	})

	it('prints on a landscape page only while it is open', async () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => {})
		const styles = () =>
			document.head.querySelectorAll('style[data-canvas-page]')
		const before = styles().length
		const wrapper = panel()
		await wrapper.get('[data-testid="print-canvas"]').trigger('click')
		expect(print).toHaveBeenCalled()
		expect(styles()).toHaveLength(before + 1)
		expect(styles()[before].textContent).toContain('A4 landscape')
		wrapper.unmount()
		expect(styles()).toHaveLength(before)
	})
})

describe('ComparePanel', () => {
	it('puts the first sketch beside what the cell holds now', () => {
		const wrapper = mount(ComparePanel, {
			props: { document: doc, canvas, courseTitle: 'Lean-старт' },
			global,
		})
		expect(wrapper.get('h1').text()).toBe('Before → after')
		const cell = (key: string) =>
			wrapper.get(`[data-testid="canvas-cell-${key}"]`)
		expect(
			cell('problem').get('[data-testid="compare-before"]').text()
		).toContain('Ищут подрядчика')
		expect(
			cell('problem').get('[data-testid="compare-after"]').text()
		).toContain('Долгий поиск')
		expect(cell('uvp').get('[data-testid="compare-before"]').text()).toContain(
			'—'
		)
		// The cell itself is no link; «Стало» opens the block.
		expect(cell('problem').attributes('data-to')).toBeUndefined()
		const to = JSON.parse(
			cell('problem')
				.get('[data-testid="compare-after"]')
				.attributes('data-to') as string
		)
		expect(to.params.view).toBe('problem')
	})
})
