import { call } from 'frappe-ui'
import { telemetryPlugin } from 'frappe-ui/frappe'

// frappe-ui's telemetry plugin imports pulse_client.js from pulse.m.frappe.cloud
// before it reads whether telemetry is on, so a site with telemetry disabled
// still handed every signed-in user's IP to a third party
// (lms-high-time/learning-services#579). Ask the backend first and install the
// plugin only when telemetry is enabled; the plugin then fetches the same
// boot config again for its own options.
export const BOOT_CONFIG = 'frappe.utils.telemetry.pulse.client.boot_config'

// main.js calls this on every change of the session user; one check is enough.
let checked = null

export function installTelemetry(app) {
	if (!checked) checked = check(app)
	return checked
}

async function check(app) {
	let config
	try {
		config = await call(BOOT_CONFIG)
	} catch (error) {
		return false
	}
	if (!config || !config.enabled) return false
	app.use(telemetryPlugin, { app_name: 'lms' })
	return true
}
