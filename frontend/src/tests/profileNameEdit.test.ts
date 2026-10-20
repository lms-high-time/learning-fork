import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { reactive } from 'vue'

// The name and the photo, edited in place under the profile's header
// (learning-services#626) — no page and no window of their own. The old
// /user/X/edit link still works: it opens the fields on the profile.

const { createResourceMock, call, toast, passthrough } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createResourceMock: vi.fn(),
		call: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		passthrough: {
			inheritAttrs: false,
			template: `<div><slot name="icon" /><slot /></div>`,
		},
	}
})

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: {}, brand: {} }),
}))

// frappe-ui's ESM build does not resolve under vitest, so every export the
// components under test reach for is stubbed by hand.
vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	call,
	usePageMeta: vi.fn(),
	toast,
	Button: {
		inheritAttrs: false,
		props: ['label', 'loading'],
		emits: ['click'],
		template: `<button v-bind="$attrs" @click="$emit('click')">{{ label }}<slot /></button>`,
	},
	// `data-label` lets a test address one field.
	FormControl: {
		name: 'FormControl',
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :data-label="label" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	Badge: passthrough,
	TabButtons: passthrough,
	Tooltip: passthrough,
}))

const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Controls/Uploader.vue', () => ({
	default: {
		name: 'Uploader',
		props: ['modelValue', 'label', 'required'],
		template: `<div data-testid="uploader">{{ label }}</div>`,
	},
}))
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: {
		name: 'PageHeader',
		props: ['breadcrumbs'],
		template: `<nav data-testid="crumbs">{{ breadcrumbs.map((c) => c.label).join(' / ') }}<slot name="actions" /></nav>`,
	},
}))
vi.mock('@/components/HeaderButton.vue', stub)
vi.mock('@/components/NoPermission.vue', stub)
vi.mock('@/components/Profile/ProfileSettings.vue', () => ({
	default: { template: '<section data-testid="profile-settings" />' },
}))
vi.mock('@/pages/NotFound.vue', stub)

// The REAL route table, not a copy.
import { routes } from '@/routes'
import Profile from '@/pages/Profile.vue'
import ProfileNameEdit from '@/components/Profile/ProfileNameEdit.vue'

const USERNAME = 'johndoe'
const ME = 'john@example.com'

const profileResource = reactive({
	data: null as Record<string, unknown> | null,
	loading: false,
	fetched: true,
	error: null,
	reload: vi.fn(),
})
createResourceMock.mockImplementation(() => profileResource)

const viewer = reactive({
	data: { name: ME, username: USERNAME } as Record<string, unknown>,
	reload: vi.fn(),
})

// Child routes are lazy imports, never rendered here: a stub view stands in
// for every one of them.
const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: routes.map((route: any) =>
			route.name === 'Profile'
				? {
						...route,
						children: route.children.map((child: any) =>
							child.component
								? { ...child, component: { render: () => null } }
								: child
						),
				  }
				: route
		),
	})

const mountProfile = async (router: Router) =>
	mount(Profile, {
		props: { username: USERNAME },
		global: {
			plugins: [router],
			provide: { $user: viewer },
			mocks: { __: (globalThis as any).__ },
		},
		attachTo: document.body,
	})

enableAutoUnmount(afterEach)

beforeEach(() => {
	delete (window as any).read_only_mode
	profileResource.data = {
		name: ME,
		username: USERNAME,
		first_name: 'John',
		last_name: null,
		full_name: 'John',
		user_image: '/files/john.png',
		language: 'en',
	}
	profileResource.reload.mockReset()
	profileResource.reload.mockResolvedValue(undefined)
	viewer.data = { name: ME, username: USERNAME }
	viewer.reload.mockReset()
	call.mockReset()
	toast.error.mockReset()
	toast.success.mockReset()
})

