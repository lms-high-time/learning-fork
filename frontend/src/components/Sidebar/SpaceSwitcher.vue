<template>
	<div
		v-if="space.hasOrganizations"
		class="px-2 pb-1"
		data-testid="space-switcher"
	>
		<Dropdown :options="options">
			<template v-slot="{ open }">
				<button
					type="button"
					class="flex h-9 items-center gap-2 rounded-md duration-300 ease-in-out"
					:class="
						isCollapsed
							? 'px-2 w-auto'
							: open
							? 'bg-surface-base shadow-sm px-2 w-52'
							: 'hover:bg-surface-gray-3 px-2 w-52'
					"
					:aria-label="__('Space') + ': ' + currentLabel"
				>
					<span
						class="size-4 shrink-0 text-ink-gray-7"
						:class="space.isOrganization ? 'lucide-building-2' : 'lucide-user'"
					/>
					<span
						v-if="!isCollapsed"
						class="min-w-0 flex-1 truncate text-start text-p-sm text-ink-gray-8"
					>
						{{ currentLabel }}
					</span>
					<span
						v-if="!isCollapsed"
						class="lucide-chevrons-up-down size-3.5 shrink-0 text-ink-gray-5"
					/>
				</button>
			</template>
		</Dropdown>
	</div>
</template>

<script setup lang="ts">
// Personal or one of the learner's organizations (learning-services#347).
// Absent for someone with no organization: there is nothing to switch between.
import { computed, onMounted } from 'vue'
import { Dropdown } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { useSpace, type Space } from '@/stores/space'
import { spaceLabel } from '@/utils/space'

defineProps<{ isCollapsed?: boolean }>()

const space = useSpace()

onMounted(() => space.load())

const currentLabel = computed(() =>
	space.currentSpace ? spaceLabel(space.currentSpace) : ''
)

const router = useRouter()

const options = computed(() => [
	...space.spaces.map((item: Space) => ({
		label: spaceLabel(item),
		icon: item.id === space.current ? 'check' : undefined,
		onClick: () => space.choose(item.id),
	})),
	// The organization's team lives in its space (learning-services#358).
	...(space.isOrganization
		? [
				{
					label: __('Team'),
					icon: 'users',
					onClick: () => router.push({ name: 'Team' }),
				},
		  ]
		: []),
])
</script>
