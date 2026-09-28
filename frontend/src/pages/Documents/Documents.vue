<template>
	<div>
		<PageHeader
			:breadcrumbs="[
				{ label: __('My documents'), route: { name: 'Documents' } },
			]"
		/>

		<div v-if="!isLoggedIn" class="p-5 text-p-base text-ink-gray-7">
			{{
				__(
					'Course documents are built as you study and are visible only to you.'
				)
			}}
			<a href="/login?redirect-to=/lms/documents" class="underline">{{
				__('Log in')
			}}</a>
		</div>

		<div
			v-else-if="progress.loading && !courses.length"
			class="flex justify-center p-10"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<div v-else class="mx-auto max-w-3xl space-y-6 p-4 sm:p-5">
			<p v-if="!courses.length" class="text-p-base text-ink-gray-6">
				{{
					__(
						'None of your courses builds a document yet. It will appear here once the course has one.'
					)
				}}
			</p>
			<section v-for="course in shown" :key="course.id" class="space-y-2">
				<h2 class="text-lg-semibold text-ink-gray-9">{{ course.title }}</h2>
				<DocumentCard
					v-for="doc in course.documents"
					:key="doc.artifact"
					:course="course.id"
					:doc="doc"
				/>
			</section>
			<p v-if="filtered" class="text-p-sm">
				<router-link
					:to="{ name: 'Documents' }"
					class="text-ink-gray-7 underline"
				>
					{{ __('All documents') }}
				</router-link>
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { createResource, LoadingIndicator, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import DocumentCard from '@/components/Documents/DocumentCard.vue'
import { sessionStore } from '@/stores/session'

interface DocumentSummary {
	artifact: string
	title: string
	blocks_total: number
	blocks_filled: number
}

interface CourseDocuments {
	id: string
	title: string
	documents: DocumentSummary[]
}

const { isLoggedIn } = sessionStore()
const route = useRoute()

// The student's courses with their documents — the same summary the agent
// reads, so the counts agree.
const progress = createResource({
	url: 'lms_frappe_app.api.student.get_my_progress',
	method: 'GET',
	auto: Boolean(isLoggedIn),
})

const courses = computed<CourseDocuments[]>(() => {
	const answer = progress.data as {
		ok?: boolean
		data?: { courses?: CourseDocuments[] }
	} | null
	return (answer?.data?.courses ?? []).filter((c) => c.documents?.length)
})

// «Мои документы» from a lesson's chat opens on that course (#303); a course
// that is not the student's, or has no documents, shows them all instead.
const filtered = computed(() => {
	const course = route.query.course
	return typeof course === 'string' &&
		courses.value.some((c) => c.id === course)
		? course
		: null
})
const shown = computed(() =>
	filtered.value
		? courses.value.filter((c) => c.id === filtered.value)
		: courses.value
)

usePageMeta(() => ({ title: __('My documents') }))
</script>
