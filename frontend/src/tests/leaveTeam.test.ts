/**
 * Leaving a team is anyone's own (learning-services#585): the switcher and the
 * «You» page call the same leave, which asks first and then calls the server
 * for the person themselves.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { call, toast, confirmAction } = vi.hoisted(() => ({
	call: vi.fn(),
	toast: { error: vi.fn() },
	confirmAction: vi.fn(),
}))

vi.mock('frappe-ui', () => ({ call, toast }))
vi.mock('@/utils/confirm', () => ({ confirmAction }))

import { leaveTeam } from '@/utils/leaveTeam'

const confirmed = async () => {
	const [[options]] = confirmAction.mock.calls
	await options.onConfirm()
	return options
}

describe('leaveTeam', () => {
	beforeEach(() => {
		call.mockReset()
		toast.error.mockReset()
		confirmAction.mockReset()
	})

	it('asks before leaving and leaves as oneself', async () => {
		call.mockResolvedValue({ ok: true, data: { left: true } })

		leaveTeam('org-1', 'me@example.com')
		const options = await confirmed()

		expect(options.title).toBe('Leave the team?')
		expect(call).toHaveBeenCalledWith('lms_frappe_app.api.team.remove_member', {
			organization: 'org-1',
			user: 'me@example.com',
		})
	})

	it('says the refusal as it came', async () => {
		call.mockResolvedValue({
			ok: false,
			error: {
				code: 'last_org_admin',
				message: 'У команды должен остаться администратор',
			},
		})

		leaveTeam('org-1', 'me@example.com')
		await confirmed()

		expect(toast.error).toHaveBeenCalledWith(
			'У команды должен остаться администратор'
		)
	})
})
