<template>
	<SkeletonLoader v-if="!course.data" variant="course-page" />
	<div v-else class="p-5">
		<div
			class="flex flex-col md:flex-row items-start justify-between w-full gap-x-8 gap-y-8"
		>
			<div class="w-full md:w-2/3 space-y-10 min-w-0">
				<section class="space-y-4">
					<h1 class="text-4xl-semibold text-ink-gray-9">
						{{ course.data.title }}
					</h1>
					<div
						class="flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-gray-7"
					>
						<template v-if="course.data.category">
							<router-link
								:to="{
									name: 'Courses',
									query: { category: course.data.category },
								}"
								class="flex items-center gap-1.5 font-medium hover:text-ink-gray-9"
							>
								<span class="lucide-tag size-4" />
								<span>{{ course.data.category }}</span>
							</router-link>
							<span class="lucide-dot size-5 text-ink-gray-7" />
						</template>
						<template v-if="Number(course.data.rating) > 0">
							<div class="flex items-center gap-1">
								<LucideStar class="size-4 text-transparent fill-yellow-500" />
								<span class="font-medium text-ink-gray-9">{{
									formatRating(course.data.rating)
								}}</span>
								<span v-if="course.data.rating_count">
									({{ formatAmount(course.data.rating_count) }})
								</span>
							</div>
							<span class="lucide-dot size-5 text-ink-gray-7" />
						</template>
						<template v-if="course.data.enrollments">
							<div class="flex items-center gap-1.5">
								<span class="lucide-users-round size-4" />
								<span>{{
									plural(
										course.data.enrollments,
										STUDENTS,
										formatAmount(course.data.enrollments)
									)
								}}</span>
							</div>
							<span class="lucide-dot size-5 text-ink-gray-7" />
						</template>
						<div
							v-if="course.data.instructors?.length"
							class="flex items-center"
						>
							<span
								class="h-6 me-1"
								:class="{
									'avatar-group overlap': course.data.instructors.length > 1,
								}"
							>
								<UserAvatar
									v-for="instructor in course.data.instructors"
									:key="instructor.name"
									:user="instructor"
								/>
							</span>
							<CourseInstructors :instructors="course.data.instructors" />
						</div>
					</div>
					<div v-if="course.data.tags" class="flex flex-wrap gap-2">
						<Badge
							v-for="tag in course.data.tags.split(', ')"
							:key="tag"
							theme="gray"
							size="lg"
						>
							{{ tag }}
						</Badge>
					</div>
					<!-- A tester sees the course before anyone else: say so, and where
					their remarks go (learning-services#393). -->
					<div
						v-if="isTester"
						data-testid="course-tester-note"
						class="flex items-start gap-2 rounded-md bg-surface-blue-1 px-3 py-2.5 text-p-sm text-ink-gray-8"
					>
						<span
							class="lucide-flask-conical size-4 shrink-0 mt-0.5 text-ink-blue-3"
						/>
						<span>
							{{
								course.data.published
									? __(
											'You test this course. What seems wrong or awkward, tell the tutor during the session: it reaches the author.'
									  )
									: __(
											'The course is not published yet: you test it before everyone else. What seems wrong or awkward, tell the tutor during the session: it reaches the author.'
									  )
							}}
						</span>
					</div>
					<p
						v-if="course.data.short_introduction"
						class="text-ink-gray-7 leading-6"
					>
						{{ course.data.short_introduction }}
					</p>
					<div class="md:hidden space-y-4">
						<CourseCardOverlay :course="course" :notify="notify" />
						<CourseDocumentCard
							:documents="documents"
							:courseName="course.data.name"
							:enrolled="Boolean(course.data.membership)"
						/>
					</div>
				</section>

				<!-- An announced course shows what it will teach, not how: its
				programme is still being built (learning-services#389). -->
				<section v-if="upcoming" data-testid="course-announcement">
					<h2 class="text-3xl-semibold text-ink-gray-9 mb-4">
						{{ __('After the course you will be able to') }}
					</h2>
					<!-- Until the map answers, a placeholder: «the course is in the
					works» in its place read as a course with nothing in it
					(learning-services#391). -->
					<div
						v-if="!mapLoaded"
						data-testid="course-announcement-loading"
						class="space-y-3"
						aria-hidden="true"
					>
						<div
							v-for="width in ['w-11/12', 'w-9/12', 'w-10/12']"
							:key="width"
							class="h-4 rounded bg-surface-gray-2 animate-pulse"
							:class="width"
						/>
					</div>
					<ul
						v-else-if="objectives.length"
						class="list-disc ps-5 space-y-2 text-ink-gray-8 leading-6"
					>
						<li v-for="objective in objectives" :key="objective">
							{{ objective }}
						</li>
					</ul>
					<p v-else class="text-ink-gray-5">
						{{ __('The course is in the works.') }}
					</p>
				</section>

				<!-- The program replaces both the old honeycomb map and the outline:
				the same lessons, once, with each one's status and topics
				(learning-services#322). Without lms_frappe_app the outline stays. -->
				<section v-else-if="program" data-testid="course-program-section">
					<h2 class="text-3xl-semibold text-ink-gray-9 mb-4">
						{{ __('Course program') }}
					</h2>
					<CourseProgram :program="program" :courseName="course.data.name" />
				</section>

				<section v-else>
					<div class="flex items-baseline justify-between gap-4 mb-4">
						<h2 class="text-3xl-semibold text-ink-gray-9">
							{{ __('Course content') }}
						</h2>
						<div class="text-base text-ink-gray-5">
							{{ outlineStats }}
						</div>
					</div>
					<div class="border rounded-md p-2">
						<SkeletonLoader
							v-if="outline.loading && !outline.data"
							variant="course-outline"
							:count="10"
						/>
						<div
							v-else-if="!hasCourseContent"
							class="flex items-center justify-center px-4 py-10 text-center"
						>
							<span class="text-sm text-ink-gray-5">
								{{ __('Course Content coming soon!') }}
							</span>
						</div>
						<CourseOutline
							v-else
							:courseName="course.data.name"
							:getProgress="course.data.membership ? true : false"
							:editorLinks="isCourseAdmin"
						/>
					</div>
				</section>

				<!-- A description that only repeats the introduction above says it
				twice; an announcement page is short enough for that to show. -->
				<section
					v-if="course.data.description && !descriptionRepeatsIntro"
					data-testid="course-about"
					class="space-y-3"
				>
					<h2 class="text-3xl-semibold text-ink-gray-9">
						{{ __('About this course') }}
					</h2>
					<div
						v-safe-html:rich="course.data.description"
						class="ProseMirror prose prose-sm max-w-none !whitespace-normal prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2"
					/>
				</section>

				<CourseReviews
					:courseName="course.data.name"
					:avg_rating="course.data.rating"
					:membership="course.data.membership || null"
				/>
			</div>

			<aside
				class="hidden md:flex w-80 shrink-0 flex-col space-y-6 self-start sticky top-5"
			>
				<!-- The way in, and what the course leaves you with (#340); the
				author is in the header already (learning-services#326). -->
				<CourseCardOverlay :course="course" :notify="notify" />
				<CourseDocumentCard
					:documents="documents"
					:courseName="course.data.name"
					:enrolled="Boolean(course.data.membership)"
				/>
			</aside>
		</div>

		<RelatedCourses :courseName="course.data.name" class="mt-12" />
	</div>
</template>

<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { call, createResource, Badge } from 'frappe-ui'
import { formatAmount, formatRating } from '@/utils/'
import type {
	CourseDetails,
	OutlineChapter,
	Resource,
	SessionUser,
} from '@/types'
import CourseCardOverlay from '@/components/CourseCardOverlay.vue'
import CourseDocumentCard from '@/components/CourseDocumentCard.vue'
import CourseOutline from '@/components/CourseOutline.vue'
import CourseProgram from '@/components/CourseProgram/CourseProgram.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseReviews from '@/components/CourseReviews.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import RelatedCourses from '@/components/RelatedCourses.vue'
import type { ProgramData } from '@/utils/courseProgram'
import { useSpace } from '@/stores/space'
import { withSpace } from '@/utils/space'
import { LESSONS, SECTIONS, STUDENTS, plural } from '@/utils/plural'

const props = defineProps<{
	course: Resource<CourseDetails | null>
}>()

const user = inject<SessionUser>('$user')

const isCourseInstructor = computed<boolean>(() =>
	(props.course.data?.instructors || []).some(
		(i) => i.name === user?.data?.name
	)
)

const isCourseAdmin = computed<boolean>(
	() => Boolean(user?.data?.is_moderator) || isCourseInstructor.value
)

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	makeParams() {
		return { course: props.course.data?.name, progress: false }
	},
	auto: false,
}) as Resource<OutlineChapter[]>

watch(
	() => props.course.data?.name,
	(name) => {
		if (name) outline.fetch()
	},
	{ immediate: true }
)

const space = useSpace()

// The map comes from our own app: Learning knows nothing about objectives or
// their coverage. Same timing rule as the outline above — `auto: false` plus a
// watch, because firing before the course name arrives sends `undefined` and
// the server answers 500.
const courseMap = createResource({
	url: 'lms_frappe_app.api.public.course_map',
	// GET, not the default POST: the endpoint is whitelisted for GET only and
	// answers 403 to anything else. It reads, so GET is also what it means.
	method: 'GET',
	makeParams() {
		const course = props.course.data?.name
		// The documents' fill is the chosen space's (learning-services#347).
		return withSpace({ course }, space.paramFor(course))
	},
	auto: false,
}) as Resource<{ data: ProgramData } | null>

watch(
	() => props.course.data?.name,
	(name) => {
		// The rejection has to be handled here: createResource rethrows in
		// handleError no matter what, and a Learning site without
		// lms_frappe_app answers AppNotInstalledError. Unhandled, it surfaces
		// as an application error on every course page — which is exactly how
		// it took down three Cypress specs. No app, no map, no noise.
		if (name)
			space
				.load()
				.then(() => courseMap.fetch())
				.catch(() => {})
	},
	{ immediate: true }
)

// The program needs lessons, not objectives: a lesson without them still gets
// its slide, just without the topics. No lessons — the outline's own empty state.
// The documents the course builds, from the same map (#340).
const documents = computed(() => courseMap.data?.data?.documents ?? [])

// An announced course, for anyone not enrolled in it and not managing it:
// Learning knows the flag before the map arrives, so the outline never
// flashes the lessons. Its authors keep the outline and its editor links.
const upcoming = computed<boolean>(
	() =>
		Boolean(props.course.data?.upcoming) &&
		!props.course.data?.membership &&
		!isCourseAdmin.value
)
const objectives = computed<string[]>(
	() => courseMap.data?.data?.objectives ?? []
)
const notify = computed<boolean>(() => Boolean(courseMap.data?.data?.notify))
const mapLoaded = computed<boolean>(() => Boolean(courseMap.data))
const isTester = computed<boolean>(() => Boolean(courseMap.data?.data?.tester))

const plainText = (html: string): string =>
	html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
const descriptionRepeatsIntro = computed<boolean>(() => {
	const intro = props.course.data?.short_introduction?.trim()
	const description = props.course.data?.description
	return Boolean(intro && description && plainText(description) === intro)
})

// A guest who asked to hear of the release comes back from the login page
// with `notify=1`; the wish is carried out here, once — the card is mounted
// twice, for the phone and for the desktop (learning-services#391).
const route = useRoute()
const router = useRouter()
const releaseWish = computed<boolean>(() => route?.query?.notify === '1')

watch(
	() => [releaseWish.value, mapLoaded.value, Boolean(user?.data)],
	([wish, loaded, loggedIn]) => {
		if (!wish || !loaded || !upcoming.value) return
		const { notify: _, ...rest } = route.query
		router?.replace({ query: rest })
		if (!loggedIn || notify.value) return
		call('lms_frappe_app.api.student.notify_when_released', {
			course: props.course.data?.name,
		})
			.then(() => courseMap.fetch())
			.catch(() => {})
	},
	{ immediate: true }
)

const program = computed<ProgramData | null>(() => {
	const data = courseMap.data?.data
	return data?.chapters?.some((chapter) => chapter.lessons.length) ? data : null
})

const outlineStats = computed(() => {
	const chapters = outline.data || []
	const lessonCount = chapters.reduce(
		(acc, c) => acc + (c.lessons?.length || 0),
		0
	)
	const parts: string[] = []
	if (chapters.length) {
		parts.push(plural(chapters.length, SECTIONS))
	}
	if (lessonCount) {
		parts.push(plural(lessonCount, LESSONS))
	}
	return parts.join(' · ')
})

const hasCourseContent = computed(() => {
	const chapters = outline.data || []
	const lessonCount = chapters.reduce(
		(acc, c) => acc + (c.lessons?.length || 0),
		0
	)
	return chapters.length > 0 && lessonCount > 0
})
</script>
