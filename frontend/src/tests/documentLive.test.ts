import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

// learning-services#348: the document reads itself again when the agent
// writes to it, not when the page itself did.

const reload = vi.fn()
const call = vi.fn()
vi.mock('frappe-ui', () => ({
	call: (...args: unknown[]) => call(...args),
	toast: { error: vi.fn() },
	createResource: () => ({
		data: { ok: true, data: null },
		reload,
		fetch: vi.fn(),
	}),
}))

import { useDocument } from '@/composables/useDocument'

function socketStub() {
	const handlers: Record<string, ((data: unknown) => void)[]> = {}
	return {
		on: (e: string, fn: (data: unknown) => void) =>
			(handlers[e] = [...(handlers[e] ?? []), fn]),
		off: (e: string, fn: (data: unknown) => void) =>
			(handlers[e] = (handlers[e] ?? []).filter((f) => f !== fn)),
		emit: (e: string, data: unknown) =>
			(handlers[e] ?? []).forEach((f) => f(data)),
		count: (e: string) => (handlers[e] ?? []).length,
	}
}

function host(socket: ReturnType<typeof socketStub>) {
	let api!: ReturnType<typeof useDocument>
	const Host = defineComponent({
		setup() {
			api = useDocument(ref('c1'), ref('risk_register'))
			return () => h('div')
		},
	})
	const wrapper = mount(Host, { global: { provide: { $socket: socket } } })
	return { wrapper, api: () => api }
}

beforeEach(() => {
	reload.mockReset()
	call.mockReset()
	vi.stubGlobal('__', (s: string) => s)
})

describe('a live document', () => {
	it('reads itself again when its own document changes elsewhere', async () => {
		const socket = socketStub()
		const { api } = host(socket)
		socket.emit('artifact_updated', { course: 'c1', artifact: 'other' })
		expect(reload).not.toHaveBeenCalled()
		socket.emit('artifact_updated', { course: 'c1', artifact: 'risk_register' })
		await flushPromises()
		expect(reload).toHaveBeenCalledTimes(1)
		expect(api().updatedAt.value).toBeInstanceOf(Date)
	})

	it('does not answer the echo of its own write', async () => {
		const socket = socketStub()
		const { api } = host(socket)
		call.mockResolvedValue({ ok: true, data: { created: [] } })
		await api().write('risks', { content: 'x' })
		reload.mockReset()
		socket.emit('artifact_updated', { course: 'c1', artifact: 'risk_register' })
		await flushPromises()
		expect(reload).not.toHaveBeenCalled()
	})

	it('stops listening when the page goes', () => {
		const socket = socketStub()
		const { wrapper } = host(socket)
		expect(socket.count('artifact_updated')).toBe(1)
		wrapper.unmount()
		expect(socket.count('artifact_updated')).toBe(0)
	})
})
