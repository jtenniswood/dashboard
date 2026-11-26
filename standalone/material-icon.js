export const defaultIconColour = '#2878c9'
const iconFont = '500 88px "Dashboard Material Symbols"'
let library

export function loadMaterialSymbols() {
	if (!library) {
		library = Promise.all([
			fetch('/material-symbols/rounded-codepoints.txt'),
			document.fonts.load(iconFont, '\ue894'),
		]).then(async ([response, faces]) => {
			if (!response.ok || !faces.length) throw new Error('Could not load the Material Symbols.')
			return new Map((await response.text()).trim().split('\n').map(row => row.trim().split(/\s+/)))
		}).catch(error => {
			library = undefined
			throw error
		})
	}
	return library
}

function gradientChannels(colour) {
	const channels = colour.slice(1).match(/../g).map(channel => parseInt(channel, 16))
	return [
		channels.map(channel => Math.round(channel + (255 - channel) * 0.10)),
		channels.map(channel => Math.round(channel * 0.82)),
	]
}

const rgb = channels => `rgb(${channels.join(', ')})`

export function iconGradient(colour) {
	return `linear-gradient(160deg, ${gradientChannels(colour).map(rgb).join(', ')})`
}

function luminance(channels) {
	const linear = channels.map(channel => channel / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

export function iconForeground(colour) {
	const [light, dark] = gradientChannels(colour).map(luminance)
	const whiteContrast = 1.05 / (light + 0.05)
	const charcoalContrast = (dark + 0.05) / (luminance([24, 51, 67]) + 0.05)
	return whiteContrast >= charcoalContrast ? 'white' : '#183343'
}

export function glyph(codepoint) {
	return String.fromCodePoint(parseInt(codepoint, 16))
}

export function drawMaterialIcon(codepoint, colour) {
	const canvas = document.createElement('canvas')
	canvas.width = 128
	canvas.height = 128
	const context = canvas.getContext('2d')
	const fill = context.createLinearGradient(40, 0, 86, 128)
	const [light, dark] = gradientChannels(colour).map(rgb)
	fill.addColorStop(0, light)
	fill.addColorStop(1, dark)
	context.fillStyle = fill
	context.beginPath()
	context.roundRect(0, 0, 128, 128, 25)
	context.fill()
	context.fillStyle = iconForeground(colour)
	context.font = iconFont
	context.textAlign = 'center'
	context.textBaseline = 'middle'
	context.fillText(glyph(codepoint), 64, 64)
	return canvas.toDataURL('image/png')
}
