// What the assistant panel's iframe may say to the page (learning-services#463):
// `refresh` after the chat saved something the page shows, `close` from the
// chat's own Close button. Any window can post to ours, so a message counts
// only from the panel's frame, from the chat's origin, with a type on this
// list; anything else is dropped without a word.

export type PanelMessage = { type: 'refresh'; what: string } | { type: 'close' }

/** A message from the panel's iframe, or null when it is not ours. */
export function readPanelMessage(
	event: MessageEvent,
	frame: Window | null,
	panelOrigin: string
): PanelMessage | null {
	// No frame yet: `null === null` must not let a message through.
	if (!frame || event.source !== frame) return null
	if (event.origin !== panelOrigin) return null
	const data = event.data
	if (!data || typeof data !== 'object') return null
	if (data.type === 'close') return { type: 'close' }
	if (data.type === 'refresh' && typeof data.what === 'string')
		return { type: 'refresh', what: data.what }
	return null
}

/** The origin the panel at `url` answers from; relative URLs are ours. */
export function panelOriginOf(url: string): string {
	return new URL(url, window.location.href).origin
}
