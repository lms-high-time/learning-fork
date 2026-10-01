<template>
	<div>
		<PageHeader
			:breadcrumbs="[
				{ label: __('Connect an assistant'), route: { name: 'Agent' } },
			]"
		/>

		<div class="mx-auto max-w-3xl space-y-8 p-4 sm:p-5">
			<section class="space-y-4">
				<h1 class="text-xl-semibold text-ink-gray-9">
					{{ __('Connect an assistant') }}
				</h1>
				<p class="text-p-base text-ink-gray-7">
					{{
						__(
							'Study with your own AI assistant: it runs the lesson, explains and asks questions, while the platform keeps your progress, grades and documents. The assistant connects to the site over MCP and signs in with your account.'
						)
					}}
				</p>
				<ol class="grid gap-3 sm:grid-cols-3" data-testid="agent-steps">
					<li
						v-for="(step, index) in steps"
						:key="index"
						class="flex gap-3 rounded-lg bg-surface-gray-2 p-3"
					>
						<span
							class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-gray-4 text-sm font-semibold text-ink-gray-8"
							>{{ index + 1 }}</span
						>
						<span class="text-p-sm text-ink-gray-8">{{ step }}</span>
					</li>
				</ol>
			</section>

			<section class="space-y-2" data-testid="agent-connection-student">
				<h2 class="text-lg-semibold text-ink-gray-9">
					{{ __('Connection address') }}
				</h2>
				<div class="flex items-center gap-2">
					<code
						class="min-w-0 flex-1 truncate rounded bg-surface-gray-2 px-3 py-2 text-p-base text-ink-gray-9"
						>{{ studentUrl }}</code
					>
					<Button
						variant="solid"
						:label="__('Copy')"
						:aria-label="__('Copy the address')"
						@click="copy(studentUrl)"
					/>
				</div>
				<p
					v-if="!session.isLoggedIn"
					class="text-p-sm text-ink-gray-6"
					data-testid="agent-login"
				>
					{{
						__(
							'The assistant signs in with your account on this site. No account yet?'
						)
					}}
					<a href="/login?redirect-to=/lms/agent" class="underline">{{
						__('Log in or sign up')
					}}</a>
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-lg-semibold text-ink-gray-9">
					{{ __('How to connect') }}
				</h2>
				<!-- As on «Homework»: tabs scroll sideways on a phone, arrows move
				     between them (WAI-ARIA tabs). -->
				<nav
					class="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b px-4 sm:mx-0 sm:px-0"
					role="tablist"
					:aria-label="__('Assistant')"
					@keydown="moveTab"
				>
					<button
						v-for="item in clients"
						:id="`agent-tab-${item.value}`"
						:key="item.value"
						type="button"
						role="tab"
						:aria-selected="client === item.value"
						:aria-controls="`agent-panel-${item.value}`"
						:tabindex="client === item.value ? 0 : -1"
						:data-testid="`agent-tab-${item.value}`"
						class="shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-p-base"
						:class="
							client === item.value
								? 'border-ink-gray-9 text-ink-gray-9'
								: 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'
						"
						@click="client = item.value"
					>
						{{ item.label }}
					</button>
				</nav>

				<div
					:id="`agent-panel-${client}`"
					role="tabpanel"
					:aria-labelledby="`agent-tab-${client}`"
					class="space-y-3 text-p-base text-ink-gray-7"
					:data-testid="`agent-panel-${client}`"
				>
					<template v-if="client === 'claude'">
						<ol class="list-decimal space-y-1.5 ps-5">
							<li>
								{{
									__(
										'Open claude.ai or the Claude desktop app and go to Customize → Connectors.'
									)
								}}
							</li>
							<li>{{ __('Click «+», then Add custom connector.') }}</li>
							<li>
								{{
									__(
										'Name — for example «{0}», URL — the address above. Click Add.'
									).format(name)
								}}
							</li>
							<li>
								{{
									__(
										'Click Connect, sign in to this site with your account and allow access.'
									)
								}}
							</li>
							<li>
								{{
									__(
										'In a chat, click «+» → Connectors and check that «{0}» is on.'
									).format(name)
								}}
							</li>
						</ol>
						<p class="text-p-sm text-ink-gray-6">
							{{
								__(
									'A connector added once works on the site, in the desktop app and in the Claude mobile app. On the free plan Claude allows one custom connector. On a Team or Enterprise plan the connector is added by an administrator — send them the address.'
								)
							}}
						</p>
					</template>

					<template v-else-if="client === 'chatgpt'">
						<p
							class="rounded bg-surface-amber-1 p-3 text-p-sm text-ink-gray-8"
							data-testid="agent-chatgpt-plan"
						>
							{{
								__(
									'ChatGPT needs a paid plan (Plus, Pro, Business, Enterprise or Education) and developer mode, in the web version. On the free plan choose another assistant or study in the browser.'
								)
							}}
						</p>
						<ol class="list-decimal space-y-1.5 ps-5">
							<li>
								{{
									__(
										'Open chatgpt.com, go to Settings → Security and login and turn on Developer mode.'
									)
								}}
							</li>
							<li>
								{{
									__(
										'Open Plugins, click «+» and create an app for the platform.'
									)
								}}
							</li>
							<li>
								{{
									__(
										'Name — «{0}», URL — the address above, authentication — OAuth.'
									).format(name)
								}}
							</li>
							<li>
								{{
									__('Sign in to this site with your account and allow access.')
								}}
							</li>
							<li>
								{{
									__(
										'In a chat, open the «+» menu, choose Developer mode and turn on «{0}».'
									).format(name)
								}}
							</li>
						</ol>
					</template>

					<template v-else-if="client === 'cursor'">
						<p>
							{{
								__(
									'One click: Cursor opens and offers to install the connector. Then sign in to this site when Cursor asks.'
								)
							}}
						</p>
						<Button
							variant="solid"
							:label="__('Add to Cursor')"
							data-testid="agent-install-cursor"
							@click="open(cursorInstallLink(name, studentUrl))"
						/>
						<p class="text-p-sm text-ink-gray-6">
							{{
								__(
									'Cursor did not open? Add an MCP server in Cursor settings and paste the address above.'
								)
							}}
						</p>
					</template>

					<template v-else-if="client === 'vscode'">
						<p>
							{{
								__(
									'One click: VS Code with GitHub Copilot opens and offers to install the connector. Then sign in to this site when VS Code asks.'
								)
							}}
						</p>
						<Button
							variant="solid"
							:label="__('Add to VS Code')"
							data-testid="agent-install-vscode"
							@click="open(vscodeInstallLink(name, studentUrl))"
						/>
						<p class="text-p-sm text-ink-gray-6">
							{{
								__(
									'VS Code did not open? Command Palette → MCP: Add Server → HTTP, and paste the address above.'
								)
							}}
						</p>
					</template>

					<template v-else-if="client === 'claude-code'">
						<p>{{ __('Run in the terminal:') }}</p>
						<div class="flex items-center gap-2">
							<code
								class="min-w-0 flex-1 truncate rounded bg-surface-gray-2 px-3 py-2 text-p-sm text-ink-gray-9"
								data-testid="agent-claude-code"
								>{{ claudeCodeCommand(name, studentUrl) }}</code
							>
							<Button
								variant="subtle"
								:label="__('Copy')"
								:aria-label="__('Copy the command')"
								@click="copy(claudeCodeCommand(name, studentUrl))"
							/>
						</div>
						<p>
							{{
								__('Then type /mcp in Claude Code and sign in to this site.')
							}}
						</p>
					</template>

					<template v-else>
						<p>
							{{
								__(
									'Any assistant that supports remote MCP servers connects with the same address. Sign-in is OAuth: the assistant opens this site, you sign in and allow access. No keys or tokens are needed.'
								)
							}}
						</p>
					</template>
				</div>
			</section>

			<section class="space-y-3">
				<h2 class="text-lg-semibold text-ink-gray-9">
					{{ __('What to say first') }}
				</h2>
				<p class="text-p-base text-ink-gray-7">
					{{
						__(
							'Write to the assistant in your own words — for example, one of these:'
						)
					}}
				</p>
				<ul class="space-y-2" data-testid="agent-prompts">
					<li
						v-for="prompt in prompts"
						:key="prompt"
						class="flex items-center gap-2 rounded-lg border p-2 ps-3"
					>
						<span class="flex-1 text-p-base text-ink-gray-9">{{ prompt }}</span>
						<Button
							variant="ghost"
							:label="__('Copy')"
							:aria-label="__('Copy the phrase: {0}').format(prompt)"
							@click="copy(prompt)"
						/>
					</li>
				</ul>
			</section>

			<section
				class="space-y-2 rounded-lg bg-surface-gray-2 p-4"
				data-testid="agent-web-chat"
			>
				<h2 class="text-lg-semibold text-ink-gray-9">
					{{ __('No suitable assistant?') }}
				</h2>
				<p class="text-p-base text-ink-gray-7">
					{{
						__(
							'While you have trial lessons left, take them in the browser with the platform agent — along the same route and with the same grading. Later you continue with your own assistant, and the progress is kept.'
						)
					}}
				</p>
				<Button
					variant="solid"
					link="/chat"
					:label="__('Study in the browser')"
					data-testid="agent-web-chat-link"
				/>
			</section>

			<section class="space-y-2">
				<h2 class="text-lg-semibold text-ink-gray-9">
					{{ __('Questions and problems') }}
				</h2>
				<details
					v-for="item in faq"
					:key="item.question"
					class="rounded-lg border px-4 py-3"
				>
					<summary
						class="cursor-pointer text-p-base font-medium text-ink-gray-9"
					>
						{{ item.question }}
					</summary>
					<p class="mt-2 text-p-base text-ink-gray-7">{{ item.answer }}</p>
				</details>
			</section>

			<section
				v-if="curatorUrl"
				class="space-y-2"
				data-testid="agent-connection-curator"
			>
				<h2 class="text-lg-semibold text-ink-gray-9">
					{{ __('For course authors') }}
				</h2>
				<p class="text-p-base text-ink-gray-7">
					{{
						__(
							'Courses are built through a second connector — connect it the same way, with this address:'
						)
					}}
				</p>
				<div class="flex items-center gap-2">
					<code
						class="min-w-0 flex-1 truncate rounded bg-surface-gray-2 px-3 py-2 text-p-base text-ink-gray-9"
						>{{ curatorUrl }}</code
					>
					<Button
						variant="subtle"
						:label="__('Copy')"
						:aria-label="__('Copy the authoring address')"
						@click="copy(curatorUrl)"
					/>
				</div>
				<p class="text-p-sm text-ink-gray-6">
					{{
						__(
							'Ask the assistant to call authoring_guide first: it is the build order and the platform rules.'
						)
					}}
				</p>
			</section>

			<p class="text-p-sm text-ink-gray-5">
				{{ __('The platform application is open under AGPL-3.0:') }}
				<a
					href="https://github.com/lms-high-time/learning-app"
					class="underline"
					>{{ __('source code') }}</a
				>.
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Button, toast, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import {
	agentConnections,
	claudeCodeCommand,
	cursorInstallLink,
	vscodeInstallLink,
} from '@/utils/agentConnection'