describe('the old edit link', () => {
	it('lands on the profile, asking for the fields to open', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		expect(router.currentRoute.value.name).toBe('ProfileAbout')
		expect(router.currentRoute.value.params.username).toBe(USERNAME)
		expect(router.currentRoute.value.query).toEqual({ edit: '1' })
	})

	it('opens the fields on the owner’s profile and tidies the address', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-name-edit"]').exists()).toBe(
			true
		)
		expect(router.currentRoute.value.name).toBe('ProfileAbout')
		expect(router.currentRoute.value.query).toEqual({})
	})

	it('opens nothing on someone else’s profile', async () => {
		viewer.data = { name: 'admin@example.com', username: 'admin' }
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-name-edit"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="profile-edit"]').exists()).toBe(false)
	})

	it('opens nothing while the site is read-only', async () => {
		;(window as any).read_only_mode = true
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-name-edit"]').exists()).toBe(
			false
		)
	})

	it('keeps whatever else the link carried', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit?fromLesson=1`)
		await mountProfile(router)
		await flushPromises()
		expect(router.currentRoute.value.query).toEqual({ fromLesson: '1' })
	})

	it('sends the old certificates link to the profile', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/certificates`)
		expect(router.currentRoute.value.name).toBe('ProfileAbout')
	})

	it('leaves the other profile tabs alone', () => {
		const router = makeRouter()
		expect(router.resolve(`/user/${USERNAME}`).name).toBe('ProfileAbout')
		expect(router.resolve(`/user/${USERNAME}/roles`).name).toBe('ProfileRoles')
	})
})

describe('the profile header', () => {
	it('opens the fields in place and puts focus back on its button', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		await wrapper.get('[data-testid="profile-edit"]').trigger('click')
		await flushPromises()
		const panel = wrapper.get('[data-testid="profile-name-edit"]')
		expect(document.activeElement).toBe(
			panel.get('input[data-label="First Name"]').element
		)
		await panel
			.findAll('button')
			.find((button) => button.text() === 'Cancel')!
			.trigger('click')
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-name-edit"]').exists()).toBe(
			false
		)
		expect(document.activeElement).toBe(
			wrapper.get('[data-testid="profile-edit"]').element
		)
	})

	it('calls your own profile «My Profile», not «People»', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		expect(wrapper.get('[data-testid="crumbs"]').text()).toBe('My Profile')
	})

	it('keeps «People» on someone else’s profile', async () => {
		viewer.data = { name: 'admin@example.com', username: 'admin' }
		const router = makeRouter()
		await router.push(`/user/${USERNAME}`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		expect(wrapper.get('[data-testid="crumbs"]').text()).toBe('People / John')
	})
})

describe('someone else’s profile', () => {
	it('shows a moderator neither the email nor the settings', async () => {
		viewer.data = {
			name: 'admin@example.com',
			username: 'admin',
			is_moderator: true,
		}
		const router = makeRouter()
		await router.push(`/user/${USERNAME}`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-email"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="profile-settings"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="profile-edit"]').exists()).toBe(false)
	})

	it('does not take the open name fields along to it', async () => {
		// A moderator opens the fields on their own profile, then goes back to
		// a learner's: the page is reused, the fields must not be.
		viewer.data = { name: ME, username: USERNAME, is_moderator: true }
		const router = makeRouter()
		await router.push(`/user/${USERNAME}`)
		const wrapper = await mountProfile(router)
		await flushPromises()
		await wrapper.get('[data-testid="profile-edit"]').trigger('click')
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-name-edit"]').exists()).toBe(
			true
		)
		profileResource.data = {
			...profileResource.data!,
			name: 'alice@example.com',
			username: 'alice',
			full_name: 'Alice',
		}
		await wrapper.setProps({ username: 'alice' })
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-name-edit"]').exists()).toBe(
			false
		)
	})
})

