<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<div
		v-if="details"
		class="mx-auto grid max-w-5xl gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
	>
		<div class="min-w-0">
			<h1 class="text-2xl-semibold text-ink-gray-9">{{ programTitle }}</h1>
			<p
				v-if="details.description"
				class="mt-2 whitespace-pre-line text-p-base text-ink-gray-7"
				data-testid="program-description"
			>
				{{ details.description }}
			</p>
			<p class="mt-2 text-p-sm text-ink-gray-5">
				{{ plural(path.length, COURSES) }} ·
				{{
					details.enforce_course_order
						? __('in order: each course opens after the previous one')
						: __('in any order')
				}}
			</p>

			<!-- The path: numbered steps, each with what it is about and where
			the viewer stands on it (learning-services#417). -->
			<ol class="mt-6 space-y-3" data-testid="program-path">
				<li v-for="(course, index) in path" :key="course.name">
					<router-link
						:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
						class="flex gap-4 rounded-lg border p-4 hover:border-outline-gray-3"
						:data-testid="`program-step-${index + 1}`"
					>
						<span
							class="grid size-8 shrink-0 place-items-center rounded-full border text-p-base-medium"
							:class="
								status(course) === 'completed'
									? 'border-transparent bg-surface-green-3 text-ink-green-3'
									: 'text-ink-gray-7'
							"
							aria-hidden="true"
						>
							<span
								v-if="status(course) === 'completed'"
								class="lucide-check size-4"
							/>
							<template v-else>{{ index + 1 }}</template>
						</span>
						<span class="min-w-0 flex-1">
							<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="text-base-medium text-ink-gray-9">
									{{ course.title }}
								</span>
								<Badge :theme="badgeTheme(course)" size="sm">
									{{ stepLabel(status(course), index) }}
								</Badge>
							</span>
							<span
								v-if="course.short_introduction"
								class="mt-1 line-clamp-2 block text-p-sm text-ink-gray-6"
							>
								{{ course.short_introduction }}
							</span>
						</span>
					</router-link>
				</li>
			</ol>
		</div>

		<!-- One action: join, or go on with the next course. -->
		<aside class="lg:sticky lg:top-5 lg:self-start">
			<div class="space-y-3 rounded-lg border p-5" data-testid="program-action">
				<template v-if="details.is_member">
					<div class="text-p-sm text-ink-gray-7">
						{{ __('You are in this program') }} ·
						{{ __('{0}% completed').format(details.progress ?? 0) }}
					</div>
					<ProgressBar :progress="details.progress ?? 0" />
					<router-link
						v-if="next"
						:to="{ name: 'CourseDetail', params: { courseName: next.name } }"
						class="block"
						data-testid="program-continue"
					>
						<Button variant="solid" size="md" class="w-full">
							{{ __('Continue: {0}').format(next.title) }}
						</Button>
					</router-link>
					<p v-else class="text-p-sm text-ink-gray-6">
						{{ memberWaiting }}
					</p>
				</template>
				<template v-else>
					<Button
						v-if="user?.data"
						variant="solid"
						size="md"
						class="w-full"
						:loading="joining"
						data-testid="program-join"
						@click="join"
					>
						{{ __('Join the program') }}
					</Button>
					<a
						v-else
						:href="safeUrl(loginUrl)"
						class="block"
						data-testid="program-login"
					>
						<Button variant="solid" size="md" class="w-full">
							{{ __('Log in to join') }}
						</Button>
					</a>
					<p class="text-p-sm text-ink-gray-6">
						{{
							details.enforce_course_order
								? __(
										'Courses open one after another: the next one once the previous is passed.'
								  )
								: __('Take the courses in any order.')
						}}
					</p>
					<p
						v-if="upcomingFirst"
						class="text-p-sm text-ink-gray-6"
						data-testid="program-upcoming-note"
					>
						{{
							__(
								'The courses are still in the works. Join, and we will write when the first one opens.'
							)
						}}
					</p>
				</template>
			</div>
		</aside>
	</div>
	<div v-else-if="program.error" class="p-5 text-p-base text-ink-gray-6">
		{{ __('This program is not available.') }}
	</div>
</template>

<script setup lang="ts">
// One page of a program for everyone (learning-services#417): the path in
// numbered steps with the viewer's status on each, and one action — join, or
// go on. Joining used to be a confirmation dialog over the list, and the
// program had no page of its own until one had joined.
import { computed, inject, ref } from 'vue'
import {
	Badge,
	Button,
	call,
	createResource,
	toast,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import {
	firstUpcoming,
	nextStep,
	pathOf,
	stepLabel as label,
	stepStatus,
	type ProgramCourse,
	type ProgramDetails,
	type StepStatus,
} from '@/utils/learningProgram'
import { COURSES, plural } from '@/utils/plural'
import { safeUrl } from '@/utils/safeUrl'

const props = defineProps<{ programName: string }>()
const user = inject<{ data?: { name: string } | null }>('$user')

const program = createResource({
	url: 'lms.lms.utils.get_program_details',
	params: { program_name: props.programName },
	auto: true,
})

const details = computed(() => (program.data as ProgramDetails | null) ?? null)
const path = computed(() => (details.value ? pathOf(details.value) : []))
const programTitle = computed(
	() => details.value?.title || details.value?.name || props.programName
)
const next = computed(() => (details.value ? nextStep(details.value) : null))
const upcomingFirst = computed(() =>
	details.value ? firstUpcoming(details.value) : null
)

const status = (course: ProgramCourse): StepStatus =>
	stepStatus(course, details.value as ProgramDetails)
// A shut step names the course that opens it: the one right before.
const stepLabel = (value: StepStatus, index: number) => label(value, index)
const badgeTheme = (course: ProgramCourse) =>
	({
		upcoming: 'orange',
		completed: 'green',
		locked: 'gray',
		in_progress: 'blue',
		open: 'gray',
	}[status(course)])

const memberWaiting = computed(() =>
	path.value.length && path.value.every((c) => status(c) === 'completed')
		? __('All courses of the program are passed.')
		: __('The next course is still in the works. We will write when it opens.')
)

const loginUrl = computed(
	() =>
		`/login?redirect-to=${encodeURIComponent(
			`/lms/programs/${props.programName}`
		)}`
)

const joining = ref(false)
async function join() {
	joining.value = true
	try {
		await call('lms.lms.utils.enroll_in_program', {
			program: props.programName,
		})
		// While the first course is an announcement, joining is asking to hear
		// when it opens: the same subscription as on the course page.
		const first = upcomingFirst.value
		if (first)
			await call('lms_frappe_app.api.student.notify_when_released', {
				course: first.name,
			}).catch(() => {})
		toast.success(__('You are in the program'))
		await program.reload()
	} catch (error: unknown) {
		const message =
			(error as { messages?: string[] })?.messages?.[0] ??
			__('Could not join the program')
		toast.error(message)
	} finally {
		joining.value = false
	}
}

const breadcrumbs = computed(() => [
	{ label: __('Programs'), route: { name: 'Programs' } },
	{
		label: programTitle.value,
		route: {
			name: 'ProgramDetail',
			params: { programName: props.programName },
		},
	},
])

usePageMeta(() => ({ title: programTitle.value }))
</script>