// «Connect an assistant»: where an assistant connects and how, for people who
// have never added a connector (learning-services#470, #471). The address is
// shown to a guest too: the assistant asks to sign in anyway.

const session = sessionStore()
const { userResource } = usersStore()

const origin = window.location.origin
// The router waits for the user before any page, so the roles are here.
const connections = computed(() => agentConnections(origin, userResource.data))
const studentUrl = computed(
	() => connections.value.find((c) => c.role === 'student')!.url
)
const curatorUrl = computed(
	() => connections.value.find((c) => c.role === 'curator')?.url ?? null
)
// What to call the connector — the site's own name, as the sidebar shows it.
const name = computed(() => session.branding?.data?.app_name || 'Learning')

const steps = [
	__("Add the address to your assistant's settings"),
	__('Sign in with your account on this site'),
	__('Write: «Show my courses»'),
]

type Client =
	| 'claude'
	| 'chatgpt'
	| 'cursor'
	| 'vscode'
	| 'claude-code'
	| 'other'
const clients: { value: Client; label: string }[] = [
	{ value: 'claude', label: 'Claude' },
	{ value: 'chatgpt', label: 'ChatGPT' },
	{ value: 'cursor', label: 'Cursor' },
	{ value: 'vscode', label: 'VS Code' },
	{ value: 'claude-code', label: 'Claude Code' },
	{ value: 'other', label: __('Other') },
]
const client = ref<Client>('claude')

