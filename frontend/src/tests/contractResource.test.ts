import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// A read of a contract method as the homework pages show it
// (learning-services#452): the failure comes from `resource.error`, and a
// newer read wins over an older one.

vi.mock('frappe-ui', async () => {
	const { fakeResource } = await import('./helpers/fakeResource')
	return { createResource: fakeResource }
})

import { hold, server } from './helpers/fakeResource'
import { useContractResource } from '@/composables/useContractResource'

const URL = 'lms_frappe_app.api.review.queue'
let param = 'a'
const make = () =>
	useContractResource<{ n: number }>({
		url: URL,
		makeParams: () => ({ param }),
		fallback: () => 'Could not load',
	})

beforeEach(() => {
	server.clear()
	param = 'a'
})

describe('useContractResource', () => {
	it('waits, then shows the data', async () => {
		server.answers[URL] = { ok: true, data: { n: 1 } }
		const read = make()
		const done = read.load()
		expect(read.state.value).toBe('loading')
		await done
		expect(read.state.value).toBe('ready')
		expect(read.data.value).toEqual({ n: 1 })
	})

	it('says what the server refused', async () => {
		server.answers[URL] = { ok: false, error: { code: 'x', message: 'Нельзя' } }
		const read = make()
		await read.load()
		expect(read.state.value).toBe('error')
		expect(read.failure.value).toBe('Нельзя')
	})

	it('takes a failure from the resource, thrown or not', async () => {
		server.answers[URL] = { ok: true, data: { n: 1 } }
		const read = make()
		await read.load()

		// The previous answer comes back into `data`; it is not shown as ready.
		server.failures[URL] = { error: new Error('502') }
		await read.load()
		expect(read.state.value).toBe('error')
		expect(read.data.value).toBeNull()
		expect(read.failure.value).toBe('Could not load')

		server.failures[URL] = { error: new Error('502'), quiet: true }
		await read.load()
		expect(read.state.value).toBe('error')
	})

	it('fails when the step before the read fails', async () => {
		const read = make()
		await read.load({ before: () => Promise.reject(new Error('space')) })
		expect(read.state.value).toBe('error')
		expect(server.fetched).toEqual([])
	})

	it('lets only the newest read end the wait', async () => {
		const read = make()
		server.answers[URL] = { ok: true, data: { n: 1 } }
		const first = hold(URL)
		const one = read.load()
		await flushPromises()

		param = 'b'
		server.answers[URL] = { ok: true, data: { n: 2 } }
		const second = hold(URL)
		const two = read.load()
		await flushPromises()
		expect(read.resource.abort).toHaveBeenCalled()

		first.release()
		await one
		expect(read.state.value).toBe('loading')

		second.release()
		await two
		expect(read.state.value).toBe('ready')
		expect(read.data.value).toEqual({ n: 2 })
		expect(server.fetched.map((call) => call.params)).toEqual([
			{ param: 'a' },
			{ param: 'b' },
		])
	})

	it('keeps the screen through a quiet read', async () => {
		server.answers[URL] = { ok: true, data: { n: 1 } }
		const read = make()
		await read.load()
		server.answers[URL] = { ok: true, data: { n: 2 } }
		const gate = hold(URL)
		const again = read.load({ quiet: true })
		await flushPromises()
		expect(read.state.value).toBe('ready')
		gate.release()
		await again
		expect(read.data.value).toEqual({ n: 2 })
	})

	it('forgets the record on reset', async () => {
		server.answers[URL] = { ok: true, data: { n: 1 } }
		const read = make()
		await read.load()
		read.reset()
		expect(read.data.value).toBeNull()
		expect(read.state.value).toBe('loading')
	})

	it('shows an answer it is given', async () => {
		server.answers[URL] = { ok: true, data: { n: 1 } }
		const read = make()
		await read.load()
		read.show({ n: 5 })
		expect(read.data.value).toEqual({ n: 5 })
	})
})
