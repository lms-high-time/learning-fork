// «Connect your agent» (learning-services#470): where an MCP client connects
// for each role. The agent service lives on the site's own domain, next to
// the web chat (`/chat`), so the addresses follow the page's origin.

export type AgentRoles = {
	is_instructor?: boolean
	is_moderator?: boolean
}

export type AgentConnection = {
	role: 'student' | 'curator'
	url: string
}

export const STUDENT_PATH = '/mcp'
export const CURATOR_PATH = '/authoring'

// The authoring tools answer course creators and moderators only.
export const isAuthor = (user: AgentRoles | null | undefined): boolean =>
	Boolean(user?.is_instructor || user?.is_moderator)

export const agentConnections = (
	origin: string,
	user: AgentRoles | null | undefined
): AgentConnection[] => {
	const connections: AgentConnection[] = [
		{ role: 'student', url: `${origin}${STUDENT_PATH}` },
	]
	if (isAuthor(user)) {
		connections.push({ role: 'curator', url: `${origin}${CURATOR_PATH}` })
	}
	return connections
}

// One-click installs (learning-services#471), in the formats the clients
// document: Cursor takes the mcp.json entry base64-encoded, VS Code the
// `--add-mcp` object URL-encoded. The address is ASCII, so `btoa` is enough.
export const cursorInstallLink = (name: string, url: string): string =>
	`cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
		name
	)}&config=${btoa(JSON.stringify({ url }))}`

export const vscodeInstallLink = (name: string, url: string): string =>
	`vscode:mcp/install?${encodeURIComponent(
		JSON.stringify({ name, type: 'http', url })
	)}`

// A server name the terminal takes without quoting: the site's name in
// Latin letters, or `learning` when nothing Latin is left of it.
export const commandName = (name: string): string =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'learning'

export const claudeCodeCommand = (name: string, url: string): string =>
	`claude mcp add --transport http ${commandName(name)} ${url}`
