import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// What logging out clears in this browser
// (lms-high-time/learning-services#688): localStorage (quiz answers),
// sessionStorage, the IndexedDB stores (frappe-ui's resource cache) and
// Cache Storage (the service worker's page cache). The call from logout
// itself is covered in sessionLogout.test.ts.

import { clearBrowserData } from '@/utils/browserData'

// A stand-in for IndexedDB: jsdom has none. Each database is a map of object
// stores, and a store is cleared through a readwrite transaction the way the
// real API does it, so an open connection elsewhere does not block it.
const fakeIndexedDB = (databases: Record<string, Record<string, string[]>>) => {
	const opened: string[] = []
	const created: string[] = []
	const factory = {
		databases: async () => Object.keys(databases).map((name) => ({ name })),
		open(name: string) {
			opened.push(name)
			const request: any = {}
			setTimeout(() => {
				const stores = databases[name]
				if (!stores) {
					const transaction = { abort: vi.fn() }
					request.transaction = transaction
					request.onupgradeneeded?.()
					if (transaction.abort.mock.calls.length) {
						request.onerror?.()
					} else {
						created.push(name)
						request.result = { objectStoreNames: [], close: vi.fn() }
						request.onsuccess?.()
					}
					return
				}
				request.result = {
					objectStoreNames: Object.keys(stores),
					close: vi.fn(),
					transaction(names: string[]) {
						const tx: any = {
							objectStore: (store: string) => ({
								clear: () => (stores[store] = []),
							}),
						}
						setTimeout(() => tx.oncomplete?.())
						return tx
					},
				}
				request.onsuccess?.()
			})
			return request
		},
	}
	return { factory, opened, created }
}

beforeEach(() => {
	localStorage.clear()
	sessionStorage.clear()
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('clearBrowserData', () => {
	it('empties localStorage, sessionStorage and every IndexedDB store', async () => {
		const databases = {
			'keyval-store': { keyval: ['lms.lms.api.get_my_courses'] },
			other: { a: ['x'], b: ['y'] },
		}
		const db = fakeIndexedDB(databases)
		vi.stubGlobal('indexedDB', db.factory)
		localStorage.setItem('Quiz title', '[{"question_name":"q1"}]')
		sessionStorage.setItem('note', '1')

		await clearBrowserData()

		expect(localStorage.length).toBe(0)
		expect(sessionStorage.length).toBe(0)
		expect(databases).toEqual({
			'keyval-store': { keyval: [] },
			other: { a: [], b: [] },
		})
	})

	it('falls back to the frappe-ui store without creating a database', async () => {
		const databases = { 'keyval-store': { keyval: ['cached'] } }
		const db = fakeIndexedDB(databases)
		vi.stubGlobal('indexedDB', { open: db.factory.open })

		await clearBrowserData()
		expect(databases['keyval-store'].keyval).toEqual([])

		const empty = fakeIndexedDB({})
		vi.stubGlobal('indexedDB', { open: empty.factory.open })
		await clearBrowserData()
		expect(empty.opened).toEqual(['keyval-store'])
		expect(empty.created).toEqual([])
	})

	it('deletes every Cache Storage cache', async () => {
		vi.stubGlobal('indexedDB', undefined)
		const stored = new Set(['html-cache', 'assets'])
		vi.stubGlobal('caches', {
			keys: async () => [...stored],
			delete: async (key: string) => stored.delete(key),
		})

		await clearBrowserData()

		expect(stored.size).toBe(0)
	})

	it('still resolves when storage is unavailable', async () => {
		vi.stubGlobal('indexedDB', undefined)
		vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError')
		})

		await expect(clearBrowserData()).resolves.toBeUndefined()
		vi.restoreAllMocks()
	})
})
