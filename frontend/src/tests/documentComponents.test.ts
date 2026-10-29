import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { ManyBlock, OneBlock } from '@/utils/documentTable'

// learning-services#331, #342, #515: the cell, the table, the fields and a
// lesson's document as the student meets them on «Мои документы».

const screen = vi.hoisted(() => ({ isMobile: false }))

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
	useScreenSize: () => screen,
}))

import TableCell from '@/components/Documents/TableCell.vue'
import BlockFields from '@/components/Documents/BlockFields.vue'
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
	screen.isMobile = false
})

const agreements: ManyBlock = {
	key: 'agreements',
	title: 'Договорённости',
	description: 'Что команда решила и кто за это отвечает.',
	lesson: 'l1',
	rows: 'many',
	columns: [
		{ key: 'topic', title: 'Тема', required: true },
		{ key: 'driver', title: 'Драйвер', required: false },
		{ key: 'area', title: 'Область', required: { if_column: 'driver' } },
	],
	items: [
		{ id: 'A1', topic: 'Ретро раз в две недели', driver: 'Сроки' },
		{ id: 'A2', topic: 'уточнить у Анны' },
	],
	filled: false,
	empty_cells: [{ row: 'A1', column: 'area' }],
}

const decide: OneBlock = {
	key: 'how_we_decide',
	title: 'Как мы решаем',
	description: null,
	lesson: 'l2',
	rows: 'one',
	columns: [
		{ key: 'method', title: 'Способ', required: true },
		{ key: 'exception', title: 'Исключение', required: false },
		{ key: 'who', title: 'Кто решает', required: { if_column: 'exception' } },
	],
	values: { exception: 'Бюджет' },
	filled: false,
	empty_cells: [{ field: 'method' }, { field: 'who' }],
}

const [topic, , area] = agreements.columns

describe('TableCell', () => {
	it('shows a blank required cell as one to fill', () => {
		const cell = mount(TableCell, {
			props: { row: agreements.items[0], column: area },
			global,
		})
		expect(cell.classes()).toContain('is-missing')
		expect(cell.text()).toContain('Fill in')
	})

	it('edits text, saves it trimmed and nothing when unchanged', async () => {
		const cell = mount(TableCell, {
			props: { row: agreements.items[0], column: topic },
			global,
		})
		await cell.get('button').trigger('click')
		const textarea = cell.get('textarea')
		expect((textarea.element as HTMLTextAreaElement).value).toBe(
			'Ретро раз в две недели'
		)
		await textarea.trigger('blur')
		expect(cell.emitted('save')).toBeUndefined()
		await cell.get('button').trigger('click')
		await cell.get('textarea').setValue('  Ретро раз в неделю ')
		await cell.get('textarea').trigger('blur')
		expect(cell.emitted('save')?.[0]).toEqual(['Ретро раз в неделю'])
	})

	it('clears a cell with an empty text', async () => {
		const cell = mount(TableCell, {
			props: { row: agreements.items[0], column: topic },
			global,
		})
		await cell.get('button').trigger('click')
		await cell.get('textarea').setValue('   ')
		await cell.get('textarea').trigger('blur')
		expect(cell.emitted('save')?.[0]).toEqual([''])
	})

	it('keeps what is typed when the row is read back meanwhile', async () => {
		const cell = mount(TableCell, {
			props: { row: agreements.items[0], column: topic },
			global,
		})
		await cell.get('button').trigger('click')
		await cell.get('textarea').setValue('Ретро раз')
		await cell.setProps({ row: { ...agreements.items[0], driver: 'Время' } })
		expect((cell.get('textarea').element as HTMLTextAreaElement).value).toBe(
			'Ретро раз'
		)
		const textarea = cell.get('textarea')
		expect(textarea.attributes('maxlength')).toBe('4000')
		expect(textarea.attributes('aria-required')).toBe('true')
	})

	it('cancels on Esc without letting it reach the row card', async () => {
		const outer = vi.fn()
		const Host = {
			components: { TableCell },
			props: ['row', 'column'],
			setup: () => ({ outer }),
			template:
				'<div @keydown.esc="outer"><TableCell :row="row" :column="column" /></div>',
		}
		const host = mount(Host, {
			props: { row: agreements.items[0], column: topic },
			global,
		})
		await host.get('button').trigger('click')
		await host.get('textarea').setValue('черновик')
		await host.get('textarea').trigger('keydown', { key: 'Escape' })
		expect(outer).not.toHaveBeenCalled()
		expect(host.find('textarea').exists()).toBe(false)
	})

	it('marks «уточнить у …»', () => {
		const cell = mount(TableCell, {
			props: { row: agreements.items[1], column: topic },
			global,
		})
		expect(cell.classes()).toContain('is-clarify')
	})
})

