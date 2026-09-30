import { computed, ref, watch, type Ref } from 'vue'
import { createResource, toast } from 'frappe-ui'
import { useSpace } from '@/stores/space'
import { withSpace } from '@/utils/space'
import type {
	ContractAnswer,
	LessonHomeworkData,
	Submission,
} from '@/utils/homework'

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
	})

	// The space first: the submission is the chosen space's, and a read before
	// it would show another space's and then swap (learning-services#347).
	watch(
		lesson,
		(name) => {
			if (name) spaces.load().then(() => resource.fetch())
		},
		{ immediate: true }
	)

	const answer = computed(
		() => resource.data as ContractAnswer<LessonHomeworkData> | null
	)
	const data = computed(() =>
		answer.value?.ok ? answer.value.data ?? null : null
	)
	const homework = computed(() => data.value?.homework ?? null)
	const submission = computed<Submission | null>(
		() => data.value?.submission ?? null
	)
	// The space the read answered for: the save names it back, so the page never
	// reads one space's submission and writes another's.
	const space = computed(() => data.value?.space ?? undefined)
	const saving = ref(false)

	async function save(change: HomeworkSave): Promise<boolean> {
		const form = new FormData()
		form.append('lesson', lesson.value)
		if (space.value) form.append('space', space.value)
		if (change.answer !== undefined) form.append('answer', change.answer)
		if (change.removeFiles.length)
			form.append('remove_files', JSON.stringify(change.removeFiles))
		for (const file of change.files) form.append('file', file, file.name)
		const first = !submission.value?.version
		saving.value = true
		try {
			const response = await fetch(
				'/api/method/lms_frappe_app.api.student.submit_homework',
				{
					method: 'POST',
					body: form,
					headers: {
						Accept: 'application/json',
						'X-Frappe-CSRF-Token':
							(window as Window & { csrf_token?: string }).csrf_token ?? '',
					},
				}
			)
			const body = response.ok ? await response.json() : null
			const result = body?.message as ContractAnswer<unknown> | undefined
			if (!result?.ok) {
				toast.error(result?.error?.message || __('Could not save the answer'))
				return false
			}
			toast.success(first ? __('Homework submitted') : __('Answer saved'))
			await resource.reload()
			return true
		} catch {
			toast.error(__('Could not save the answer'))
			return false
		} finally {
			saving.value = false
		}
	}

	return { resource, homework, submission, space, saving, save }
}
