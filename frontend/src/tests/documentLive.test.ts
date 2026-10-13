import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

// learning-services#348: the document reads itself again when the agent
// writes to it, not when the page itself did.

const reload = vi.fn()
const call = vi.fn()
// The learner's space (learning-services#347): a personal space, loaded.
vi.mock('@/stores/space', () => ({
	PERSONAL: 'personal',
	useSpace: () => ({
		load: () => Promise.resolve(),
		paramFor: () => 'personal',
	}),
}))

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
		await api().write('risks', { fields: { owner: 'x' } })
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

// learning-services#515: a block is written with `rows` and `delete_rows`
// (many), `fields` (one) or `clear` — text only, an empty one clears.
describe('writing a block', () => {
	const params = () => call.mock.calls[0][1]

	beforeEach(() => {
		call.mockResolvedValue({ ok: true, data: { created: ['A3'] } })
	})

	it('writes a cell as a row by its ID', async () => {
		const { api } = host(socketStub())
		await api().setCell('agreements', { id: 'A1' }, 'topic', '')
		expect(call.mock.calls[0][0]).toBe(
			'lms_frappe_app.api.student.update_artifact'
		)
		expect(params()).toEqual({
			course: 'c1',
			artifact: 'risk_register',
			key: 'agreements',
			space: undefined,
			rows: [{ id: 'A1', topic: '' }],
		})
	})

	it('adds a row without an ID and answers the one the server gave', async () => {
		const { api } = host(socketStub())
		expect(await api().addRow('agreements')).toBe('A3')
		expect(params().rows).toEqual([{}])
	})

	it('writes a field, deletes a row, clears a block', async () => {
		const { api } = host(socketStub())
		await api().setField('how_we_decide', 'method', 'Согласие')
		expect(params().fields).toEqual({ method: 'Согласие' })
		call.mockClear()
		await api().deleteRow('agreements', 'A2')
		expect(params().delete_rows).toEqual(['A2'])
		call.mockClear()
		await api().clear('agreements')
		expect(params().clear).toBe(true)
	})
})
