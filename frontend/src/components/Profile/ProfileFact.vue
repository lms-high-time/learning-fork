<template>
	<li class="flex flex-col gap-1 py-3" data-testid="profile-fact">
		<div v-if="fact.label" class="text-p-sm font-medium text-ink-gray-6">
			{{ fact.label }}
		</div>
		<template v-if="editing">
			<FormControl
				v-model="draft"
				type="textarea"
				:rows="3"
				:aria-label="fact.label || undefined"
				data-testid="profile-fact-draft"
			/>
			<div class="flex gap-2">
				<Button
					variant="solid"
					:label="__('Save')"
					:loading="saving"
					:disabled="!draft.trim()"
					data-testid="profile-fact-save"
					@click="submit"
				/>
				<Button :label="__('Cancel')" @click="editing = false" />
			</div>
		</template>
		<template v-else>
			<p
				v-if="fact.text"
				class="whitespace-pre-line text-p-base text-ink-gray-9"
				data-testid="profile-fact-text"
			>
				{{ fact.text }}
			</p>
			<p
				v-else
				class="text-p-base italic text-ink-gray-5"
				data-testid="profile-fact-empty"
			>
				{{ __('Not filled yet') }}
			</p>
			<div
				v-if="fact.updated || editable"
				class="flex flex-wrap items-center gap-2 text-p-sm text-ink-gray-5"
			>
				<span v-if="fact.updated">
					{{ __('Updated {0}').format(formatDay(fact.updated)) }}
				</span>
				<template v-if="editable">
					<Button
						variant="ghost"
						size="sm"
						:label="__('Fix')"
						data-testid="profile-fact-edit"
						@click="startEditing"
					/>
					<Button
						v-if="fact.text"
						variant="ghost"
						size="sm"
						:label="__('Delete')"
						data-testid="profile-fact-delete"
						@click="remove()"
					/>
				</template>
			</div>
		</template>
	</li>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button, FormControl } from 'frappe-ui'
import { formatDay } from '@/utils/team'

// One thing the mentor knows about the learner (learning-services#463). The
// learner may word it themselves rather than talk the agent into it: the edit
// is saved as the same fact the agent writes.

export type ProfileFactData = {
	key: string
	label?: string
	text: string | null
	updated: string | null
}

const props = defineProps<{
	fact: ProfileFactData
	/** Own profile: someone else's is shown read-only. */
	editable: boolean
	/** Saves the text; true when it was saved and the editor may close. */
	save: (text: string) => Promise<boolean>
	remove: () => void
}>()

const editing = ref(false)
const draft = ref('')
const saving = ref(false)

function startEditing() {
	draft.value = props.fact.text ?? ''
	editing.value = true
}

async function submit() {
	const text = draft.value.trim()
	if (!text || saving.value) return
	saving.value = true
	try {
		if (await props.save(text)) editing.value = false
	} finally {
		saving.value = false
	}
}
</script>
