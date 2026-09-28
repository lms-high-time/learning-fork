<template>
	<div class="mx-auto max-w-xl space-y-4 p-5">
		<h1 class="text-xl-semibold text-ink-gray-9">
			{{ __('Create an organization') }}
		</h1>
		<ul class="list-disc space-y-1 ps-5 text-p-base text-ink-gray-7">
			<li>
				{{ __('You become its administrator and invite people by a link.') }}
			</li>
			<li>
				{{
					__(
						'Its courses are the open catalog; a course of your own process is made with us.'
					)
				}}
			</li>
			<li>
				{{ __('Until we verify it, it holds a limited number of members.') }}
			</li>
		</ul>
		<form class="space-y-3" data-testid="new-team" @submit.prevent="create">
			<FormControl
				v-model="title"
				type="text"
				:label="__('Organization name')"
				:placeholder="__('For example, the sales team')"
			/>
			<Button
				variant="solid"
				type="submit"
				:disabled="title.trim().length < 2"
				:loading="saving"
				data-testid="create-team"
			>
				{{ __('Create') }}
			</Button>
		</form>
	</div>
</template>

<script setup lang="ts">
// Starting one's own organization (learning-services#366): the creator is its
// administrator and lands in its space. Limits are the server's; a refusal is
// said as it came.
import { ref } from 'vue'
import { Button, call, FormControl, toast, usePageMeta } from 'frappe-ui'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}

const title = ref('')
const saving = ref(false)

async function create() {
	saving.value = true
	try {
		const result = (await call('lms_frappe_app.api.team.create_organization', {
			title: title.value,
		})) as Answer<{ organization: string }>
		if (!result?.ok) {
			toast.error(result?.error?.message ?? __('Could not save'))
			return
		}
		// Its space is chosen on the server; a fresh load draws every list in it.
		window.location.href = '/lms/team'
	} finally {
		saving.value = false
	}
}

usePageMeta(() => ({ title: __('Create an organization') }))
</script>
