// What changed in a homework answer since the tutor last reviewed it
// (learning-services#452): words taken out and added, and files. The card
// draws the parts as text in <del>/<ins>, never as HTML.

export type DiffPart = { type: 'same' | 'add' | 'del'; text: string }

/**
 * The most cells the comparison table may hold. Words first; past it, lines;
 * past it again, the two texts whole — a pasted book must not hang the tab.
 */
export const DIFF_BUDGET = 2_000_000

const words = (text: string): string[] =>
	text.split(/(\s+)/).filter((token) => token !== '')
// A line keeps its line break, so the parts join back into the text.
const lines = (text: string): string[] =>
	text.split(/(?<=\n)/).filter((token) => token !== '')

const isBlank = (text: string) => /^\s+$/.test(text)

/** Token by token along the longest common subsequence; null — over budget. */
function compare(a: string[], b: string[]): DiffPart[] | null {
	// The shared start and end cost nothing: an edit in the middle of a long
	// answer compares only the middle.
	let start = 0
	while (start < a.length && start < b.length && a[start] === b[start]) start++
	let endA = a.length
	let endB = b.length
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--
		endB--
	}
	const n = endA - start
	const m = endB - start
	if (n * m > DIFF_BUDGET) return null

	const parts: DiffPart[] = a
		.slice(0, start)
		.map((text) => ({ type: 'same' as const, text }))
	// lcs[i][j]: the common length of a[i..] and b[j..], flattened.
	const width = m + 1
	const lcs = new Uint32Array((n + 1) * width)
	for (let i = n - 1; i >= 0; i--)
		for (let j = m - 1; j >= 0; j--)
			lcs[i * width + j] =
				a[start + i] === b[start + j]
					? lcs[(i + 1) * width + j + 1] + 1
					: Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
	let i = 0
	let j = 0
	while (i < n || j < m) {
		if (i < n && j < m && a[start + i] === b[start + j]) {
			parts.push({ type: 'same', text: a[start + i] })
			i++
			j++
		} else if (
			j >= m ||
			(i < n && lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])
		) {
			parts.push({ type: 'del', text: a[start + i] })
			i++
		} else {
			parts.push({ type: 'add', text: b[start + j] })
			j++
		}
	}
	for (const text of a.slice(endA)) parts.push({ type: 'same', text })
	return parts
}

/** Adjacent parts of one kind as one. */
function merge(parts: DiffPart[]): DiffPart[] {
	const merged: DiffPart[] = []
	for (const part of parts) {
		const last = merged[merged.length - 1]
		if (last && last.type === part.type) last.text += part.text
		else if (part.text) merged.push({ ...part })
	}
	return merged
}

/**
 * A change reads as one: «встречу» → «две встречи», not «встречу» → «две»,
 * a kept space, «встречи». A space kept between two changes joins them, and
 * each run of changes becomes one taken-out piece and one added, in that
 * order; the whitespace both end with goes back to the text around.
 */
function tidy(parts: DiffPart[]): DiffPart[] {
	const result: DiffPart[] = []
	let del = ''
	let add = ''
	const flush = () => {
		const tail = commonTail(del, add)
		const head = commonHead(
			del.slice(0, del.length - tail.length),
			add.slice(0, add.length - tail.length)
		)
		if (head) result.push({ type: 'same', text: head })
		const taken = del.slice(head.length, del.length - tail.length)
		const given = add.slice(head.length, add.length - tail.length)
		if (taken) result.push({ type: 'del', text: taken })
		if (given) result.push({ type: 'add', text: given })
		if (tail) result.push({ type: 'same', text: tail })
		del = ''
		add = ''
	}
	parts.forEach((part, index) => {
		const between =
			part.type === 'same' &&
			isBlank(part.text) &&
			index > 0 &&
			index < parts.length - 1 &&
			parts[index - 1].type !== 'same' &&
			parts[index + 1].type !== 'same'
		if (part.type === 'del' || between) del += part.text
		if (part.type === 'add' || between) add += part.text
		if (part.type === 'same' && !between) {
			flush()
			result.push(part)
		}
	})
	flush()
	return merge(result)
}

// Only whitespace moves back: a word both pieces share stays inside them.
function commonTail(a: string, b: string): string {
	if (!a || !b) return ''
	const x = a.match(/\s*$/)![0]
	const y = b.match(/\s*$/)![0]
	let k = 0
	while (
		k < x.length &&
		k < y.length &&
		x[x.length - 1 - k] === y[y.length - 1 - k]
	)
		k++
	return x.slice(x.length - k)
}

function commonHead(a: string, b: string): string {
	if (!a || !b) return ''
	const x = a.match(/^\s*/)![0]
	const y = b.match(/^\s*/)![0]
	let k = 0
	while (k < x.length && k < y.length && x[k] === y[k]) k++
	return x.slice(0, k)
}

/** What changed from `before` to `after`, word by word. */
export function diffWords(before: string, after: string): DiffPart[] {
	const a = before ?? ''
	const b = after ?? ''
	const parts = compare(words(a), words(b)) ?? compare(lines(a), lines(b))
	if (parts) return tidy(merge(parts))
	return merge([
		{ type: 'del', text: a },
		{ type: 'add', text: b },
	])
}

/** The files of two versions by id: which came, which went, which stayed. */
export function diffFiles<T extends { id: string }>(
	before: readonly T[],
	after: readonly T[]
): { added: T[]; removed: T[]; kept: T[] } {
	const was = new Set(before.map((file) => file.id))
	const is = new Set(after.map((file) => file.id))
	return {
		added: after.filter((file) => !was.has(file.id)),
		removed: before.filter((file) => !is.has(file.id)),
		kept: after.filter((file) => was.has(file.id)),
	}
}
