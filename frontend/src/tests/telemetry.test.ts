/**
 * Frappe telemetry stays off the network unless the backend enables it.
 *
 * frappe-ui's plugin imports pulse_client.js from pulse.m.frappe.cloud before
 * reading whether telemetry is on, so installing it unconditionally leaked every
 * signed-in user's IP to a third party (lms-high-time/learning-services#579).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { call, telemetryPlugin } = vi.hoisted(() => ({
	call: vi.fn(),
	telemetryPlugin: { install: vi.fn() },
}))

vi.mock('frappe-ui', () => ({ call }))
vi.mock('frappe-ui/frappe', () => ({ telemetryPlugin }))

async function load() {
	vi.resetModules()
	// @ts-expect-error a JS module has no generated types (TS7016)
	return await import('@/telemetry')
}

const app = () => ({ use: vi.fn() })

describe('installTelemetry', () => {
	beforeEach(() => {
		call.mockReset()
	})

	it('does not install the plugin when telemetry is disabled', async () => {
		call.mockResolvedValue({ enabled: false })
		const { installTelemetry } = await load()
		const a = app()

		expect(await installTelemetry(a)).toBe(false)
		expect(a.use).not.toHaveBeenCalled()
	})

	it('does not install the plugin when the boot config fails', async () => {
		call.mockRejectedValue(new Error('404'))
		const { installTelemetry } = await load()
		const a = app()

		expect(await installTelemetry(a)).toBe(false)
		expect(a.use).not.toHaveBeenCalled()
	})

	it('installs the plugin when telemetry is enabled', async () => {
		call.mockResolvedValue({ enabled: true })
		const { installTelemetry } = await load()
		const a = app()

		expect(await installTelemetry(a)).toBe(true)
		expect(a.use).toHaveBeenCalledWith(telemetryPlugin, { app_name: 'lms' })
	})

	it('asks the backend once however often the user changes', async () => {
		call.mockResolvedValue({ enabled: false })
		const { installTelemetry } = await load()
		const a = app()

		await Promise.all([
			installTelemetry(a),
			installTelemetry(a),
			installTelemetry(a),
		])

		expect(call).toHaveBeenCalledTimes(1)
	})
})
