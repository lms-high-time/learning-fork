<template>
	<div class="border-2 rounded-md min-w-80 max-w-sm">
		<VideoPreview
			:video-link="course.data?.video_link"
			:fallback-image="course.data?.image"
		/>
		<div class="p-5">
			<div class="text-3xl-semibold text-ink-gray-9 mb-4">
				{{ priceLabel }}
			</div>
			<div v-if="!readOnlyMode">
				<div v-if="course.data?.membership" class="space-y-2">
					<!-- One click into the agent session on the next open lesson; the
					reader stays as the fallback for a site without lms_frappe_app. -->
					<template v-if="entry">
						<a
							:href="safeUrl(entry.study.url)"
							data-testid="course-study"
							class="block"
						>
							<Button variant="solid" size="md" class="w-full">
								<template #prefix>
									<span class="lucide-message-circle size-4" />
								</template>
								<span>{{ studyLabel }}</span>
							</Button>
						</a>
						<div class="text-p-sm text-ink-gray-6">
							{{ __('Next: {0}').format(entry.title) }}
						</div>
					</template>
					<router-link
						v-else
						:to="{
							name: 'Lesson',
							params: {
								courseName: course.data?.name,
								chapterNumber: course?.data?.current_lesson
									? course?.data?.current_lesson.split('-')[0]
									: 1,
								lessonNumber: course?.data?.current_lesson
									? course?.data?.current_lesson.split('-')[1]
									: 1,
							},
						}"
					>
						<Button variant="solid" size="md" class="w-full">
							<template #prefix>
								<span class="lucide-book-text size-4" />
							</template>
							<span>
								{{ __('Continue Learning') }}
							</span>
						</Button>
					</router-link>
					<CertificationLinks :courseName="course.data.name" class="w-full" />
				</div>
				<router-link
					v-else-if="course.data?.paid_course && !isAdmin"
					:to="{
						name: 'Billing',
						params: {
							type: 'course',
							name: course.data.name,
						},
					}"
				>
					<Button variant="solid" size="md" class="w-full text-p-base-medium">
						<template #prefix>
							<span class="lucide-credit-card size-4" />
						</template>
						<span>
							{{ __('Buy this course') }}
						</span>
					</Button>
				</router-link>
				<Badge
					v-else-if="course.data?.disable_self_learning && !isAdmin"
					theme="blue"
					size="lg"
				>
					{{ __('Contact the Administrator to enroll for this course') }}
				</Badge>
				<Button
					v-else-if="!isAdmin"
					@click="enrollStudent()"
					variant="solid"
					class="w-full"
					size="md"
				>
					<template #prefix>
						<span class="lucide-book-text size-4" />
					</template>
					<span>
						{{ __('Enroll Now') }}
					</span>
				</Button>
				<Button
					v-if="canGetCertificate"
					@click="fetchCertificate()"
					variant="subtle"
					class="w-full mt-2"
					size="md"
				>
					<template #prefix>
						<span class="lucide-graduation-cap size-4" />
					</template>
					{{ __('Get Certificate') }}
				</Button>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { Badge, Button, call, createResource, toast } from 'frappe-ui'
import { useRouter } from 'vue-router'
import CertificationLinks from '@/components/CertificationLinks.vue'
import VideoPreview from '@/components/VideoPreview.vue'
import { useTelemetry } from 'frappe-ui/frappe'
import { openExternal } from '@/utils/openExternal'
import { safeUrl } from '@/utils/safeUrl'
import { useSpace } from '@/stores/space'
import type {
	CourseDetails,
	CourseInstructorInfo,
	Resource,
	SessionUser,
} from '@/types'

const router = useRouter()
const user = inject<SessionUser>('$user')!
const space = useSpace()
const readOnlyMode = (window as Window & { read_only_mode?: boolean })
	.read_only_mode
const { capture } = useTelemetry()

const props = withDefaults(
	defineProps<{
		course: Resource<CourseDetails | null>
	}>(),
	{}
)