describe('BlockFields', () => {
	const fields = () =>
		mount(BlockFields, {
			props: { columns: decide.columns, values: decide.values },
			global,
		})

	it('marks a field required always or once its condition is filled', () => {
		const wrapper = fields()
		const star = (key: string) =>
			wrapper.find(`[data-testid="field-${key}"] span[title]`)
		expect(star('method').attributes('title')).toBe('Required')
		expect(star('exception').exists()).toBe(false)
		expect(star('who').attributes('title')).toBe(
			'Required when “Исключение” is filled'
		)
		const missing = (key: string) =>
			wrapper
				.get(`[data-testid="field-${key}"] textarea`)
				.classes()
				.includes('is-missing')
		expect(missing('method')).toBe(true)
		expect(missing('exception')).toBe(false)
		expect(missing('who')).toBe(true)
	})

	it('saves a field as trimmed text, and nothing when unchanged', async () => {
		const wrapper = fields()
		const exception = wrapper.get('[data-testid="field-exception"] textarea')
		await exception.trigger('focus')
		await exception.trigger('blur')
		expect(wrapper.emitted('save')).toBeUndefined()
		const method = wrapper.get('[data-testid="field-method"] textarea')
		await method.trigger('focus')
		await method.setValue(' Согласие ')
		await method.trigger('blur')
		expect(wrapper.emitted('save')?.[0]).toEqual(['method', 'Согласие'])
	})
})

describe('BlockFields as typed into', () => {
	it('keeps what is typed when the document is read back meanwhile', async () => {
		const wrapper = mount(BlockFields, {
			props: { columns: decide.columns, values: decide.values },
			global,
		})
		const method = wrapper.get('[data-testid="field-method"] textarea')
		await method.trigger('focus')
		await method.setValue('Согл')
		// Another field's write lands and the document comes back.
		await wrapper.setProps({ values: { exception: 'Бюджет', who: 'Анна' } })
		expect((method.element as HTMLTextAreaElement).value).toBe('Согл')
		const who = wrapper.get('[data-testid="field-who"] textarea')
		expect((who.element as HTMLTextAreaElement).value).toBe('Анна')
	})

	it('caps a field at the length the server takes, and says what is missing', () => {
		const wrapper = mount(BlockFields, {
			props: { columns: decide.columns, values: decide.values },
			global,
		})
		const method = wrapper.get('[data-testid="field-method"] textarea')
		expect(method.attributes('maxlength')).toBe('4000')
		expect(method.attributes('aria-required')).toBe('true')
		expect(method.attributes('aria-invalid')).toBe('true')
		const exception = wrapper.get('[data-testid="field-exception"] textarea')
		expect(exception.attributes('aria-required')).toBeUndefined()
		expect(exception.attributes('aria-invalid')).toBeUndefined()
		expect(
			wrapper
				.get('[data-testid="field-method"] span[title]')
				.attributes('aria-hidden')
		).toBe('true')
	})
})

describe('DocTableEditor', () => {
	const editor = (block: ManyBlock = agreements) =>
		mount(DocTableEditor, { props: { block }, global })

	it('heads a column per column of the section, marking the required ones', () => {
		const heads = editor()
			.findAll('thead th')
			.map((th) => th.text())
		expect(heads).toEqual(['ID', 'Тема*', 'Драйвер', 'Область*', 'Row actions'])
		expect(
			editor().get('thead th:nth-child(4) span[title]').attributes('title')
		).toBe('Required when “Драйвер” is filled')
	})

	it('narrows to rows with empty cells', async () => {
		const wrapper = editor()
		await wrapper.get('[data-testid="show-unfilled"]').trigger('click')
		expect(
			wrapper.findAll('tbody tr[data-row]').map((r) => r.attributes('data-row'))
		).toEqual(['A1'])
	})

	it('offers a search only on a longer table', () => {
		expect(editor().find('input[type="search"]').exists()).toBe(false)
		const items = Array.from({ length: 8 }, (_, i) => ({
			id: `A${i + 1}`,
			topic: `Тема ${i + 1}`,
		}))
		expect(
			editor({ ...agreements, items })
				.find('input[type="search"]')
				.exists()
		).toBe(true)
	})

	it('asks before deleting a row', async () => {
		const wrapper = editor()
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
		await wrapper.get('button[aria-label="Delete A1"]').trigger('click')
		expect(confirm).toHaveBeenCalled()
		expect(wrapper.emitted('deleteRow')?.[0]).toEqual(['A1'])
	})

	it('emits the cell with its row and column', async () => {
		const wrapper = editor()
		const cell = wrapper.get('[data-testid="cell-A2-driver"]')
		await cell.get('button').trigger('click')
		await cell.get('textarea').setValue('Качество')
		await cell.get('textarea').trigger('blur')
		expect(wrapper.emitted('setCell')?.[0]).toEqual([
			agreements.items[1],
			'driver',
			'Качество',
		])
	})

	it('shows a card per row on a phone', () => {
		screen.isMobile = true
		const wrapper = editor()
		expect(wrapper.find('table').exists()).toBe(false)
		expect(wrapper.findAll('details[data-row]')).toHaveLength(2)
		expect(wrapper.get('details[data-row="A1"] summary').text()).toContain(
			'Ретро раз в две недели'
		)
	})
})

