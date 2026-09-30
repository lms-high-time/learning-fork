<template>
	<section
		class="space-y-2 rounded-md border border-outline-gray-1 p-3"
		data-testid="homework-diff"
	>
		<h3 class="text-p-sm font-medium text-ink-gray-8">
			{{ __('Changes since version {0}').format(version) }}
		</h3>
		<!-- Parts as text in <del>/<ins>: an answer is never drawn as HTML. -->
		<p
			v-if="changed"
			class="whitespace-pre-wrap break-words text-p-sm leading-relaxed text-ink-gray-8"
		>
			<template v-for="(part, index) in parts" :key="index"
				><del
					v-if="part.type === 'del'"
					class="rounded-sm bg-surface-red-2 text-ink-red-7"
					>{{ part.text }}</del
				><ins
					v-else-if="part.type === 'add'"
					class="rounded-sm bg-surface-green-2 text-ink-green-8 no-underline"
					>{{ part.text }}</ins
				><span v-else>{{ part.text }}</span></template
			>
		</p>
		<p v-else class="text-p-sm text-ink-gray-5">
			{{ __('The text has not changed.') }}
		</p>
		<ul
			v-if="files.added.length || files.removed.length"
			class="space-y-1 text-p-sm"
		>
			<li
				v-for="file in files.added"
				:key="`added-${file.id}`"
				class="text-ink-green-8"
				data-testid="diff-added"
			>
				{{ __('Added: {0}').format(file.name) }}
			</li>
			<li
				v-for="file in files.removed"
				:key="`removed-${file.id}`"
				class="text-ink-red-7"
				data-testid="diff-removed"
			>
				{{ __('Removed: {0}').format(file.name) }}
			</li>
		</ul>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { diffFiles, diffWords } from '@/utils/textDiff'
import type { HomeworkFile, HomeworkVersion } from '@/utils/homework'

// What the learner changed since the tutor last reviewed the answer
// (learning-services#452): the tutor checks the fix against their own
// comment, not against the save before.
const props = defineProps<{
	reviewed: HomeworkVersion
	answer: string | null
	files: HomeworkFile[]
}>()

const version = computed(() => props.reviewed.version)
const parts = computed(() =>
	diffWords(props.reviewed.answer ?? '', props.answer ?? '')
)
const changed = computed(() => parts.value.some((part) => part.type !== 'same'))
const files = computed(() => diffFiles(props.reviewed.files, props.files))
</script>
