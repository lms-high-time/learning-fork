<template>
	<div class="space-y-6">
		<form
			class="space-y-3 rounded border p-4"
			data-testid="assign-form"
			@submit.prevent="assign"
		>
			<h2 class="text-lg-semibold text-ink-gray-9">
				{{ __('Assign a course') }}
			</h2>
			<FormControl
				v-model="course"
				type="select"
				:options="courseOptions"
				:label="__('Course')"
			/>
			<div class="space-y-1">
				<label class="flex items-center gap-2 text-p-base">
					<input v-model="wholeTeam" type="checkbox" data-testid="whole-team" />
					{{ __('The whole team, and whoever joins later') }}
				</label>
				<div v-if="!wholeTeam" class="flex flex-wrap gap-3 ps-6">
					<label
						v-for="member in activeMembers"
						:key="member.user"
						class="flex items-center gap-2 text-p-sm"
					>
						<input v-model="picked" type="checkbox" :value="member.user" />
						{{ member.full_name || member.user }}
					</label>
				</div>
			</div>
			<div class="flex flex-wrap items-end gap-4">
				<FormControl v-model="deadline" type="date" :label="__('Deadline')" />
				<label class="flex items-center gap-2 pb-1 text-p-base">
					<input v-model="mandatory" type="checkbox" />
					{{ __('Mandatory') }}
				</label>
			</div>
			<p class="text-p-sm text-ink-gray-5">
				{{
					__(
						'Everyone assigned gets an email, and a reminder a few days before the deadline if the course is not passed yet.'
					)
				}}
			</p>
			<Button
				variant="solid"
				type="submit"
				:disabled="!canAssign"
				:loading="saving"
				data-testid="assign"
			>
				{{ __('Assign the course') }}
			</Button>
		</form>

		<p v-if="!items.length" class="text-p-base text-ink-gray-6">
			{{ __('Nothing is assigned yet.') }}
		</p>
		<section v-else class="space-y-1">
			<h2 class="text-lg-semibold text-ink-gray-9">
				{{ __('Assigned') }}
			</h2>
			<ul class="divide-y" data-testid="allocations">
				<li
					v-for="item in items"
					:key="item.id"
					class="flex flex-wrap items-center justify-between gap-3 py-3"
				>
					<div class="min-w-0">
						<div class="text-p-base text-ink-gray-9">{{ item.title }}</div>
						<div class="text-p-sm text-ink-gray-5">
							{{ audienceLabel(item) }}
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<FormControl
							type="date"
							class="w-44"
							:modelValue="item.deadline || ''"
							:aria-label="
								__('Deadline for {0}').format(item.title || item.course)
							"
							@update:modelValue="(value: string) => update(item.id, { deadline: value })"
						/>
						<label class="flex items-center gap-2 text-p-sm">
							<input
								type="checkbox"
								:checked="item.mandatory"
								@change="(e: Event) => update(item.id, { mandatory: (e.target as HTMLInputElement).checked ? '1' : '0' })"
							/>
							{{ __('Mandatory') }}
						</label>
						<Button
							variant="ghost"
							:aria-label="__('Unassign {0}').format(item.title || item.course)"
							:data-testid="`unassign-${item.id}`"
							@click="unassign(item)"
						>
							{{ __('Unassign') }}
						</Button>
					</div>
				</li>
			</ul>
		</section>
	</div>
</template>

<script setup lang="ts">
// A manager's assignments (learning-services#365): a course to the whole team
// or to chosen people, with a deadline. Mail about the assignment and the
// reminder are the server's; the page says they will come.
import { computed, onMounted, ref } from 'vue'
import { Button, call, createResource, FormControl, toast } from 'frappe-ui'
import { confirmAction } from '@/utils/confirm'
import { audienceText, type Allocation, type TeamData } from '@/utils/team'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}
type Allocations = {
	allocations: Allocation[]
	courses: { id: string; title: string }[]
}

const props = defineProps<{ team: TeamData }>()

const resource = createResource({
	url: 'lms_frappe_app.api.team.allocations',
	auto: false,
})
const load = () => resource.reload({ organization: props.team.organization })
onMounted(load)

const data = computed(() => {
	const answer = resource.data as Answer<Allocations> | null
	return answer?.ok ? answer.data ?? null : null
})
const items = computed(() => data.value?.allocations ?? [])
const courseOptions = computed(() =>
	(data.value?.courses ?? []).map((item) => ({
		value: item.id,
		label: item.title,
	}))
)
const activeMembers = computed(() => props.team.members.filter((m) => !m.left))

const course = ref('')
const wholeTeam = ref(true)
const picked = ref<string[]>([])
const deadline = ref('')
const mandatory = ref(false)
const saving = ref(false)
const canAssign = computed(
	() => Boolean(course.value) && (wholeTeam.value || picked.value.length > 0)
)

const names = computed(() =>
	Object.fromEntries(
		props.team.members.map((m) => [m.user, m.full_name || m.user])
	)
)
const audienceLabel = (item: Allocation) => audienceText(item, names.value)

async function act(method: string, params: Record<string, unknown>) {
	const result = (await call(
		`lms_frappe_app.api.team.${method}`,
		params
	)) as Answer<unknown>
	if (!result?.ok) {
		toast.error(result?.error?.message ?? __('Could not save'))
		return false
	}
	return true
}

async function assign() {
	if (!canAssign.value) return
	saving.value = true
	try {
		const done = await act('assign_course', {
			organization: props.team.organization,
			course: course.value,
			members: wholeTeam.value ? [] : picked.value,
			deadline: deadline.value || undefined,
			mandatory: mandatory.value ? 1 : 0,
		})
		if (done) {
			toast.success(__('Assigned'))
			course.value = ''
			picked.value = []
			deadline.value = ''
			mandatory.value = false
			await load()
		}
	} finally {
		saving.value = false
	}
}

async function update(id: string, change: Record<string, string>) {
	if (await act('update_allocation', { allocation: id, ...change }))
		await load()
}

// Unassigning drops the course from the report and its reminders; the
// progress stays with the people (#379).
function unassign(item: Allocation) {
	confirmAction({
		title: __('Unassign {0}?').format(item.title || item.course),
		message: __(
			'The course leaves the report and nobody gets reminders about it. Progress stays with the people.'
		),
		label: __('Unassign'),
		onConfirm: async () => {
			if (await act('remove_allocation', { allocation: item.id })) await load()
		},
	})
}
</script>
