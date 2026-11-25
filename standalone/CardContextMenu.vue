<template>
	<Teleport to="body">
		<div v-if="entry" ref="menu" class="card-context-menu" role="menu"
			:aria-label="entry.card?.name ?? 'Add card'" :style="position" @keydown="navigate">
			<template v-if="entry.card">
				<a role="menuitem" tabindex="-1" :href="entry.card.url" target="_blank" rel="noopener noreferrer" @click="close">Open link</a>
				<button type="button" role="menuitem" tabindex="-1" @click="edit">Edit card</button>
				<button type="button" role="menuitem" tabindex="-1" :disabled="!entry.canMoveEarlier" @click="move(-1)">Move earlier</button>
				<button type="button" role="menuitem" tabindex="-1" :disabled="!entry.canMoveLater" @click="move(1)">Move later</button>
			</template>
			<button v-else type="button" role="menuitem" tabindex="-1" @click="edit">Add card</button>
		</div>
	</Teleport>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'

const emit = defineEmits(['edit', 'move'])
const menu = ref(null)
const entry = shallowRef(null)
const position = ref({ visibility: 'hidden' })
let opener

function items() {
	return [...menu.value.querySelectorAll('[role="menuitem"]:not(:disabled)')]
}

async function open(event, card, index, count) {
	const target = event.currentTarget
	opener = event.target.closest('a, button') || target.querySelector('a, button') || target
	const anchor = opener.getBoundingClientRect()
	const keyboard = event.type === 'keydown' || (!event.clientX && !event.clientY)
	const x = keyboard ? anchor.left : event.clientX
	const y = keyboard ? anchor.bottom : event.clientY
	const next = { card, canMoveEarlier: index > 0, canMoveLater: index >= 0 && index < count - 1 }
	entry.value = next
	position.value = { visibility: 'hidden' }
	await nextTick()
	if (entry.value !== next || !menu.value) return
	const { offsetWidth, offsetHeight } = menu.value
	position.value = {
		left: `${Math.max(8, Math.min(x, window.innerWidth - offsetWidth - 8))}px`,
		top: `${Math.max(8, Math.min(y, window.innerHeight - offsetHeight - 8))}px`,
	}
	await nextTick()
	if (entry.value === next && menu.value) items()[0]?.focus({ preventScroll: true })
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

function move(offset) {
	const id = entry.value.card.id
	dismiss()
	emit('move', id, offset)
}

function navigate(event) {
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
	window.addEventListener('scroll', close, true)
})

onUnmounted(() => {
	window.removeEventListener('pointerdown', closeOutside)
	window.removeEventListener('resize', close)
	window.removeEventListener('scroll', close, true)
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

[role="menuitem"] {
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

[role="menuitem"]:hover, [role="menuitem"]:focus-visible {
	background: #e8f2fc;
	outline: 0;
}

[role="menuitem"]:disabled {
	color: #71818b;
	background: transparent;
	cursor: default;
}
</style>
