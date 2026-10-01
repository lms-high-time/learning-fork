<template>
	<!-- Mounted on the first open and only hidden after: closing and opening
	again must not reload the conversation. A new URL is a new chat. -->
	<div
		v-if="store.url"
		v-show="store.isOpen"
		class="fixed z-40 bg-surface-base"
		:class="
			isMobile
				? 'inset-0'
				: 'inset-y-0 end-0 w-[400px] shadow-2xl border-s border-outline-gray-2'
		"
		data-testid="assistant-panel"
	>
		<!-- No header of its own: the chat inside has its Close button. -->
		<iframe
			:key="store.url"
			ref="frame"
			:src="safeUrl(store.url)"
			:title="__('Chat with your mentor')"
			class="size-full border-0"
			@load="sendContext"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAssistantPanel } from '@/stores/assistantPanel'
import { useScreenSize } from '@/utils/composables'
import { panelOriginOf, readPanelMessage } from '@/utils/panelMessages'
import { safeUrl } from '@/utils/safeUrl'

// The web chat beside the page (learning-services#463). It talks to the page
// only by postMessage: it says `refresh` when it saved something the page
// shows and `close` from its own button; the page tells it where the learner
// is (`context`). Messages go to the chat's origin by name, never `*`.

const store = useAssistantPanel()
const route = useRoute()
const { isMobile } = useScreenSize()
const frame = ref<HTMLIFrameElement | null>(null)

const panelOrigin = computed(() => {
	if (!store.url) return null
	try {
		return panelOriginOf(store.url)
	} catch {
		return null
	}
})

function sendContext() {
	const target = frame.value?.contentWindow
	if (!target || !panelOrigin.value) return
	target.postMessage(
		{ type: 'context', route: route.fullPath },
		panelOrigin.value
	)
}

function onMessage(event: MessageEvent) {
	if (!panelOrigin.value) return
	const message = readPanelMessage(
		event,
		frame.value?.contentWindow ?? null,
		panelOrigin.value
	)
	if (message?.type === 'refresh') store.notifyRefresh()
	else if (message?.type === 'close') store.close()
}

// Esc while focus is on the page; inside the iframe the chat has its own keys.
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && store.isOpen && !event.defaultPrevented)
		store.close()
}

watch(() => route.fullPath, sendContext)

// Typing goes to the chat as soon as it opens.
watch(
	() => store.isOpen,
	async (open) => {
		if (!open) return
		await nextTick()
		frame.value?.focus()
	}
)

onMounted(() => {
	window.addEventListener('message', onMessage)
	window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
	window.removeEventListener('message', onMessage)
	window.removeEventListener('keydown', onKeydown)
})
</script>
