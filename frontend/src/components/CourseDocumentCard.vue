<template>
	<section
		v-if="documents.length"
		class="rounded-md border-2 p-5 space-y-3"
		data-testid="course-documents"
	>
		<h2 class="text-p-sm font-medium uppercase text-ink-gray-5">
			{{ enrolled ? __('Your document') : __('You will build') }}
		</h2>
		<div v-for="doc in documents" :key="doc.artifact" class="space-y-2">
			<div class="flex items-start gap-2">
				<span
					class="lucide-file-text mt-0.5 size-4 shrink-0 text-ink-gray-6"
					aria-hidden="true"
				/>
				<span class="text-p-base font-medium text-ink-gray-9">{{
					doc.title
				}}</span>
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
			<p v-else class="text-p-sm text-ink-gray-6">
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
