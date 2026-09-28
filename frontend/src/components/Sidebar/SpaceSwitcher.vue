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
		<!-- The team is a page of the organization's space: a sidebar item
		     while that space is open, not only an entry in this menu (#379). -->
		<nav v-if="space.isOrganization" class="mt-1" data-testid="team-link">
			<SidebarLink :link="teamLink" :isCollapsed="isCollapsed" />
		</nav>
	</div>
</template>

<script setup lang="ts">
// Personal or one of the learner's organizations (learning-services#347).
// Absent for someone with no organization: there is nothing to switch between.
import { computed, onMounted } from 'vue'
import { Dropdown } from 'frappe-ui'
import { useRouter } from 'vue-router'
import SidebarLink from '@/components/Sidebar/SidebarLink.vue'
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
	// Another workspace starts where one switches between them (#379).
	{
		label: __('Create an organization'),
		icon: 'plus',
		onClick: () => router.push({ name: 'NewTeam' }),
	},
])

const teamLink = {
	label: 'Team',
	icon: 'Users',
	to: 'Team',
	activeFor: ['Team'],
}
</script>
