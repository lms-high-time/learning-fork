<template>
	<details
		class="rounded border px-3 py-2"
		:data-testid="`homework-due-${item.id}`"
	>
		<summary class="cursor-pointer text-p-sm text-ink-gray-7">
			{{ __('Homework deadlines') }}
		</summary>
		<div class="mt-3 space-y-3">
			<p class="text-p-sm text-ink-gray-5">
				{{
					__(
						"A deadline set here applies to everyone in this assignment instead of the author's. A deadline already given does not move."
					)
				}}
			</p>
			<ul class="space-y-3">
				<li
					v-for="row in rows"
					:key="row.homework"
					class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3"
					data-testid="homework-due-row"
				>
					<div class="min-w-0">
						<div class="text-p-sm font-medium text-ink-gray-9">
							{{ row.title }}
						</div>
						<div class="text-p-sm text-ink-gray-5">
							{{ row.lesson_title }}
						</div>
					</div>
					<div class="flex flex-wrap items-end gap-2">
						<FormControl
							v-model="drafts[row.homework].mode"
							type="select"
							class="w-56"
							:options="modeOptions(row)"
							:aria-label="__('Deadline for {0}').format(row.title)"
							:data-testid="`due-mode-${row.homework}`"
						/>
						<FormControl
							v-if="drafts[row.homework].mode === 'relative'"
							v-model="drafts[row.homework].days"
							type="number"
							class="w-24"
							:aria-label="
								__('Days after the lesson for {0}').format(row.title)
							"
							:data-testid="`due-days-${row.homework}`"
						/>
						<FormControl
							v-if="drafts[row.homework].mode === 'absolute'"
							v-model="drafts[row.homework].date"
							type="date"
							class="w-44"
							:aria-label="__('Date for {0}').format(row.title)"
							:data-testid="`due-date-${row.homework}`"
						/>
					</div>
				</li>
			</ul>
			<Button
				:disabled="!valid || saving"
				:loading="saving"
				:data-testid="`save-due-${item.id}`"
				@click="submit"
			>
				{{ __('Save deadlines') }}
			</Button>
		</div>
	</details>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Button, FormControl } from 'frappe-ui'
import { dueLabel } from '@/utils/homework'
import {
	dueDraft,
	homeworkDuePayload,
	isDueDraftValid,
	type Allocation,
	type AllocationHomework,
	type DueDraft,
	type HomeworkDueRow,
} from '@/utils/team'

// The homework deadlines of one course assignment (learning-services#452):
// per homework, the author's, a number of days after the lesson, or a date.
// Saved together — the list replaces the assignment's rules.

const props = defineProps<{
	item: Allocation
	save: (rows: HomeworkDueRow[]) => Promise<boolean>
}>()

const rows = computed(() => props.item.homework ?? [])
const drafts = reactive<Record<string, DueDraft>>({})

// New rules from the server — after a save, say — start the form again. By
// what the rules are, not by the array: the tab reads all assignments again
// after any change, and a draft of this one must survive a change of another.
const signature = computed(() =>
	JSON.stringify(rows.value.map((row) => [row.homework, row.due]))
)
watch(
	signature,
	() => {
		for (const key of Object.keys(drafts)) delete drafts[key]
		for (const row of rows.value) drafts[row.homework] = dueDraft(row)
	},
	{ immediate: true }
)

const modeOptions = (row: AllocationHomework) => [
	{
		value: 'author',
		label: __('{0} (as the author)').format(dueLabel(row.author_due)),
	},
	{ value: 'relative', label: __('Days after the lesson') },
	{ value: 'absolute', label: __('By a date') },
]

const valid = computed(() =>
	rows.value.every((row) => isDueDraftValid(drafts[row.homework]))
)

const saving = ref(false)
async function submit() {
	if (!valid.value || saving.value) return
	saving.value = true
	try {
		await props.save(
			homeworkDuePayload(
				rows.value.map((row) => ({
					homework: row.homework,
					draft: drafts[row.homework],
				}))
			)
		)
	} finally {
		saving.value = false
	}
}
</script>
