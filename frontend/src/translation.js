import { createResource } from 'frappe-ui'

// Settles when the translations are in place, or when they cannot be: a
// failed request resolves too, so a broken endpoint costs translations, not
// the app. Stays resolved when the messages were already on the window.
let loaded = Promise.resolve()

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	window.__ = translate
	if (!window.translatedMessages) loaded = fetchTranslations()
}

/* `__()` reads the messages synchronously and is not reactive, so whatever
   renders before they arrive keeps the English string until something else
   re-renders it — the sidebar's "Courses" and "More" did (#564). main.js
   mounts after this; the timeout keeps a hung request from blocking the app. */
export function translationsReady(timeout = 3000) {
	return Promise.race([
		loaded,
		new Promise((resolve) => setTimeout(resolve, timeout)),
	])
}

function translate(message) {
	let translatedMessages = window.translatedMessages || {}
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
			transform: (data) => {
				window.translatedMessages = data
			},
			onSuccess: () => resolve(),
			onError: () => resolve(),
		})
	})
}
