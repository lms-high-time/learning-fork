<template>
	<details v-if="history.length" class="text-p-sm">
		<summary class="cursor-pointer text-ink-gray-6">
			{{ __('History') }}
		</summary>
		<ul class="mt-2 space-y-2">
			<li v-for="(row, index) in history" :key="index" class="text-ink-gray-7">
				<span class="font-medium text-ink-gray-8">{{
					eventLabel(row.event)
				}}</span>
				· {{ whoLabel(row, me) }} · {{ formatMoment(row.at) }}
				<span v-if="row.version">
					· {{ __('version {0}').format(row.version) }}</span
				>
				<p v-if="row.comment" class="mt-0.5 whitespace-pre-line">
					{{ row.comment }}
				</p>
			</li>
		</ul>
	</details>
</template>

<script setup lang="ts">
import {
	eventLabel,
	formatMoment,
	whoLabel,
	type HomeworkEvent,
} from '@/utils/homework'

// A submission's journal, folded away: who did what and when, with the
// tutor's comments (learning-services#439, #452). The reader is «You».
defineProps<{ history: HomeworkEvent[]; me?: string | null }>()
</script>
