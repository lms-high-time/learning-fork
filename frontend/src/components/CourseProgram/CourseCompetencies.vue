<template>
	<!-- What the course teaches, above its programme (learning-services#843):
	the integrative competencies with their parts folded under each, then, past
	a rule, the base ones no integrative one takes in. Every toggle reads the
	same, so each is described by its competency's title. -->
	<section
		data-testid="course-competencies"
		aria-labelledby="course-competencies-title"
	>
		<h2
			id="course-competencies-title"
			class="mb-4 text-3xl-semibold text-ink-gray-9"
		>
			{{ __("What you'll learn") }}
		</h2>
		<ul v-if="integrative.length" class="space-y-5">
			<li
				v-for="(competency, index) in integrative"
				:key="competency.key"
				data-testid="course-competency"
			>
				<h3
					:id="`course-competency-${index}-title`"
					class="text-lg-semibold text-ink-gray-9"
				>
					{{ competency.title }}
				</h3>
				<p
					v-if="competency.description"
					class="mt-1 text-p-base text-ink-gray-7"
				>
					{{ competency.description }}
				</p>
				<template v-if="competency.parts?.length">
					<button
						type="button"
						class="mt-2 inline-flex items-center gap-1 rounded text-p-sm font-medium text-ink-gray-6 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-blue-6"
						:aria-expanded="isOpen(competency.key)"
						:aria-controls="`course-competency-${index}-parts`"
						:aria-describedby="`course-competency-${index}-title`"
						data-testid="course-competency-toggle"
						@click="toggle(competency.key)"
					>
						{{ __('What it is made of') }}
						<span
							class="lucide-chevron-down size-4 transition-transform motion-reduce:transition-none"
							:class="{ 'rotate-180': isOpen(competency.key) }"
							aria-hidden="true"
						/>
					</button>
					<ul
						v-show="isOpen(competency.key)"
						:id="`course-competency-${index}-parts`"
						class="mt-3 space-y-3 border-s-2 border-outline-gray-2 ps-4"
						data-testid="course-competency-parts"
					>
						<li v-for="part in competency.parts" :key="part.key">
							<span class="block text-p-base font-medium text-ink-gray-8">
								{{ part.title }}
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
		<ul
			v-if="base.length"
			class="list-disc space-y-2 ps-5 text-ink-gray-8"
			:class="{
				'mt-6 border-t border-outline-gray-2 pt-6': integrative.length,
			}"
			data-testid="course-competencies-base"
		>
			<li v-for="competency in base" :key="competency.key">
				<span class="text-p-base font-medium text-ink-gray-8">
					{{ competency.title }}
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CourseCompetency } from '@/utils/courseProgram'

const props = defineProps<{
	competencies: CourseCompetency[]
}>()

const integrative = computed(() =>
	props.competencies.filter((competency) => competency.kind === 'integrative')
)
const base = computed(() =>
	props.competencies.filter((competency) => competency.kind === 'base')
)

// Folded at first: the titles say what the course teaches; the parts are
// for whoever wants the detail.
const open = ref<string[]>([])

function isOpen(key: string): boolean {
	return open.value.includes(key)
}

function toggle(key: string): void {
	open.value = isOpen(key)
		? open.value.filter((openKey) => openKey !== key)
		: [...open.value, key]
}
</script>
