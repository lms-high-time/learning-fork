<template>
	<!-- The course page's «Skills» tab (learning-services#854). The title
	leads it as it leads the overview, so the tab is still the course's page
	and its skills sit under one heading. -->
	<div v-if="course.data" class="p-5 space-y-6">
		<h1 class="text-4xl-semibold text-ink-gray-9">
			{{ course.data.title }}
		</h1>
		<CourseCompetencies :competencies="competencies" />
	</div>
</template>

<script setup lang="ts">
import type { CourseDetails, Resource } from '@/types'
import type { CourseCompetency } from '@/utils/courseProgram'
import CourseCompetencies from '@/components/CourseProgram/CourseCompetencies.vue'

defineProps<{
	course: Resource<CourseDetails | null>
	competencies: CourseCompetency[]
}>()
</script>