// The next open lesson and where to study it, from lms_frappe_app
// (learning-services#301). Learning's own `current_lesson` moves only with the
// dwell timer, which this platform switched off (learning-services#305), so it
// would always point at the first lesson.
interface CourseEntry {
	title: string
	completed: boolean
	study: { channel: 'web' | 'agent'; url: string }
}

const courseEntry = createResource({
	url: 'lms_frappe_app.api.public.lesson_entry',
	// GET-only on the server, like the course map; the default POST gets 403.
	method: 'GET',
	makeParams() {
		const course = props.course.data?.name
		return { course, space: space.paramFor(course) }
	},
	auto: false,
})

watch(
	() => [props.course.data?.name, Boolean(props.course.data?.membership)],
	([name, enrolled]) => {
		// Rejections handled: a site without lms_frappe_app answers
		// AppNotInstalledError, and the reader link stays. The space first: the
		// entry names the blocks of the chosen space's document.
		if (name && enrolled)
			space
				.load()
				.then(() => courseEntry.fetch())
				.catch(() => {})
	},
	{ immediate: true }
)

const entry = computed<CourseEntry | null>(
	() => (courseEntry.data as { data?: CourseEntry } | null)?.data ?? null
)

const studyLabel = computed<string>(() => {
	if (entry.value?.study.channel === 'agent') return __('Connect your agent')
	return entry.value?.completed
		? __('Repeat with the agent')
		: __('Continue with the agent')
})

function enrollStudent() {
	if (!user.data) {
		toast.warning(__('You need to login first to enroll for this course'))
		setTimeout(() => {
			window.location.href = `/login?redirect-to=${window.location.pathname}`
		}, 500)
		return
	}
	const courseName = props.course.data?.name
	if (!courseName) return
	// Through our contract, not a bare LMS Enrollment: in an organization's
	// space the enrolment is its allocation and lands in its space and report
	// (learning-services#347).
	space
		.load()
		.then(() =>
			call('lms_frappe_app.api.student.enroll', {
				course: courseName,
				space: space.enrolFor(courseName),
			})
		)
		.then((result: { ok: boolean; error?: { message: string } }) => {
			if (!result?.ok) {
				toast.warning(result?.error?.message ?? __('Could not enroll'))
				return
			}
			capture('enrolled_in_course', { course: courseName })
			toast.success(__('You have been enrolled in this course'))
			setTimeout(() => {
				router.push({
					name: 'Lesson',
					params: {
						courseName,
						chapterNumber: 1,
						lessonNumber: 1,
					},
				})
			}, 1000)
		})
		.catch((err: { messages?: string[] } | string) => {
			const msg = typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'
			toast.warning(__(msg))
			console.error(err)
		})
}

const is_instructor = (): boolean => {
	let user_is_instructor = false
	props.course.data?.instructors.forEach((instructor: CourseInstructorInfo) => {
		if (!user_is_instructor && instructor.name == user.data?.name) {
			user_is_instructor = true
		}
	})
	return user_is_instructor
}

const priceLabel = computed<string>(() => {
	if (props.course.data?.paid_course) return props.course.data?.price || ''
	return __('Free')
})

const canGetCertificate = computed<boolean>(() => {
	return Boolean(
		props.course.data?.enable_certification &&
			(props.course.data?.membership?.progress ?? 0) >= 100
	)
})

const certificate = createResource({
	url: 'lms.lms.doctype.lms_certificate.lms_certificate.create_certificate',
	makeParams(values: { course?: string }) {
		return {
			course: values.course,
		}
	},
	onSuccess(data: { name: string; template: string }) {
		openExternal(
			`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
				data.name
			}&format=${encodeURIComponent(data.template)}`
		)
	},
}) as Resource<{ name: string; template: string } | null>

const fetchCertificate = () => {
	certificate.submit({
		course: props.course.data?.name,
		member: user.data?.name,
	})
}

const isAdmin = computed<boolean>(() => {
	return Boolean(user.data?.is_moderator) || is_instructor()
})
</script>
