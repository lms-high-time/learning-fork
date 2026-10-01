import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// learning-services#462: «Мои документы» as a list — each document says why
// it is there, how full it is and when it last changed.

const progress: {
	data: unknown
	error: unknown
	loading: boolean
	reload: ReturnType<typeof vi.fn>
} = {
	data: null,
	error: null,
	loading: false,
	reload: vi.fn().mockResolvedValue(undefined),
}
const query: Record<string, string> = {}

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label', 'variant'],
		emits: ['click'],
		template:
			'<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
	},
	LoadingIndicator: { template: '<span data-testid="loading" />' },
	createResource: () => progress,
	usePageMeta: () => {},
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query }) }))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ isLoggedIn: true }),
}))
vi.mock('@/stores/space', () => ({
	useSpace: () => ({ load: vi.fn(), isOrganization: false }),
}))

import {
	byRecent,
	changedAt,
	fillOf,
	type CourseDocuments,
} from '@/utils/documentList'
import DocumentRow from '@/components/Documents/DocumentRow.vue'
import Documents from '@/pages/Documents/Documents.vue'

const __ = (message: string) => {
	const format = (...args: unknown[]) =>
		message.replace(/{(\d+)}/g, (m, n) =>
			args[Number(n)] === undefined ? m : String(args[Number(n)])
		)
	return Object.assign(new String(message), { format })
}
;(globalThis as unknown as { __: typeof __ }).__ = __
const global = {
	mocks: { __ },
	stubs: {
		PageHeader: true,
		RouterLink: {
			props: ['to'],
			template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
		},
	},
}

const doc = (
	artifact: string,
	filled: number,
	total: number,
	extra: Record<string, unknown> = {}
) => ({
	artifact,
	title: artifact,
	blocks_filled: filled,
	blocks_total: total,
	...extra,
})

describe('helpers', () => {
	it('tells how full a document is', () => {
		expect(fillOf(doc('a', 0, 6))).toEqual({
			percent: 0,
			done: false,
			empty: true,
		})
		expect(fillOf(doc('a', 11, 14))).toEqual({
			percent: 79,
			done: false,
			empty: false,
		})
		expect(fillOf(doc('a', 3, 3)).done).toBe(true)
		// A schema without blocks is not «done».
		expect(fillOf(doc('a', 0, 0))).toEqual({
			percent: 0,
			done: false,
			empty: true,
		})
	})

	it('says when a document changed: the time today, the day this year', () => {
		const now = new Date(2026, 9, 1, 18, 0)
		expect(changedAt(null, now)).toBeNull()
		expect(changedAt('2026-10-01T14:32:00', now)?.short).toBe('14:32')
		expect(changedAt('2026-09-28T22:14:42.064609', now)?.short).toBe('28 сент.')
		expect(changedAt('2025-12-30T10:00:00', now)?.short).toBe('30.12.2025')
		expect(changedAt('2026-09-28T22:14:42', now)?.full).toBe(
			'Changed 28 сентября 2026, 22:14'
		)
	})

	it('puts the most recently written courses first', () => {
		const course = (id: string, ...modified: (string | null)[]) => ({
			id,
			title: id,
			documents: modified.map((m, i) =>
				doc(`${id}${i}`, 0, 1, { modified: m })
			),
		})
		const order = byRecent([
			course('untouched', null),
			course('older', '2026-09-20T10:00:00'),
			course('quiet', null),
			course('newer', null, '2026-09-28T22:14:42'),
		] as CourseDocuments[]).map((c) => c.id)
		expect(order).toEqual(['newer', 'older', 'untouched', 'quiet'])
	})
})

describe('DocumentRow', () => {
	const row = (d: ReturnType<typeof doc>) =>
		mount(DocumentRow, { props: { course: 'c1', doc: d }, global })

	it('shows the percent in the ring, the purpose and when it changed', () => {
		const wrapper = row(
			doc('risk_register', 11, 14, {
				purpose: 'Риски проекта — чтобы замечать угрозы заранее.',
				modified: '2026-09-28T22:14:42',
			})
		)
		expect(wrapper.get('[data-testid="document-fill"]').text()).toContain('79%')
		expect(wrapper.get('[data-testid="document-purpose"]').text()).toBe(
			'Риски проекта — чтобы замечать угрозы заранее.'
		)
		expect(wrapper.find('[data-testid="document-changed"]').exists()).toBe(true)
		// The whole row opens the document.
		expect(JSON.parse(wrapper.get('a').attributes('data-to') ?? '')).toEqual({
			name: 'Document',
			params: { courseName: 'c1', artifact: 'risk_register' },
		})
	})

	it('turns the percent into a check once every block is filled', () => {
		const wrapper = row(doc('summary', 6, 6))
		expect(wrapper.find('[data-testid="document-done"]').exists()).toBe(true)
		expect(wrapper.text()).not.toContain('100%')
	})

	it('leaves out the purpose and the date it does not have', () => {
		const wrapper = row(doc('summary', 0, 6))
		expect(wrapper.find('[data-testid="document-purpose"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="document-changed"]').exists()).toBe(
			false
		)
		expect(wrapper.get('[data-testid="document-fill"]').text()).toContain('0%')
	})
})

describe('Documents page', () => {
	beforeEach(() => {
		progress.data = null
		progress.error = null
		progress.loading = false
		for (const key of Object.keys(query)) delete query[key]
	})
	const page = () => mount(Documents, { global })
	const answer = (courses: unknown[]) => ({ ok: true, data: { courses } })

	it('tells a failed load apart from having no documents', async () => {
		progress.data = { ok: false, error: { code: 'x', message: 'x' } }
		const wrapper = page()
		expect(wrapper.find('[data-testid="documents-error"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="documents-empty"]').exists()).toBe(false)
		await wrapper.get('button').trigger('click')
		expect(progress.reload).toHaveBeenCalled()
	})

	it('offers the courses when no course builds a document', () => {
		progress.data = answer([{ id: 'c1', title: 'Курс', documents: [] }])
		const wrapper = page()
		expect(wrapper.find('[data-testid="documents-empty"]').exists()).toBe(true)
		expect(wrapper.text()).toContain('To courses')
	})

	it('lists documents under their courses, the recently written first', () => {
		progress.data = answer([
			{ id: 'p3', title: 'P3.express', documents: [doc('summary', 0, 6)] },
			{
				id: 'risks',
				title: 'Риски',
				documents: [
					doc('risk_register', 11, 14, { modified: '2026-09-28T22:14:42' }),
				],
			},
		])
		const wrapper = page()
		expect(wrapper.findAll('h2').map((h) => h.text())).toEqual([
			'Риски',
			'P3.express',
		])
		expect(wrapper.find('[data-testid="document-summary"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="documents-filter"]').exists()).toBe(
			false
		)
	})

	it('names the course it is narrowed to and leads back to all', () => {
		query.course = 'risks'
		progress.data = answer([
			{ id: 'p3', title: 'P3.express', documents: [doc('summary', 0, 6)] },
			{ id: 'risks', title: 'Риски', documents: [doc('risk_register', 1, 14)] },
		])
		const wrapper = page()
		const filter = wrapper.get('[data-testid="documents-filter"]')
		expect(filter.text()).toContain('Course: Риски')
		expect(wrapper.findAll('h2').map((h) => h.text())).toEqual(['Риски'])
	})
})
