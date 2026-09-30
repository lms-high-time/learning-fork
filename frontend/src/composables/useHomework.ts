import { computed, ref, watch, type Ref } from 'vue'
import { createResource, toast } from 'frappe-ui'
import { useSpace } from '@/stores/space'
import { withSpace } from '@/utils/space'
import { postForm, type ContractAnswer } from '@/utils/postForm'
import type { LessonHomeworkData, Submission } from '@/utils/homework'

/**
 * A lesson's homework and the learner's answer in the chosen space
 * (learning-services#439). Read with `homework` — POST, as the server allows;
 * saved with `submit_homework` as a form, so the files go as the browser sends
 * them. One save is one version, whatever it changes.
 */

export type HomeworkSave = {
	answer?: string
	removeFiles: string[]
	files: File[]
}

export function useHomework(lesson: Ref<string>, course: Ref<string>) {
	const spaces = useSpace()
	const resource = createResource({
		url: 'lms_frappe_app.api.student.homework',
		makeParams: () =>
			withSpace({ lesson: lesson.value }, spaces.paramFor(course.value)),
		auto: false,
		// The block is extra to the lesson: a failed read leaves it out rather
		// than raising the app's error toast over the lesson.
		onError: () => {},
	})

	// The space first: the submission is the chosen space's, and a read before
	// it would show another space's and then swap (learning-services#347). A
	// read still on its way for the previous lesson is dropped.
	watch(
		lesson,
		(name: string) => {
			if (!name) return
			resource.abort?.()
			spaces
				.load()
				.then(() => resource.fetch())
				.catch(() => {})
		},
		{ immediate: true }
	)

	const answer = computed(
		() => resource.data as ContractAnswer<LessonHomeworkData> | null
	)
	// Only the answer for the lesson on screen: a quick next/prev can outrun it.
	const data = computed(() => {
		const value = answer.value?.ok ? answer.value.data ?? null : null
		if (value?.homework && value.homework.lesson !== lesson.value) return null
		return value
	})
	const homework = computed(() => data.value?.homework ?? null)
	const submission = computed<Submission | null>(
		() => data.value?.submission ?? null
	)
	// The space the read answered for: the save names it back, so the page never
	// reads one space's submission and writes another's.
	const space = computed(() => data.value?.space ?? undefined)
	const saving = ref(false)

	async function save(change: HomeworkSave): Promise<boolean> {
		if (saving.value || homework.value?.lesson !== lesson.value) return false
		const form = new FormData()
		form.append('lesson', lesson.value)
		if (space.value) form.append('space', space.value)
		if (change.answer !== undefined) form.append('answer', change.answer)
		if (change.removeFiles.length)
			form.append('remove_files', JSON.stringify(change.removeFiles))
		for (const file of change.files) form.append('file', file, file.name)
		const first = !submission.value?.version

		// Held through the read-back too: a second click before the new version
		// arrives would save the old draft again.
		saving.value = true
		try {
			const result = await postForm<unknown>(
				'lms_frappe_app.api.student.submit_homework',
				form
			)
			if (!result.ok) {
				toast.error(result.message || __('Could not save the answer'))
				return false
			}
			toast.success(first ? __('Homework submitted') : __('Answer saved'))
			// The answer is saved; a failed read-back is not a failed save.
			await resource.reload().catch(() => {})
			return true
		} finally {
			saving.value = false
		}
	}

	return { resource, homework, submission, space, saving, save }
}
