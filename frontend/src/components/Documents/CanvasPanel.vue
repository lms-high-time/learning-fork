<template>
	<article class="canvas-page space-y-4" data-testid="canvas-panel">
		<header class="flex items-start justify-between gap-3">
			<div class="space-y-1">
				<p class="text-p-sm text-ink-gray-5">{{ courseTitle }}</p>
				<h1 class="text-2xl-semibold text-ink-gray-9">
					{{ __('The whole canvas') }}
				</h1>
			</div>
			<Button
				class="shrink-0 print:hidden"
				variant="subtle"
				:label="__('Print or save as PDF')"
				data-testid="print-canvas"
				@click="print"
			>
				<template #prefix>
					<span class="lucide-printer size-4" />
				</template>
			</Button>
		</header>

		<CanvasSheet :document="document" :canvas="canvas" linked>
			<template #default="{ cell }">
				<CanvasSummary :lines="cell.lines" />
			</template>
		</CanvasSheet>
	</article>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { Button } from 'frappe-ui'
import CanvasSheet from '@/components/Documents/CanvasSheet.vue'
import CanvasSummary from '@/components/Documents/CanvasSummary.vue'
import type { CanvasSpec, DocumentData } from '@/utils/documentTable'

// The whole canvas (learning-services#351): every block of the document on
// one sheet, as the course lays it out; a cell opens its block. Printing
// leaves only the sheet, on a landscape page.

defineProps<{
	document: DocumentData
	canvas: CanvasSpec
	courseTitle: string
}>()

const print = () => window.print()

// `@page` cannot be scoped to a component: a static rule would turn every
// page of the app landscape once this one had loaded. It lives only while
// the canvas is open.
let pageStyle: HTMLStyleElement | null = null
onMounted(() => {
	pageStyle = window.document.createElement('style')
	pageStyle.dataset.canvasPage = ''
	pageStyle.textContent = '@page { size: A4 landscape; margin: 10mm; }'
	window.document.head.appendChild(pageStyle)
})
onBeforeUnmount(() => {
	pageStyle?.remove()
	pageStyle = null
})
</script>

<style>
/* The canvas prints alone: the app's sidebar, the contents and the header
   stay on screen. Scoped by `:has` so that, once loaded, it hides nothing on
   pages without the canvas. */
@media print {
	body:has(.canvas-page) * {
		visibility: hidden;
	}
	body:has(.canvas-page) .canvas-page,
	body:has(.canvas-page) .canvas-page * {
		visibility: visible;
	}
	.canvas-page {
		position: absolute;
		inset: 0;
	}
	.canvas-page .print\:hidden {
		display: none;
	}
	.canvas-page a {
		color: inherit;
		text-decoration: none;
	}
}
</style>
