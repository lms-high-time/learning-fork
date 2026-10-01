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
		const suggest = wrapper.get('[data-testid="report-suggest"]').text()
		expect(suggest).toContain('Nothing is ticked for the report yet.')
		// The rank is called what the table calls it (learning-services#360).
		expect(suggest).toContain('Top by «Ранг»:')
		expect(suggest).toContain('R1')
		expect(suggest).not.toContain('R2')
		// A report view with no title of its own gets a neutral one.
		expect(wrapper.get('h1').text()).toBe('Report')
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
	const card = (artifact = 'risk_register') =>
		mount(DocumentCard, {
			props: {
				course: 'c1',
				doc: {
					artifact,
					title: 'Реестр',
					blocks_total: 14,
					blocks_filled: 4,
				},
			},
			global,
		})

	const during = (next: string) => {
		const builds = [{ artifact: 'risk_register' }]
		resources['lms_frappe_app.api.public.course_map'] = {
			data: {
				data: {
					next_lesson: next,
					chapters: [
						{
							lessons: [
								{ id: 'l5', number: 5, title: 'Ответ и мера', blocks: builds },
								{ id: 'l6', number: 6, title: 'Владельцы', blocks: [] },
								{
									id: 'l7',
									number: 7,
									title: 'Резюме',
									blocks: [{ artifact: 'summary' }],
								},
							],
						},
					],
				},
			},
			fetch: vi.fn(),
		}
	}

	it('names the lesson in progress and continues there', () => {
		during('l5')
		const wrapper = card()
		expect(wrapper.get('[data-testid="document-next"]').text()).toBe(
			'Lesson 5 · Ответ и мера'
		)
		expect(wrapper.text()).toContain('Continue')
	})

	// The course's next lesson builds nothing of this document: the card named
	// it anyway, «Урок 1» on four registers begun later (learning-services#462).
	it('names the later lesson the document grows on', () => {
		during('l6')
		const wrapper = card('summary')
		expect(wrapper.get('[data-testid="document-next"]').text()).toBe(
			'Lesson 7 · Резюме'
		)
		expect(wrapper.text()).toContain('Continue')
	})

	it('says the document’s lessons are passed while the course goes on', () => {
		during('l6')
		const wrapper = card()
		expect(wrapper.get('[data-testid="document-next"]').text()).toBe(
			'Its lessons are behind you'
		)
		expect(wrapper.text()).toContain('Open')
		expect(wrapper.text()).not.toContain('Continue')
	})

	it('claims no passed lessons for a document no lesson builds', () => {
		during('l5')
		const wrapper = card('free_notes')
		expect(wrapper.get('[data-testid="document-next"]').text()).toBe('')
	})

	it('says nothing on a map without the student’s next lesson', () => {
		resources['lms_frappe_app.api.public.course_map'] = {
			data: { data: { chapters: [] } },
			fetch: vi.fn(),
		}
		expect(card().get('[data-testid="document-next"]').text()).toBe('')
	})

	// After the course: the table's most urgent date, under the field's own
	// title — no key is special, each course names its dates
	// (learning-services#360).
	const finished = (d: DocumentData) => {
		resources['lms_frappe_app.api.public.course_map'] = {
			data: { data: { next_lesson: null, chapters: [] } },
			fetch: vi.fn(),
		}
		resources['lms_frappe_app.api.student.artifact'] = {
			data: { data: d },
			fetch: vi.fn(),
		}
		return card()
	}
	const dated = (fields: DocumentData['fields'], canvas?: unknown) => {
		const d = doc(register())
		d.blocks = [
			{
				key: 'risks',
				fields: [
					{ key: 'check_on', title: 'Сверка', type: 'date' },
					{ key: 'call_on', title: 'Созвон', type: 'date' },
				],
			} as never,
		]
		d.fields = fields
		if (canvas) (d as { canvas?: unknown }).canvas = canvas
		return d
	}

	it('after the course, puts an overdue date first, named by its field', () => {
		const wrapper = finished(
			dated({ check_on: '2099-01-01', call_on: '2020-01-01' })
		)
		expect(
			resources['lms_frappe_app.api.student.artifact'].fetch
		).toHaveBeenCalled()
		const next = wrapper.get('[data-testid="document-next"]')
		expect(next.text()).toMatch(/^Созвон: overdue by \d+ d$/)
		expect(next.get('span').classes()).toContain('text-ink-red-5')
		// «Open» lets the document open where it should by itself.
		expect(wrapper.text()).toContain('Open')
		const links = wrapper.findAll('a[data-to]')
		expect(
			links.map((a) => JSON.parse(a.attributes('data-to') as string))
		).toEqual(
			links.map(() => ({
				name: 'Document',
				params: { courseName: 'c1', artifact: 'risk_register' },
			}))
		)
	})

	it("shows the nearest date of a sheet's table too", () => {
		const wrapper = finished(
			dated(
				{ check_on: '2099-03-01', call_on: '2099-01-15' },
				{ grid: ['risks'] }
			)
		)
		expect(wrapper.get('[data-testid="document-next"]').text()).toBe(
			'Созвон: 15.01.2099'
		)
	})
})
