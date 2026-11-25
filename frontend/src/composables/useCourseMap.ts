import { computed, watch, type ComputedRef } from 'vue'
import { createResource } from 'frappe-ui'
import type { Resource } from '@/types'
import type { ProgramData } from '@/utils/courseProgram'
import { useSpace } from '@/stores/space'
import { withSpace } from '@/utils/space'

// frappe-ui's resource has these too; the shared Resource type leaves them out.
export type CourseMapResource = Resource<{ data: ProgramData } | null> & {
	fetched?: boolean
	reset?(): void
	abort?(): void
}

/**
 * The course map, for the whole course page: the overview builds its programme
 * and document from it, and the page decides from it whether the course has a
 * skills tab (learning-services#854). One request for both, made by the page.
 *
 * The map comes from our own app: Learning knows nothing about objectives or
 * their coverage. Same timing rule as the outline — `auto: false` plus a
 * watch, because firing before the course name arrives sends `undefined` and
 * the server answers 500.
 */
export function useCourseMap(courseName: () => string | undefined): {
	courseMap: CourseMapResource
	mapSettled: ComputedRef<boolean>
} {
	const space = useSpace()

	const courseMap = createResource({
		url: 'lms_frappe_app.api.public.course_map',
		// GET, not the default POST: the endpoint is whitelisted for GET only and
		// answers 403 to anything else. It reads, so GET is also what it means.
		method: 'GET',
		makeParams() {
			const course = courseName()
			// The documents' fill is the chosen space's (learning-services#347).
			return withSpace({ course }, space.paramFor(course))
		},
		auto: false,
	}) as CourseMapResource

	watch(
		courseName,
		(name: string | undefined) => {
			// The rejection has to be handled here: createResource rethrows in
			// handleError no matter what, and a Learning site without
			// lms_frappe_app answers AppNotInstalledError. Unhandled, it surfaces
			// as an application error on every course page — which is exactly how
			// it took down three Cypress specs. No app, no map, no noise.
			// Another course's map is no answer for this one: the page is reused
			// from course to course (learning-services#636). A request still on
			// its way for the previous course is called off, not just forgotten:
			// arriving after the reset, it would hand this course the previous
			// one's tabs (learning-services#854). frappe-ui drops an abort quietly.
			courseMap.abort?.()
			courseMap.reset?.()
			if (name)
				space
					.load()
					.then(() => courseMap.fetch())
					.catch(() => {})
		},
		{ immediate: true }
	)

	// Answered, whatever the answer — an empty one included, or whatever waits
	// for it would wait for good.
	const mapSettled = computed<boolean>(
		() => Boolean(courseMap.fetched) || Boolean(courseMap.error)
	)

	return { courseMap, mapSettled }
}
