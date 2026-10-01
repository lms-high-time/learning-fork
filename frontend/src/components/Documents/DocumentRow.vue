<template>
	<!-- One document, one link: how full it is, why it is there, when it
	changed (learning-services#462). The document opens on the lesson it
	grows on next (#462, step 1). -->
	<router-link
		:to="{
			name: 'Document',
			params: { courseName: course, artifact: doc.artifact },
		}"
		class="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-4 rounded-lg px-3 py-3 hover:bg-surface-gray-2 sm:px-4"
		:data-testid="`document-${doc.artifact}`"
	>
		<span
			class="relative size-11 shrink-0"
			:title="
				__('Filled {0} of {1}').format(
					String(doc.blocks_filled),
					String(doc.blocks_total)
				)
			"
			data-testid="document-fill"
		>
			<svg
				viewBox="0 0 40 40"
				class="absolute inset-0 size-full -rotate-90"
				aria-hidden="true"
			>
				<circle
					cx="20"
					cy="20"
					r="17"
					fill="none"
					stroke-width="2.5"
					:class="fill.done ? 'stroke-ink-green-6' : 'stroke-ink-gray-2'"
				/>
				<circle
					v-if="!fill.empty && !fill.done"
					cx="20"
					cy="20"
					r="17"
					fill="none"
					stroke-width="2.5"
					stroke-linecap="round"
					class="stroke-ink-gray-7"
					:stroke-dasharray="`${arc} ${CIRCLE}`"
				/>
			</svg>
			<span
				v-if="fill.done"
				aria-hidden="true"
				class="lucide-check absolute inset-0 m-auto size-4 text-ink-green-6"
				data-testid="document-done"
			/>
			<span
				v-else
				aria-hidden="true"
				class="absolute inset-0 flex items-center justify-center text-[11px] font-medium tabular-nums"
				:class="fill.empty ? 'text-ink-gray-5' : 'text-ink-gray-8'"
				>{{ fill.percent }}%</span
			>
			<span class="sr-only">{{
				fill.done
					? __('Document is complete')
					: __('Filled {0} of {1}').format(
							String(doc.blocks_filled),
							String(doc.blocks_total)
					  )
			}}</span>
		</span>

		<span class="min-w-0">
			<span class="block text-base-medium text-ink-gray-9">{{
				doc.title
			}}</span>
			<span
				v-if="doc.purpose"
				class="mt-0.5 line-clamp-2 text-p-sm text-ink-gray-6"
				data-testid="document-purpose"
				>{{ doc.purpose }}</span
			>
		</span>

		<span
			v-if="changed"
			class="whitespace-nowrap text-xs tabular-nums text-ink-gray-5"
			:title="changed.full"
			data-testid="document-changed"
			><span aria-hidden="true">{{ changed.short }}</span
			><span class="sr-only">{{ changed.full }}</span></span
		>
	</router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { changedAt, fillOf, type DocumentSummary } from '@/utils/documentList'

const props = defineProps<{
	course: string
	doc: DocumentSummary
}>()

// The ring's length at r = 17.
const CIRCLE = 2 * Math.PI * 17

const fill = computed(() => fillOf(props.doc))
const arc = computed(() => ((fill.value.percent / 100) * CIRCLE).toFixed(1))
const changed = computed(() => changedAt(props.doc.modified))
</script>
