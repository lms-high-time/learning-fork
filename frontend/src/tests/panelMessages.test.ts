import { describe, expect, it } from 'vitest'
import { readPanelMessage } from '@/utils/panelMessages'

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
