import { describe, expect, it } from 'vitest'
import { markdownLinks } from '@/utils/markdownLinks'

// learning-services#636: Markdown links in a course description shown as HTML.

const parse = (html: string) => {
	const box = document.createElement('div')
	box.innerHTML = html
	return box
}

describe('markdownLinks', () => {
	it('turns a link in the text into a link', () => {
		const box = parse(
			markdownLinks(
				'<p>Опора — [patterns.sociocracy30.org](https://patterns.sociocracy30.org/), CC BY-SA.</p>'
			)
		)
		const link = box.querySelector('a')!
		expect(link.getAttribute('href')).toBe('https://patterns.sociocracy30.org/')
		expect(link.textContent).toBe('patterns.sociocracy30.org')
		expect(box.textContent).toBe('Опора — patterns.sociocracy30.org, CC BY-SA.')
	})

	it('keeps parentheses that belong to the address', () => {
		const link = parse(
			markdownLinks('[Foo](https://en.wikipedia.org/wiki/Foo_(bar)) и всё')
		).querySelector('a')!
		expect(link.getAttribute('href')).toBe(
			'https://en.wikipedia.org/wiki/Foo_(bar)'
		)
	})

	it('does not reach into attributes, links or code', () => {
		const html =
			'<img alt="[x](https://a.example/)" src="i.png"><a href="https://b.example/">[y](https://c.example/)</a><pre><code>[z](https://d.example/)</code></pre>'
		const box = parse(markdownLinks(html))
		expect(box.querySelector('img')!.getAttribute('alt')).toBe(
			'[x](https://a.example/)'
		)
		expect(box.querySelectorAll('a')).toHaveLength(1)
		expect(box.querySelector('code')!.textContent).toBe(
			'[z](https://d.example/)'
		)
	})

	it('cannot be used to write markup', () => {
		// Escaped in the source, so text: it has to stay text in the link.
		const box = parse(
			markdownLinks(
				'<p>[&lt;img src=x onerror=alert(1)&gt;](https://e.example/a"b)</p>'
			)
		)
		expect(box.querySelector('img')).toBeNull()
		const link = box.querySelector('a')!
		expect(link.textContent).toBe('<img src=x onerror=alert(1)>')
		expect(link.getAttributeNames()).toEqual(['href'])
	})

	it('leaves other addresses and plain text alone', () => {
		expect(markdownLinks('<p>[a](javascript:alert(1))</p>')).toBe(
			'<p>[a](javascript:alert(1))</p>'
		)
		expect(markdownLinks('<p>без ссылок</p>')).toBe('<p>без ссылок</p>')
	})
})
