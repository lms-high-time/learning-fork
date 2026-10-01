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

const route = reactive({ path: '/courses' })
vi.mock('vue-router', () => ({ useRoute: () => route }))

import { hold, server } from './helpers/fakeResource'
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
	route.path = '/courses'
})

describe('the panel', () => {
	const setWidth = (width: number) =>
		Object.defineProperty(window, 'innerWidth', {
			value: width,
			writable: true,
			configurable: true,
		})

	const openPanel = async (url = CHAT) => {
		const wrapper = mount(AssistantPanel, { global, attachTo: document.body })
		const panel = useAssistantPanel()
		panel.open('profile', url)
		await flushPromises()
		const frame = wrapper.get('iframe').element as HTMLIFrameElement
		return { wrapper, panel, frame, chat: frame.contentWindow! }
	}

	const post = (data: unknown, source: Window | null, origin = ORIGIN) =>
		window.dispatchEvent(new MessageEvent('message', { data, origin, source }))

	const esc = () =>
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

	beforeEach(() => setWidth(1280))
	afterEach(() => {
		document.body.innerHTML = ''
	})

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

	it('starts a new chat for a new address', async () => {
		const { wrapper, panel, frame } = await openPanel()
		panel.open('profile', `${CHAT}&fresh=1`)
		await nextTick()
		expect(wrapper.get('iframe').element).not.toBe(frame)
	})

	it('opens nothing but a web page', async () => {
		const wrapper = mount(AssistantPanel, { global })
		const panel = useAssistantPanel()
		panel.open('profile', 'javascript:alert(1)')
		await nextTick()
		expect(panel.isOpen).toBe(false)
		expect(wrapper.find('iframe').exists()).toBe(false)
	})

	it('closes from its own header, whatever the chat shows', async () => {
		const { wrapper, panel } = await openPanel()
		await wrapper.get('[data-testid="assistant-panel-close"]').trigger('click')
		expect(panel.isOpen).toBe(false)
	})

	it('passes on a refresh from its chat', async () => {
		const { panel, chat } = await openPanel()
		post({ type: 'refresh', what: 'profile' }, chat)
		expect(panel.refreshTick).toBe(1)
	})

	it('is closed by its own header only, not by the chat', async () => {
		const { panel, chat } = await openPanel()
		post({ type: 'close' }, chat)
		expect(panel.isOpen).toBe(true)
	})

	it('does not listen to another window or origin', async () => {
		const { panel, chat } = await openPanel()
		post({ type: 'refresh', what: 'profile' }, window)
		post({ type: 'refresh', what: 'profile' }, chat, 'https://evil.example')
		expect(panel.refreshTick).toBe(0)
	})

	it('closes on Esc', async () => {
		const { panel } = await openPanel()
		esc()
		expect(panel.isOpen).toBe(false)
	})

	it('leaves Esc alone while closed', async () => {
		const { panel } = await openPanel()
		panel.close()
		const actions: string[] = []
		panel.$onAction(({ name }) => void actions.push(name))
		esc()
		expect(actions).toEqual([])
	})

	it('leaves Esc to a dialog of the page', async () => {
		const { panel } = await openPanel()
		const dialog = document.createElement('div')
		dialog.setAttribute('role', 'dialog')
		dialog.setAttribute('data-state', 'open')
		document.body.appendChild(dialog)
		esc()
		expect(panel.isOpen).toBe(true)
	})

	it('leaves Esc to a menu the focused control opened', async () => {
		const { panel } = await openPanel()
		const layer = document.createElement('div')
		layer.setAttribute('data-dismissable-layer', '')
		layer.innerHTML = '<ul id="options" role="listbox"></ul>'
		const combobox = document.createElement('button')
		combobox.setAttribute('aria-expanded', 'true')
		combobox.setAttribute('aria-controls', 'options')
		document.body.append(layer, combobox)
		combobox.focus()
		esc()
		expect(panel.isOpen).toBe(true)
	})

	it('tells its chat where the learner is, to the chat’s origin only', async () => {
		const { frame, chat } = await openPanel()
		const send = vi.spyOn(chat, 'postMessage')
		frame.dispatchEvent(new Event('load'))
		route.path = '/courses/pm/learn/1-1'
		await nextTick()
		// The path, not the query.
		expect(send.mock.calls).toEqual([
			[{ type: 'context', route: '/courses' }, ORIGIN],
			[{ type: 'context', route: '/courses/pm/learn/1-1' }, ORIGIN],
		])
	})

	it('sits beside the page on a desktop', async () => {
		const { wrapper } = await openPanel()
		const panel = wrapper.get('[data-testid="assistant-panel"]')
		expect(panel.attributes('role')).toBe('complementary')
		expect(panel.attributes('aria-modal')).toBeUndefined()
		expect(panel.attributes('aria-label')).toBe('Your mentor')
	})

	it('covers the page on a phone, and Back closes it', async () => {
		setWidth(390)
		const { wrapper, panel } = await openPanel()
		const root = wrapper.get('[data-testid="assistant-panel"]')
		expect(root.attributes('role')).toBe('dialog')
		expect(root.attributes('aria-modal')).toBe('true')
		route.path = '/you'
		await nextTick()
		expect(panel.isOpen).toBe(false)
	})

	const tab = (shiftKey = false) =>
		document.activeElement!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true })
		)

	it('keeps Tab within its header and chat on a phone', async () => {
		setWidth(390)
		const { wrapper, frame } = await openPanel()
		const close = wrapper.get('[data-testid="assistant-panel-close"]')
			.element as HTMLElement
		close.focus()
		tab(true)
		expect(document.activeElement).toBe(frame)
		// Tab off the chat's last field lands on what follows the iframe — the
		// sentinel — which sends focus round to the header.
		const sentinel = wrapper.get('[data-testid="assistant-panel-sentinel"]')
			.element as HTMLElement
		expect(frame.compareDocumentPosition(sentinel)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		)
		sentinel.focus()
		expect(document.activeElement).toBe(close)
	})

	it('lets Tab go on into the page on a desktop', async () => {
		const { wrapper } = await openPanel()
		const close = wrapper.get('[data-testid="assistant-panel-close"]')
			.element as HTMLElement
		close.focus()
		const shiftTab = new KeyboardEvent('keydown', {
			key: 'Tab',
			shiftKey: true,
			bubbles: true,
			cancelable: true,
		})
		close.dispatchEvent(shiftTab)
		expect(shiftTab.defaultPrevented).toBe(false)
		expect(document.activeElement).toBe(close)
		expect(
			wrapper.find('[data-testid="assistant-panel-sentinel"]').exists()
		).toBe(false)
	})

	it('gives focus back to what opened it', async () => {
		const button = document.createElement('button')
		document.body.appendChild(button)
		button.focus()
		const { panel, frame } = await openPanel()
		expect(document.activeElement).toBe(frame)
		panel.close()
		await nextTick()
		expect(document.activeElement).toBe(button)
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

	it('drops a read overtaken by a newer one', async () => {
		server.answers[URL] = { ok: true, data: SUMMARY }
		const first = hold(URL)
		const wrapper = mount(asker(() => true))
		// Only the first read waits; the second answers at once.
		delete server.gates[URL]
		server.answers[URL] = { ok: true, data: { ...SUMMARY, filled: 5 } }
		useAssistantPanel().notifyRefresh()
		await flushPromises()
		first.release()
		await flushPromises()
		expect(wrapper.text()).toBe('5')
	})

	it('offers nothing when the read fails', async () => {
		server.answers[URL] = { ok: false, error: { code: 'x', message: 'x' } }
		const wrapper = mount(asker(() => true))
		await flushPromises()
		expect(wrapper.text()).toBe('-')
	})
})
