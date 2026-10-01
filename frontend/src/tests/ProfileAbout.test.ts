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
	})
	await flushPromises()
	return wrapper
}

const texts = (wrapper: Awaited<ReturnType<typeof open>>, id: string) =>
	wrapper.findAll(`[data-testid="${id}"]`).map((node) => node.text())

enableAutoUnmount(afterEach)

beforeEach(() => {
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

	it('shows what else the agent knows', async () => {
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
		expect(server.fetched).toHaveLength(2)
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
		expect(server.fetched).toHaveLength(2)
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
