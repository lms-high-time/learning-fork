/**
 * The page's language: `<html lang>`, which the server renders from the same
 * resolution the translations come from — the user's language, else the
 * language the site chose for the request (its `preferred_language` cookie),
 * else the system's (learning-services#765). Dates, sorting and plurals follow
 * it, so an English page does not show «28 сент.».
 */
export const pageLang = (): string =>
	(typeof document !== 'undefined' && document.documentElement.lang) ||
	(typeof window !== 'undefined' &&
		(window as Window & { lang?: string }).lang) ||
	'en'
