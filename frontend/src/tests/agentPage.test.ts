import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

// «Connect an assistant» (learning-services#470, #471): the MCP addresses inside
// the app, the authoring one only for those who build courses, and the way to
// connect them for each assistant.

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label', 'link'],
		template: '<a v-if="link" :href="link">{{ label }}</a><button v-else>{{ label }}</button>',
	},
	toast: { success: vi.fn(), error: vi.fn() },
	usePageMeta: vi.fn(),
}))
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))

const session = reactive({
	isLoggedIn: true,
	branding: { data: { app_name: 'MCP-LMS' } as { app_name?: string } | null },
})
vi.mock('@/stores/session', () => ({ sessionStore: () => session }))
const user = reactive({ data: {} as Record<string, unknown> | null })
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: user }),
}))

import Agent from '@/pages/Agent/Agent.vue'
import {
	agentConnections,
	claudeCodeCommand,
	commandName,
	cursorInstallLink,
	vscodeInstallLink,
} from '@/utils/agentConnection'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (m, n) =>
				args[Number(n)] === undefined ? m : String(args[Number(n)])
			),
	}
}
const open = () => mount(Agent, { global: { mocks: { __ } } })

afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
	vi.stubGlobal('__', __)
	session.isLoggedIn = true
	session.branding = { data: { app_name: 'MCP-LMS' } }
	user.data = { is_instructor: false, is_moderator: false }
})

describe('agent connections', () => {
	it('gives a student the learning address on the site domain', () => {
		expect(agentConnections('https://lms.example', {})).toEqual([
			{ role: 'student', url: 'https://lms.example/mcp' },
		])
	})

	it('adds the authoring address for a course creator or a moderator', () => {
		for (const roles of [{ is_instructor: true }, { is_moderator: true }]) {
			expect(
				agentConnections('https://lms.example', roles).map((c) => c.url)
			).toEqual(['https://lms.example/mcp', 'https://lms.example/authoring'])
		}
	})
})

describe('one-click installs', () => {
	const url = 'https://lms.example/mcp'

	it('gives Cursor the mcp.json entry, base64-encoded', () => {
		const link = new URL(cursorInstallLink('MCP-LMS', url))
		expect(link.protocol).toBe('cursor:')
		expect(link.searchParams.get('name')).toBe('MCP-LMS')
		expect(JSON.parse(atob(link.searchParams.get('config')!))).toEqual({ url })
	})

	it('gives VS Code a remote http server', () => {
		const link = vscodeInstallLink('MCP-LMS', url)
		expect(link.startsWith('vscode:mcp/install?')).toBe(true)
		expect(
			JSON.parse(decodeURIComponent(link.slice('vscode:mcp/install?'.length)))
		).toEqual({ name: 'MCP-LMS', type: 'http', url })
	})

	it('names the server for the terminal in Latin letters only', () => {
		expect(commandName('MCP-LMS')).toBe('mcp-lms')
		expect(commandName('Школа Ромашка')).toBe('learning')
		expect(claudeCodeCommand('MCP-LMS', url)).toBe(
			'claude mcp add --scope user --transport http mcp-lms https://lms.example/mcp'
		)
	})
})

describe('the agent page', () => {
	it('shows a student only the learning address', () => {
		const wrapper = open()
		expect(
			wrapper.find('[data-testid="agent-connection-student"]').text()
		).toContain(`${window.location.origin}/mcp`)
		expect(
			wrapper.find('[data-testid="agent-connection-curator"]').exists()
		).toBe(false)
	})

	it('shows a course creator the authoring address too', () => {
		user.data = { is_instructor: true }
		const wrapper = open()
		expect(
			wrapper.find('[data-testid="agent-connection-curator"]').text()
		).toContain(`${window.location.origin}/authoring`)
		// Two «Copy» buttons, told apart for a screen reader.
		expect(
			wrapper
				.find('[data-testid="agent-connection-curator"] button')
				.attributes('aria-label')
		).toBe('Copy the authoring address')
	})

	it('shows a guest the address and how to sign in', () => {
		session.isLoggedIn = false
		user.data = null
		const wrapper = open()
		// The assistant asks to sign in anyway: the instructions help a guest too.
		expect(
			wrapper.find('[data-testid="agent-connection-student"]').text()
		).toContain(`${window.location.origin}/mcp`)
		expect(wrapper.find('[data-testid="agent-login"]').exists()).toBe(true)
		expect(
			wrapper.find('[data-testid="agent-connection-curator"]').exists()
		).toBe(false)
		// The web chat needs no agent of one's own: offered to a guest as well.
		expect(
			wrapper.find('[data-testid="agent-web-chat"] a').attributes('href')
		).toBe('/chat')
	})

	it('opens on Claude and names the connector after the site', () => {
		const wrapper = open()
		expect(wrapper.find('[data-testid="agent-panel-claude"]').text()).toContain(
			'«MCP-LMS»'
		)
	})

	it('switches between assistants', async () => {
		const wrapper = open()
		await wrapper.get('[data-testid="agent-tab-chatgpt"]').trigger('click')
		expect(wrapper.find('[data-testid="agent-chatgpt-plan"]').exists()).toBe(
			true
		)
		await wrapper.get('[data-testid="agent-tab-claude-code"]').trigger('click')
		expect(wrapper.get('[data-testid="agent-claude-code"]').text()).toBe(
			`claude mcp add --scope user --transport http mcp-lms ${window.location.origin}/mcp`
		)
	})

	it('installs into Cursor with one click', async () => {
		const assign = vi.fn()
		vi.stubGlobal('location', { ...window.location, assign, origin: window.location.origin })
		const wrapper = open()
		await wrapper.get('[data-testid="agent-tab-cursor"]').trigger('click')
		await wrapper.get('[data-testid="agent-install-cursor"]').trigger('click')
		expect(assign).toHaveBeenCalledWith(
			cursorInstallLink('MCP-LMS', `${window.location.origin}/mcp`)
		)
	})

	it('offers ready phrases to start with', () => {
		const wrapper = open()
		expect(wrapper.get('[data-testid="agent-prompts"]').text()).toContain(
			'Show my courses'
		)
	})
})

describe('the agent route', () => {
	it('keeps the sidebar item inside the app and lights it up', async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: (await import('@/routes')).routes,
		})
		await router.push('/agent-sidebar')
		expect(router.currentRoute.value.name).toBe('Agent')
		expect(router.currentRoute.value.meta.sidebarLink).toBe('agent-sidebar')
	})
})
