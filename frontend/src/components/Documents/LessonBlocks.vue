<template>
	<!-- The lesson page has the room to say what each block is for; the
	program's slide names them in a line (learning-services#515). -->
	<div v-if="blocks.length && detailed" data-testid="lesson-blocks">
		<p class="text-p-sm text-ink-gray-5">
			{{ label || __('Into the document:') }}
		</p>
		<ul class="mt-2 space-y-2">
			<li
				v-for="block in blocks"
				:key="`${block.artifact}-${block.key}`"
				class="text-p-sm"
			>
				<router-link
					v-if="linked"
					:to="to(block)"
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
				<span v-else class="font-medium text-ink-gray-8">{{
					block.title
				}}</span>
				<p
					v-if="block.description"
					class="mt-0.5 whitespace-pre-line text-p-sm text-ink-gray-6"
					data-testid="lesson-block-description"
				>
					{{ block.description }}
				</p>
			</li>
		</ul>
	</div>
	<div
		v-else-if="blocks.length"
		class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-p-sm"
		data-testid="lesson-blocks"
	>
		<span class="text-ink-gray-5">{{ label || __('Into the document:') }}</span>
		<template
			v-for="(block, i) in blocks"
			:key="`${block.artifact}-${block.key}`"
		>
			<!-- A student goes to the block itself; a visitor reads what the
			lesson will leave them with. In a line the description is a hover
			and is read out after the title. -->
			<router-link
				v-if="linked"
				:to="to(block)"
				class="inline-flex items-center gap-1 font-medium text-ink-gray-8 underline decoration-outline-gray-3 underline-offset-2 hover:text-ink-gray-9"
				:data-testid="`lesson-block-${block.key}`"
				:title="block.description || undefined"
			>
				<span
					v-if="block.filled"
					class="lucide-circle-check size-3.5 text-ink-green-6"
					:aria-label="__('Done')"
				/>
				{{ block.title }}
				<span v-if="block.description" class="sr-only"
					>— {{ block.description }}</span
				>
			</router-link>
			<span
				v-else
				class="font-medium text-ink-gray-8"
				:title="block.description || undefined"
				>{{ block.title
				}}<span v-if="block.description" class="sr-only">
					— {{ block.description }}</span
				></span
			>
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
const props = defineProps<{
	blocks: ProgramBlock[]
	courseName: string
	/** Links for a student of the course; a visitor has no document yet. */
	linked: boolean
	label?: string
	/** A block per line with its description in view: the lesson page. */
	detailed?: boolean
}>()

const to = (block: ProgramBlock) => ({
	name: 'Document',
	params: {
		courseName: props.courseName,
		artifact: block.artifact,
		view: block.key,
	},
})
</script>
