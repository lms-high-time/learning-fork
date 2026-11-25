<template>
	<section
		v-if="documents.length"
		class="space-y-4"
		data-testid="course-documents"
	>
		<h2 class="text-3xl-semibold text-ink-gray-9">
			{{ enrolled ? __('Your document') : __('What you will get') }}
		</h2>
		<div
			v-for="doc in documents"
			:key="doc.artifact"
			class="max-w-prose space-y-2"
		>
			<div class="flex items-start gap-2">
				<span
					class="lucide-file-text mt-1 size-5 shrink-0 text-ink-gray-6"
					aria-hidden="true"
				/>
				<span class="text-lg-semibold text-ink-gray-9">{{ doc.title }}</span>
			</div>
			<template v-if="enrolled && doc.blocks_total">
				<div class="text-p-sm text-ink-gray-6">
					{{
						__('Filled {0} of {1}').format(
							String(doc.blocks_filled ?? 0),
							String(doc.blocks_total)
						)
					}}
				</div>
				<ProgressBar :progress="percent(doc)" />
				<router-link
					:to="{
						name: 'Document',
						params: { courseName, artifact: doc.artifact },
					}"
					class="inline-block"
				>
					<Button variant="subtle" :label="__('Open the document')" />
				</router-link>
			</template>
			<p v-else class="text-p-base text-ink-gray-7">
				{{
					__(
						'Built lesson by lesson on your own project, with your agent. It stays yours after the course.'
					)
				}}
			</p>
		</div>
	</section>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import ProgressBar from '@/components/ProgressBar.vue'
import type { ProgramDocument } from '@/utils/courseProgram'

// What the course leaves the student with (learning-services#340): for a
// visitor its promise, for a student the document itself and how far it is.
// A section of the overview's main column, between the task the course helps
// with and its programme (learning-services#854).
defineProps<{
	documents: ProgramDocument[]
	courseName: string
	enrolled: boolean
}>()

const percent = (doc: ProgramDocument) =>
	doc.blocks_total
		? Math.round(((doc.blocks_filled ?? 0) / doc.blocks_total) * 100)
		: 0
</script>
