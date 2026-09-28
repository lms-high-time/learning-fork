<template>
	<span
		class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-p-xs font-medium"
		:class="classes[state]"
		data-testid="block-status"
		>{{ labels[state]() }}</span
	>
</template>

<script setup lang="ts">
import type { BlockState } from '@/utils/documentTable'

// Where a document stands, in one word (learning-services#342).
defineProps<{ state: BlockState }>()

const labels: Record<BlockState, () => string> = {
	done: () => __('Done'),
	progress: () => __('Started'),
	preset: () => __('Preset'),
	empty: () => __('Empty'),
}

const classes: Record<BlockState, string> = {
	done: 'bg-surface-green-2 text-ink-green-8',
	progress: 'bg-surface-amber-2 text-ink-amber-8',
	preset: 'bg-surface-blue-1 text-ink-blue-7',
	empty: 'bg-surface-gray-2 text-ink-gray-6',
}
</script>
