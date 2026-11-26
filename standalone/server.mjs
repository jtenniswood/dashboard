import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sampleMetrics } from './metrics.mjs'
import { wallpapers } from './wallpapers.mjs'

const staticDir = fileURLToPath(new URL('../dist', import.meta.url)).replace(/\/$/, '')
const dataDir = resolve(process.env.DATA_DIR || './data')
const dataFile = resolve(dataDir, 'dashboard.json')
const iconDir = resolve(dataDir, 'icons')
const iconPath = /^\/api\/icons\/([a-f0-9]{64}\.png)$/
const originalFile = /^[a-f0-9]{64}\.svg$/
const pngPrefix = 'data:image/png;base64,'
const svgPrefix = 'data:image/svg+xml;base64,'
const svgLimit = 4 * 1024 * 1024
const inventoryFile = '/snapshot/inventory.json'
const widgetNames = ['system', 'storage', 'network']
const emptyInventory = { drives: [] }
const port = Number(process.env.PORT || 8080)
const defaults = {
	revision: 0,
	links: [],
	wallpaper: 'wallpaper01',
	widgets: ['system', 'storage'],
}
const mime = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
}

mkdirSync(iconDir, { recursive: true })
let dashboard = defaults
try {
	const saved = JSON.parse(readFileSync(dataFile, 'utf8'))
	const wasDefault = saved.widgets.join(',') === 'clock,system,storage,network'
	const widgets = wasDefault ? defaults.widgets : saved.widgets.filter(widget => widgetNames.includes(widget))
	const { revision, links } = saved
	const wallpaper = Object.hasOwn(wallpapers, saved.wallpaper) ? saved.wallpaper : defaults.wallpaper
	dashboard = { revision, links, wallpaper, widgets }
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

function decodeImage(value, prefix, maxLength) {
	if (typeof value !== 'string' || !value.startsWith(prefix) || value.length > maxLength) return null
	const encoded = value.slice(prefix.length)
	const bytes = Buffer.from(encoded, 'base64')
	return bytes.length > 0 && bytes.toString('base64') === encoded ? bytes : null
}

function validIcon(value) {
	if (value === '' || validURL(value)) return true
	const file = typeof value === 'string' && iconPath.exec(value)?.[1]
	if (file) return existsSync(resolve(iconDir, file))
	const png = decodeImage(value, pngPrefix, 100000)
	return png && png.length >= 33
		&& png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
		&& png.toString('ascii', 12, 16) === 'IHDR'
		&& png.readUInt32BE(16) > 0 && png.readUInt32BE(16) <= 128
		&& png.readUInt32BE(20) > 0 && png.readUInt32BE(20) <= 128
}

function validIconDetails({ icon, iconSource, iconDesign }) {
	if (iconSource === undefined && iconDesign === undefined) return true
	if (!icon.startsWith(pngPrefix) && !iconPath.test(icon)) return false
	if (iconDesign !== undefined) {
		return iconSource === undefined && typeof iconDesign?.symbol === 'string' && typeof iconDesign.colour === 'string'
			&& /^[a-z0-9_]{1,80}$/.test(iconDesign.symbol) && /^#[a-f0-9]{6}$/i.test(iconDesign.colour)
	}
	if (typeof iconSource !== 'string') return false
	if (originalFile.test(iconSource)) return existsSync(resolve(iconDir, iconSource))
	const svg = decodeImage(iconSource, svgPrefix, svgPrefix.length + Math.ceil(svgLimit / 3) * 4)
	return svg && svg.length <= svgLimit && /<svg(?:[\s>/])/i.test(svg.toString('utf8'))
}

function storeIcon(dataURL, prefix, extension) {
	const bytes = Buffer.from(dataURL.slice(prefix.length), 'base64')
	const filename = createHash('sha256').update(bytes).digest('hex') + extension
	const path = resolve(iconDir, filename)
	if (!existsSync(path)) {
		writeFileSync(path + '.tmp', bytes, { mode: 0o600 })
		renameSync(path + '.tmp', path)
	}
	return filename
}

function storeCard({ id, name, url, icon, iconSource, iconDesign }) {
	const card = { id, name, url, icon }
	if (icon.startsWith(pngPrefix)) card.icon = '/api/icons/' + storeIcon(icon, pngPrefix, '.png')
	if (iconSource) card.iconSource = iconSource.startsWith(svgPrefix) ? storeIcon(iconSource, svgPrefix, '.svg') : iconSource
	if (iconDesign) card.iconDesign = { symbol: iconDesign.symbol, colour: iconDesign.colour }
	return card
}

function validCards(cards) {
	if (!Array.isArray(cards) || cards.length > 200) return false
	const ids = new Set()
	for (const card of cards) {
		if (typeof card?.id !== 'string' || !/^[a-zA-Z0-9_-]{10,40}$/.test(card.id) || ids.has(card.id)
			|| typeof card.name !== 'string' || !card.name.trim() || card.name.length > 80
			|| !validURL(card.url)
			|| !validIcon(card.icon) || !validIconDetails(card)) return false
		ids.add(card.id)
	}
	return true
}

function validate(value) {
	return Number.isSafeInteger(value?.revision)
		&& Object.hasOwn(wallpapers, value.wallpaper)
		&& Array.isArray(value.widgets) && new Set(value.widgets).size === value.widgets.length
		&& value.widgets.every(widget => widgetNames.includes(widget))
		&& validCards(value.links)
}

function inventory() {
	try {
		const snapshot = JSON.parse(readFileSync(inventoryFile, 'utf8'))
		if (Date.now() - snapshot.sampledAt < 20000 && Array.isArray(snapshot.drives)) return { drives: snapshot.drives }
	} catch (error) {
		if (error.code !== 'ENOENT') console.error(error.message)
	}
	return emptyInventory
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
		if (body.length > 8 * 1024 * 1024) return json(res, 413, { error: 'Dashboard data is too large.' })
	}
	let next
	try {
		next = JSON.parse(body)
	} catch {
		return json(res, 400, { error: 'Invalid dashboard data.' })
	}
	if (!validate(next)) return json(res, 400, { error: 'Check the card names, HTTP or HTTPS addresses, and icons.' })
	if (next.revision !== dashboard.revision) return json(res, 409, { error: 'The dashboard changed elsewhere. Reload to see the latest version.' })
	const { links, widgets, wallpaper } = next
	const updated = {
		revision: dashboard.revision + 1,
		links: links.map(storeCard),
		widgets,
		wallpaper,
	}
	writeFileSync(dataFile + '.tmp', JSON.stringify(updated), { mode: 0o600 })
	renameSync(dataFile + '.tmp', dataFile)
	dashboard = updated
	return json(res, 200, dashboard)
}

function serve(req, res, pathname) {
	const path = resolve(staticDir, '.' + (pathname === '/' ? '/index.html' : pathname))
	if (!path.startsWith(staticDir + sep)) return json(res, 404, { error: 'Not found.' })
	return serveFile(req, res, path, /\.[a-f0-9]{8}\./.test(path))
}

function serveFile(req, res, path, immutable) {
	const file = statSync(path, { throwIfNoEntry: false })
	if (!file?.isFile()) return json(res, 404, { error: 'Not found.' })
	res.writeHead(200, {
		'Content-Type': mime[extname(path)] || 'application/octet-stream',
		'Content-Length': file.size,
		'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
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
		if (pathname === '/api/inventory') return json(res, 200, inventory())
		const icon = iconPath.exec(pathname)
		if (icon) return serveFile(req, res, resolve(iconDir, icon[1]), true)
		return serve(req, res, pathname)
	} catch (error) {
		if (error instanceof URIError) return json(res, 400, { error: 'Invalid request.' })
		console.error(error)
		if (!res.headersSent) json(res, 500, { error: 'Dashboard storage or server error.' })
		else res.destroy()
	}
})
server.listen(port, '0.0.0.0', () => console.log(`Dashboard listening on port ${port}`))
