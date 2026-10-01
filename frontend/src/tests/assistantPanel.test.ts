import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, reactive } from 'vue'

// The assistant panel (learning-services#463): the web chat in an iframe beside
// the page, the card that opens it, and the read that decides the card.

vi.mock('frappe-ui', async () => {
	const { fakeResource } = await import('./helpers/fakeResource')
	return {
		createResource: fakeResource,
		Button: {
			props: ['label'],
			emits: ['click'],
			template: '<button @click="$emit(\'click\')">{{ label }}</button>',
		},
		Tooltip: { props: ['text'], template: '<span><slot /></span>' },
	}
})

const route = reactive({ fullPath: '/courses' })
vi.mock('vue-router', () => ({ useRoute: () => route }))

import { server } from './helpers/fakeResource'
import AssistantPanel from '@/components/AssistantPanel/AssistantPanel.vue'
import SuggestedAction from '@/components/SuggestedAction.vue'
import {
	resetProfileSummary,
	useProfileSummary,
} from '@/composables/useProfileSummary'
import { useAssistantPanel } from '@/stores/assistantPanel'

const CHAT = 'https://lms.example/chat?mode=profile'
const ORIGIN = 'https://lms.example'
const global = { mocks: { __: (globalThis as any).__ } }

enableAutoUnmount(afterEach)

beforeEach(() => {
	setActivePinia(createPinia())
	server.clear()
	resetProfileSummary()
	route.fullPath = '/courses'
})

describe('the panel', () => {
	const openPanel = async () => {
		const wrapper = mount(AssistantPanel, { global, attachTo: document.body })
		const panel = useAssistantPanel()
		panel.open('profile', CHAT)
		await nextTick()
		const frame = wrapper.get('iframe').element as HTMLIFrameElement
		return { wrapper, panel, frame, chat: frame.contentWindow! }
	}

	const post = (data: unknown, source: Window | null, origin = ORIGIN) =>
		window.dispatchEvent(new MessageEvent('message', { data, origin, source }))

	it('has no iframe before it is first opened', () => {
		const wrapper = mount(AssistantPanel, { global })
		expect(wrapper.find('iframe').exists()).toBe(false)
	})

	it('keeps the conversation when closed', async () => {
		const { wrapper, panel, frame } = await openPanel()
		expect(frame.getAttribute('src')).toBe(CHAT)
		panel.close()
		await nextTick()
		expect(wrapper.get('iframe').element).toBe(frame)
		expect(wrapper.get('[data-testid="assistant-panel"]').isVisible()).toBe(
			false
		)
	})

	it('passes on a refresh from its chat', async () => {
		const { panel, chat } = await openPanel()
		post({ type: 'refresh', what: 'profile' }, chat)
		expect(panel.refreshTick).toBe(1)
	})

	it('closes when its chat says so', async () => {
		const { panel, chat } = await openPanel()
		post({ type: 'close' }, chat)
		expect(panel.isOpen).toBe(false)
	})

	it('does not listen to another window or origin', async () => {
		const { panel, chat } = await openPanel()
		post({ type: 'close' }, window)
		post({ type: 'close' }, chat, 'https://evil.example')
		expect(panel.isOpen).toBe(true)
	})

	it('closes on Esc', async () => {
		const { panel } = await openPanel()
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		expect(panel.isOpen).toBe(false)
	})

	it('tells its chat where the learner is, to the chat’s origin only', async () => {
		const { frame, chat } = await openPanel()
		const send = vi.spyOn(chat, 'postMessage')
		frame.dispatchEvent(new Event('load'))
		route.fullPath = '/courses/pm/learn/1-1'
		await nextTick()
		expect(send.mock.calls).toEqual([
			[{ type: 'context', route: '/courses' }, ORIGIN],
			[{ type: 'context', route: '/courses/pm/learn/1-1' }, ORIGIN],
		])
	})

	it('stops listening once unmounted', async () => {
		const { wrapper, panel, chat } = await openPanel()
		wrapper.unmount()
		post({ type: 'refresh', what: 'profile' }, chat)
		expect(panel.refreshTick).toBe(0)
	})
})

describe('the suggested action', () => {
	const props = {
		title: 'Tell your mentor about yourself',
		text: 'About 5 minutes.',
		actionLabel: 'Start',
		scenario: 'profile',
	}

	it('is not offered without the chat', () => {
		const wrapper = mount(SuggestedAction, {
			props: { ...props, url: null },
			global,
		})
		expect(wrapper.find('[data-testid="suggested-action"]').exists()).toBe(
			false
		)
	})

	it('opens the panel on its scenario', async () => {
		const wrapper = mount(SuggestedAction, {
			props: { ...props, url: CHAT },
			global,
		})
		await wrapper.get('button').trigger('click')
		const panel = useAssistantPanel()
		expect([panel.isOpen, panel.scenario, panel.url]).toEqual([
			true,
			'profile',
			CHAT,
		])
	})

	it('is an icon in the collapsed sidebar', async () => {
		const wrapper = mount(SuggestedAction, {
			props: { ...props, url: CHAT, collapsed: true },
			global,
		})
		expect(wrapper.text()).toBe('')
		await wrapper.get('button').trigger('click')
		expect(useAssistantPanel().isOpen).toBe(true)
	})
})

describe('the profile summary', () => {
	const URL = 'lms_frappe_app.api.student.my_profile'
	const SUMMARY = { filled: 3, total: 9, complete: false, interview_url: CHAT }

	const asker = (enabled: () => boolean) =>
		defineComponent({
			setup() {
				const { summary } = useProfileSummary(enabled)
				return () => h('div', summary.value?.filled ?? '-')
			},
		})

	it('is read once however many places ask', async () => {
		server.answers[URL] = { ok: true, data: SUMMARY }
		const first = mount(asker(() => true))
		const second = mount(asker(() => true))
		await flushPromises()
		expect(server.fetched).toEqual([{ url: URL, params: undefined }])
		expect([first.text(), second.text()]).toEqual(['3', '3'])
	})

	it('is not read for someone it is not offered to', async () => {
		mount(asker(() => false))
		await flushPromises()
		expect(server.fetched).toHaveLength(0)
	})

	it('is read again when the chat saved a fact', async () => {
		server.answers[URL] = { ok: true, data: SUMMARY }
		const wrapper = mount(asker(() => true))
		await flushPromises()
		server.answers[URL] = { ok: true, data: { ...SUMMARY, filled: 4 } }
		useAssistantPanel().notifyRefresh()
		await flushPromises()
		expect(server.fetched).toHaveLength(2)
		expect(wrapper.text()).toBe('4')
	})

	it('offers nothing when the read fails', async () => {
		server.answers[URL] = { ok: false, error: { code: 'x', message: 'x' } }
		const wrapper = mount(asker(() => true))
		await flushPromises()
		expect(wrapper.text()).toBe('-')
	})
})
