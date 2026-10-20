<template>
	<!-- A row: the label, the text, and the row's buttons. On a wide screen the
	label is a column of its own; on a phone it sits over the text. The buttons
	of a filled fact are quiet icons, shown on hover or focus where there is a
	pointer to hover with, and always on touch (learning-services#626). -->
	<li
		ref="root"
		class="group/fact grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-3 md:grid-cols-[10.5rem_minmax(0,1fr)_auto] md:items-baseline"
		data-testid="profile-fact"
	>
		<div
			v-if="fact.label"
			class="col-start-1 row-start-1 text-p-sm text-ink-gray-6 md:pt-px"
		>
			{{ fact.label }}
		</div>
		<div
			class="col-start-1 min-w-0"
			:class="[
				fact.label ? 'md:col-start-2 md:row-start-1' : 'md:col-span-2',
				editing ? 'col-span-2 md:col-span-2' : '',
			]"
		>
			<template v-if="editing">
				<FormControl
					v-model="draft"
					type="textarea"
					:rows="3"
					:aria-label="fact.label || __('What your mentor knows')"
					data-testid="profile-fact-draft"
				/>
				<div class="mt-2 flex gap-2">
					<Button
						variant="solid"
						:label="__('Save')"
						:loading="saving"
						:disabled="!draft.trim()"
						data-testid="profile-fact-save"
						@click="submit"
					/>
					<Button :label="__('Cancel')" @click="stopEditing" />
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
					{{ __('Not specified') }}
				</p>
				<p v-if="fact.updated" class="mt-0.5 text-p-sm text-ink-gray-5">
					{{ __('Updated {0}').format(updatedOn) }}
				</p>
			</template>
		</div>
		<div
			v-if="editable && !editing"
			class="col-start-2 row-span-2 row-start-1 flex items-center gap-0.5 self-center md:col-start-3 md:row-span-1 md:self-baseline"
			:class="
				fact.text
					? '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover/fact:opacity-100 [@media(hover:hover)]:group-focus-within/fact:opacity-100'
					: ''
			"
		>
			<!-- The words in the slot, not `label`: frappe-ui's Button makes
			`label` its accessible name, over the one naming the fact. -->
			<template v-if="fact.text">
				<Button
					variant="ghost"
					:aria-label="__('Fix: {0}').format(name)"
					data-testid="profile-fact-edit"
					@click="startEditing"
				>
					<span
						class="lucide-pencil size-4 text-ink-gray-6"
						aria-hidden="true"
					/>
				</Button>
				<Button
					variant="ghost"
					:aria-label="__('Delete: {0}').format(name)"
					data-testid="profile-fact-delete"
					@click="remove()"
				>
					<span
						class="lucide-trash-2 size-4 text-ink-gray-6"
						aria-hidden="true"
					/>
				</Button>
			</template>
			<Button
				v-else
				variant="ghost"
				class="!text-ink-blue-7"
				:aria-label="__('Fill in: {0}').format(name)"
				data-testid="profile-fact-edit"
				@click="startEditing"
			>
				{{ __('Fill in') }}
			</Button>
		</div>
	</li>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Button, FormControl } from 'frappe-ui'

// One thing the mentor knows about the learner (learning-services#463). The
// learner may word it themselves rather than talk the agent into it: the edit
// is saved as the same fact the mentor writes.

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

const root = ref<HTMLElement | null>(null)
const editing = ref(false)
const draft = ref('')
const saving = ref(false)

// What a screen reader hears the buttons are for: the label, or for a fact
// with none («Your mentor also knows») its text.
const name = computed(() => props.fact.label || props.fact.text || '')

// «20 октября», with the year only when it is not this one.
const updatedOn = computed(() => {
	const iso = props.fact.updated
	if (!iso) return ''
	const day = new Date(`${iso.slice(0, 10)}T00:00:00`)
	if (Number.isNaN(day.getTime())) return iso
	const lang = document.documentElement.lang || 'ru'
	const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
	if (day.getFullYear() !== new Date().getFullYear()) options.year = 'numeric'
	try {
		return new Intl.DateTimeFormat(lang, options).format(day)
	} catch {
		return iso.slice(0, 10)
	}
})

// Focus follows the editor in and back out to the button that opened it.
async function startEditing() {
	draft.value = props.fact.text ?? ''
	editing.value = true
	await nextTick()
	root.value?.querySelector('textarea')?.focus()
}

async function stopEditing() {
	editing.value = false
	await nextTick()
	root.value
		?.querySelector<HTMLElement>('[data-testid="profile-fact-edit"]')
		?.focus()
}

async function submit() {
	const text = draft.value.trim()
	if (!text || saving.value) return
	saving.value = true
	try {
		if (await props.save(text)) await stopEditing()
	} finally {
		saving.value = false
	}
}
</script>
