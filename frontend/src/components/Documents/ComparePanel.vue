<template>
	<article class="space-y-4" data-testid="compare-panel">
		<header class="space-y-1">
			<p class="text-p-sm text-ink-gray-5">{{ courseTitle }}</p>
			<h1 class="text-2xl-semibold text-ink-gray-9">
				{{ __('Before → after') }}
			</h1>
			<p class="text-p-base text-ink-gray-7">
				{{ __('The first sketch next to what it has become') }}
			</p>
		</header>

		<CanvasSheet :document="document" :canvas="canvas">
			<template #default="{ cell }">
				<div class="space-y-0.5" data-testid="compare-before">
					<p class="text-p-xs text-ink-gray-5">{{ __('Before') }}</p>
					<p class="whitespace-pre-line text-p-sm text-ink-gray-6">
						{{ sketchValue(document, canvas, cell.key) || '—' }}
					</p>
				</div>
				<component
					:is="cell.block ? 'router-link' : 'div'"
					:to="cell.block ? cell.to : undefined"
					class="after -mx-1.5 space-y-0.5 rounded px-1.5 py-1"
					:class="{ 'is-link': cell.block }"
					data-testid="compare-after"
				>
					<p class="text-p-xs text-ink-gray-5">{{ __('After') }}</p>
					<CanvasSummary :lines="cell.lines" />
				</component>
			</template>
		</CanvasSheet>
	</article>
</template>

<script setup lang="ts">
import CanvasSheet from '@/components/Documents/CanvasSheet.vue'
import CanvasSummary from '@/components/Documents/CanvasSummary.vue'
import {
	sketchValue,
	type CanvasSpec,
	type DocumentData,
} from '@/utils/documentTable'

// «Было → стало» (learning-services#351): the student's first sketch of each
// cell from its lesson beside what the cell holds now. What the course taught
// shows as the distance between the two.

defineProps<{
	document: DocumentData
	canvas: CanvasSpec
	courseTitle: string
}>()
</script>

<style scoped>
.after.is-link:hover {
	background-color: var(--surface-gray-1);
}

.after.is-link:focus-visible {
	outline: 2px solid var(--outline-gray-4);
	outline-offset: -2px;
}
</style>
