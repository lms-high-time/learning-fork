import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isPanelUrl } from '@/utils/panelMessages'

// The assistant panel (learning-services#463): the web chat in an iframe beside
// the page, opened for a scenario — `profile` first. The URL comes from the
// server with the scenario, so a scenario the chat service does not offer has
// no button to open it. `refreshTick` moves when the chat saved something: a
// page showing that data reads it again.

export const useAssistantPanel = defineStore('assistantPanel', () => {
	const isOpen = ref(false)
	const url = ref<string | null>(null)
	const scenario = ref<string | null>(null)
	const refreshTick = ref(0)

	// The URL is the server's, but it lands in a frame on our origin: anything
	// but a web page is not opened at all.
	function open(nextScenario: string, nextUrl: string) {
		if (!isPanelUrl(nextUrl)) return
		scenario.value = nextScenario
		url.value = nextUrl
		isOpen.value = true
	}

	function close() {
		isOpen.value = false
	}

	function notifyRefresh() {
		refreshTick.value++
	}

	return { isOpen, url, scenario, refreshTick, open, close, notifyRefresh }
})
