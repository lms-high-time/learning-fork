/**
 * Markdown links — `[text](https://…)` — written into HTML that is shown as
 * HTML: they came out as their brackets (learning-services#636).
 *
 * Only plain text is touched: nothing inside a tag's attributes, an existing
 * link, or code. The links are built as elements, so neither the text nor the
 * address can break out into markup. The result still goes through the
 * page's sanitizer.
 */

// A URL may hold balanced parentheses: …/wiki/Foo_(bar).
const LINK = /\[([^\]\n]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/gi

const SKIP = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'])

export function markdownLinks(html: string): string {
	if (!html || !html.includes('](') || typeof DOMParser === 'undefined')
		return html
	const doc = new DOMParser().parseFromString(html, 'text/html')
	const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
	const texts: Text[] = []
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		let skip = false
		for (let up = node.parentElement; up; up = up.parentElement)
			if (SKIP.has(up.tagName)) {
				skip = true
				break
			}
		if (!skip && LINK.test(node.textContent ?? '')) texts.push(node as Text)
		LINK.lastIndex = 0
	}
	for (const text of texts) {
		const value = text.textContent ?? ''
		const parts = doc.createDocumentFragment()
		let last = 0
		for (const match of value.matchAll(LINK)) {
			const at = match.index ?? 0
			parts.append(value.slice(last, at))
			const link = doc.createElement('a')
			link.href = match[2]
			link.textContent = match[1]
			parts.append(link)
			last = at + match[0].length
		}
		parts.append(value.slice(last))
		text.replaceWith(parts)
	}
	return doc.body.innerHTML
}
