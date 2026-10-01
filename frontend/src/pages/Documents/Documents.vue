<template>
	<div>
		<PageHeader
			:breadcrumbs="[
				{ label: __('My documents'), route: { name: 'Documents' } },
			]"
		/>

		<div
			v-if="!isLoggedIn"
			class="flex flex-col items-center gap-3 px-4 py-16 text-center"
		>
			<p class="max-w-md text-p-base text-ink-gray-7">
				{{
					__('Course documents are built as you study. Log in to see yours.')
				}}
			</p>
			<!-- The login page is outside the app: a plain link in the same tab,
			drawn as frappe-ui's solid button (its `link` opens a new tab). -->
			<a
				href="/login?redirect-to=/lms/documents"
				class="inline-flex h-8 items-center rounded-4 bg-surface-gray-10 px-2.5 text-base-medium text-ink-base hover:bg-surface-gray-9"
				>{{ __('Log in') }}</a
			>
		</div>

		<div
			v-else-if="progress.loading && !answer"
			class="flex justify-center p-10"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<div
			v-else-if="failed"
			class="flex flex-col items-center gap-3 px-4 py-16 text-center"
			data-testid="documents-error"
		>
			<p class="max-w-md text-p-base text-ink-gray-7">
				{{
					__(
						'Could not load your documents. What you wrote is safe — try again.'
					)
				}}
			</p>
			<Button :label="__('Try again')" @click="refresh" />
		</div>

		<div
			v-else-if="!courses.length"
			class="flex flex-col items-center gap-3 px-4 py-16 text-center"
			data-testid="documents-empty"
		>
			<p class="max-w-md text-p-base text-ink-gray-7">
				{{
					__(
						'None of your courses builds a document yet. Documents appear here once you start a course that builds them.'
					)
				}}
			</p>
			<Button :route="{ name: 'Courses' }" :label="__('To courses')" />
		</div>

		<div v-else class="mx-auto max-w-3xl space-y-7 px-2 py-6 sm:px-4">
			<!-- Opened from a lesson's chat on one course (#303): say so, and let
			the student see the rest. -->
			<div
				v-if="filtered"
				class="flex flex-wrap items-center gap-3 px-3 sm:px-4"
				data-testid="documents-filter"
			>
				<span
					class="inline-flex items-center gap-1 rounded-full bg-surface-gray-2 py-1 pe-1 ps-3 text-sm text-ink-gray-8"
				>
					{{ __('Course: {0}').format(shown[0]?.title ?? '') }}
					<router-link
						:to="{ name: 'Documents' }"
						:aria-label="__('All documents')"
						class="flex size-6 items-center justify-center rounded-full text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-8"
					>
						<span class="lucide-x size-3.5" aria-hidden="true" />
					</router-link>
				</span>
			</div>

			<section v-for="course in shown" :key="course.id">
				<h2
					class="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-ink-gray-5 sm:px-4"
				>
					{{ course.title }}
				</h2>
				<p
					v-if="documentToFill(course, space.isOrganization)"
					class="mx-3 mb-1 rounded bg-surface-gray-2 px-3 py-2 text-p-sm text-ink-gray-7 sm:mx-4"
					data-testid="fill-document-hint"
				>
					{{
						__(
							"The course is behind you, and the company's document is not complete yet. Fill it in here, or ask your agent: “let's fill in the document for the company”."
						)
					}}
					<a href="/agent" class="underline">{{ __('Connect your agent') }}</a>
				</p>
				<DocumentRow
					v-for="doc in course.documents"
					:key="doc.artifact"
					:course="course.id"
					:doc="doc"
				/>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
	Button,
	createResource,
	LoadingIndicator,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import { useSpace } from '@/stores/space'
import { documentToFill } from '@/utils/space'
import { byRecent, type CourseDocuments } from '@/utils/documentList'
import DocumentRow from '@/components/Documents/DocumentRow.vue'
import { sessionStore } from '@/stores/session'

const { isLoggedIn } = sessionStore()
const space = useSpace()
if (isLoggedIn) space.load()
const route = useRoute()

// The student's courses with their documents — the same summary the agent
// reads, so the counts agree.
const progress = createResource({
	url: 'lms_frappe_app.api.student.get_my_progress',
	method: 'GET',
	auto: Boolean(isLoggedIn),
})

const answer = computed(
	() =>
		progress.data as {
			ok?: boolean
			data?: { courses?: CourseDocuments[] }
		} | null
)
// A refusal or a failed request is not «no documents»: the student would
// think what they wrote is gone.
// A failed refresh keeps the list it had: frappe-ui leaves the previous data
// in place, and the page shouldn't empty under the student's eyes.
const failed = computed(
	() => (!answer.value && Boolean(progress.error)) || answer.value?.ok === false
)

// Courses with documents, the most recently written first.
const courses = computed<CourseDocuments[]>(() =>
	byRecent(
		(answer.value?.data?.courses ?? []).filter((c) => c.documents?.length)
	)
)

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

// The agent writes to a document meanwhile: the counts follow without a
// reload (learning-services#348).
const socket = inject<{
	on: (event: string, handler: () => void) => void
	off: (event: string, handler: () => void) => void
} | null>('$socket', null)
// frappe-ui rethrows a failed request; the page shows it, nothing to catch.
const refresh = () => progress.reload().catch(() => {})
onMounted(() => socket?.on('artifact_updated', refresh))
onBeforeUnmount(() => socket?.off('artifact_updated', refresh))

usePageMeta(() => ({ title: __('My documents') }))
</script>
