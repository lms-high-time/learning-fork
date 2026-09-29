import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { DocumentData, DocTable } from '@/utils/documentTable'

// learning-services#331, #342: the cell, the table and a lesson's document as
// the student meets them on «Мои документы».

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label', 'variant', 'theme', 'size'],
		emits: ['click'],
		template:
			'<button type="button" :aria-label="label" @click="$emit(\'click\')"><slot name="prefix" /><slot name="icon" />{{ label }}</button>',
	},
	Dropdown: {
		props: ['options'],
		template:
			'<div data-testid="menu"><button v-for="o in options" type="button" @click="o.onClick()">{{ o.label }}</button></div>',
	},
}))
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: false }),
}))

import TableCell from '@/components/Documents/TableCell.vue'
import DocTableEditor from '@/components/Documents/DocTableEditor.vue'
import LessonDocument from '@/components/Documents/LessonDocument.vue'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, n) =>
				args[Number(n)] === undefined ? match : String(args[Number(n)])
			),
	}
}

const global = {
	mocks: { __ },
	stubs: { 'router-link': { template: '<a><slot /></a>' } },
}

beforeEach(() => {
	vi.stubGlobal('__', __)
})

const register: DocTable = {
	name: 'register',
	title: 'Реестр',
	owner: 'risks',
	prefix: 'R',
	markdown: '',
	views: [],
	columns: [
		{
			key: 'event',
			title: 'Событие',
			type: 'text',
			block: 'risks',
			required: true,
		},
		{
			key: 'probability',
			title: 'Вероятность',
			type: 'scale',
			block: 'assessment',
			min: 1,
			max: 5,
			required: true,
		},
		{ key: 'rank', title: 'Ранг', type: 'formula', block: 'assessment' },
		{ key: 'in_work', title: 'В работе', type: 'formula', block: 'assessment' },
	],
	rows: [
		{
			id: 'R1',
			event: 'Подрядчик уйдёт',
			probability: 4,
			rank: 16,
			in_work: true,
		},
		{ id: 'R2', event: 'уточнить у Анны', in_work: null },
	],
}

const blocks = [
	{
		key: 'risks',
		title: 'Риски',
		hint: '',
		lesson: null,
		span: 1,
		kind: 'text',
		accept: [],
		content: '',
		file: null,
		url: null,
		preview: null,
		table: 'register',
		columns: register.columns.slice(0, 1),
		fields: [],
		filled: true,
		empty_cells: [],
	},
	{
		key: 'assessment',
		title: 'Оценка',
		hint: 'Готов, когда…',
		lesson: null,
		span: 1,
		kind: 'text',
		accept: [],
		content: '',
		file: null,
		url: null,
		preview: null,
		table: 'register',
		columns: register.columns.slice(1),
		fields: [
			{
				key: 'threshold',
				title: 'Порог внимания',
				type: 'number',
				required: true,
			},
		],
		filled: false,
		empty_cells: [{ row: 'R2', column: 'probability' }],
	},
] as DocumentData['blocks']

const rankCell = (rank: number) =>
	mount(TableCell, {
		props: {
			row: { ...register.rows[0], rank },
			column: register.columns[2],
			tables: {},
		},
		global,
	})

describe('TableCell', () => {
	it('shows a formula read-only and a blank required cell as one to fill', () => {
		const rank = mount(TableCell, {
			props: { row: register.rows[0], column: register.columns[2], tables: {} },
			global,
		})
		expect(rank.text()).toBe('16')
		expect(rank.find('button').exists()).toBe(false)

		const blank = mount(TableCell, {
			props: { row: register.rows[1], column: register.columns[1], tables: {} },
			global,
		})
		expect(blank.classes()).toContain('is-missing')
	})

	it('saves a scale as a number, and nothing when unchanged', async () => {
		const cell = mount(TableCell, {
			props: { row: register.rows[0], column: register.columns[1], tables: {} },
			global,
		})
		await cell.get('button').trigger('click')
		const select = cell.get('select')
		await select.setValue('4')
		expect(cell.emitted('save')).toBeUndefined()
		await cell.get('button').trigger('click')
		await cell.get('select').setValue('5')
		expect(cell.emitted('save')?.[0]).toEqual([5])
	})

	// learning-services#386: «900 000» on the canvas, «900000» in the table.
	it('reads a number in groups of digits and edits it bare', async () => {
		const cell = mount(TableCell, {
			props: {
				row: { id: 'R1', budget: 900000 },
				column: {
					key: 'budget',
					title: 'Бюджет',
					type: 'number',
					block: 'assessment',
				},
				tables: {},
			},
			global,
		})
		expect(cell.get('button').text()).toBe('900\u00a0000')
		await cell.get('button').trigger('click')
		expect((cell.get('input').element as HTMLInputElement).value).toBe('900000')

		const total = mount(TableCell, {
			props: {
				row: { id: 'R1', total: 1234567.891 },
				column: {
					key: 'total',
					title: 'Итого',
					type: 'formula',
					block: 'assessment',
				},
				tables: {},
			},
			global,
		})
		expect(total.text()).toBe('1\u00a0234\u00a0567,89')
		// Four digits stay whole, as the canvas writes them.
		expect(rankCell(1000).text()).toBe('1000')
	})

	it('marks «уточнить у …»', () => {
		const cell = mount(TableCell, {
			props: { row: register.rows[1], column: register.columns[0], tables: {} },
			global,
		})
		expect(cell.classes()).toContain('is-clarify')
	})
})

