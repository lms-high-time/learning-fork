import { reactive } from 'vue'
import { vi } from 'vitest'

/**
 * A frappe-ui `createResource` that behaves like frappe-ui 1.0.0-beta.29's
 * (resources/resources.js), for the homework pages (learning-services#452):
 *
 * - a failure sets `error`, puts the previous data back, and rethrows —
 *   or, with `quiet`, only sets `error` and resolves, so a page that reads
 *   the state from `error` is tested against both;
 * - `abort()` stops the read in flight quietly: its answer is dropped;
 * - `reset()` and `setData()` as the real ones.
 *
 * A test drives it through `server`: answers and failures by URL, and a gate
 * to hold a read until the test lets it go.
 */

type Config = { url: string; makeParams?: () => unknown }

export const server = {
	answers: {} as Record<string, unknown>,
	failures: {} as Record<string, { error: Error; quiet?: boolean }>,
	gates: {} as Record<string, () => Promise<void>>,
	fetched: [] as { url: string; params: unknown }[],
	reloaded: [] as string[],
	clear() {
		for (const store of [this.answers, this.failures, this.gates])
			for (const key of Object.keys(store)) delete store[key]
		this.fetched.length = 0
		this.reloaded.length = 0
	},
}

/** A read the test holds; `release()` lets it answer. */
export function hold(url: string): { release: () => void } {
	let release = () => {}
	const gate = new Promise<void>((resolve) => (release = resolve))
	server.gates[url] = () => gate
	return {
		release: () => {
			delete server.gates[url]
			release()
		},
	}
}

export function fakeResource(config: Config) {
	let current: { aborted: boolean } | null = null

	const read = async (reason: 'fetch' | 'reload') => {
		const params = config.makeParams?.()
		if (reason === 'fetch') server.fetched.push({ url: config.url, params })
		else server.reloaded.push(config.url)
		const token = { aborted: false }
		current = token
		const previous = resource.data
		resource.error = null
		resource.loading = true
		// The server answers what it knew when asked, however late it arrives.
		const answer = server.answers[config.url] ?? null
		const failure = server.failures[config.url]
		const gate = server.gates[config.url]
		if (gate) await gate()
		if (token.aborted) return resource.data
		resource.loading = false
		if (failure) {
			resource.data = previous
			resource.error = failure.error
			if (failure.quiet) return resource.data
			throw failure.error
		}
		resource.data = answer
		return resource.data
	}

	const resource = reactive({
		data: null as unknown,
		error: null as unknown,
		loading: false,
		fetch: vi.fn(() => read('fetch')),
		reload: vi.fn(() => read('reload')),
		abort: vi.fn(() => {
			if (current) current.aborted = true
		}),
		reset: vi.fn(() => {
			resource.data = null
			resource.error = null
			resource.loading = false
		}),
		setData: vi.fn((data: unknown) => {
			resource.data = data
		}),
	})
	return resource
}
