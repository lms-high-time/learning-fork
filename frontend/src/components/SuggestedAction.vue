<template>
	<Tooltip v-if="url && collapsed" :text="title">
		<button
			type="button"
			class="flex items-center justify-center"
			:aria-label="title"
			data-testid="suggested-action"
			@click="start"
		>
			<span :class="icon" class="size-4 text-ink-gray-7" />
		</button>
	</Tooltip>
	<div
		v-else-if="url"
		class="flex flex-col gap-3 text-ink-gray-9 py-2.5 px-3 bg-surface-base shadow-sm rounded-md"
		data-testid="suggested-action"
	>
		<div class="flex flex-col text-p-sm gap-1">
			<div class="inline-flex gap-1">
				<span :class="icon" class="h-4 my-0.5 shrink-0" />
				<div class="font-medium">{{ title }}</div>
			</div>
			<div class="text-ink-gray-7">{{ text }}</div>
		</div>
		<Button :label="actionLabel" class="w-full" @click="start">
			<template #prefix>
				<span class="lucide-chevrons-right h-4 w-4 text-ink-gray-7" />
			</template>
		</Button>
	</div>
</template>

<script setup lang="ts">
import { Button, Tooltip } from 'frappe-ui'
import { useAssistantPanel } from '@/stores/assistantPanel'

// An action the platform offers the learner, done in the assistant panel
// (learning-services#463): «Tell your mentor about yourself» now, later
// «Get to know the platform» or «Continue the lesson». No URL — the chat
// service does not offer the scenario — and there is nothing to offer.

const props = withDefaults(
	defineProps<{
		title: string
		text: string
		actionLabel: string
		scenario: string
		url: string | null
		/** The collapsed sidebar: an icon with the title as its tooltip. */
		collapsed?: boolean
		icon?: string
	}>(),
	{ collapsed: false, icon: 'lucide-user' }
)

const panel = useAssistantPanel()

function start() {
	if (props.url) panel.open(props.scenario, props.url)
}
</script>
