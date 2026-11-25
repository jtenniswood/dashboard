const lookups = new Map()
const headLimit = 128 * 1024

function webURL(value, base) {
	try {
		const url = new URL(value, base)
		if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return null
		if (window.location.protocol === 'https:' && url.protocol !== 'https:') return null
		return url
	} catch {
		return null
	}
}

async function readHead(response) {
	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let head = ''
	let remaining = headLimit
	try {
		while (remaining > 0) {
			const { done, value } = await reader.read()
			if (done) return head + decoder.decode()
			head += decoder.decode(value.subarray(0, remaining), { stream: true })
			remaining -= value.length
			const end = /<\/head\s*>/i.exec(head)
			if (end) return head.slice(0, end.index)
		}
		return head
	} finally {
		reader.cancel().catch(() => {})
	}
}

async function declaredIcons(address) {
	try {
		const response = await fetch(address, {
			credentials: 'omit',
			redirect: 'error',
			referrerPolicy: 'no-referrer',
			signal: AbortSignal.timeout(3500),
		})
		if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/html')) return []
		const fragment = document.createElement('template')
		fragment.innerHTML = await readHead(response)
		const declaredBase = fragment.content.querySelector('base[href]')?.getAttribute('href')
		const pageURL = response.url || address
		const base = declaredBase ? webURL(declaredBase, pageURL)?.href || pageURL : pageURL
		const icons = [...fragment.content.querySelectorAll('link[rel~="apple-touch-icon" i][href], link[rel~="apple-touch-icon-precomposed" i][href]'),
			...fragment.content.querySelectorAll('link[rel~="icon" i][href]')]
		return icons.slice(0, 6).map(icon => webURL(icon.getAttribute('href'), base)?.href).filter(Boolean)
	} catch {
		return []
	}
}

export async function siteIcons(address) {
	const url = webURL(address)
	if (!url) return []
	url.search = ''
	url.hash = ''
	const key = url.href
	if (!lookups.has(key)) {
		const lookup = declaredIcons(key).then(icons => [...new Set([
			...icons,
			new URL('/apple-touch-icon.png', url).href,
			new URL('/favicon.ico', url).href,
			new URL('/favicon.png', url).href,
		])])
		lookups.set(key, lookup)
		if (lookups.size > 200) lookups.delete(lookups.keys().next().value)
	}
	return lookups.get(key)
}
