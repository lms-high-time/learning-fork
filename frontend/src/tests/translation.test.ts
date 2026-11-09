/**
 * The app mounts after translations arrive, and late translations still land.
 *
 * `__()` used to read `window.translatedMessages` synchronously, with no
 * reactivity, while the translations come from an async request. The app
 * mounted at once: whatever rendered before the request landed — the sidebar's
 * "Courses" and "More" first of all — stayed English until something else
 * re-rendered it (learning-services#564). What is pinned here: the gate opens
 * when the translations land — from the cache too, not only the network — and
 * on a failed or hung request, so a broken endpoint costs translations, never
 * the app; and a template painted before the translations re-renders when
 * they arrive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

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

const options = () => createResource.mock.calls[0][0]

// Whether a promise has settled with the clock stopped: a gate that opens
// only on its timeout must not count as opened.
async function settledNow(promise: Promise<unknown>) {
	let settled = false
	promise.then(() => (settled = true))
	await vi.advanceTimersByTimeAsync(0)
	return settled
}

describe('translationsReady', () => {
	beforeEach(() => {
		vi.useFakeTimers()
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
		const ready = translationsReady()

		expect(await settledNow(ready)).toBe(false)

		options().transform({ Courses: 'Курсы' })

		expect(await settledNow(ready)).toBe(true)
		expect(window.__('Courses')).toBe('Курсы')
	})

	it('resolves on cached translations, without waiting for the network', async () => {
		// frappe-ui feeds a cached response through transform and calls
		// onSuccess only after the network round trip.
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)
		options().transform({ Courses: 'Курсы' })

		expect(await settledNow(translationsReady())).toBe(true)
		expect(window.__('Courses')).toBe('Курсы')
	})

	it('resolves on a failed request, so the app still mounts', async () => {
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)
		options().onError(new Error('500'))

		expect(await settledNow(translationsReady())).toBe(true)
	})

	it('resolves after the timeout when the request hangs', async () => {
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)
		const ready = translationsReady(1500)

		await vi.advanceTimersByTimeAsync(1500)

		await expect(ready).resolves.toBeUndefined()
	})

	it('does not wait or fetch when translations are already there', async () => {
		;(window as unknown as { translatedMessages: unknown }).translatedMessages =
			{}
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)

		expect(await settledNow(translationsReady())).toBe(true)
		expect(createResource).not.toHaveBeenCalled()
	})

	it('keeps one load when a sub-app installs the plugin again', async () => {
		const { default: plugin, translationsReady } = await loadPlugin()
		plugin(app() as never)
		plugin(app() as never)
		options().transform({})

		expect(createResource).toHaveBeenCalledTimes(1)
		expect(await settledNow(translationsReady())).toBe(true)
	})

	// learning-services#765: under one key a page switched to English painted
	// the cached Russian catalogue first.
	it('keeps a catalogue per page language', async () => {
		document.documentElement.lang = 'en'
		try {
			const { default: plugin } = await loadPlugin()
			plugin(app() as never)
			expect(options().cache).toEqual(['translations', 'en'])
		} finally {
			document.documentElement.lang = ''
		}
	})

	it('re-renders a template painted before the translations landed', async () => {
		const { default: plugin } = await loadPlugin()
		const Label = defineComponent({
			render: () => h('span', window.__('Courses')),
		})
		const wrapper = mount(Label, { global: { plugins: [plugin] } })
		expect(wrapper.text()).toBe('Courses')

		options().transform({ Courses: 'Курсы' })
		await nextTick()

		expect(wrapper.text()).toBe('Курсы')
	})
})
