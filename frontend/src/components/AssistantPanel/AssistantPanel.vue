<template>
	<!-- Mounted on the first open and only hidden after: closing and opening
	again must not reload the conversation. A new URL is a new chat. -->
	<div
		v-if="store.url"
		v-show="store.isOpen"
		ref="root"
		class="fixed z-40 flex flex-col bg-surface-base"
		:class="
			isMobile
				? 'inset-0 pt-safe-0 pb-safe-0'
				: 'inset-y-0 end-0 w-[400px] shadow-2xl border-s border-outline-gray-2'
		"
		:role="isMobile ? 'dialog' : 'complementary'"
		:aria-modal="isMobile ? 'true' : undefined"
		:aria-label="__('Your mentor')"
		data-testid="assistant-panel"
	>
		<!-- Ours, not the chat's: a chat that failed to load (offline, refused to
		be framed) must still be closable, and a phone has no Esc. -->
		<header
			class="flex h-11 shrink-0 items-center justify-between border-b border-outline-gray-2 ps-4 pe-2"
		>
			<span class="text-base font-medium text-ink-gray-9">
				{{ __('Your mentor') }}
			</span>
			<button
				type="button"
				class="rounded p-1.5 text-ink-gray-7 transition-colors hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				:aria-label="__('Close')"
				data-testid="assistant-panel-close"
				@click="store.close()"
			>
				<span class="lucide-x block size-4" aria-hidden="true" />
			</button>
		</header>
		<iframe
			:key="store.url"
			ref="frame"
			:src="safeUrl(store.url)"
			:title="__('Chat with your mentor')"
			class="min-h-0 w-full flex-1 border-0"
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
// shows and `close`; the page tells it where the learner is (`context`).
// Messages go to the chat's origin by name, never `*`.

const store = useAssistantPanel()
const route = useRoute()
const { isMobile } = useScreenSize()
const root = ref<HTMLElement | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)

const panelOrigin = computed(() => {
	if (!store.url) return null
	try {
		return panelOriginOf(store.url)
	} catch {
		return null
	}
})

// The path only: a query can carry what the chat has no business reading.
function sendContext() {
	const target = frame.value?.contentWindow
	if (!target || !panelOrigin.value) return
	target.postMessage({ type: 'context', route: route.path }, panelOrigin.value)
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

// A dialog of the page's own, open over or beside the panel, takes Esc first.
const PAGE_DIALOG = '[role="dialog"][data-state="open"], [aria-modal="true"]'
const pageDialogOpen = () =>
	Array.from(document.querySelectorAll(PAGE_DIALOG)).some(
		(dialog) => !root.value?.contains(dialog)
	)

// Esc while focus is on the page; inside the iframe the chat has its own keys.
function onKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || !store.isOpen || event.defaultPrevented) return
	if (pageDialogOpen()) return
	store.close()
}

watch(
	() => route.path,
	() => {
		// Full screen on a phone: Back leaves the page, and the panel with it.
		if (isMobile.value && store.isOpen) store.close()
		else sendContext()
	}
)

// Typing goes to the chat as soon as it opens; on close, focus goes back where
// it was — the button that opened it, if it is still on the page.
let returnFocusTo: HTMLElement | null = null
watch(
	() => store.isOpen,
	async (open) => {
		if (open) {
			returnFocusTo = document.activeElement as HTMLElement | null
			await nextTick()
			frame.value?.focus()
			// The learner may have moved on while it was closed.
			sendContext()
			return
		}
		if (returnFocusTo?.isConnected) returnFocusTo.focus()
		returnFocusTo = null
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
