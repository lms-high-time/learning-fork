import { describe, expect, it } from 'vitest'

// learning-services#360: the document engine is generic — a course defines its
// document as data (blocks, fields, tables, views, a sheet), and dozens of
// courses are coming. So the documents code names no course's block, field or
// column, and speaks no course's words: labels come from the schema (a
// table's title, a view's title) or are neutral. This guard reads the code
// itself; comments may still use a course as an example, so they are cut
// before matching.

const sources = import.meta.glob(
	[
		'../utils/documentTable.ts',
		'../components/Documents/*.vue',
		'../pages/Documents/Document.vue',
		'../components/CourseDocumentCard.vue',
		'../composables/useDocument.ts',
	],
	{ query: '?raw', import: 'default', eager: true }
) as Record<string, string>

// Block comments keep their line breaks, so a finding names its real line.
const blank = (comment: string) => comment.replace(/[^\n]/g, '')
const withoutComments = (code: string) =>
	code
		.replace(/<!--[\s\S]*?-->/g, blank)
		.replace(/\/\*[\s\S]*?\*\//g, blank)
		// A line comment, not the `//` inside a string such as a URL.
		.replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

// Keys of the courses written so far, as they would appear in code.
const KEYS = [
	'event',
	'review',
	'sponsor',
	'rank',
	'threshold',
	'uvp',
	'segments',
	'first_sketch',
]
const QUOTED_KEY = new RegExp(`['"\`](${KEYS.join('|')})['"\`]`)
// Words of one course (the risks course so far).
const WORDS = /риск|реестр|спонсор|sponsor|risk|register/i

describe('the documents code knows no course', () => {
	const files = Object.entries(sources)

	it('reads the documents code', () => {
		expect(files.length).toBeGreaterThan(10)
		expect(Object.keys(sources)).toContain(
			'../components/Documents/TablePanel.vue'
		)
	})

	it.each(files)('%s has no course keys or words', (_, code) => {
		const lines = withoutComments(code).split('\n')
		const found = lines
			.map((line, i) => ({ line: i + 1, text: line.trim() }))
			.filter(({ text }) => QUOTED_KEY.test(text) || WORDS.test(text))
		expect(found).toEqual([])
	})

	it('catches what it is meant to', () => {
		const bad = (code: string) =>
			withoutComments(code)
				.split('\n')
				.some((l) => QUOTED_KEY.test(l) || WORDS.test(l))
		expect(bad("c.key === 'event'")).toBe(true)
		expect(bad("__('The whole register')")).toBe(true)
		expect(bad('{{ __("Доклад спонсору") }}')).toBe(true)
		expect(bad('// the risks course names its table «Реестр»')).toBe(false)
		expect(bad('<!-- the register at a glance -->')).toBe(false)
		expect(bad("const url = 'https://example.org' // a register")).toBe(false)
	})
})
