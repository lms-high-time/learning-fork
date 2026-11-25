import { defineComponent, h, type PropType } from 'vue'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import { useCourseMap } from '@/composables/useCourseMap'
import type { CourseDetails, Resource } from '@/types'

/**
 * CourseOverview as the course page mounts it: the page asks for the course
 * map and hands it down (learning-services#854). Tests that drive the map
 * through a mocked `createResource` mount this host instead of the overview,
 * so the request still happens — and in the page's order.
 */
export const CourseOverviewHost = defineComponent({
	name: 'CourseOverviewHost',
	props: {
		course: {
			type: Object as PropType<Resource<CourseDetails | null>>,
			required: true,
		},
	},
	setup(props) {
		const { courseMap } = useCourseMap(() => props.course.data?.name)
		return () => h(CourseOverview, { course: props.course, courseMap })
	},
})
