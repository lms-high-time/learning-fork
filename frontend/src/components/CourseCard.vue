<template>
	<div
		v-if="course.title"
		class="flex flex-col h-full rounded-md overflow-auto text-ink-gray-9 bg-surface-elevation-1"
	>
		<div
			class="w-[100%] bg-cover bg-center bg-no-repeat border-x rounded-t-md"
			:class="
				course.image
					? 'h-[168px] border-t'
					: 'min-h-[136px] p-5 border-t-4 border-b bg-surface-gray-1'
			"
			:style="
				course.image
					? { backgroundImage: `url('${encodeURI(course.image)}')` }
					: { borderTopColor: coverColor }
			"
		>
			<!-- <div class="flex items-center flex-wrap relative top-4 px-2 w-fit">
				<div
					v-if="course.featured"
					class="flex items-center gap-x-1 text-xs text-ink-amber-6 bg-surface-base border border-outline-amber-1 px-2 py-0.5 rounded-md me-1 mb-1"
				>
					<Star class="size-3 stroke-2" />
					<span>
						{{ __('Featured') }}
					</span>
				</div>
				<div
					v-if="course.tags"
					v-for="tag in course.tags?.split(', ')"
					class="text-xs border bg-surface-base text-ink-gray-9 px-2 py-0.5 rounded-md mb-1 me-1"
				>
					{{ tag }}
				</div>
			</div> -->
			<div
				v-if="!course.image"
				data-testid="course-card-title"
				class="course-card-title text-xl leading-6 text-ink-gray-9 text-start"
			>
				{{ course.title }}
			</div>
		</div>
		<div class="flex flex-col flex-auto p-4 border-x border-b rounded-b-md">
			<!-- An announcement has no lessons, students or rating yet
			(learning-services#391). -->
			<div
				v-if="!course.upcoming"
				class="flex items-center gap-x-4 mb-2 tabular-nums"
			>
				<div v-if="course.lessons">
					<Tooltip :text="__('Lessons')">
						<span class="flex items-center">
							<span class="lucide-book-open size-4 me-1" />
							{{ course.lessons }}
						</span>
					</Tooltip>
				</div>

				<div v-if="course.enrollments">
					<Tooltip :text="__('Enrolled Students')">
						<span class="flex items-center">
							<span class="lucide-users size-4 me-1" />
							{{ formatAmount(course.enrollments) }}
						</span>
					</Tooltip>
				</div>

				<div v-if="Number(course.rating) > 0" data-testid="course-card-rating">
					<Tooltip :text="__('Average Rating')">
						<span class="flex items-center">
							<LucideStar class="size-4 me-1" />
							{{ formatRating(course.rating) }}
						</span>
					</Tooltip>
				</div>

				<Tooltip v-if="course.featured" :text="__('Featured')">
					<span class="lucide-award size-4 text-ink-amber-6" />
				</Tooltip>
			</div>

			<!-- Announced: in the catalog, not yet open (learning-services#389). -->
			<Badge
				v-if="course.upcoming"
				data-testid="course-card-upcoming"
				theme="orange"
				size="md"
				class="w-fit mb-2 !text-ink-gray-8"
			>
				{{ __('Coming soon') }}
			</Badge>

			<div
				v-if="course.image"
				class="course-card-title leading-6"
				:class="course.title.length > 32 ? 'text-lg' : 'text-2xl'"
			>
				{{ course.title }}
			</div>

			<div class="course-card-intro text-sm">
				{{ course.short_introduction }}
			</div>

			<ProgressBar
				v-if="user && course.membership"
				:progress="course.membership.progress"
			/>

			<div v-if="user && course.membership" class="text-sm mt-2 mb-4">
				{{ Math.ceil(course.membership.progress) }}% {{ __('completed') }}
			</div>

			<div class="flex items-center justify-between mt-auto">
				<div v-if="SHOW_COURSE_AUTHORS" class="flex avatar-group overlap">
					<div
						class="h-6 me-1"
						:class="{ 'avatar-group overlap': course.instructors.length > 1 }"
					>
						<UserAvatar
							v-for="instructor in course.instructors"
							:key="instructor.username || instructor.name"
							:user="instructor"
						/>
					</div>
					<CourseInstructors :instructors="course.instructors" />
				</div>

				<div class="flex items-center gap-x-2">
					<div v-if="course.paid_course" class="font-semibold">
						{{ course.price }}
					</div>

					<Tooltip
						v-if="course.paid_certificate || course.enable_certification"
						:text="__('Get Certified')"
					>
						<span class="lucide-graduation-cap size-5 text-ink-gray-7" />
					</Tooltip>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { sessionStore } from '@/stores/session'
import { Badge, Tooltip } from 'frappe-ui'
import { formatAmount, formatRating } from '@/utils'
import { theme } from '@/utils/theme'
import { computed, watch } from 'vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { SHOW_COURSE_AUTHORS } from '@/utils/courseAuthors'

const { user } = sessionStore()

const props = defineProps({
	course: {
		type: Object,
		default: null,
	},
})

const coverColor = computed(() => {
	let color = props.course.card_gradient?.toLowerCase() || 'blue'
	return `var(--${color}-400)`
})
</script>
<style>
.course-card-pills {
	background: #ffffff;
	margin-left: 0;
	margin-right: 0.5rem;
	padding: 3.5px 8px;
	font-size: 11px;
	text-align: center;
	letter-spacing: 0.011em;
	text-transform: uppercase;
	font-weight: 600;
	width: fit-content;
}

.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}

.avatar-group.overlap .avatar + .avatar {
	margin-inline-start: calc(-8px);
}

.course-card-title {
	font-family: 'Literata', Georgia, serif;
	font-weight: 500;
	letter-spacing: -0.01em;
}

/* The promise of the course is what the card sells: room for all of it. */
.course-card-intro {
	display: -webkit-box;
	-webkit-line-clamp: 6;
	-webkit-box-orient: vertical;
	text-overflow: ellipsis;
	width: 100%;
	overflow: hidden;
	margin: 0.25rem 0 1.25rem;
	line-height: 1.5;
}
</style>
