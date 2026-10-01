import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

// «About me» (learning-services#463): what the mentor knows about the learner,
// in four blocks, in place of the bio. The server decides who sees it; the
// page shows its answer and nothing for a refusal.

const { call, toast, confirmAction } = vi.hoisted(() => ({
	call: vi.fn(),
	toast: { error: vi.fn(), success: vi.fn() },
	// Confirmed at once: the dialog itself is the app's, tested elsewhere.
	confirmAction: vi.fn((options: { onConfirm: () => unknown }) =>
		options.onConfirm()
	),
}))

vi.mock('frappe-ui', async () => {
	const { fakeResource } = await import('./helpers/fakeResource')
	return {
		createResource: fakeResource,
		call,
		toast,
		Button: {
			props: ['label'],
			emits: ['click'],
			template:
				'<button @click="$emit(\'click\')">{{ label }}<slot /></button>',
		},
		FormControl: {
			props: ['modelValue'],
			emits: ['update:modelValue'],
			template:
				'<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
		},
		HoverCard: { template: '<div />' },
		LoadingIndicator: { template: '<span data-testid="loading" />' },
	}
})
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ branding: { data: null } }),
}))
vi.mock('@/utils/confirm', () => ({ confirmAction }))

import { server } from './helpers/fakeResource'
import ProfileAbout from '@/pages/ProfileAbout.vue'
import { useAssistantPanel } from '@/stores/assistantPanel'

const URL = 'lms_frappe_app.api.student.my_profile'
const INTERVIEW = 'https://lms.example/chat?mode=profile'

const viewer = reactive({ data: { name: 'me@x' } as Record<string, unknown> })

const profileOf = (overrides: Record<string, unknown> = {}) => ({
	user: 'me@x',
	full_name: 'Мария',
	user_image: null,
	blocks: [
		{
			id: 'work',
			title: 'Контекст работы',
			facts: [
				{
					key: 'role',
					label: 'Роль',
					text: 'Руководитель проектов',
					updated: '2026-09-30 10:00:00',
				},
				{ key: 'industry', label: 'Отрасль', text: null, updated: null },
			],
		},
	],
	other_facts: [],
	filled: 1,
	total: 9,
	complete: false,
	interview_url: INTERVIEW,
	...overrides,
})

const open = async (name = 'me@x') => {
	const wrapper = mount(ProfileAbout, {
		props: { profile: { data: { name, username: name.split('@')[0] } } },
		global: {
			mocks: { __: (globalThis as any).__ },
			provide: { $user: viewer, $dayjs: () => ({ format: () => '' }) },
		},
		// Focus is only real in a document.
		attachTo: document.body,
	})
	await flushPromises()
	return wrapper
}

const texts = (wrapper: Awaited<ReturnType<typeof open>>, id: string) =>
	wrapper.findAll(`[data-testid="${id}"]`).map((node) => node.text())

enableAutoUnmount(afterEach)

beforeEach(() => {
	delete (window as any).read_only_mode
	setActivePinia(createPinia())
	server.clear()
	viewer.data = { name: 'me@x' }
	call.mockReset()
	toast.error.mockReset()
	confirmAction.mockClear()
})

