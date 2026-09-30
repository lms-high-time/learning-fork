/**
 * Our methods answer `{ok, data}` or `{ok: false, error}` (lms_frappe_app's
 * CONTRACT.md); frappe-ui wraps it in `message`.
 */
export type ContractAnswer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}

export type FormResult<T> =
	| { ok: true; data: T | undefined }
	| { ok: false; code: string | null; message: string | null }

type FrappeBody = {
	message?: unknown
	_server_messages?: string
}

const text = (html: string): string => html.replace(/<[^>]*>/g, '').trim()

/**
 * What Frappe said about a failed request: the first of `_server_messages`
 * (a JSON list of JSON objects), or a plain `message`. Null when it said
 * nothing a person can read.
 */
export function serverMessage(body: unknown): string | null {
	const { _server_messages, message } = (body ?? {}) as FrappeBody
	if (_server_messages) {
		try {
			for (const raw of JSON.parse(_server_messages) as string[]) {
				const parsed = JSON.parse(raw) as { message?: unknown }
				if (typeof parsed.message === 'string' && text(parsed.message))
					return text(parsed.message)
			}
		} catch {
			// Not the shape Frappe writes: say nothing rather than raw JSON.
		}
	}
	return typeof message === 'string' && text(message) ? text(message) : null
}

/**
 * A write sent as a form — files go as the browser sends them. Never throws:
 * a dropped connection, a body nginx turned away (413) and a refusal all come
 * back as `{ok: false}` with what can be told to the person, if anything.
 */
export async function postForm<T>(
	method: string,
	form: FormData
): Promise<FormResult<T>> {
	let response: Response
	try {
		response = await fetch(`/api/method/${method}`, {
			method: 'POST',
			body: form,
			headers: {
				Accept: 'application/json',
				'X-Frappe-CSRF-Token':
					(window as Window & { csrf_token?: string }).csrf_token ?? '',
			},
		})
	} catch {
		return { ok: false, code: null, message: null }
	}
	if (response.status === 413)
		return {
			ok: false,
			code: 'too_large',
			message: __('The files are too large to send at once'),
		}
	let body: unknown = null
	try {
		body = await response.json()
	} catch {
		// An HTML error page: nothing to read.
	}
	if (!response.ok)
		return { ok: false, code: null, message: serverMessage(body) }
	const answer = (body as FrappeBody | null)?.message as
		| ContractAnswer<T>
		| undefined
	if (answer?.ok) return { ok: true, data: answer.data }
	return {
		ok: false,
		code: answer?.error?.code ?? null,
		message: answer?.error?.message ?? null,
	}
}
