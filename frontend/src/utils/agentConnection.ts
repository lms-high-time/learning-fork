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
