import { beforeEach, describe, expect, it, vi } from 'vitest'

// How many submissions await the tutor's review, for the menu item and the
// You page (learning-services#452). One number wherever it is read.

const { call, user } = vi.hoisted(() => ({
	call: vi.fn(),
	user: { data: null as unknown },
}))

vi.mock('frappe-ui', () => ({ call }))
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: user }),
}))

import { loadPendingCount, pendingCount } from '@/stores/homeworkQueue'

const METHOD = 'lms_frappe_app.api.review.pending_count'

beforeEach(() => {
	call.mockReset()
	pendingCount.value = 0
	user.data = { roles: ['Organization Manager'] }
})

describe('the pending count', () => {
	it('asks the server for a tutor and keeps its number', async () => {
		call.mockResolvedValue({ ok: true, data: { count: 7 } })
		await loadPendingCount()
		expect(call).toHaveBeenCalledWith(METHOD)
		expect(pendingCount.value).toBe(7)
	})

	it('does not ask for a learner or a visitor', async () => {
		user.data = { roles: ['LMS Student'], is_instructor: 0 }
		pendingCount.value = 3
		await loadPendingCount()
		user.data = null
		await loadPendingCount()
		expect(call).not.toHaveBeenCalled()
		expect(pendingCount.value).toBe(0)
	})

	it('keeps the last number when the server refuses or fails', async () => {
		pendingCount.value = 2
		call.mockResolvedValue({ ok: false, error: { code: 'x', message: 'x' } })
		await loadPendingCount()
		expect(pendingCount.value).toBe(2)
		call.mockRejectedValue(new Error('502'))
		await loadPendingCount()
		expect(pendingCount.value).toBe(2)
	})
})
