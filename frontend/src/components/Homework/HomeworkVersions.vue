<template>
	<details v-if="versions.length" class="text-p-sm">
		<summary class="cursor-pointer text-ink-gray-6">
			{{ __('Versions') }}
		</summary>
		<div class="mt-2 space-y-2">
			<details v-for="version in newestFirst" :key="version.version">
				<summary class="cursor-pointer text-ink-gray-7">
					{{ __('Version {0}').format(version.version) }} ·
					{{ formatMoment(version.saved_at) }}
				</summary>
				<div class="mt-1 space-y-1 ps-4">
					<p v-if="version.answer" class="whitespace-pre-line text-ink-gray-8">
						{{ version.answer }}
					</p>
					<HomeworkFiles :files="version.files" />
				</div>
			</details>
		</div>
	</details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HomeworkFiles from '@/components/Homework/HomeworkFiles.vue'
import { formatMoment, type HomeworkVersion } from '@/utils/homework'

// Every saved answer, newest first, each folded (learning-services#439,
// #452). Snapshots are read-only: there is no rolling back.
const props = defineProps<{ versions: HomeworkVersion[] }>()

const newestFirst = computed(() => [...props.versions].reverse())
</script>
