import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { LESSONS, pluralMessage, plural, STUDENTS } from '@/utils/plural'
import { ROWS_OF } from '@/utils/documentTable'
import { BLOCKS_OF, TEAM_LIMIT } from '@/utils/team'
import { pageLang } from '@/utils/lang'

// learning-services#325: «1 Студенты» and «4 разделов · 8 уроки» become the
// right form of the noun for the count.

const RU = {
	'{0} lesson': '{0} урок',
	'{0} lessons [few]': '{0} урока',
	'{0} lessons [many]': '{0} уроков',
	'{0} lessons': '{0} урока',
}

describe('pluralMessage', () => {
	it('picks one, few and many for Russian', () => {
		expect(pluralMessage(1, LESSONS, 'ru', RU)).toBe('{0} lesson')
		expect(pluralMessage(21, LESSONS, 'ru', RU)).toBe('{0} lesson')
		expect(pluralMessage(3, LESSONS, 'ru', RU)).toBe('{0} lessons [few]')
		expect(pluralMessage(8, LESSONS, 'ru', RU)).toBe('{0} lessons [many]')
		expect(pluralMessage(11, LESSONS, 'ru', RU)).toBe('{0} lessons [many]')
	})

	it('uses only one and other for English', () => {
		expect(pluralMessage(1, LESSONS, 'en', {})).toBe('{0} lesson')
		expect(pluralMessage(3, LESSONS, 'en', {})).toBe('{0} lessons')
		expect(pluralMessage(8, LESSONS, 'en', {})).toBe('{0} lessons')
	})

	it('falls back to other where a language has no few or many translated', () => {
		// Russian rules, but a catalogue without the extra forms: better the
		// plain plural than an English message with a [few] tag.
		expect(pluralMessage(3, STUDENTS, 'ru', {})).toBe('{0} students')
	})
})

describe('plural', () => {
	beforeEach(() => {
		vi.stubGlobal('translatedMessages', RU)
		vi.stubGlobal('__', (message: string) => ({
			format: (value: string) =>
				((RU as Record<string, string>)[message] ?? message).replace('{0}', value),
		}))
		document.documentElement.lang = 'ru'
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		document.documentElement.lang = ''
	})

	it('writes the count with its noun', () => {
		expect(plural(1, LESSONS)).toBe('1 урок')
		expect(plural(4, LESSONS)).toBe('4 урока')
		expect(plural(8, LESSONS)).toBe('8 уроков')
	})

	it('shows the display text while the count picks the form', () => {
		expect(plural(50, LESSONS, '50+')).toBe('50+ уроков')
	})
})

// learning-services#765: the counts our pages wrote as «{0} members» whatever
// the number. Where a count reads "of" a total, the total picks the noun.
describe('the fork counts', () => {
	it('picks the singular for one and the plural for the rest', () => {
		expect(pluralMessage(1, TEAM_LIMIT, 'en')).toBe(
			'A team holds up to {0} member.'
		)
		expect(pluralMessage(25, TEAM_LIMIT, 'en')).toBe(
			'A team holds up to {0} members.'
		)
		expect(pluralMessage(1, ROWS_OF, 'en')).toBe('{0} of {1} row')
		expect(pluralMessage(4, ROWS_OF, 'en')).toBe('{0} of {1} rows')
		expect(pluralMessage(1, BLOCKS_OF, 'en')).toBe('{0} of {1} block')
		expect(pluralMessage(4, BLOCKS_OF, 'en')).toBe('{0} of {1} blocks')
	})

	it('gives Russian the genitive singular after 21 and the plural after 3', () => {
		expect(pluralMessage(21, TEAM_LIMIT, 'ru')).toBe(
			'A team holds up to {0} member.'
		)
		expect(pluralMessage(3, ROWS_OF, 'ru')).toBe('{0} of {1} rows')
	})
})

// learning-services#765: the tag is checked once, so no caller needs a guard.
describe('pageLang', () => {
	afterEach(() => {
		document.documentElement.lang = ''
	})

	it('takes the page tag, canonical', () => {
		document.documentElement.lang = 'en-gb'
		expect(pageLang()).toBe('en-GB')
		document.documentElement.lang = 'ru'
		expect(pageLang()).toBe('ru')
	})

	it('reads English without a tag or with the template left unrendered', () => {
		document.documentElement.lang = ''
		expect(pageLang()).toBe('en')
		document.documentElement.lang = '{{ boot.lang }}'
		expect(pageLang()).toBe('en')
	})
})
