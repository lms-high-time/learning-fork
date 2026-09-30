import { afterEach, describe, expect, it, vi } from 'vitest'
import { postForm, serverMessage } from '@/utils/postForm'

// A write sent as a form (learning-services#439): what comes back is either the
// data or what can be told to the person — never a throw.

const respond = (status: number, body: unknown) =>
	vi.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: async () => {
			if (body === undefined) throw new SyntaxError('not JSON')
			return body
		},
	} as Response)

afterEach(() => {
	vi.restoreAllMocks()
})

describe('postForm', () => {
	it('posts the form with the CSRF token', async () => {
		;(window as Window & { csrf_token?: string }).csrf_token = 'tok'
		const spy = respond(200, { message: { ok: true, data: { n: 1 } } })
		const form = new FormData()
		form.append('lesson', 'L1')

		expect(await postForm('app.api.method', form)).toEqual({
			ok: true,
			data: { n: 1 },
		})
		const [url, init] = spy.mock.calls[0] as [string, RequestInit]
		expect(url).toBe('/api/method/app.api.method')
		expect(init.method).toBe('POST')
		expect(init.body).toBe(form)
		expect((init.headers as Record<string, string>)['X-Frappe-CSRF-Token']).toBe(
			'tok'
		)
	})

	it('passes a refusal on with its code and message', async () => {
		respond(200, {
			message: { ok: false, error: { code: 'empty_answer', message: 'Пусто' } },
		})
		expect(await postForm('m', new FormData())).toEqual({
			ok: false,
			code: 'empty_answer',
			message: 'Пусто',
		})
	})

	it('says the files are too large when nginx turns the body away', async () => {
		respond(413, undefined)
		expect(await postForm('m', new FormData())).toEqual({
			ok: false,
			code: 'too_large',
			message: 'The files are too large to send at once',
		})
	})

	it('reads what Frappe said about a failed request', async () => {
		respond(417, {
			_server_messages: JSON.stringify([
				JSON.stringify({ message: '<b>Нельзя</b> так' }),
			]),
		})
		expect(await postForm('m', new FormData())).toEqual({
			ok: false,
			code: null,
			message: 'Нельзя так',
		})
	})

	it('has nothing to say about a server error without a message', async () => {
		respond(502, undefined)
		expect(await postForm('m', new FormData())).toEqual({
			ok: false,
			code: null,
			message: null,
		})
	})

	it('does not throw when the connection drops', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(
			new TypeError('Failed to fetch')
		)
		expect(await postForm('m', new FormData())).toEqual({
			ok: false,
			code: null,
			message: null,
		})
	})
})

describe('serverMessage', () => {
	it('falls back to a plain message', () => {
		expect(serverMessage({ message: 'Слишком много' })).toBe('Слишком много')
	})

	it('reads nothing out of an unexpected shape', () => {
		expect(serverMessage({ _server_messages: 'not json' })).toBeNull()
		expect(serverMessage(null)).toBeNull()
	})
})
