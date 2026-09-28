import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
	columnValues,
	filterableColumns,
	rankColumn,
	referringTables,
	registerDates,
	toCsv,
	type DocBlock,
	type DocTable,
	type DocumentData,
} from '@/utils/documentTable'

// learning-services#342, step 2: the whole register — its views, filters,
// summary, CSV and the card of a row.

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label'],
		emits: ['click'],
		template:
			'<button type="button" :aria-label="label" @click="$emit(\'click\')">{{ label }}<slot name="prefix" /><slot name="icon" /></button>',
	},
}))
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: false }),
}))

import RegisterPanel from '@/components/Documents/RegisterPanel.vue'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (m, n) =>
				args[Number(n)] === undefined ? m : String(args[Number(n)])
			),
	}
}
const global = { mocks: { __ } }
beforeEach(() => {
	vi.stubGlobal('__', __)
	push.mockReset()
	try {
		localStorage.clear()
	} catch {
		// no storage in this runner
	}
})

const register: DocTable = {
	name: 'register',
	title: 'Реестр рисков',
	owner: 'risks',
	prefix: 'R',
	markdown: '',
	views: [
		{ type: 'matrix', x: 'impact', y: 'probability', highlight: 'in_work' },
		{ type: 'columns', title: 'Кратко', columns: ['event', 'rank', 'owner'] },
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
			key: 'probability',
			title: 'Вероятность',
			type: 'scale',
			block: 'assessment',
			min: 1,
			max: 5,
		},
		{
			key: 'impact',
			title: 'Влияние',
			type: 'scale',
			block: 'assessment',
			min: 1,
			max: 5,
		},
		{
			key: 'rank',
			title: 'Ранг',
			type: 'formula',
			block: 'assessment',
			formula: 'probability * impact',
		},
		{
			key: 'in_work',
			title: 'В работе',
			type: 'formula',
			block: 'assessment',
			formula: 'rank >= threshold',
		},
		{ key: 'owner', title: 'Владелец', type: 'text', block: 'owners' },
		{
			key: 'status',
			title: 'Статус',
			type: 'select',
			block: 'status',
			options: ['открыт', 'закрыт', 'сработал'],
		},
	],
	rows: [
		{
			id: 'R1',
			event: 'Подрядчик уйдёт',
			probability: 4,
			impact: 5,
			rank: 20,
			in_work: true,
			owner: 'Анна',
			status: 'открыт',
		},
		{
			id: 'R2',
			event: 'Отпуск, в сезон',
			probability: 2,
			impact: 3,
			rank: 6,
			in_work: false,
			owner: 'Игорь',
			status: 'открыт',
		},
		{
			id: 'R3',
			event: 'Модуль',
			probability: 3,
			impact: 4,
			rank: 12,
			in_work: true,
			owner: 'Анна',
			status: 'сработал',
		},
	],
}
const issues: DocTable = {
	name: 'issues',
	title: 'Проблемы',
	owner: 'issues',
	prefix: 'PR',
	markdown: '',
	views: [],
	columns: [
		{
			key: 'risk',
			title: 'Риск',
			type: 'ref',
			ref: 'register',
			block: 'issues',
		},
		{ key: 'what', title: 'Что случилось', type: 'text', block: 'issues' },
	],
	rows: [],
}
const block = (key: string, title: string, extra = {}) =>
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
		...extra,
	} as DocBlock)
const document = {
	course: 'c1',
	artifact: 'risk_register',
	title: 'Реестр',
	layout: 'sections',
	blocks: [
		block('risks', 'Риски'),
		block('assessment', 'Оценка', {
			fields: [{ key: 'threshold', title: 'Порог', type: 'number' }],
		}),
		block('owners', 'Владельцы'),
		block('status', 'Статус', {
			fields: [
				{ key: 'next_review', title: 'Следующий пересмотр', type: 'date' },
			],
		}),
		block('issues', 'Проблемы'),
	],
	tables: { register, issues },
	fields: { threshold: 12, next_review: '2026-09-20' },
} as DocumentData

describe('register helpers', () => {
	it('filters by choices and by text with a few values', () => {
		expect(filterableColumns(register).map((c) => c.key)).toEqual([
			'owner',
			'status',
		])
		expect(columnValues(register, 'owner')).toEqual(['Анна', 'Игорь'])
	})

	it('sorts by the rank', () => {
		expect(rankColumn(register)?.key).toBe('rank')
	})

	it('knows how far off the register dates are', () => {
		const dates = registerDates(register, document, new Date(2026, 8, 28))
		expect(dates).toEqual([
			{
				key: 'next_review',
				title: 'Следующий пересмотр',
				value: '2026-09-20',
				days: -8,
			},
		])
	})

	it('writes the view as CSV, quoting what needs it', () => {
		const csv = toCsv(
			register.columns.slice(0, 1).concat(register.columns[3]),
			register.rows.slice(0, 2),
			{ register }
		)
		expect(csv.split('\n')).toEqual([
			'ID,Событие,Ранг',
			'R1,Подрядчик уйдёт,20',
			'R2,"Отпуск, в сезон",6',
		])
	})

	it('finds the tables that point at the register', () => {
		expect(
			referringTables(register, { register, issues }).map((r) => [
				r.table.name,
				r.column.key,
			])
		).toEqual([['issues', 'risk']])
	})
})

describe('RegisterPanel', () => {
	const api = {
		setCell: vi.fn(),
		addRow: vi.fn().mockResolvedValue('PR1'),
		deleteRow: vi.fn(),
	}
	const panel = () =>
		mount(RegisterPanel, {
			props: { table: register, document, api: api as never },
			global,
		})
	const rowIds = (w: ReturnType<typeof panel>) =>
		w.findAll('tbody tr[data-row]').map((r) => r.attributes('data-row'))

	it('opens sorted by rank, and says the review is overdue', () => {
		const wrapper = panel()
		expect(rowIds(wrapper)).toEqual(['R1', 'R3', 'R2'])
		expect(
			wrapper.get('[data-testid="register-date-next_review"]').text()
		).toMatch(/overdue by \d+ d/)
		expect(wrapper.get('[data-testid="register-summary"]').text()).toContain(
			'Порог: 12'
		)
	})

	it('switches to a named view of columns', async () => {
		const wrapper = panel()
		await wrapper.get('[data-testid="view-Кратко"]').trigger('click')
		const heads = wrapper
			.findAll('thead tr:nth-child(2) th')
			.map((th) => th.text().replace('*', '').trim())
		expect(heads).toEqual(['Событие', 'Ранг', 'Владелец'])
	})

	it('filters by a value', async () => {
		const wrapper = panel()
		await wrapper.get('select[aria-label="Filter by"]').setValue('owner')
		await wrapper.get('[data-testid="filter-value"]').setValue('Игорь')
		expect(rowIds(wrapper)).toEqual(['R2'])
	})

	it('opens a row card and carries a triggered risk into «Проблемы»', async () => {
		const wrapper = panel()
		await wrapper.get('button[aria-label="Open R3"]').trigger('click')
		expect(wrapper.get('[data-testid="row-card"]').text()).toContain('Модуль')
		await wrapper.get('[data-testid="refer-issues"]').trigger('click')
		await flushPromises()
		expect(api.addRow).toHaveBeenCalledWith('issues', { risk: 'R3' })
		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({
				params: expect.objectContaining({ view: 'issues' }),
			})
		)
	})
})
