import { describe, expect, it } from 'vitest'
import { diffFiles, diffWords, type DiffPart } from '@/utils/textDiff'

// The tutor compares an answer with the version they last reviewed
// (learning-services#452): words added and taken out, and files.

const before = (parts: DiffPart[]) =>
	parts
		.filter((part) => part.type !== 'add')
		.map((part) => part.text)
		.join('')
const after = (parts: DiffPart[]) =>
	parts
		.filter((part) => part.type !== 'del')
		.map((part) => part.text)
		.join('')

describe('diffWords', () => {
	it('keeps an unchanged text as one piece', () => {
		expect(diffWords('Провёл встречу', 'Провёл встречу')).toEqual([
			{ type: 'same', text: 'Провёл встречу' },
		])
	})

	it('marks the words taken out and the words added', () => {
		expect(
			diffWords('Провёл встречу вчера', 'Провёл две встречи вчера')
		).toEqual([
			{ type: 'same', text: 'Провёл ' },
			{ type: 'del', text: 'встречу' },
			{ type: 'add', text: 'две встречи' },
			{ type: 'same', text: ' вчера' },
		])
	})

	it('handles empty texts', () => {
		expect(diffWords('', '')).toEqual([])
		expect(diffWords('', 'Новый ответ')).toEqual([
			{ type: 'add', text: 'Новый ответ' },
		])
		expect(diffWords('Старый ответ', '')).toEqual([
			{ type: 'del', text: 'Старый ответ' },
		])
	})

	it('keeps line breaks as they were', () => {
		const parts = diffWords('Цели:\n- одна', 'Цели:\n- одна\n- две')
		expect(before(parts)).toBe('Цели:\n- одна')
		expect(after(parts)).toBe('Цели:\n- одна\n- две')
		expect(parts[parts.length - 1]).toEqual({ type: 'add', text: '\n- две' })
	})

	it('compares whole lines when the texts are too long for words', () => {
		// 30 lines of 50 words, changed at both ends: the part to compare is past
		// the word budget, so a changed word marks its whole line.
		const line = (n: number) =>
			Array.from({ length: 50 }, (_, i) => `w${n}-${i}`).join(' ')
		const lines = Array.from({ length: 30 }, (_, n) => line(n))
		const changed = [...lines]
		changed[0] = changed[0].replace('w0-0 ', 'начало ')
		changed[29] = changed[29].replace(' w29-49', ' конец')
		const a = lines.join('\n')
		const b = changed.join('\n')

		const parts = diffWords(a, b)
		expect(before(parts)).toBe(a)
		expect(after(parts)).toBe(b)
		expect(parts.filter((part) => part.type === 'del')).toEqual([
			{ type: 'del', text: lines[0] },
			{ type: 'del', text: lines[29] },
		])
		expect(parts.filter((part) => part.type === 'add')).toEqual([
			{ type: 'add', text: changed[0] },
			{ type: 'add', text: changed[29] },
		])
	})

	it('shows both texts whole when even lines are too many', () => {
		const a = Array.from({ length: 1500 }, (_, i) => `a${i}`).join('\n')
		const b = Array.from({ length: 1500 }, (_, i) => `b${i}`).join('\n')
		expect(diffWords(a, b)).toEqual([
			{ type: 'del', text: a },
			{ type: 'add', text: b },
		])
	})

	it('finds the change in long texts with a common start and end', () => {
		// The shared head and tail cost nothing: only the middle is compared.
		const head = Array.from({ length: 3000 }, (_, i) => `h${i}`).join(' ')
		const parts = diffWords(`${head} старое ${head}`, `${head} новое ${head}`)
		expect(parts.filter((part) => part.type !== 'same')).toEqual([
			{ type: 'del', text: 'старое' },
			{ type: 'add', text: 'новое' },
		])
	})
})

describe('diffFiles', () => {
	const file = (id: string) => ({ id, name: `${id}.pdf` })

	it('sorts the files into added, removed and kept', () => {
		const result = diffFiles(
			[file('F-1'), file('F-2')],
			[file('F-2'), file('F-3')]
		)
		expect(result.added.map((f) => f.id)).toEqual(['F-3'])
		expect(result.removed.map((f) => f.id)).toEqual(['F-1'])
		expect(result.kept.map((f) => f.id)).toEqual(['F-2'])
	})

	it('handles no files', () => {
		expect(diffFiles([], [])).toEqual({ added: [], removed: [], kept: [] })
	})
})
