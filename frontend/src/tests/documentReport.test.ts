import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { DocTable, DocumentData } from '@/utils/documentTable'

// learning-services#342, step 3: the report offers its rows and copies as
// text; «Мои документы» say the next step.

const resources: Record<
	string,
	{ data: unknown; fetch: ReturnType<typeof vi.fn> }
> = {}
vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label'],
		emits: ['click'],
		template:
			'<button type="button" @click="$emit(\'click\')">{{ label }}<slot name="prefix" /></button>',
	},
	toast: { success: vi.fn(), error: vi.fn() },
	createResource: (options: { url: string }) => {
		const r = resources[options.url] ?? { data: null, fetch: vi.fn() }
		return r
	},
}))

import ReportPanel from '@/components/Documents/ReportPanel.vue'
import DocumentCard from '@/components/Documents/DocumentCard.vue'

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
		ProgressBar: true,
	},
}
beforeEach(() => vi.stubGlobal('__', __))

const register = (sponsor: string[] = []): DocTable => ({
	name: 'register',
	title: 'Реестр',
	owner: 'risks',
	prefix: 'R',
	markdown: '',
	views: [
		{
			type: 'report',
			filter: 'sponsor',
			columns: ['event', 'rank'],
			field: 'next_report',
		},
	],
	columns: [
		{ key: 'event', title: 'Событие', type: 'text', block: 'risks' },
		{
			key: 'rank',
			title: 'Ранг',
			type: 'formula',
			block: 'assessment',
			formula: 'p * i',
		},
		{ key: 'sponsor', title: 'Спонсору', type: 'check', block: 'top3', max: 3 },
	],
	rows: [
		{ id: 'R1', event: 'A', rank: 20 },
		{ id: 'R2', event: 'B', rank: 6 },
		{ id: 'R3', event: 'C', rank: 12 },
		{ id: 'R4', event: 'D', rank: 15 },
	].map((r) => ({ ...r, sponsor: sponsor.includes(r.id) })),
})
const doc = (table: DocTable) =>
	({
		course: 'c1',
		artifact: 'risk_register',
		title: 'Реестр',
		layout: 'sections',
		blocks: [
			{
				key: 'top3',
				title: 'Три',
				fields: [
					{ key: 'next_report', title: 'Следующий доклад', type: 'date' },
				],
			},
		],
		tables: { register: table },
		fields: { next_report: '2026-10-15' },
	} as unknown as DocumentData)

describe('ReportPanel', () => {
	it('offers the top three by rank when nothing is ticked, and ticks them in one write', async () => {
		const api = { write: vi.fn().mockResolvedValue({}) }
		const wrapper = mount(ReportPanel, {
			props: { document: doc(register()), courseTitle: 'Риски', api },
			global,
		})
		expect(wrapper.get('[data-testid="report-suggest"]').text()).toContain('R1')
		expect(wrapper.get('[data-testid="report-suggest"]').text()).not.toContain(
			'R2'
		)
		await wrapper.get('[data-testid="tick-suggested"]').trigger('click')
		expect(api.write).toHaveBeenCalledWith('top3', {
			rows: [
				{ id: 'R1', sponsor: true },
				{ id: 'R4', sponsor: true },
				{ id: 'R3', sponsor: true },
			],
		})
	})

	it('copies the ticked rows as text', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		vi.stubGlobal('navigator', { clipboard: { writeText } })
		const wrapper = mount(ReportPanel, {
			props: { document: doc(register(['R1'])), courseTitle: 'Риски' },
			global,
		})
		await wrapper.get('[data-testid="copy-report"]').trigger('click')
		await flushPromises()
		const text = writeText.mock.calls[0][0] as string
		expect(text).toContain('R1. A')
		expect(text).toContain('Ранг: 20')
		expect(text).toContain('Следующий доклад: 15.10.2026')
	})
})

describe('DocumentCard', () => {
	const card = () =>
		mount(DocumentCard, {
			props: {
				course: 'c1',
				doc: {
					artifact: 'risk_register',
					title: 'Реестр',
					blocks_total: 14,
					blocks_filled: 4,
				},
			},
			global,
		})

	it('names the lesson in progress and continues there', () => {
		resources['lms_frappe_app.api.public.course_map'] = {
			data: {
				data: {
					next_lesson: 'l5',
					chapters: [
						{ lessons: [{ id: 'l5', number: 5, title: 'Ответ и мера' }] },
					],
				},
			},
			fetch: vi.fn(),
		}
		const wrapper = card()
		expect(wrapper.get('[data-testid="document-next"]').text()).toBe(
			'Lesson 5 · Ответ и мера'
		)
		expect(wrapper.text()).toContain('Continue')
	})

	it('after the course, says when the review is and opens the register', () => {
		resources['lms_frappe_app.api.public.course_map'] = {
			data: { data: { next_lesson: null, chapters: [] } },
			fetch: vi.fn(),
		}
		const table = { ...register(), columns: register().columns }
		const d = doc(table)
		d.blocks = [
			{
				key: 'risks',
				fields: [{ key: 'next_review', title: 'Пересмотр', type: 'date' }],
			} as never,
		]
		d.fields = { next_review: '2020-01-01' }
		const assessment = { ...table, columns: [...table.columns] }
		d.tables = { register: assessment }
		resources['lms_frappe_app.api.student.artifact'] = {
			data: { data: d },
			fetch: vi.fn(),
		}
		const wrapper = card()
		expect(
			resources['lms_frappe_app.api.student.artifact'].fetch
		).toHaveBeenCalled()
		expect(wrapper.get('[data-testid="document-next"]').text()).toMatch(
			/Review overdue by \d+ d/
		)
		expect(wrapper.text()).toContain('Open the register')
	})
})
