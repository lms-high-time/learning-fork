<template>
	<div class="space-y-4" data-testid="course-program">
		<ProgramMap
			:chapters="program.chapters"
			:nextLesson="program.next_lesson"
			:current="current"
			@select="select"
		/>

		<!-- overflow-hidden: the slides' own width must not leak into the page's
		scroll width, which it did through the layout's scrolling main. -->
		<div
			class="relative overflow-hidden"
			role="region"
			:aria-roledescription="__('carousel')"
			:aria-label="__('Lessons of the course')"
			tabindex="0"
			@keydown.left.prevent="select(current - 1)"
			@keydown.right.prevent="select(current + 1)"
		>
			<div
				ref="scroller"
				class="slides"
				data-testid="program-slides"
				:style="height ? { height: `${height}px` } : undefined"
			>
				<div
					v-for="(lesson, index) in lessons"
					:key="lesson.id"
					:ref="(el) => (slides[index] = el as HTMLElement)"
					class="slide"
					:class="{ 'is-current': index === current }"
					:data-index="index"
					:aria-hidden="index === current ? undefined : 'true'"
					@click="index !== current && select(index)"
				>
					<LessonSlide
						:lesson="lesson"
						:status="lessonStatus(lesson, program.next_lesson)"
						:position="index + 1"
						:total="lessons.length"
						:lessonUrl="lessonUrl(lesson)"
						:courseName="courseName"
					/>
				</div>
			</div>

			<Button
				v-if="!isMobile"
				class="arrow start-0"
				variant="outline"
				:disabled="current === 0"
				:label="__('Previous lesson')"
				@click="select(current - 1)"
			>
				<template #icon>
					<span class="lucide-chevron-left size-4" />
				</template>
			</Button>
			<Button
				v-if="!isMobile"
				class="arrow end-0"
				variant="outline"
				:disabled="current === lessons.length - 1"
				:label="__('Next lesson')"
				@click="select(current + 1)"
			>
				<template #icon>
					<span class="lucide-chevron-right size-4" />
				</template>
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { useScreenSize } from '@/utils/composables'
import ProgramMap from '@/components/CourseProgram/ProgramMap.vue'
import LessonSlide from '@/components/CourseProgram/LessonSlide.vue'
import {
	flattenLessons,
	lessonStatus,
	startIndex,
	type ProgramData,
} from '@/utils/courseProgram'

// The course program: a map of the lessons and a slider of lesson cards, in
// place of the honeycomb and the outline (learning-services#322). Data comes
// from lms_frappe_app's course_map. Each slide links to its lesson page; the
// course card holds the one button into study (learning-services#326).

const props = defineProps<{
	program: ProgramData
	courseName: string
}>()

const router = useRouter()
const { isMobile } = useScreenSize()

const lessons = computed(() => flattenLessons(props.program.chapters))
const current = ref(startIndex(lessons.value, props.program.next_lesson))
const scroller = ref<HTMLElement | null>(null)
const slides: HTMLElement[] = []

const reducedMotion = (): boolean =>
	typeof window !== 'undefined' &&
	window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function scrollTo(index: number, smooth: boolean): void {
	const slide = slides[index]
	const box = scroller.value
	if (!slide || !box) return
	// The scroller alone moves: scrollIntoView would drag the page along with it.
	const left = slide.offsetLeft - (box.clientWidth - slide.clientWidth) / 2
	box.scrollTo?.({
		left,
		behavior: smooth && !reducedMotion() ? 'smooth' : 'auto',
	})
}

function select(index: number): void {
	if (index < 0 || index >= lessons.value.length) return
	current.value = index
	scrollTo(index, true)
}

// The lesson page offers the way in, or a log-in or enrolment to someone who
// cannot study yet.
function lessonUrl(lesson: { chapterIndex: number; id: string }): string {
	const chapter = props.program.chapters[lesson.chapterIndex]
	const lessonNumber = chapter.lessons.findIndex((l) => l.id === lesson.id) + 1
	return router.resolve({
		name: 'Lesson',
		params: {
			courseName: props.courseName,
			chapterNumber: lesson.chapterIndex + 1,
			lessonNumber,
		},
	}).href
}

let observer: IntersectionObserver | null = null
let resizer: ResizeObserver | null = null

// As tall as the card on screen, not the longest lesson: a short lesson
// otherwise sat above an empty band as tall as the difference
// (learning-services#325). Taller neighbours are cut off at the bottom — they
// are only edges anyway.
const height = ref<number | null>(null)

function measure(): void {
	const card = slides[current.value]?.firstElementChild as HTMLElement | null
	if (card?.offsetHeight) height.value = card.offsetHeight
}

watch(current, () => nextTick(measure))

onMounted(async () => {
	await nextTick()
	scrollTo(current.value, false)
	measure()
	if (typeof ResizeObserver !== 'undefined') {
		// A card grows when its topics unfold, and every card reflows with the page.
		resizer = new ResizeObserver(() => measure())
		slides.forEach((slide) => {
			const card = slide?.firstElementChild
			if (card) resizer?.observe(card)
		})
	}
	if (typeof IntersectionObserver === 'undefined' || !scroller.value) return
	// A swipe moves the slides without telling us; the slide that settles in the
	// middle becomes the current one.
	observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && entry.intersectionRatio >= 0.6)
					current.value = Number((entry.target as HTMLElement).dataset.index)
			}
		},
		{ root: scroller.value, threshold: [0.6] }
	)
	slides.forEach((slide) => slide && observer?.observe(slide))
})

onBeforeUnmount(() => {
	observer?.disconnect()
	resizer?.disconnect()
})
</script>

<style scoped>
.slides {
	display: flex;
	/* Each card as tall as its own lesson: stretching to the longest left a gap
	   between a short lesson's topics and its button. */
	align-items: flex-start;
	gap: 1rem;
	overflow-x: auto;
	overflow-y: hidden;
	scroll-snap-type: x mandatory;
	transition: height 200ms ease;
	scrollbar-width: none;
	/* Room for the first and last slides to sit in the middle too. */
	padding-inline: calc((100% - var(--slide-width)) / 2);
	--slide-width: min(35rem, 85%);
	--edge: calc((100% - var(--slide-width)) / 2);
	/* The neighbours fade out towards the edges rather than end in cut-off
	   words (learning-services#326): enough to show there is more, no more. */
	-webkit-mask-image: linear-gradient(
		90deg,
		transparent,
		#000 var(--edge),
		#000 calc(100% - var(--edge)),
		transparent
	);
	mask-image: linear-gradient(
		90deg,
		transparent,
		#000 var(--edge),
		#000 calc(100% - var(--edge)),
		transparent
	);
}

.slides::-webkit-scrollbar {
	display: none;
}

.slide {
	flex: 0 0 var(--slide-width);
	scroll-snap-align: center;
	opacity: 0.35;
	transition: opacity 150ms ease;
}

.slide.is-current {
	opacity: 1;
}

/* A neighbour's edge is a way to it, not a way into its lesson: a click there
   scrolls the slider rather than following the neighbour's button. */
.slide:not(.is-current) {
	cursor: pointer;
}

.slide:not(.is-current) > * {
	pointer-events: none;
}

@media (max-width: 639px) {
	.slides {
		--slide-width: calc(100% - 2rem);
		gap: 0.5rem;
	}
}

@media (prefers-reduced-motion: reduce) {
	.slide,
	.slides {
		transition: none;
	}
}

.arrow {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
}
</style>
