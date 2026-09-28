<template>
	<div
		v-if="blocks.length"
		class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-p-sm"
		data-testid="lesson-blocks"
	>
		<span class="text-ink-gray-5">{{ label || __('Into the document:') }}</span>
		<template
			v-for="(block, i) in blocks"
			:key="`${block.artifact}-${block.key}`"
		>
			<!-- A student goes to the block itself; a visitor reads what the
			lesson will leave them with. -->
			<router-link
				v-if="linked"
				:to="{
					name: 'Document',
					params: { courseName, artifact: block.artifact, view: block.key },
				}"
				class="inline-flex items-center gap-1 font-medium text-ink-gray-8 underline decoration-outline-gray-3 underline-offset-2 hover:text-ink-gray-9"
				:data-testid="`lesson-block-${block.key}`"
			>
				<span
					v-if="block.filled"
					class="lucide-circle-check size-3.5 text-ink-green-6"
					:aria-label="__('Done')"
				/>
				{{ block.title }}
			</router-link>
			<span v-else class="font-medium text-ink-gray-8">{{ block.title }}</span>
			<span
				v-if="i < blocks.length - 1"
				class="text-ink-gray-4"
				aria-hidden="true"
				>·</span
			>
		</template>
	</div>
</template>

<script setup lang="ts">
import type { ProgramBlock } from '@/utils/courseProgram'

// Which blocks of the course's document a lesson builds (learning-services#340):
// on the program's slide and on the lesson page.
defineProps<{
	blocks: ProgramBlock[]
	courseName: string
	/** Links for a student of the course; a visitor has no document yet. */
	linked: boolean
	label?: string
}>()
</script>
