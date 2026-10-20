<template>
	<!-- The name and the photo, edited in place under the header: two fields
	and a picture are not worth a page or a window of their own
	(learning-services#626). -->
	<div
		ref="root"
		class="mt-5 rounded-md border border-outline-gray-2 p-4 md:p-5"
		role="group"
		:aria-label="__('Edit name and photo')"
		data-testid="profile-name-edit"
		@keydown.esc="emit('close')"
	>
		<div class="grid gap-4 md:grid-cols-2">
			<FormControl
				v-model="draft.first_name"
				:label="__('First Name')"
				:required="true"
			/>
			<FormControl v-model="draft.last_name" :label="__('Last Name')" />
			<!-- Optional: without a photo the profile shows initials. -->
			<Uploader
				v-model="draft.image"
				class="md:col-span-2"
				:label="__('Photo')"
				:required="false"
				shape="circle"
			/>
		</div>
		<div class="mt-4 flex justify-end gap-2">
			<Button :label="__('Cancel')" @click="emit('close')" />
			<Button
				variant="solid"
				:label="__('Save')"
				:loading="saving"
				data-testid="profile-save"
				@click="save"
			/>
		</div>
	</div>
</template>

<script setup>
import { inject, nextTick, onMounted, reactive, ref } from 'vue'
import { Button, call, FormControl, toast } from 'frappe-ui'
import Uploader from '@/components/Controls/Uploader.vue'

const props = defineProps({
	// The profile page's get_profile_details resource: the form starts from it
	// and reloads it once saved.
	profile: {
		type: Object,
		required: true,
	},
})
const emit = defineEmits(['close'])

const user = inject('$user')
const root = ref(null)
const saving = ref(false)

// A field never filled in arrives as null; an input can only give back ''.
const draft = reactive({
	first_name: props.profile.data?.first_name ?? '',
	last_name: props.profile.data?.last_name ?? '',
	image: props.profile.data?.user_image ?? '',
})

onMounted(async () => {
	await nextTick()
	root.value?.querySelector('input')?.focus()
})

const save = async () => {
	if (saving.value) return
	const first = draft.first_name.trim()
	if (!first) {
		toast.error(
			__('Please fill the mandatory fields: {0}').format(__('First Name'))
		)
		return
	}
	saving.value = true
	try {
		await call('frappe.client.set_value', {
			doctype: 'User',
			name: props.profile.data.name,
			fieldname: {
				first_name: first,
				last_name: draft.last_name.trim(),
				user_image: draft.image || null,
			},
		})
	} catch (error) {
		saving.value = false
		toast.error(error?.messages?.[0] || __('Could not save'))
		return
	}
	// The page and the sidebar both show the name.
	await props.profile.reload()
	user?.reload?.()
	saving.value = false
	toast.success(__('Profile updated successfully'))
	emit('close')
}
</script>
