import { describe, expect, it } from 'vitest'
import { isPanelUrl, readPanelMessage } from '@/utils/panelMessages'

// The assistant panel's iframe talks to the page (learning-services#463). Any
// window can post to ours, so only the panel's own frame, from the chat's
// origin, with a type we know, is listened to.

const ORIGIN = 'https://lms.example'
const frame = {} as Window
const stranger = {} as Window

const event = (data: unknown, overrides: Partial<MessageEvent> = {}) =>
	({ data, origin: ORIGIN, source: frame, ...overrides } as MessageEvent)

describe('readPanelMessage', () => {
	it('reads a refresh from the panel', () => {
		expect(
			readPanelMessage(
				event({ type: 'refresh', what: 'profile' }),
				frame,
				ORIGIN
			)
		).toEqual({ type: 'refresh', what: 'profile' })
	})

	it('reads a close from the panel', () => {
		expect(readPanelMessage(event({ type: 'close' }), frame, ORIGIN)).toEqual({
			type: 'close',
		})
	})

	it('ignores another origin', () => {
		expect(
			readPanelMessage(
				event({ type: 'close' }, { origin: 'https://evil.example' }),
				frame,
				ORIGIN
			)
		).toBeNull()
	})

	it('ignores another window of the same origin', () => {
		expect(
			readPanelMessage(
				event({ type: 'close' }, { source: stranger }),
				frame,
				ORIGIN
			)
		).toBeNull()
	})

	it('ignores everything while there is no frame', () => {
		expect(
			readPanelMessage(event({ type: 'close' }, { source: null }), null, ORIGIN)
		).toBeNull()
	})

	it('ignores a type it does not know', () => {
		expect(
			readPanelMessage(event({ type: 'navigate', to: '/' }), frame, ORIGIN)
		).toBeNull()
	})

	it('ignores a refresh that does not say what', () => {
		expect(
			readPanelMessage(event({ type: 'refresh' }), frame, ORIGIN)
		).toBeNull()
	})

	it('ignores a string instead of an object', () => {
		expect(readPanelMessage(event('close'), frame, ORIGIN)).toBeNull()
		expect(readPanelMessage(event(null), frame, ORIGIN)).toBeNull()
	})
})

describe('isPanelUrl', () => {
	it('takes a web address or a path on this site', () => {
		expect(isPanelUrl('https://lms.example/chat?mode=profile')).toBe(true)
		expect(isPanelUrl('http://localhost:8000/chat')).toBe(true)
		expect(isPanelUrl('/chat?mode=profile')).toBe(true)
	})

	it('refuses anything else a frame could be pointed at', () => {
		for (const url of [
			'javascript:alert(1)',
			' javascript:alert(1)',
			'data:text/html,hi',
			'mailto:a@x',
			'#chat',
			'//evil.example/chat',
			'/\\evil.example/chat',
			'chat',
			'',
			// The URL parser drops tabs and line breaks: each of these is
			// https://evil.example to a browser.
			'/\t/evil.example/chat',
			'/\n/evil.example/chat',
			'/\r/evil.example/chat',
			'https://\t/x',
		])
			expect(isPanelUrl(url), url).toBe(false)
	})
})
