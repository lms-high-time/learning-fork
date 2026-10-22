/**
 * Where a signed-out visitor lands.
 *
 * Logging out used to reload the current page. With guest access off, that
 * page is not browsable by a guest, so the visitor was left looking at an
 * access error on the page they had just been using. They now go to the site
 * root, which every visitor can open. Before leaving, the site storage in
 * this browser is cleared (lms-high-time/learning-services#688).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { resources, userResource } = vi.hoisted(() => ({
	resources: new Map<string, any>(),
	userResource: { reload: vi.fn(), reset: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	createResource: (options: any) => {
		resources.set(options.url, options)
		return { submit: vi.fn(), reload: vi.fn() }
	},
}))

vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource }) }))
vi.mock('../stores/user', () => ({ usersStore: () => ({ userResource }) }))

import { sessionStore } from '@/stores/session'

describe('logout', () => {
	let location: { href: string; reload: ReturnType<typeof vi.fn> }

	beforeEach(() => {
		resources.clear()
		setActivePinia(createPinia())
		document.cookie = 'user_id=learner@example.com'
		location = { href: 'https://lms.example.com/lms/courses/p3', reload: vi.fn() }
		vi.stubGlobal('location', location)
		Object.defineProperty(window, 'location', { value: location, configurable: true })
	})

	it('sends the signed-out visitor to the site root', async () => {
		sessionStore()

		await resources.get('logout').onSuccess()

		expect(location.href).toBe('/')
		expect(location.reload).not.toHaveBeenCalled()
	})

	it('forgets the user before leaving', async () => {
		const session = sessionStore()

		await resources.get('logout').onSuccess()

		expect(userResource.reset).toHaveBeenCalled()
		expect(session.isLoggedIn).toBe(false)
	})

	it('clears the site storage before leaving', async () => {
		sessionStore()
		localStorage.setItem('Quiz title', '[]')
		sessionStorage.setItem('note', '1')
		let storedOnLeaving = -1
		Object.defineProperty(location, 'href', {
			configurable: true,
			get: () => 'https://lms.example.com/lms/courses/p3',
			set: () => (storedOnLeaving = localStorage.length + sessionStorage.length),
		})

		await resources.get('logout').onSuccess()

		expect(storedOnLeaving).toBe(0)
	})
})
