<template>
	<ul
		v-if="lines.length"
		class="space-y-1 text-p-sm text-ink-gray-8"
		data-testid="canvas-summary"
	>
		<li v-for="(line, i) in lines" :key="i">
			<!-- ✓ and ✗ as characters, not icons: they print. -->
			<span
				v-if="line.flag !== undefined"
				class="flag inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-p-xs font-medium"
				:class="
					line.flag
						? 'bg-surface-green-2 text-ink-green-8'
						: 'bg-surface-red-2 text-ink-red-7'
				"
				:data-flag="String(line.flag)"
				>{{ line.flag ? '✓' : '✗' }} {{ line.text }}</span
			>
			<template v-else>
				<span v-if="line.label" class="text-ink-gray-5"
					>{{ line.label }}:
				</span>
				{{ line.text }}
			</template>
		</li>
	</ul>
	<p v-else class="text-p-sm text-ink-gray-4" data-testid="canvas-empty">
		{{ __('empty') }}
	</p>
</template>

<script setup lang="ts">
import type { CanvasLine } from '@/utils/documentTable'

// A canvas cell's summary of its block (learning-services#351).
defineProps<{ lines: CanvasLine[] }>()
</script>

<style scoped>
@media print {
	.flag {
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
}
</style>
