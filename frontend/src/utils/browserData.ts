// What the site keeps in this browser, cleared on logout
// (lms-high-time/learning-services#688): localStorage (quiz answers in
// progress, editor state), sessionStorage, IndexedDB (frappe-ui's resource
// cache: courses, progress, notifications) and Cache Storage (the service
// worker's page cache). The logout response also carries
// `Clear-Site-Data`; this covers browsers that ignore that header.
//
// IndexedDB stores are emptied rather than the databases deleted: frappe-ui
// keeps its connection open, and `deleteDatabase` would wait on it until the
// page unloads, which is not guaranteed to finish the deletion.

// idb-keyval's default database, the one frappe-ui writes to. Used when the
// browser cannot list its databases (`indexedDB.databases()` is recent).
const FRAPPE_UI_DATABASE = 'keyval-store'

// A stuck open (another tab mid-upgrade) must not hold the logout up.
const TIMEOUT_MS = 1000

const clearStorage = (name: 'localStorage' | 'sessionStorage') => {
	// Both the property and `clear()` throw when site data is blocked.
	try {
		window[name].clear()
	} catch {}
}

const clearDatabase = (factory: IDBFactory, name: string): Promise<void> =>
	new Promise((resolve) => {
		const request = factory.open(name)
		// No such database: abort the upgrade instead of creating an empty
		// one, which would leave frappe-ui's store missing from it.
		request.onupgradeneeded = () => request.transaction?.abort()
		request.onerror = () => resolve()
		request.onblocked = () => resolve()
		request.onsuccess = () => {
			const db = request.result
			const stores = Array.from(db.objectStoreNames)
			if (!stores.length) {
				db.close()
				return resolve()
			}
			const tx = db.transaction(stores, 'readwrite')
			stores.forEach((store) => tx.objectStore(store).clear())
			tx.oncomplete = tx.onerror = tx.onabort = () => {
				db.close()
				resolve()
			}
		}
	})

const databaseNames = async (factory: IDBFactory): Promise<string[]> => {
	try {
		if (typeof factory.databases === 'function') {
			const names = (await factory.databases()).map((db) => db.name)
			return names.filter((name): name is string => !!name)
		}
	} catch {}
	return [FRAPPE_UI_DATABASE]
}

const clearIndexedDB = async () => {
	let factory: IDBFactory | undefined
	try {
		factory = window.indexedDB
	} catch {}
	if (!factory) return
	const names = await databaseNames(factory)
	await Promise.all(names.map((name) => clearDatabase(factory, name)))
}

// Cache Storage: the service worker's runtime caches keep pages fetched
// while signed in (`html-cache` in the PWA config).
const clearCacheStorage = async () => {
	if (typeof caches === 'undefined') return
	await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
}

export const clearBrowserData = async (): Promise<void> => {
	clearStorage('localStorage')
	clearStorage('sessionStorage')
	await Promise.race([
		Promise.all([
			clearIndexedDB().catch(() => {}),
			clearCacheStorage().catch(() => {}),
		]),
		new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
	])
}
