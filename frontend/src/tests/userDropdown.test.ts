/**
 * The desktop profile menu: the page with connected agents and browser
 * sessions is reachable from it, and only for a signed-in user
 * (learning-services#691).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { session } = vi.hoisted(() => ({
	session: { isLoggedIn: true },
}))

// The menu as plain buttons: what matters is which rows exist and where they lead.
vi.mock('frappe-ui', () => ({
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	createResource: () => ({ data: [] }),
	Dropdown: {
		props: ['options'],
		template: `<div>
			<template v-for="group in options">
				<template v-for="item in group.items">
					<button
						v-if="!item.condition || item.condition()"
						:data-label="item.label"
						@click="item.onClick && item.onClick()"
					>{{ item.label }}</button>
				</template>
			</template>
		</div>`,
	},
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({
		isLoggedIn: session.isLoggedIn,
		logout: { submit: vi.fn(() => Promise.resolve()) },
		branding: { data: {} },
	}),
}))

vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: { data: { username: 'me' } } }),
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ isSettingsOpen: false, settings: { data: {} } }),
}))

vi.mock('@/utils', () => ({ convertToTitleCase: (text: string) => text }))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/components/Settings/Settings.vue', () => ({
	default: { template: '<div />' },
}))

import UserDropdown from '@/components/Sidebar/UserDropdown.vue'

describe('agents and sessions in the profile menu', () => {
	it('leads a signed-in user to the connections page', async () => {
		session.isLoggedIn = true
		const location = { href: '' }
		vi.stubGlobal('location', location)
		const wrapper = mount(UserDropdown)

		await wrapper.get('[data-label="Agents and sessions"]').trigger('click')

		expect(location.href).toBe('/connections')
		vi.unstubAllGlobals()
		vi.stubGlobal('__', (text: string) => text)
	})

	it('is absent for a guest', () => {
		session.isLoggedIn = false
		const wrapper = mount(UserDropdown)

		expect(wrapper.find('[data-label="Agents and sessions"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-label="Log in"]').exists()).toBe(true)
	})
})
