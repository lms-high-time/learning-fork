<template>
	<div class="mx-auto w-full max-w-5xl space-y-8 p-5">
		<!-- Two lists on one page instead of two tabs: the learner's own programs
		first, then the rest (learning-services#417). The page header names the
		page; a list is headed only when there are two to tell apart. -->
		<section
			v-for="section in sections"
			:key="section.key"
			class="space-y-3"
			:data-testid="`programs-${section.key}`"
		>
			<h2 v-if="sections.length > 1" class="text-lg-semibold text-ink-gray-9">
				{{ section.title }}
			</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				<router-link
					v-for="program in section.items"
					:key="program.name"
					:to="{
						name: 'ProgramDetail',
						params: { programName: program.name },
					}"
					class="flex flex-col rounded-lg border p-4 hover:border-outline-gray-3"
				>
					<span class="text-base-medium text-ink-gray-9">
						{{ program.title || program.name }}
					</span>
					<span
						v-if="program.description"
						class="mt-1 line-clamp-3 text-p-sm text-ink-gray-6"
					>
						{{ program.description }}
					</span>
					<span class="mt-3 text-p-sm text-ink-gray-5">
						{{ plural(program.course_count || 0, COURSES) }}
					</span>
					<span v-if="'progress' in program" class="mt-3 block">
						<ProgressBar :progress="program.progress" />
						<span class="mt-1 block text-p-sm text-ink-gray-7">
							{{ __('{0}% completed').format(Math.ceil(program.progress)) }}
						</span>
					</span>
				</router-link>
			</div>
		</section>
		<EmptyStateLayout
			v-if="programs.data && !sections.length"
			:name="__('Programs')"
			icon="lucide-graduation-cap"
		/>
	</div>
</template>
<script setup lang="ts">
import { createResource } from 'frappe-ui'
import { computed } from 'vue'
import ProgressBar from '@/components/ProgressBar.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { COURSES, plural } from '@/utils/plural'

type ProgramCard = {
	name: string
	title?: string | null
	description?: string | null
	course_count?: number
	progress?: number
}

const programs = createResource({
	url: 'lms.lms.utils.get_programs',
	auto: true,
})

const sections = computed(() => {
	const data = programs.data as {
		enrolled: ProgramCard[]
		published: ProgramCard[]
	} | null
	return [
		{ key: 'enrolled', title: __('My programs'), items: data?.enrolled ?? [] },
		{
			key: 'published',
			title: __('Other programs'),
			items: data?.published ?? [],
		},
	].filter((section) => section.items.length)
})
</script>