describe('DocTableEditor', () => {
	const editor = () =>
		mount(DocTableEditor, {
			props: {
				table: register,
				tables: { register },
				blocks,
				canEditRows: true,
			},
			global,
		})

	it('heads columns by the block that adds them', () => {
		const heads = editor()
			.findAll('thead tr:first-child th')
			.map((th) => th.text())
		expect(heads).toEqual(['ID', 'Риски', 'Оценка', 'Row actions'])
	})

	it('narrows to rows in work and to rows with empty cells', async () => {
		const wrapper = editor()
		const [inWork, empty] = wrapper.findAll('button.chip')
		await inWork.trigger('click')
		expect(
			wrapper.findAll('tbody tr[data-row]').map((r) => r.attributes('data-row'))
		).toEqual(['R1'])
		await inWork.trigger('click')
		await empty.trigger('click')
		expect(
			wrapper.findAll('tbody tr[data-row]').map((r) => r.attributes('data-row'))
		).toEqual(['R2'])
	})

	it('asks before deleting a row', async () => {
		const wrapper = editor()
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
		await wrapper.get('button[aria-label="Delete R1"]').trigger('click')
		expect(confirm).toHaveBeenCalled()
		expect(wrapper.emitted('deleteRow')?.[0]).toEqual(['R1'])
	})
})

describe('LessonDocument', () => {
	const document = {
		course: 'c1',
		artifact: 'risk_register',
		title: 'Реестр',
		layout: 'sections',
		blocks,
		tables: { register },
		fields: {},
	} as DocumentData
	const api = {
		setField: vi.fn(),
		setCell: vi.fn(),
		addRow: vi.fn(),
		deleteRow: vi.fn(),
		write: vi.fn(),
		upload: vi.fn(),
	}
	const page = (block: typeof blocks[number], extra = {}) =>
		mount(LessonDocument, {
			props: { block, document, api: api as never, ...extra },
			global,
		})

	it('shows a lesson its own view of the register: name, computed columns, its columns', () => {
		const heads = (w: ReturnType<typeof page>) =>
			w
				.findAll('thead tr:nth-child(2) th')
				.map((th) => th.text().replace('*', '').trim())
		// «Риски» starts the rows: it adds and deletes them.
		const risks = page(blocks[0])
		expect(heads(risks)).toEqual(['Событие'])
		expect(risks.find('button[aria-label="Delete R1"]').exists()).toBe(true)
		// «Оценка» fills its columns in place and adds no rows.
		const assessment = page(blocks[1])
		expect(heads(assessment)).toEqual([
			'Событие',
			'Ранг',
			'В работе',
			'Вероятность',
		])
		expect(assessment.find('button[aria-label="Delete R1"]').exists()).toBe(
			false
		)
	})

	it('has no search in a lesson view and hides a filter with nothing to show', () => {
		const wrapper = page(blocks[1])
		expect(wrapper.find('input[type="search"]').exists()).toBe(false)
		expect(wrapper.get('[data-testid="show-unfilled"]').text()).toContain('1')
	})

	it('saves a field through the document api', async () => {
		const input = page(blocks[1]).get('[data-testid="block-fields"] input')
		await input.setValue('12')
		await input.trigger('change')
		await flushPromises()
		expect(api.setField).toHaveBeenCalledWith('assessment', 'threshold', '12')
	})

	it('says where it stands in one word, and «done» in a sentence', () => {
		const wrapper = page({
			...blocks[1],
			hint: 'Длинно для агента. Готов, когда у каждого риска три оценки.',
		})
		expect(wrapper.get('[data-testid="block-status"]').text()).toBe('Started')
		expect(wrapper.get('[data-testid="ready-line"]').text()).toBe(
			'Готов, когда у каждого риска три оценки.'
		)
	})

	it('keeps the note in the menu, not as a button of every document', () => {
		const wrapper = page(blocks[1])
		expect(wrapper.find('button[aria-label="Add a note"]').exists()).toBe(false)
		expect(wrapper.get('[data-testid="menu"]').text()).toContain('Add a note')
	})

	it('leads to the documents before and after it', () => {
		const wrapper = page(blocks[1], {
			prev: { title: 'Риски', to: '/p' },
			next: { title: 'Ответы', to: '/n' },
		})
		expect(wrapper.get('[data-testid="prev-document"]').text()).toContain(
			'Риски'
		)
		expect(wrapper.get('[data-testid="next-document"]').text()).toContain(
			'Ответы'
		)
	})
})
