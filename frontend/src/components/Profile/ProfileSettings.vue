<template>
	<!-- The learner's own settings, under what the mentor knows: the language
	was hidden in the profile form, the theme had only a light/dark toggle in
	the menu, and the password could not be reached from the app at all
	(learning-services#626). -->
	<section
		class="mt-12"
		aria-labelledby="profile-settings-title"
		data-testid="profile-settings"
	>
		<h2 id="profile-settings-title" class="text-lg-semibold text-ink-gray-9">
			{{ __('Settings') }}
		</h2>
		<div
			class="mt-3 divide-y divide-outline-gray-2 rounded-md border border-outline-gray-2"
		>
			<div :class="row">
				<div>
					<h3
						id="profile-language"
						class="text-base font-medium text-ink-gray-9"
					>
						{{ __('Interface language') }}
					</h3>
					<p class="mt-0.5 text-p-sm text-ink-gray-6">
						{{ __('The page will reload.') }}
					</p>
				</div>
				<select
					:value="language"
					:disabled="readOnlyMode || savingLanguage"
					aria-labelledby="profile-language"
					class="h-8 w-full rounded border-outline-gray-2 bg-surface-base ps-3 pe-8 text-base text-ink-gray-9 md:w-44"
					data-testid="profile-language"
					@change="changeLanguage($event.target.value)"
				>
					<option v-if="!language" value="" disabled>
						{{ __('Choose') }}
					</option>
					<option
						v-for="option in languages"
						:key="option.value"
						:value="option.value"
					>
						{{ option.label }}
					</option>
				</select>
			</div>
			<div :class="row">
				<div>
					<h3 id="profile-theme" class="text-base font-medium text-ink-gray-9">
						{{ __('Colour mode') }}
					</h3>
					<p class="mt-0.5 text-p-sm text-ink-gray-6">
						{{ __('Saved on this device only.') }}
					</p>
				</div>
				<div
					role="radiogroup"
					aria-labelledby="profile-theme"
					class="inline-flex w-full rounded-lg bg-surface-gray-2 p-0.5 md:w-auto"
					data-testid="profile-theme"
				>
					<label
						v-for="mode in modes"
						:key="mode.value"
						class="flex-1 cursor-pointer md:flex-none"
					>
						<input
							type="radio"
							name="profile-theme"
							class="peer sr-only"
							:value="mode.value"
							:checked="themePreference === mode.value"
							@change="setThemePreference(mode.value)"
						/>
						<span
							class="block whitespace-nowrap rounded-md px-2 py-1 text-center md:px-3 text-p-sm font-medium text-ink-gray-6 transition-colors hover:text-ink-gray-9 peer-checked:bg-surface-base peer-checked:text-ink-gray-9 peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-outline-blue-6"
						>
							{{ mode.label }}
						</span>
					</label>
				</div>
			</div>
		</div>
	</section>

	<section
		class="mt-12 mb-16"
		aria-labelledby="profile-account-title"
		data-testid="profile-account"
	>
		<h2 id="profile-account-title" class="text-lg-semibold text-ink-gray-9">
			{{ __('Account') }}
		</h2>
		<div
			class="mt-3 divide-y divide-outline-gray-2 rounded-md border border-outline-gray-2"
		>
			<div :class="row">
				<div>
					<h3 class="text-base font-medium text-ink-gray-9">
						{{ __('Password') }}
					</h3>
					<p class="mt-0.5 text-p-sm text-ink-gray-6">
						{{
							__(
								'Needed to sign in by email. If you sign in with Google, you need no password.'
							)
						}}
					</p>
				</div>
				<a
					href="/update-password"
					class="inline-flex h-8 items-center justify-center rounded border border-outline-gray-2 bg-surface-base px-3 text-base font-medium text-ink-gray-8 transition-colors hover:bg-surface-gray-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline-blue-6"
					data-testid="profile-password"
				>
					{{ __('Change password') }}
				</a>
			</div>
			<div :class="row">
				<div>
					<h3
						class="text-base font-medium text-ink-gray-9 [overflow-wrap:anywhere]"
					>
						{{ __('Signed in as {0}').format(user) }}
					</h3>
				</div>
				<Button
					theme="red"
					variant="subtle"
					:loading="logout.loading"
					data-testid="profile-logout"
					@click="logout.submit()"
				>
					{{ __('Log out') }}
				</Button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, call, toast } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { setThemePreference, themePreference } from '@/utils/theme'
import type { ThemePreference } from '@/utils/theme'

const props = defineProps<{
	/** The User's docname — the profile shown is the viewer's own. */
	user: string
	/** The User's `language`; empty when the site's default applies. */
	language: string | null
}>()

const { logout } = sessionStore()
const readOnlyMode = Boolean((window as any).read_only_mode)

// A row: what it is on the left, its control on the right; on a phone the
// control goes under the words.
const row =
	'grid gap-x-6 gap-y-3 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'

const languages = computed(() => {
	const known = [
		{ value: 'ru', label: 'Русский' },
		{ value: 'en', label: 'English' },
	]
	// Someone set to a language we do not list still sees it chosen.
	if (
		props.language &&
		!known.some((option) => option.value === props.language)
	)
		known.push({ value: props.language, label: props.language })
	return known
})

const modes: { value: ThemePreference; label: string }[] = [
	{ value: 'system', label: __('System') },
	{ value: 'light', label: __('Light') },
	{ value: 'dark', label: __('Dark') },
]

// A language takes hold only once the whole app loads again.
const savingLanguage = ref(false)
const changeLanguage = async (value: string) => {
	if (!value || value === props.language) return
	savingLanguage.value = true
	try {
		await call('frappe.client.set_value', {
			doctype: 'User',
			name: props.user,
			fieldname: 'language',
			value,
		})
		window.location.reload()
	} catch {
		savingLanguage.value = false
		toast.error(__('Could not save'))
	}
}
</script>