describe('About me', () => {
	it('asks for the profile it shows', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		await open()
		expect(server.fetched).toEqual([{ url: URL, params: { user: 'me@x' } }])
	})

	it('says a fact is not filled yet', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		const wrapper = await open()
		expect(texts(wrapper, 'profile-block')).toHaveLength(1)
		expect(texts(wrapper, 'profile-fact-text')).toEqual([
			'Руководитель проектов',
		])
		expect(texts(wrapper, 'profile-fact-empty')).toEqual(['Not filled yet'])
	})

	it('shows what else the mentor knows', async () => {
		server.answers[URL] = {
			ok: true,
			data: profileOf({
				other_facts: [{ key: 'pet', text: 'Кот Борис', updated: null }],
			}),
		}
		const wrapper = await open()
		expect(wrapper.get('[data-testid="profile-other-facts"]').text()).toContain(
			'Кот Борис'
		)
	})

	it('shows nothing of someone else’s profile when the server refuses', async () => {
		server.answers[URL] = {
			ok: false,
			error: { code: 'not_your_profile', message: 'Not yours' },
		}
		const wrapper = await open('other@x')
		expect(wrapper.find('[data-testid="profile-facts"]').exists()).toBe(false)
		expect(wrapper.find('[role="alert"]').exists()).toBe(false)
		expect(wrapper.findAll('button')).toHaveLength(0)
	})

	it('says why the own profile could not be read', async () => {
		server.answers[URL] = {
			ok: false,
			error: { code: 'broken', message: 'Сломалось' },
		}
		const wrapper = await open()
		expect(wrapper.get('[role="alert"]').text()).toBe('Сломалось')
	})

	it('says so in its own words when the read fails without any', async () => {
		server.failures[URL] = { error: new Error('offline'), quiet: true }
		const wrapper = await open()
		expect(wrapper.get('[role="alert"]').text()).toBe(
			'Could not load the profile'
		)
	})

	it('tells the platform of anything but a refusal on someone else’s profile', async () => {
		viewer.data = { name: 'admin@x' }
		server.answers[URL] = {
			ok: false,
			error: { code: 'broken', message: 'Сломалось' },
		}
		const wrapper = await open('other@x')
		expect(wrapper.get('[role="alert"]').text()).toBe('Сломалось')
	})

	it('keeps the profile on screen when a re-read fails', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		const wrapper = await open()
		server.failures[URL] = { error: new Error('offline'), quiet: true }
		useAssistantPanel().notifyRefresh()
		await flushPromises()
		expect(texts(wrapper, 'profile-fact-text')).toEqual([
			'Руководитель проектов',
		])
		expect(wrapper.find('[role="alert"]').exists()).toBe(false)
		expect(toast.error).toHaveBeenCalledWith('Could not load the profile')
	})

	it('does not ask again for someone else’s profile when the chat saved a fact', async () => {
		// A learner on a classmate's page, filling in their own profile in the
		// panel: each saved fact must not bring the classmate's refusal back.
		server.answers[URL] = {
			ok: false,
			error: { code: 'not_your_profile', message: 'Not yours' },
		}
		await open('other@x')
		useAssistantPanel().notifyRefresh()
		useAssistantPanel().notifyRefresh()
		await flushPromises()
		expect(server.fetched).toHaveLength(1)
		expect(toast.error).not.toHaveBeenCalled()
	})

	it('shows someone else’s profile read-only to the platform', async () => {
		// The server sends no chat for another person's profile.
		server.answers[URL] = {
			ok: true,
			data: profileOf({ user: 'other@x', interview_url: null }),
		}
		const wrapper = await open('other@x')
		expect(texts(wrapper, 'profile-block')).toHaveLength(1)
		expect(wrapper.findAll('button')).toHaveLength(0)
	})

	it('offers the interview on the own profile when the chat is there', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		const wrapper = await open()
		await wrapper.get('[data-testid="profile-interview"]').trigger('click')
		const panel = useAssistantPanel()
		expect(panel.isOpen).toBe(true)
		expect(panel.scenario).toBe('profile')
		expect(panel.url).toBe(INTERVIEW)
	})

	it('offers neither the interview nor edits while the site is read-only', async () => {
		;(window as any).read_only_mode = true
		server.answers[URL] = { ok: true, data: profileOf() }
		const wrapper = await open()
		expect(texts(wrapper, 'profile-block')).toHaveLength(1)
		expect(wrapper.findAll('button')).toHaveLength(0)
	})

	it('offers no interview without the chat', async () => {
		server.answers[URL] = {
			ok: true,
			data: profileOf({ interview_url: null }),
		}
		const wrapper = await open()
		expect(wrapper.find('[data-testid="profile-interview"]').exists()).toBe(
			false
		)
		// The learner still words the facts by hand.
		expect(wrapper.findAll('[data-testid="profile-fact-edit"]')).toHaveLength(2)
	})

	it('saves a fact the learner words as the agent’s fact', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		call.mockResolvedValue({
			ok: true,
			data: { key: 'industry', kind: 'fact' },
		})
		const wrapper = await open()
		await wrapper
			.findAll('[data-testid="profile-fact-edit"]')[1]
			.trigger('click')
		await wrapper.get('textarea').setValue('  Строительство ')
		await wrapper.get('[data-testid="profile-fact-save"]').trigger('click')
		await flushPromises()
		expect(call).toHaveBeenCalledWith('lms_frappe_app.api.student.remember', {
			kind: 'fact',
			key: 'industry',
			text: 'Строительство',
		})
		// One read again, and the card offering the interview hears of it too.
		expect(server.fetched).toHaveLength(2)
		expect(useAssistantPanel().refreshTick).toBe(1)
		expect(wrapper.find('textarea').exists()).toBe(false)
	})

	it('keeps the editor open when the save is refused', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		call.mockResolvedValue({
			ok: false,
			error: { code: 'bad_key', message: 'Нельзя' },
		})
		const wrapper = await open()
		await wrapper
			.findAll('[data-testid="profile-fact-edit"]')[0]
			.trigger('click')
		await wrapper.get('[data-testid="profile-fact-save"]').trigger('click')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith('Нельзя')
		expect(wrapper.find('textarea').exists()).toBe(true)
	})

	it('forgets a fact after asking', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		call.mockResolvedValue({ ok: true, data: { key: 'role' } })
		const wrapper = await open()
		// Only a filled fact can be deleted.
		const deletes = wrapper.findAll('[data-testid="profile-fact-delete"]')
		expect(deletes).toHaveLength(1)
		await deletes[0].trigger('click')
		await flushPromises()
		expect(confirmAction).toHaveBeenCalledTimes(1)
		expect(call).toHaveBeenCalledWith('lms_frappe_app.api.student.forget', {
			key: 'role',
		})
		// One read again, and the card offering the interview hears of it too.
		expect(server.fetched).toHaveLength(2)
		expect(useAssistantPanel().refreshTick).toBe(1)
	})

	it('puts focus on «Fill in» of the fact it deleted', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		call.mockResolvedValue({ ok: true, data: { key: 'role' } })
		const wrapper = await open()
		server.answers[URL] = {
			ok: true,
			data: profileOf({
				blocks: [
					{
						id: 'work',
						title: 'Контекст работы',
						facts: [
							{ key: 'role', label: 'Роль', text: null, updated: null },
							{ key: 'industry', label: 'Отрасль', text: null, updated: null },
						],
					},
				],
			}),
		}
		await wrapper.get('[data-testid="profile-fact-delete"]').trigger('click')
		await flushPromises()
		await new Promise((resolve) => setTimeout(resolve))
		const role = wrapper.findAll('[data-testid="profile-fact-edit"]')[0]
		expect(role.attributes('aria-label')).toBe('Fill in: Роль')
		expect(document.activeElement).toBe(role.element)
	})

	it('reads the profile again when the chat saved a fact', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		const wrapper = await open()
		server.answers[URL] = {
			ok: true,
			data: profileOf({
				blocks: [
					{
						id: 'work',
						title: 'Контекст работы',
						facts: [
							{
								key: 'industry',
								label: 'Отрасль',
								text: 'Строительство',
								updated: '2026-10-01 09:00:00',
							},
						],
					},
				],
			}),
		}
		useAssistantPanel().notifyRefresh()
		await flushPromises()
		expect(texts(wrapper, 'profile-fact-text')).toEqual(['Строительство'])
	})
})

