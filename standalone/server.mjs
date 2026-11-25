import { createServer } from 'node:http'
import { createReadStream, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sampleMetrics } from './metrics.mjs'

const staticDir = fileURLToPath(new URL('../dist', import.meta.url)).replace(/\/$/, '')
const dataDir = resolve(process.env.DATA_DIR || './data')
const dataFile = resolve(dataDir, 'dashboard.json')
const port = Number(process.env.PORT || 8080)
const defaults = {
	revision: 0,
	links: [],
	wallpaper: 'wallpaper01',
	widgets: ['clock', 'system', 'storage', 'network'],
	search: true,
}
const mime = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webmanifest': 'application/manifest+json',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
}

mkdirSync(dataDir, { recursive: true })
let dashboard = defaults
try {
	dashboard = JSON.parse(readFileSync(dataFile, 'utf8'))
} catch (error) {
	if (error.code !== 'ENOENT') throw error
}
const metrics = sampleMetrics(dataDir)

function json(res, status, value) {
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
	res.end(JSON.stringify(value))
}

function validURL(value) {
	if (typeof value !== 'string' || value.length > 2048) return false
	try {
		const url = new URL(value)
		return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
	} catch {
		return false
	}
}

function validate(value) {
	if (!Number.isSafeInteger(value?.revision) || !Array.isArray(value.links) || value.links.length > 200
		|| !['wallpaper01', 'wallpaper02'].includes(value.wallpaper)
		|| !Array.isArray(value.widgets) || new Set(value.widgets).size !== value.widgets.length
		|| !value.widgets.every(widget => defaults.widgets.includes(widget))
		|| typeof value.search !== 'boolean') return false
	const ids = new Set()
	for (const link of value.links) {
		if (typeof link?.id !== 'string' || !/^[a-zA-Z0-9_-]{10,40}$/.test(link.id) || ids.has(link.id)
			|| typeof link.name !== 'string' || !link.name.trim() || link.name.length > 80
			|| !validURL(link.url) || (link.icon !== '' && !validURL(link.icon))) return false
		ids.add(link.id)
	}
	return true
}

async function save(req, res) {
	if (req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res, 415, { error: 'Expected JSON.' })
	if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') {
		return json(res, 403, { error: 'Open the dashboard directly to save changes.' })
	}
	let body = ''
	req.setEncoding('utf8')
	for await (const chunk of req) {
		body += chunk
		if (body.length > 1024 * 1024) return json(res, 413, { error: 'Dashboard data is too large.' })
	}
	let next
	try {
		next = JSON.parse(body)
	} catch {
		return json(res, 400, { error: 'Invalid dashboard data.' })
	}
	if (!validate(next)) return json(res, 400, { error: 'Use a name and valid HTTP or HTTPS URLs for each app.' })
	if (next.revision !== dashboard.revision) return json(res, 409, { error: 'The dashboard changed elsewhere. Reload to see the latest version.' })
	const { links, widgets, wallpaper, search } = next
	const updated = { revision: dashboard.revision + 1, links, widgets, wallpaper, search }
	writeFileSync(dataFile + '.tmp', JSON.stringify(updated), { mode: 0o600 })
	renameSync(dataFile + '.tmp', dataFile)
	dashboard = updated
	return json(res, 200, dashboard)
}

function serve(req, res, pathname) {
	const path = resolve(staticDir, '.' + (pathname === '/' ? '/index.html' : pathname))
	if (!path.startsWith(staticDir + sep)) return json(res, 404, { error: 'Not found.' })
	const file = statSync(path, { throwIfNoEntry: false })
	if (!file?.isFile()) return json(res, 404, { error: 'Not found.' })
	res.writeHead(200, {
		'Content-Type': mime[extname(path)] || 'application/octet-stream',
		'Content-Length': file.size,
		'Cache-Control': /\.[a-f0-9]{8}\./.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache',
	})
	if (req.method === 'HEAD') return res.end()
	const stream = createReadStream(path)
	stream.on('error', error => res.destroy(error))
	stream.pipe(res)
}

const server = createServer(async (req, res) => {
	res.setHeader('X-Content-Type-Options', 'nosniff')
	res.setHeader('X-Frame-Options', 'DENY')
	res.setHeader('Referrer-Policy', 'no-referrer')
	try {
		const pathname = decodeURIComponent(new URL(req.url, 'http://dashboard').pathname)
		if (pathname.includes('\0')) return json(res, 400, { error: 'Invalid request.' })
		if (req.method === 'PUT' && pathname === '/api/dashboard') return await save(req, res)
		if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' })
		if (pathname === '/healthz') return json(res, 200, { ok: true })
		if (pathname === '/api/dashboard') return json(res, 200, dashboard)
		if (pathname === '/api/metrics') return json(res, 200, metrics())
		return serve(req, res, pathname)
	} catch (error) {
		if (error instanceof URIError) return json(res, 400, { error: 'Invalid request.' })
		console.error(error)
		if (!res.headersSent) json(res, 500, { error: 'Dashboard storage or server error.' })
		else res.destroy()
	}
})
server.listen(port, '0.0.0.0', () => console.log(`Dashboard listening on port ${port}`))
