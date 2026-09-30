<template>
	<div class="border-2 rounded-md min-w-80 max-w-sm">
		<VideoPreview
			:video-link="course.data?.video_link"
			:fallback-image="course.data?.image"
		/>
		<div class="p-5">
			<!-- An announcement has no price to lead with yet: its state does
			(learning-services#391). -->
			<div
				v-if="course.data?.upcoming && !isAdmin"
				class="text-2xl-semibold text-ink-gray-9 mb-2"
			>
				{{ __('Course in the works') }}
			</div>
			<div v-else class="text-3xl-semibold text-ink-gray-9 mb-4">
				{{ priceLabel }}
			</div>
			<div v-if="!readOnlyMode">
				<!-- A program in set order keeps this course shut until the previous
				one is passed; the server refuses it too (learning-services#405).
				Not on an announcement: nobody enrols in one anyway, and the lock
				would hide asking to hear of its release. -->
				<div
					v-if="lock && !isAdmin && !course.data?.upcoming"
					data-testid="course-program-lock"
					class="space-y-3"
				>
					<p class="text-p-sm text-ink-gray-7">
						{{
							__('The program «{0}» goes in order: first pass «{1}».').format(
								lock.title,
								lock.locked_by?.title
							)
						}}
					</p>
					<router-link
						:to="{
							name: 'CourseDetail',
							params: { courseName: lock.locked_by?.id },
						}"
						class="block"
					>
						<Button variant="solid" size="md" class="w-full">
							{{ __('Go to «{0}»').format(lock.locked_by?.title) }}
						</Button>
					</router-link>
				</div>
				<div v-else-if="course.data?.membership" class="space-y-2">
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
				<!-- An announced course takes no enrolments; the one thing to do is
				ask to hear when it opens (learning-services#389). -->
				<div
					v-else-if="course.data?.upcoming && !isAdmin"
					data-testid="course-upcoming"
					class="space-y-3"
				>
					<p class="text-p-sm text-ink-gray-7">
						{{ __('Enrollment opens when the course is released.') }}
					</p>
					<div
						v-if="subscribed"
						data-testid="course-notify-done"
						class="space-y-2"
					>
						<div class="flex items-start gap-2 text-p-sm text-ink-gray-8">
							<span
								class="lucide-circle-check size-4 shrink-0 mt-0.5 text-ink-green-6"
							/>
							<span>
								{{
									__(
										"You're on the list. We'll write to {0} when it is out."
									).format(userEmail)
								}}
							</span>
						</div>
						<button
							type="button"
							data-testid="course-unnotify"
							class="text-p-sm text-ink-gray-6 underline underline-offset-2 hover:text-ink-gray-8"
							:disabled="notifying"
							@click="stopNotify()"
						>
							{{ __('Unsubscribe') }}
						</button>
					</div>
					<Button
						v-else
						data-testid="course-notify"
						variant="solid"
						size="md"
						class="w-full"
						:loading="notifying"
						@click="notifyWhenReleased()"
					>
						<template #prefix>
							<span class="lucide-bell size-4" />
						</template>
						<span>{{ __('Notify me when it is out') }}</span>
					</Button>
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
			<!-- Where this course stands in a chain of courses (#405). -->
			<ul
				v-if="programs.length"
				data-testid="course-programs"
				class="mt-4 space-y-1 border-t pt-3"
			>
				<li v-for="program in programs" :key="program.program">
					<router-link
						:to="programRoute(program)"
						class="text-p-sm text-ink-gray-7 underline-offset-2 hover:underline"
					>
						{{
							__('Course {0} of {1} in the program «{2}»').format(
								program.number,
								program.total,
								program.title
							)
						}}
					</router-link>
					<!-- What the chain leads to after this course (learning-services#443). -->
					<router-link
						v-if="program.next"
						:to="{
							name: 'CourseDetail',
							params: { courseName: program.next.id },
						}"
						data-testid="course-program-next"
						class="mt-1.5 block text-p-sm text-ink-gray-7 underline-offset-2 hover:underline"
					>
						{{ __('Next course: «{0}»').format(program.next.title) }}
					</router-link>
				</li>
			</ul>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { Badge, Button, call, createResource, toast } from 'frappe-ui'
import { useRouter } from 'vue-router'
import CertificationLinks from '@/components/CertificationLinks.vue'
import VideoPreview from '@/components/VideoPreview.vue'
import { useTelemetry } from 'frappe-ui/frappe'
import { openExternal } from '@/utils/openExternal'
import { safeUrl } from '@/utils/safeUrl'
import { useSpace } from '@/stores/space'
import { withSpace } from '@/utils/space'
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
		/** Whether the viewer already asked to hear of the release of an
		 * announced course; the page reads it from the course map. */
		notify?: boolean
	}>(),
	{ notify: false }
)

const subscribed = ref<boolean>(props.notify)
const notifying = ref<boolean>(false)
watch(
	() => props.notify,
	(value) => {
		if (value) subscribed.value = true
	}
)

function notifyWhenReleased() {
	if (!user.data) {
		toast.warning(__('You need to login first to get notified'))
		// Back to this page with the wish in hand: the course page subscribes
		// once the guest has logged in (learning-services#391).
		const back = `${window.location.pathname}?notify=1`
		setTimeout(() => {
			window.location.href = `/login?redirect-to=${encodeURIComponent(back)}`
		}, 500)
		return
	}
	const courseName = props.course.data?.name
	if (!courseName) return
	notifying.value = true
	call('lms_frappe_app.api.student.notify_when_released', {
		course: courseName,
	})
		.then((result: { ok: boolean; error?: { message: string } }) => {
			if (!result?.ok) {
				toast.warning(result?.error?.message ?? __('Could not subscribe'))
				return
			}
			subscribed.value = true
			capture('asked_for_course_release', { course: courseName })
		})
		.catch((err: { messages?: string[] } | string) => {
			const msg = typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'
			toast.warning(__(msg))
		})
		.finally(() => {
			notifying.value = false
		})
}

const userEmail = computed<string>(
	() => user.data?.email || user.data?.name || ''
)

function stopNotify() {
	const courseName = props.course.data?.name
	if (!courseName) return
	notifying.value = true
	call('lms_frappe_app.api.student.notify_when_released', {
		course: courseName,
		notify: false,
	})
		.then((result: { ok: boolean; error?: { message: string } }) => {
			if (!result?.ok) {
				toast.warning(result?.error?.message ?? __('Could not unsubscribe'))
				return
			}
			subscribed.value = false
		})
		.catch((err: { messages?: string[] } | string) => {
			const msg = typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'
			toast.warning(__(msg))
		})
		.finally(() => {
			notifying.value = false
		})
}

// The programs this course is in, and whether one keeps it shut
// (learning-services#405). A guest sees the published ones.
interface CourseProgram {
	program: string
	title: string
	number: number
	total: number
	member: boolean
	// Absent from a server older than learning-app#136.
	next?: { id: string; title: string } | null
	locked_by: { id: string; title: string } | null
}

const programsResource = createResource({
	url: 'lms_frappe_app.api.public.course_programs',
	// GET-only on the server, like the course map.
	method: 'GET',
	makeParams() {
		return { course: props.course.data?.name }
	},
	auto: false,
})

watch(
	() => props.course.data?.name,
	(name) => {
		// A site without lms_frappe_app answers an error: no programs shown.
		if (name) programsResource.fetch().catch(() => {})
	},
	{ immediate: true }
)

const programs = computed<CourseProgram[]>(
	() =>
		(programsResource.data as { data?: { programs: CourseProgram[] } } | null)
			?.data?.programs ?? []
)
const lock = computed(() => programs.value.find((item) => item.locked_by))

// One program page for everyone: it shows the way in to whoever is not a
// member yet (learning-services#417).
const programRoute = (program: CourseProgram) => ({
	name: 'ProgramDetail',
	params: { programName: program.program },
})

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
		return withSpace({ course }, space.paramFor(course))
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
