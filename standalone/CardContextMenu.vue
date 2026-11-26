<template>
	<Teleport to="body">
		<div v-if="entry" ref="menu" class="card-context-menu" :role="colouring ? 'group' : 'menu'"
			:aria-label="colouring ? 'Change colour' : entry.label" :style="position" @keydown="navigate">
			<div v-if="colouring" class="quick-colours">
				<button type="button" class="palette-action" @click="showColours(false)">‹ Back</button>
				<ColourPalette :colour="entry.card.iconDesign.colour" @select="recolour" />
				<button type="button" class="palette-action" :disabled="entry.card.iconDesign.colour === defaultIconColour"
					@click="recolour(defaultIconColour)">Reset colour</button>
			</div>
			<template v-else-if="entry.card">
				<a role="menuitem" tabindex="-1" :href="entry.card.url" target="_blank" rel="noopener noreferrer" @click="dismiss">Open link</a>
				<button type="button" role="menuitem" tabindex="-1" @click="edit">Edit card</button>
				<button v-if="entry.card.iconDesign" type="button" role="menuitem" tabindex="-1" @click="showColours(true)">Change colour ›</button>
				<button type="button" role="menuitem" tabindex="-1" :disabled="!entry.canMoveEarlier" @click="move(-1)">Move earlier</button>
				<button type="button" role="menuitem" tabindex="-1" :disabled="!entry.canMoveLater" @click="move(1)">Move later</button>
			</template>
			<button v-else-if="entry.wallpaper" type="button" role="menuitem" tabindex="-1" @click="chooseWallpaper">Change wallpaper</button>
			<button v-else type="button" role="menuitem" tabindex="-1" @click="edit">Add card</button>
		</div>
	</Teleport>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import ColourPalette from './ColourPalette.vue'
import { defaultIconColour } from './material-icon.js'

const emit = defineEmits(['edit', 'move', 'wallpaper', 'recolour'])
const menu = ref(null)
const entry = shallowRef(null)
const colouring = ref(false)
const position = ref({ visibility: 'hidden' })
let opener
let point

function items() {
	return [...menu.value.querySelectorAll('[role="menuitem"]:not(:disabled)')]
}

function fitMenu() {
	const { offsetWidth, offsetHeight } = menu.value
	position.value = {
		left: `${Math.max(8, Math.min(point.x, window.innerWidth - offsetWidth - 8))}px`,
		top: `${Math.max(8, Math.min(point.y, window.innerHeight - offsetHeight - 8))}px`,
	}
}

async function open(event, options) {
	opener = options.opener || event.target.closest('a, button') || event.currentTarget.querySelector('a, button') || event.currentTarget
	const anchor = opener.getBoundingClientRect()
	const keyboard = event.type === 'keydown' || (!event.clientX && !event.clientY)
	point = {
		x: keyboard ? anchor.left : event.clientX,
		y: keyboard ? (options.wallpaper ? anchor.top : anchor.bottom) : event.clientY,
	}
	colouring.value = false
	entry.value = options
	position.value = { visibility: 'hidden' }
	await nextTick()
	if (entry.value !== options || !menu.value) return
	fitMenu()
	await nextTick()
	if (entry.value === options && menu.value) items()[0]?.focus({ preventScroll: true })
}

async function showColours(show) {
	colouring.value = show
	await nextTick()
	if (!menu.value) return
	fitMenu()
	const target = show
		? menu.value.querySelector('.colour-grid [aria-pressed="true"], .custom-swatch.selected input')
		: items().find(button => button.textContent.startsWith('Change colour'))
	target?.focus({ preventScroll: true })
}

function recolour(colour) {
	const card = entry.value.card
	dismiss()
	emit('recolour', card.id, colour)
}

function close() {
	entry.value = null
	opener = undefined
}

function dismiss() {
	const target = opener
	close()
	target?.focus({ preventScroll: true })
}

function edit() {
	const card = entry.value.card
	dismiss()
	emit('edit', card)
}

function chooseWallpaper() {
	dismiss()
	emit('wallpaper')
}

function move(offset) {
	const id = entry.value.card.id
	dismiss()
	emit('move', id, offset)
}

function navigate(event) {
	if (colouring.value) {
		if (event.key === 'Escape') {
			event.preventDefault()
			showColours(false)
		}
		return
	}
	if (event.key === 'Escape' || event.key === 'Tab') {
		if (event.key === 'Escape') event.preventDefault()
		dismiss()
		return
	}
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
	event.preventDefault()
	const options = items()
	const current = options.indexOf(document.activeElement)
	const direction = event.key === 'ArrowDown' ? 1 : -1
	const next = event.key === 'Home' ? 0
		: event.key === 'End' ? options.length - 1
			: (current + direction + options.length) % options.length
	options[next]?.focus()
}

function closeOutside(event) {
	if (menu.value && !menu.value.contains(event.target)) close()
}

onMounted(() => {
	window.addEventListener('pointerdown', closeOutside)
	window.addEventListener('resize', close)
	window.addEventListener('wheel', close, { passive: true })
})

onUnmounted(() => {
	window.removeEventListener('pointerdown', closeOutside)
	window.removeEventListener('resize', close)
	window.removeEventListener('wheel', close)
})

defineExpose({ open, close })
</script>

<style scoped>
.card-context-menu {
	position: fixed;
	z-index: 100;
	display: grid;
	min-width: 10rem;
	max-width: calc(100vw - 1rem);
	padding: 0.3rem;
	border: 1px solid #d6e0e8;
	border-radius: 0.55rem;
	background: #fff;
	box-shadow: 0 4px 16px #00132250;
}

[role="menuitem"], .palette-action {
	display: block;
	padding: 0.45rem 0.65rem;
	border: 0;
	border-radius: 0.3rem;
	background: transparent;
	color: #183343;
	font: inherit;
	font-size: 0.875rem;
	text-align: left;
	cursor: pointer;
}

[role="menuitem"]:hover, [role="menuitem"]:focus-visible, .palette-action:hover, .palette-action:focus-visible {
	background: #e8f2fc;
	outline: 0;
}

[role="menuitem"]:disabled, .palette-action:disabled {
	color: #71818b;
	background: transparent;
	cursor: default;
}

.quick-colours { display: grid; gap: 0.5rem; padding: 0.2rem; }
.quick-colours .palette-action { justify-self: stretch; }
</style>
