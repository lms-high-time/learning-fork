import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

// «Connect your agent» (learning-services#470): the MCP addresses inside the
// app, the authoring one only for those who build courses.

vi.mock('frappe-ui', () => ({
	Button: { props: ['label'], template: '<button>{{ label }}</button>' },
	toast: { success: vi.fn(), error: vi.fn() },
	usePageMeta: vi.fn(),
}))
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))

const session = reactive({ isLoggedIn: true })
vi.mock('@/stores/session', () => ({ sessionStore: () => session }))
const user = reactive({ data: {} as Record<string, unknown> | null })
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: user }),
}))

import Agent from '@/pages/Agent/Agent.vue'
import { agentConnections } from '@/utils/agentConnection'

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

beforeEach(() => {
	vi.stubGlobal('__', __)
	session.isLoggedIn = true
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
		).toBe('Copy the address: Build courses')
	})

	it('asks a guest to log in instead of listing addresses', () => {
		session.isLoggedIn = false
		user.data = null
		const wrapper = open()
		expect(wrapper.find('[data-testid="agent-login"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid^="agent-connection-"]').exists()).toBe(
			false
		)
		// The web chat needs no agent of one's own: offered to a guest as well.
		expect(
			wrapper.find('[data-testid="agent-web-chat"] a').attributes('href')
		).toBe('/chat')
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