describe('LessonDocument', () => {
	const api = {
		setField: vi.fn(),
		setCell: vi.fn(),
		addRow: vi.fn(),
		deleteRow: vi.fn(),
		clear: vi.fn(),
	}
	const page = (block: ManyBlock | OneBlock, extra = {}, attach = false) =>
		mount(LessonDocument, {
			props: { block, api: api as never, ...extra },
			global,
			...(attach ? { attachTo: document.body } : {}),
		})

	beforeEach(() => {
		Object.values(api).forEach((fn) => fn.mockReset())
	})

	it('shows the student what the block is for', () => {
		expect(
			page(agreements).get('[data-testid="block-description"]').text()
		).toBe('Что команда решила и кто за это отвечает.')
		expect(
			page(decide).find('[data-testid="block-description"]').exists()
		).toBe(false)
	})

	it('shows rows for a `many` block and writes through the document api', async () => {
		const wrapper = page(agreements)
		expect(wrapper.find('[data-testid="doc-table-agreements"]').exists()).toBe(
			true
		)
		expect(wrapper.find('[data-testid="block-fields"]').exists()).toBe(false)
		await wrapper.get('button[aria-label="Add a row"]').trigger('click')
		expect(api.addRow).toHaveBeenCalledWith('agreements')
		const cell = wrapper.get('[data-testid="cell-A1-area"]')
		await cell.get('button').trigger('click')
		await cell.get('textarea').setValue('Продукт')
		await cell.get('textarea').trigger('blur')
		expect(api.setCell).toHaveBeenCalledWith(
			'agreements',
			agreements.items[0],
			'area',
			'Продукт'
		)
	})

	it('opens a row in full from its ID and hands focus back on closing', async () => {
		const wrapper = page(agreements, {}, true)
		const id = wrapper.get('button[aria-label="Open A1"]')
		;(id.element as HTMLElement).focus()
		await id.trigger('click')
		const card = wrapper.get('[data-testid="row-card"]')
		expect(card.text()).toContain('Ретро раз в две недели')
		expect(card.findAll('[data-testid^="cell-A1-"]')).toHaveLength(3)
		expect(document.activeElement).toBe(card.element)
		await card.trigger('keydown', { key: 'Escape' })
		expect(wrapper.find('[data-testid="row-card"]').exists()).toBe(false)
		expect(document.activeElement).toBe(
			wrapper.get('button[aria-label="Open A1"]').element
		)
		wrapper.unmount()
	})

	it('keeps Tab inside the row card', async () => {
		const wrapper = page(agreements, {}, true)
		await wrapper.get('button[aria-label="Open A1"]').trigger('click')
		const card = wrapper.get('[data-testid="row-card"]')
		const stops = card.findAll('button')
		const last = stops[stops.length - 1].element as HTMLElement
		last.focus()
		await card.trigger('keydown', { key: 'Tab' })
		expect(document.activeElement).toBe(stops[0].element)
		wrapper.unmount()
	})

	it('shows fields for a `one` block and saves them', async () => {
		const wrapper = page(decide)
		expect(wrapper.find('table').exists()).toBe(false)
		const method = wrapper.get('[data-testid="field-method"] textarea')
		await method.trigger('focus')
		await method.setValue('Согласие')
		await method.trigger('blur')
		await flushPromises()
		expect(api.setField).toHaveBeenCalledWith(
			'how_we_decide',
			'method',
			'Согласие'
		)
	})

	it('says where it stands in one word', () => {
		expect(page(agreements).get('[data-testid="block-status"]').text()).toBe(
			'Started'
		)
		expect(
			page({ ...decide, values: {}, filled: false })
				.get('[data-testid="block-status"]')
				.text()
		).toBe('Empty')
		expect(
			page({ ...decide, filled: true })
				.get('[data-testid="block-status"]')
				.text()
		).toBe('Done')
	})

	it('clears a block from its menu, after asking', async () => {
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
		await page(agreements).get('[data-testid="menu"] button').trigger('click')
		expect(confirm).toHaveBeenCalledWith('Delete every row of this document?')
		expect(api.clear).toHaveBeenCalledWith('agreements')
		// Nothing written yet: nothing to clear.
		expect(
			page({ ...decide, values: {} })
				.find('[data-testid="menu"]')
				.exists()
		).toBe(false)
	})

	it('leads to the documents before and after it', () => {
		const wrapper = page(decide, {
			prev: { title: 'Договорённости', to: '/p' },
			next: { title: 'Области', to: '/n' },
		})
		expect(wrapper.get('[data-testid="prev-document"]').text()).toContain(
			'Договорённости'
		)
		expect(wrapper.get('[data-testid="next-document"]').text()).toContain(
			'Области'
		)
	})
})
