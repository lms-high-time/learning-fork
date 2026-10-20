<template>
	<NoPermission v-if="!$user.data" />
	<div v-else-if="profile.data">
		<PageHeader :breadcrumbs="breadcrumbs">
			<template #actions>
				<!-- Frappe's role refresh: a tool for the platform's roles, not a
				learner's (learning-services#626). -->
				<HeaderButton
					v-if="isSessionUser() && currentUserHasHigherAccess()"
					variant="ghost"
					:label="__('Refresh session')"
					icon="lucide-refresh-ccw"
					@click="reloadUser()"
				/>
			</template>
		</PageHeader>
		<!-- No cover, socials, «Open to» or headline: the profile is what the
		mentor knows, shown below (learning-services#463). One page, top to
		bottom: who you are, what the mentor knows, settings, account
		(learning-services#626). -->
		<div class="mx-auto mt-8 max-w-3xl px-5">
			<div class="flex flex-wrap items-center gap-x-5 gap-y-3">
				<img
					v-if="profile.data.user_image"
					:src="safeUrl(profile.data.user_image)"
					:alt="profile.data.full_name"
					class="size-14 shrink-0 rounded-full object-cover md:size-16"
				/>
				<div
					v-else
					class="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-blue-2 text-xl font-semibold text-ink-blue-7 md:size-16"
					aria-hidden="true"
				>
					{{ initials }}
				</div>
				<div class="min-w-0 flex-1">
					<h1 class="truncate text-2xl-semibold text-ink-gray-9">
						{{ profile.data.full_name }}
					</h1>
					<p
						v-if="isSessionUser()"
						class="mt-0.5 truncate text-p-base text-ink-gray-6"
						data-testid="profile-email"
					>
						{{ profile.data.name }}
					</p>
				</div>
				<Button
					v-if="isSessionUser() && !readOnlyMode && !editing"
					ref="editButton"
					class="max-md:w-full"
					aria-controls="profile-name-edit"
					:aria-expanded="editing"
					data-testid="profile-edit"
					@click="editing = true"
				>
					{{ __('Edit name and photo') }}
				</Button>
			</div>
			<ProfileNameEdit
				v-if="editing"
				id="profile-name-edit"
				:profile="profile"
				@close="stopEditing"
			/>

			<div v-if="tabButtons.length > 1" class="mt-8">
				<TabButtons
					:class="
						isMobile
							? 'flex w-full [&>div]:w-full [&_button]:min-w-0 [&_button]:grow [&_button>span]:w-full'
							: 'inline-block'
					"
					:options="tabButtons"
					v-model="activeTab"
				/>
			</div>
			<router-view :profile="profile" :key="profile.data?.name" />
			<ProfileSettings
				v-if="isSessionUser() && route.name === 'ProfileAbout'"
				:user="profile.data.name"
				:language="profile.data.language"
			/>
		</div>
	</div>
	<NotFound v-else-if="(profile.fetched || profile.error) && !profile.data" />
</template>
<script setup>
import {
	Button,
	call,
	createResource,
	TabButtons,
	toast,
	usePageMeta,
} from 'frappe-ui'
import {
	computed,
	inject,
	nextTick,
	watch,
	ref,
	onMounted,
	watchEffect,
} from 'vue'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { sessionStore } from '@/stores/session'
import { useRoute, useRouter } from 'vue-router'
import { convertToTitleCase } from '@/utils'
import { useScreenSize } from '@/utils/composables'
import ProfileNameEdit from '@/components/Profile/ProfileNameEdit.vue'
import ProfileSettings from '@/components/Profile/ProfileSettings.vue'
import NoPermission from '@/components/NoPermission.vue'
import NotFound from '@/pages/NotFound.vue'
import { safeUrl } from '@/utils/safeUrl'

const { brand } = sessionStore()
const $user = inject('$user')
const route = useRoute()
const router = useRouter()
const activeTab = ref('')
const readOnlyMode = window.read_only_mode
const { isMobile } = useScreenSize()

const props = defineProps({
	username: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	if ($user.data) profile.reload()
	setActiveTab()
})

const profile = createResource({
	url: 'lms.lms.api.get_profile_details',
	makeParams() {
		return {
			username: props.username,
		}
	},
})

const setActiveTab = () => {
	let fragments = route.path.split('/')
	let sections = ['roles', 'slots', 'schedule']
	sections.forEach((section) => {
		if (fragments.includes(section)) {
			activeTab.value = convertToTitleCase(section)
		}
	})
	if (!activeTab.value) activeTab.value = 'About'
}

// Only when the tab and the route disagree: pushing the route already shown
// would drop its query, the `?edit=1` a link to the edit form arrives with.
watchEffect(() => {
	if (!activeTab.value) return
	let target = {
		About: { name: 'ProfileAbout' },
		Roles: { name: 'ProfileRoles' },
		Slots: { name: 'ProfileEvaluator' },
		Schedule: { name: 'ProfileEvaluationSchedule' },
	}[activeTab.value]
	if (route.name !== target.name) router.push(target)
})

watch(
	() => props.username,
	() => {
		profile.reload()
	}
)

const isSessionUser = () => {
	return $user.data?.name === profile.data?.name
}

// The name and photo are edited in place (learning-services#626). The old
// /user/X/edit link lands here with `?edit=1` and opens the fields — on the
// owner's own profile, once it is known to be theirs.
const editing = ref(false)
const editButton = ref(null)
watch(
	() => [route.query.edit, profile.data?.name],
	([edit]) => {
		if (edit !== '1' || !profile.data) return
		if (isSessionUser() && !readOnlyMode) editing.value = true
		router.replace({ query: {} })
	},
	{ immediate: true }
)
const stopEditing = async () => {
	editing.value = false
	await nextTick()
	editButton.value?.$el?.focus?.()
}

const currentUserHasHigherAccess = () => {
	return $user.data?.is_evaluator || $user.data?.is_moderator
}

const isEvaluatorOrModerator = () => {
	return (
		profile.data?.roles?.includes('Batch Evaluator') ||
		profile.data?.roles?.includes('Moderator')
	)
}

// No «Certificates» tab (learning-services#626); its old link lands on About.
// A learner is left with one tab, so the strip is not shown at all; the
// platform's roles keep theirs.
const getTabButtons = () => {
	let buttons = [{ label: __('About me'), value: 'About' }]
	if ($user.data?.is_moderator) {
		buttons.push({ label: __('Roles'), value: 'Roles' })
	}

	if (currentUserHasHigherAccess() && isEvaluatorOrModerator()) {
		buttons.push({ label: __('Slots'), value: 'Slots' })
		buttons.push({ label: __('Schedule'), value: 'Schedule' })
	}
	return buttons
}

const tabButtons = computed(() => getTabButtons())

const initials = computed(() => {
	const first = profile.data?.first_name?.trim()?.charAt(0) ?? ''
	const last = profile.data?.last_name?.trim()?.charAt(0) ?? ''
	return (
		first + last ||
		profile.data?.full_name?.charAt(0) ||
		''
	).toUpperCase()
})

const reloadUser = () => {
	call('frappe.sessions.clear')
		.then(() => {
			$user.reload().then(() => {
				profile.reload()
				toast.success(__('Session refreshed successfully'))
			})
		})
		.catch((err) => {
			toast.error(__('Failed to refresh session'))
			console.error(err)
		})
}

// Your own profile is «My Profile», as in the menu; «People» is the
// platform's list of everyone, and means nothing to a learner
// (learning-services#626).
const breadcrumbs = computed(() => {
	if (isSessionUser()) return [{ label: __('My Profile') }]
	return [
		{ label: __('People') },
		{
			label: profile.data?.full_name,
			route: { name: 'Profile', params: { username: props.username } },
		},
	]
})

usePageMeta(() => {
	return {
		title: profile.data?.full_name,
		icon: brand.favicon,
	}
})
</script>