// Left and right arrows, Home and End move between tabs (WAI-ARIA tabs).
const moveTab = async (event: KeyboardEvent) => {
	const values = clients.map((item) => item.value)
	const at = values.indexOf(client.value)
	const moves: Record<string, number> = {
		ArrowRight: (at + 1) % values.length,
		ArrowLeft: (at - 1 + values.length) % values.length,
		Home: 0,
		End: values.length - 1,
	}
	const next = moves[event.key]
	if (next === undefined) return
	event.preventDefault()
	client.value = values[next]
	await nextTick()
	document.getElementById(`agent-tab-${client.value}`)?.focus()
}

const prompts = [
	__('Show my courses'),
	__("Let's move on to the next lesson"),
	__('What about my homework?'),
	__('How is my progress in the course?'),
]

const faq = [
	{
		question: __('The assistant does not see the platform'),
		answer: __(
			'Check that the connector is on in this chat (in Claude: «+» → Connectors; in ChatGPT: «+» → Developer mode). If it is on, disconnect it in the assistant settings and connect again.'
		),
	},
	{
		question: __('The assistant asks permission at every step'),
		answer: __(
			'That is how assistants protect you before the platform records your answers. In Claude you can choose «Allow always» for this connector: it works only with your studies on this site.'
		),
	},
	{
		question: __('Sign-in fails or says there are too many connections'),
		answer: __(
			'No more than 5 connections per 10 minutes: each new connection registers the assistant anew. Wait ten minutes and do not reconnect without need.'
		),
	},
	{
		question: __('Is it safe?'),
		answer: __(
			'The assistant never sees your password: you sign in on this site, and the assistant gets access only to your studies here. You can disconnect it at any time in the assistant settings.'
		),
	},
]

// The install links use the clients' own schemes (`cursor:`, `vscode:`),
// which a bound href would not pass through `safeUrl`; a click opens them.
const open = (link: string) => window.location.assign(link)

const copy = async (text: string) => {
	try {
		await navigator.clipboard.writeText(text)
		toast.success(__('Copied'))
	} catch {
		toast.error(__('Could not copy'))
	}
}

usePageMeta(() => ({ title: __('Connect an assistant') }))
</script>
