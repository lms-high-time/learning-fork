import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

// The learner's settings on their profile (learning-services#626): the
// language, the colour mode, the password and logging out, in one place.

const { call, toast, logout } = vi.hoisted(() => ({
	call: vi.fn(),
	toast: { error: vi.fn(), success: vi.fn() },
	logout: { submit: vi.fn(), loading: false },
}))

vi.mock('frappe-ui', () => ({
	call,
	toast,
	Button: {
		props: ['label', 'loading'],
		emits: ['click'],
		template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>',
	},
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ logout, branding: { data: { app_name: 'Cenda' } } }),
}))

import ProfileSettings from '@/components/Profile/ProfileSettings.vue'
import { themePreference } from '@/utils/theme'

const open = (language: string | null = 'ru') =>
	mount(ProfileSettings, {
		props: { user: 'me@x', language },
		global: { mocks: { __: (globalThis as any).__ } },
	})

const reload = vi.fn()
// The setup stubs `__` globally too, so only the location is put back.
const realLocation = window.location

enableAutoUnmount(afterEach)

beforeEach(() => {
	delete (window as any).read_only_mode
	call.mockReset()
	toast.error.mockReset()
	logout.submit.mockReset()
	reload.mockReset()
	vi.stubGlobal('location', { ...window.location, reload })
})

afterEach(() => {
	vi.stubGlobal('location', realLocation)
})

describe('profile settings', () => {
	it('saves the language and loads the app again in it', async () => {
		call.mockResolvedValue({})
		const wrapper = open()
		await wrapper.get('[data-testid="profile-language"]').setValue('en')
		await flushPromises()
		expect(call).toHaveBeenCalledWith('frappe.client.set_value', {
			doctype: 'User',
			name: 'me@x',
			fieldname: 'language',
			value: 'en',
		})
		expect(reload).toHaveBeenCalled()
	})

	it('stays put and says so when the language is not saved', async () => {
		call.mockRejectedValue(new Error('offline'))
		const wrapper = open()
		await wrapper.get('[data-testid="profile-language"]').setValue('en')
		await flushPromises()
		expect(reload).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledWith('Could not save')
	})

	it('still shows a language it does not list', () => {
		const wrapper = open('de')
		const select = wrapper.get('[data-testid="profile-language"]')
		expect((select.element as HTMLSelectElement).value).toBe('de')
	})

	it('asks for a language when none is set', () => {
		const wrapper = open(null)
		const select = wrapper.get('[data-testid="profile-language"]')
		expect((select.element as HTMLSelectElement).value).toBe('')
	})

	it('does not change the language while the site is read-only', () => {
		;(window as any).read_only_mode = true
		const wrapper = open()
		expect(
			wrapper.get('[data-testid="profile-language"]').attributes('disabled')
		).toBeDefined()
	})

	it('offers following the system as well as light and dark', async () => {
		const wrapper = open()
		const radios = wrapper.findAll('[data-testid="profile-theme"] input')
		expect(radios.map((radio) => radio.attributes('value'))).toEqual([
			'system',
			'light',
			'dark',
		])
		await radios[2].setValue(true)
		expect(themePreference.value).toBe('dark')
		await radios[0].setValue(true)
		expect(themePreference.value).toBe('system')
	})

	it('leads to the password page', () => {
		const wrapper = open()
		expect(
			wrapper.get('[data-testid="profile-password"]').attributes('href')
		).toBe('/update-password')
	})

	it('logs out', async () => {
		const wrapper = open()
		await wrapper.get('[data-testid="profile-logout"]').trigger('click')
		expect(logout.submit).toHaveBeenCalled()
	})
})
