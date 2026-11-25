<template>
	<!-- The course's skills, on a tab of their own (learning-services#854):
	the overview speaks of the task, the document and the programme, and the
	full list is here for whoever wants it — no counts, nothing folded. The
	integrative skills first, each with the parts it is made of; then the base
	ones no integrative skill takes in, under a heading of their own when both
	kinds are there (learning-services#843). An enrolled student sees where
	they stand in each (learning-services#857). -->
	<section data-testid="course-competencies" class="max-w-prose space-y-8">
		<p class="text-p-base text-ink-gray-7">
			{{
				__(
					'The course checks these skills in your conversation with the agent instead of a test.'
				)
			}}
		</p>
		<ul v-if="integrative.length" class="space-y-8">
			<li
				v-for="(competency, index) in integrative"
				:key="competency.key"
				data-testid="course-competency"
			>
				<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<h2 class="text-lg-semibold text-ink-gray-9">
						{{ competency.title }}
					</h2>
					<CompetencyLevel :competency="competency" />
				</div>
				<p
					v-if="competency.description"
					class="mt-1 text-p-base text-ink-gray-7"
				>
					{{ competency.description }}
				</p>
				<template v-if="competency.parts?.length">
					<!-- A caption, not a heading: the same words under every skill
					filled the headings list with copies of one line. -->
					<p
						:id="`course-competency-${index}-parts`"
						class="mt-4 text-p-sm font-medium text-ink-gray-6"
					>
						{{ __('What it is made of') }}
					</p>
					<ul
						class="mt-2 space-y-3 border-s-2 border-outline-gray-2 ps-4"
						:aria-labelledby="`course-competency-${index}-parts`"
						data-testid="course-competency-parts"
					>
						<li v-for="part in competency.parts" :key="part.key">
							<span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
								<span
									class="text-p-base font-medium text-ink-gray-8"
									data-testid="competency-title"
								>
									{{ part.title }}
								</span>
								<CompetencyLevel :competency="part" />
							</span>
							<span
								v-if="part.description"
								class="block text-p-sm text-ink-gray-6"
							>
								{{ part.description }}
							</span>
						</li>
					</ul>
				</template>
			</li>
		</ul>
		<section
			v-if="base.length"
			data-testid="course-competencies-base"
			:aria-labelledby="
				integrative.length ? 'course-competencies-base-title' : undefined
			"
			:class="{ 'border-t border-outline-gray-2 pt-8': integrative.length }"
		>
			<h2
				v-if="integrative.length"
				id="course-competencies-base-title"
				class="mb-4 text-p-sm font-medium uppercase text-ink-gray-5"
			>
				{{ __('Other skills') }}
			</h2>
			<ul class="space-y-3">
				<li v-for="competency in base" :key="competency.key">
					<span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
						<span
							class="text-p-base font-medium text-ink-gray-8"
							data-testid="competency-title"
						>
							{{ competency.title }}
						</span>
						<CompetencyLevel :competency="competency" />
					</span>
					<span
						v-if="competency.description"
						class="block text-p-sm text-ink-gray-6"
					>
						{{ competency.description }}
					</span>
				</li>
			</ul>
		</section>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CourseCompetency } from '@/utils/courseProgram'
import CompetencyLevel from '@/components/CourseProgram/CompetencyLevel.vue'

const props = defineProps<{
	competencies: CourseCompetency[]
}>()

const integrative = computed(() =>
	props.competencies.filter((competency) => competency.kind === 'integrative')
)
const base = computed(() =>
	props.competencies.filter((competency) => competency.kind === 'base')
)
</script>
