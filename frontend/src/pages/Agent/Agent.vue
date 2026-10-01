<template>
	<div>
		<PageHeader
			:breadcrumbs="[
				{ label: __('Connect your agent'), route: { name: 'Agent' } },
			]"
		/>

		<div class="mx-auto max-w-3xl space-y-6 p-4 sm:p-5">
			<h1 class="text-xl-semibold text-ink-gray-9">
				{{ __('Connect your agent') }}
			</h1>
			<p class="text-p-base text-ink-gray-7">
				{{
					__(
						'Lessons and course building on this platform go through your AI agent: it connects to the site over MCP and signs in with the same account as you.'
					)
				}}
			</p>
			<p class="text-p-base text-ink-gray-7" data-testid="agent-web-chat">
				{{ __('No agent of your own yet? Try the trial lessons') }}
				<a href="/chat" class="text-ink-gray-9 underline">{{
					__('in the browser')
				}}</a>
				{{
					__(
						'— with the platform agent, along the same route and with the same grading. Later you continue with your own agent, and the progress is kept.'
					)
				}}
			</p>

			<p
				v-if="!session.isLoggedIn"
				class="text-p-base text-ink-gray-7"
				data-testid="agent-login"
			>
				{{ __('To see the connection addresses,') }}
				<a href="/login?redirect-to=/lms/agent" class="underline">{{
					__('log in')
				}}</a
				>.
			</p>

			<template v-else>
				<section class="space-y-3">
					<h2 class="text-lg-semibold text-ink-gray-9">
						{{ __('Where to connect') }}
					</h2>
					<div
						v-for="connection in connections"
						:key="connection.role"
						class="space-y-2 rounded-lg border p-4"
						:data-testid="`agent-connection-${connection.role}`"
					>
						<h3 class="text-base-semibold text-ink-gray-9">
							{{ titles[connection.role] }}
						</h3>
						<div class="flex items-center gap-2">
							<code
								class="min-w-0 flex-1 truncate rounded bg-surface-gray-2 px-2 py-1.5 text-p-sm text-ink-gray-8"
								>{{ connection.url }}</code
							>
							<Button
								variant="subtle"
								:label="__('Copy')"
								@click="copy(connection.url)"
							/>
						</div>
						<p class="text-p-sm text-ink-gray-6">
							{{ firstSteps[connection.role] }}
						</p>
					</div>
				</section>

				<section class="space-y-3">
					<h2 class="text-lg-semibold text-ink-gray-9">
						{{ __('How to connect in Claude Desktop') }}
					</h2>
					<ol class="list-decimal space-y-1 pl-5 text-p-base text-ink-gray-7">
						<li>
							{{ __('Settings → Connectors → Add custom connector.') }}
						</li>
						<li>
							{{
								__(
									'Name — anything, URL — the address above. Leave the OAuth fields empty.'
								)
							}}
						</li>
						<li>
							{{
								__(
									'In the window that opens, sign in to this site with your account and confirm access.'
								)
							}}
						</li>
						<li>
							{{
								__(
									'On the first tool call, allow it: Allow always.'
								)
							}}
						</li>
					</ol>
					<p class="text-p-base text-ink-gray-7">
						{{
							__(
								'Other MCP clients (Claude Code, Cursor) connect with the same address over OAuth.'
							)
						}}
					</p>
					<p class="rounded bg-surface-gray-2 p-3 text-p-sm text-ink-gray-7">
						{{
							__(
								'No more than 5 connections per 10 minutes: each new connection registers the client anew, so do not reconnect without need.'
							)
						}}
					</p>
				</section>
			</template>

			<p class="text-p-sm text-ink-gray-5">
				{{ __('The platform application is open under AGPL-3.0:') }}
				<a
					href="https://github.com/lms-high-time/learning-app"
					class="underline"
					>{{ __('source code') }}</a>.
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, toast, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import { agentConnections } from '@/utils/agentConnection'

// «Connect your agent» (learning-services#470): where an MCP client connects
// and how to sign it in, inside the app instead of a Frappe web page.

const session = sessionStore()
const { userResource } = usersStore()

const origin = window.location.origin
// The router waits for the user before any page, so the roles are here.
const connections = computed(() => agentConnections(origin, userResource.data))

const titles = {
	student: __('Study'),
	curator: __('Build courses'),
}
const firstSteps = {
	student: __('Ask the agent to show your courses and start a lesson.'),
	curator: __(
		'Ask the agent to call authoring_guide first: it is the build order and the platform rules.'
	),
}

const copy = async (url: string) => {
	try {
		await navigator.clipboard.writeText(url)
		toast.success(__('Copied'))
	} catch {
		toast.error(__('Could not copy'))
	}
}

usePageMeta(() => ({ title: __('Connect your agent') }))
</script>