describe('the own profile', () => {
	it('shows the settings under «About me» only', async () => {
		viewer.data = { name: ME, username: USERNAME, is_moderator: true }
		const about = makeRouter()
		await about.push(`/user/${USERNAME}`)
		const onAbout = await mountProfile(about)
		await flushPromises()
		expect(onAbout.find('[data-testid="profile-settings"]').exists()).toBe(true)

		const roles = makeRouter()
		await roles.push(`/user/${USERNAME}/roles`)
		const onRoles = await mountProfile(roles)
		await flushPromises()
		expect(roles.currentRoute.value.name).toBe('ProfileRoles')
		expect(onRoles.find('[data-testid="profile-settings"]').exists()).toBe(
			false
		)
	})
})

describe('the name and photo fields', () => {
	const open = () =>
		mount(ProfileNameEdit, {
			props: { profile: profileResource },
			global: {
				provide: { $user: viewer },
				mocks: { __: (globalThis as any).__ },
			},
			attachTo: document.body,
		})
	const valueOf = (wrapper: ReturnType<typeof open>, label: string) =>
		(wrapper.get(`input[data-label="${label}"]`).element as HTMLInputElement)
			.value

	it('start from the profile, a missing last name as empty', () => {
		const wrapper = open()
		expect(valueOf(wrapper, 'First Name')).toBe('John')
		expect(valueOf(wrapper, 'Last Name')).toBe('')
	})

	it('offer only the name and an optional photo', () => {
		const wrapper = open()
		const labels = wrapper
			.findAllComponents({ name: 'FormControl' })
			.map((control) => control.props('label'))
		expect(labels).toEqual(['First Name', 'Last Name'])
		const uploader = wrapper.findComponent({ name: 'Uploader' })
		expect(uploader.props('label')).toBe('Photo')
		expect(uploader.props('required')).toBe(false)
	})

	it('save the name and photo, then the page and the sidebar read again', async () => {
		call.mockResolvedValue({})
		const wrapper = open()
		await wrapper.get('input[data-label="First Name"]').setValue('  Jon ')
		await wrapper.get('input[data-label="Last Name"]').setValue('Doe')
		await wrapper.get('[data-testid="profile-save"]').trigger('click')
		await flushPromises()
		expect(call).toHaveBeenCalledWith('frappe.client.set_value', {
			doctype: 'User',
			name: ME,
			fieldname: {
				first_name: 'Jon',
				last_name: 'Doe',
				user_image: '/files/john.png',
			},
		})
		expect(profileResource.reload).toHaveBeenCalled()
		expect(viewer.reload).toHaveBeenCalled()
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('do not save without a first name', async () => {
		const wrapper = open()
		await wrapper.get('input[data-label="First Name"]').setValue('  ')
		await wrapper.get('[data-testid="profile-save"]').trigger('click')
		await flushPromises()
		expect(call).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalled()
		expect(wrapper.emitted('close')).toBeUndefined()
	})

	it('stay open and say why when the save fails', async () => {
		call.mockRejectedValue({ messages: ['Нельзя'] })
		const wrapper = open()
		await wrapper.get('[data-testid="profile-save"]').trigger('click')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith('Нельзя')
		expect(wrapper.emitted('close')).toBeUndefined()
	})

	it('save nothing when the profile on screen is not the viewer’s', async () => {
		viewer.data = { name: 'admin@example.com', username: 'admin' }
		const wrapper = open()
		await wrapper.get('[data-testid="profile-save"]').trigger('click')
		await flushPromises()
		expect(call).not.toHaveBeenCalled()
	})

	it('close once saved even when the page cannot read the profile again', async () => {
		call.mockResolvedValue({})
		profileResource.reload.mockRejectedValue(new Error('offline'))
		const wrapper = open()
		await wrapper.get('[data-testid="profile-save"]').trigger('click')
		await flushPromises()
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('close on Escape', async () => {
		const wrapper = open()
		await wrapper
			.get('[data-testid="profile-name-edit"]')
			.trigger('keydown', { key: 'Escape' })
		expect(wrapper.emitted('close')).toHaveLength(1)
	})
})
