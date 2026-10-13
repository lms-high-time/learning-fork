import { createResource } from 'frappe-ui'
import { shallowRef } from 'vue'

// The messages behind `__()`, reactive: a template rendered before the
// translations arrive re-renders when they do. `__()` once read the window
// directly, and the sidebar's "Courses" and "More" stayed English (#564).
const messages = shallowRef(window.translatedMessages || null)

// The one load, shared by the app and the sub-apps that install the plugin
// again (quiz, program, assignment, upload). Settles when the messages are in
// place — from frappe-ui's cache or the network — or when they cannot be: a
// failed request settles too, so a broken endpoint costs translations, never
// the app.
let loaded = null

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	window.__ = translate
	if (!messages.value && !loaded) loaded = fetchTranslations()
}

/* main.js mounts after this, so the first paint is already translated; the
   timeout keeps a slow or hung request from holding the app — anything that
   paints before a late answer still updates through `messages`. */
export function translationsReady(timeout = 1500) {
	if (messages.value || !loaded) return Promise.resolve()
	return Promise.race([
		loaded,
		new Promise((resolve) => setTimeout(resolve, timeout)),
	])
}

function translate(message) {
	let translatedMessages = messages.value || {}
	let translatedMessage = translatedMessages[message] || message

	const hasPlaceholders = /{\d+}/.test(message)
	if (!hasPlaceholders) {
		return translatedMessage
	}
	return {
		format: function (...args) {
			return translatedMessage.replace(
				/{(\d+)}/g,
				function (match, number) {
					return typeof args[number] != 'undefined'
						? args[number]
						: match
				}
			)
		},
	}
}

function fetchTranslations() {
	return new Promise((resolve) => {
		createResource({
			url: 'lms.lms.api.get_translations',
			cache: 'translations',
			auto: true,
			// transform runs for the cached response and the network one alike;
			// onSuccess only after the network.
			transform: (data) => {
				window.translatedMessages = data
				messages.value = data
				resolve()
			},
			onError: () => resolve(),
		})
	})
}
