<template>
	<Dialog
		v-model:open="open"
		:title="title"
		:actions="[
			{
				label,
				variant: 'solid',
				disabled: !comment.trim() || sending,
				loading: sending,
				onClick: ({ close }: { close: () => void }) => submit(close),
			},
		]"
	>
		<p class="mb-3 text-p-base text-ink-gray-7">{{ message }}</p>
		<label class="block space-y-1.5">
			<span class="text-p-sm text-ink-gray-6">{{ __('Comment') }}</span>
			<textarea
				v-model="comment"
				rows="5"
				class="w-full rounded-md border border-outline-gray-2 p-3 text-p-sm leading-relaxed text-ink-gray-9"
				:placeholder="__('What to fix')"
			/>
		</label>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog } from 'frappe-ui'

// Sending a homework back, or cancelling an acceptance, takes a comment
// (learning-services#452): it is what the learner acts on. The button stays
// off until there is one; the dialog closes only when the server agreed.
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
	title: string
	message: string
	label: string
	send: (comment: string) => Promise<boolean>
}>()

const comment = ref('')
const sending = ref(false)

watch(open, (value) => {
	if (value) comment.value = ''
})

async function submit(close: () => void) {
	const text = comment.value.trim()
	if (!text || sending.value) return
	sending.value = true
	try {
		if (await props.send(text)) close()
	} finally {
		sending.value = false
	}
}
</script>
