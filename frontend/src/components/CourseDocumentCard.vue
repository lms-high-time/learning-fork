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
			</template>
			<p v-else class="text-p-base text-ink-gray-7">
				{{
					__(
						'Built lesson by lesson on your own project, with your agent. It stays yours after the course.'
					)
				}}
			</p>
			<!-- What will be in the document: its sections answer the hard decisions
			of the task (learning-services#856). In two columns on a wide screen,
			read down each; a student sees which are filled. -->
			<div
				v-if="doc.blocks?.length"
				class="pt-2"
				data-testid="course-document-sections"
			>
				<p
					:id="`course-document-${doc.artifact}-sections`"
					class="text-p-sm font-medium text-ink-gray-6"
				>
					{{ __('Document sections') }}
				</p>
				<ul
					class="mt-2 gap-x-6 sm:columns-2"
					:aria-labelledby="`course-document-${doc.artifact}-sections`"
				>
					<li
						v-for="block in doc.blocks"
						:key="block.key"
						class="flex break-inside-avoid items-start gap-2 py-0.5 text-p-base text-ink-gray-8"
						:data-filled="showFill(doc) ? String(Boolean(block.filled)) : null"
					>
						<span
							v-if="showFill(doc)"
							class="mt-0.5 size-4 shrink-0"
							:class="
								block.filled
									? 'lucide-circle-check text-ink-green-6'
									: 'lucide-circle text-ink-gray-4'
							"
							aria-hidden="true"
						/>
						<span
							v-else
							class="mt-2.5 size-1.5 shrink-0 rounded-full bg-surface-gray-5"
							aria-hidden="true"
						/>
						<span>
							{{ block.title }}
							<span v-if="showFill(doc)" class="sr-only">
								—
								{{
									block.filled ? __('section filled') : __('not filled yet')
								}}</span
							>
						</span>
					</li>
				</ul>
			</div>
			<router-link
				v-if="enrolled && doc.blocks_total"
				:to="{
					name: 'Document',
					params: { courseName, artifact: doc.artifact },
				}"
				class="inline-block pt-1"
			>
				<Button variant="subtle" :label="__('Open the document')" />
			</router-link>
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
const props = defineProps<{
	documents: ProgramDocument[]
	courseName: string
	enrolled: boolean
}>()

// The marks only for a student, and only where the server said which are
// filled.
const showFill = (doc: ProgramDocument): boolean =>
	props.enrolled &&
	Boolean(doc.blocks?.some((block) => block.filled !== undefined))

const percent = (doc: ProgramDocument) =>
	doc.blocks_total
		? Math.round(((doc.blocks_filled ?? 0) / doc.blocks_total) * 100)
		: 0
</script>
