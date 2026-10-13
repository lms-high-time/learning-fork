/**
 * The app mounts after translations arrive.
 *
 * `__()` reads `window.translatedMessages` synchronously and is not reactive,
 * and the translations come from an async request. The app used to mount at
 * once: whatever rendered before the request landed — the sidebar's "Courses"
 * and "More" first of all — stayed English until something else re-rendered
 * it (learning-services#564). What is pinned here is the gate: it opens when
 * the translations land, and also on a failed or hung request, so a broken
 * endpoint costs translations, never the app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createResource } = vi.hoisted(() => ({ createResource: vi.fn() }))

vi.mock('frappe-ui', () => ({ createResource }))

const app = () => ({
	config: { globalProperties: {} as Record<string, unknown> },
})

async function loadPlugin() {
	vi.resetModules()
	// @ts-expect-error a JS module has no generated types (TS7016)
	return await import('@/translation')
}

describe('translationsReady', () => {
	beforeEach(() => {
		createResource.mockReset()
		delete (window as unknown as { translatedMessages?: unknown })
			.translatedMessages
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('resolves once the translations land, with them in place', async () => {
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)
		const options = createResource.mock.calls[0][0]
		let settled = false
		const ready = translationsReady().then(() => (settled = true))

		await Promise.resolve()
		expect(settled).toBe(false)

		options.transform({ Courses: 'Курсы' })
		options.onSuccess()
		await ready

		expect(window.__('Courses')).toBe('Курсы')
	})

	it('resolves on a failed request, so the app still mounts', async () => {
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)
		createResource.mock.calls[0][0].onError(new Error('500'))

		await expect(translationsReady()).resolves.toBeUndefined()
	})

	it('resolves after the timeout when the request hangs', async () => {
		vi.useFakeTimers()
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)
		const ready = translationsReady(3000)

		await vi.advanceTimersByTimeAsync(3000)

		await expect(ready).resolves.toBeUndefined()
	})

	it('does not wait or fetch when translations are already there', async () => {
		;(window as unknown as { translatedMessages: unknown }).translatedMessages =
			{}
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)

		await expect(translationsReady()).resolves.toBeUndefined()
		expect(createResource).not.toHaveBeenCalled()
	})
})
