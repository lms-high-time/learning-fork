<template>
	<div
		class="canvas-sheet"
		:class="{ 'is-grid': !isMobile }"
		:style="sheetStyle"
		data-testid="canvas-grid"
	>
		<component
			:is="linked && cell.block ? 'router-link' : 'div'"
			v-for="cell in cells"
			:key="cell.key"
			:to="linked && cell.block ? cell.to : undefined"
			class="canvas-cell"
			:class="{ 'is-link': linked && cell.block }"
			:style="{
				'--area': cell.area,
				gridArea: isMobile ? undefined : cell.area,
			}"
			:data-testid="`canvas-cell-${cell.key}`"
			:data-area="cell.area"
		>
			<div class="flex items-start justify-between gap-2">
				<span
					class="text-p-xs font-medium uppercase tracking-wide text-ink-gray-5"
					data-testid="canvas-label"
					>{{ cell.label }}</span
				>
				<span
					v-if="cell.state"
					class="state-dot mt-1 size-2 shrink-0 rounded-full"
					:class="DOTS[cell.state]"
					:title="WORDS[cell.state]()"
					data-testid="canvas-state"
					:data-state="cell.state"
				>
					<span class="sr-only">{{ WORDS[cell.state]() }}</span>
				</span>
			</div>
			<slot :cell="cell" />
		</component>
	</div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useScreenSize } from '@/utils/composables'
import {
	blockState,
	canvasArea,
	canvasAreas,
	canvasKeys,
	canvasLabel,
	canvasRows,
	cellSummary,
	type BlockState,
	type CanvasLine,
	type CanvasSpec,
	type DocBlock,
	type DocumentData,
} from '@/utils/documentTable'

// The canvas's sheet (learning-services#351): the blocks where the course's
// grid puts them, a bordered cell each — the classic Lean Canvas page. A
// phone has no room for five columns: the cells stack in reading order.

export interface CanvasCell {
	key: string
	area: string
	label: string
	block: DocBlock | null
	state: BlockState | null
	lines: CanvasLine[]
	to: RouteLocationRaw
}

const props = defineProps<{
	document: DocumentData
	canvas: CanvasSpec
	/** The whole cell opens its block. */
	linked?: boolean
}>()

const { isMobile } = useScreenSize()

const cells = computed<CanvasCell[]>(() =>
	canvasKeys(props.canvas).map((key) => {
		const block = props.document.blocks.find((b) => b.key === key) ?? null
		return {
			key,
			area: canvasArea(key),
			label: canvasLabel(props.canvas, key, props.document.blocks),
			block,
			state: block ? blockState(block, props.document) : null,
			lines: block ? cellSummary(block, props.document, props.canvas) : [],
			to: {
				name: 'Document',
				params: {
					courseName: props.document.course,
					artifact: props.document.artifact,
					view: key,
				},
			},
		}
	})
)

// The areas also go into variables: printing restores the grid even when
// the page was opened on a phone.
const sheetStyle = computed(() => {
	const rows = canvasRows(props.canvas)
	const vars = {
		'--canvas-areas': canvasAreas(props.canvas),
		'--canvas-columns': `repeat(${rows[0]?.length ?? 1}, minmax(0, 1fr))`,
		'--canvas-rows': String(rows.length || 1),
	}
	return unref(isMobile)
		? vars
		: {
				...vars,
				gridTemplateAreas: vars['--canvas-areas'],
				gridTemplateColumns: vars['--canvas-columns'],
		  }
})

const WORDS: Record<BlockState, () => string> = {
	done: () => __('done'),
	progress: () => __('started'),
	preset: () => __('template'),
	empty: () => __('empty'),
}
const DOTS: Record<BlockState, string> = {
	done: 'bg-surface-green-7',
	progress: 'bg-surface-amber-6',
	preset: 'bg-surface-blue-5',
	empty: 'bg-surface-gray-4',
}
</script>

<style scoped>
.canvas-sheet {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	border-top: 1px solid var(--outline-gray-2);
	border-left: 1px solid var(--outline-gray-2);
}

.canvas-sheet.is-grid {
	grid-auto-rows: minmax(9rem, auto);
}

.canvas-cell {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	min-height: 6rem;
	min-width: 0;
	padding: 0.75rem;
	border-right: 1px solid var(--outline-gray-2);
	border-bottom: 1px solid var(--outline-gray-2);
	overflow-wrap: anywhere;
}

.canvas-cell.is-link:hover {
	background-color: var(--surface-gray-1);
}

.canvas-cell.is-link:focus-visible {
	outline: 2px solid var(--outline-gray-4);
	outline-offset: -2px;
}

@media print {
	.canvas-sheet {
		grid-template-areas: var(--canvas-areas) !important;
		grid-template-columns: var(--canvas-columns) !important;
		/* The sheet fills the landscape page under its title. */
		grid-auto-rows: minmax(calc(160mm / var(--canvas-rows)), auto);
	}
	.canvas-cell {
		grid-area: var(--area) !important;
		break-inside: avoid;
		color: inherit;
		text-decoration: none;
	}
	.state-dot {
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
}
</style>