describe('a fact', () => {
	it('names the fact its buttons are for', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		const wrapper = await open()
		const edits = wrapper.findAll('[data-testid="profile-fact-edit"]')
		expect(edits.map((button) => button.text())).toEqual(['Fix', 'Fill in'])
		expect(edits.map((button) => button.attributes('aria-label'))).toEqual([
			'Fix: Роль',
			'Fill in: Отрасль',
		])
		expect(
			wrapper
				.get('[data-testid="profile-fact-delete"]')
				.attributes('aria-label')
		).toBe('Delete: Роль')
	})

	it('takes focus into the editor and back to its button', async () => {
		server.answers[URL] = { ok: true, data: profileOf() }
		const wrapper = await open()
		const edit = wrapper.findAll('[data-testid="profile-fact-edit"]')[0]
		await edit.trigger('click')
		await flushPromises()
		expect(document.activeElement).toBe(wrapper.get('textarea').element)
		await wrapper
			.findAll('button')
			.find((button) => button.text() === 'Cancel')!
			.trigger('click')
		await flushPromises()
		expect(document.activeElement).toBe(
			wrapper.findAll('[data-testid="profile-fact-edit"]')[0].element
		)
	})

	it('gives the editor a name when the fact has no label', async () => {
		server.answers[URL] = {
			ok: true,
			data: profileOf({
				blocks: [],
				other_facts: [{ key: 'pet', text: 'Кот Борис', updated: null }],
			}),
		}
		const wrapper = await open()
		expect(
			wrapper.get('[data-testid="profile-fact-edit"]').attributes('aria-label')
		).toBe('Fix: Кот Борис')
		await wrapper.get('[data-testid="profile-fact-edit"]').trigger('click')
		expect(wrapper.get('textarea').attributes('aria-label')).toBe(
			'What your mentor knows'
		)
	})
})
