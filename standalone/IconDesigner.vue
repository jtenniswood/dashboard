<template>
	<section class="modal-card-body designer">
		<div class="designer-preview">
			<div class="icon-sample" :style="{ background: iconGradient(colour), color: iconForeground(colour) }" aria-label="Icon preview">
				<span v-if="ready" class="symbol" aria-hidden="true">{{ glyph(selectedCodepoint) }}</span>
			</div>
			<div class="colour-field">
				<span class="colour-label">Background colour</span>
				<ColourPalette :colour="colour" @select="colour = $event" />
			</div>
		</div>
		<b-field label="Material Symbols" label-for="icon-search">
			<input id="icon-search" v-model="search" class="input" type="search" placeholder="Search icons" autocomplete="off">
		</b-field>
		<p v-if="error" class="has-text-danger" role="alert">{{ error }}</p>
		<p v-else-if="!ready" role="status">Loading icons…</p>
		<p v-else-if="!matches.length" role="status">No matching icons.</p>
		<div v-else ref="grid" class="symbol-grid" aria-label="Matching icons">
			<button v-for="[name, codepoint] in matches" :key="name" v-memo="[name === symbol]" type="button"
				:aria-label="label(name)" :title="label(name)" :aria-pressed="name === symbol" @click="select(name, codepoint)">
				<span class="symbol" aria-hidden="true">{{ glyph(codepoint) }}</span>
			</button>
		</div>
	</section>
	<footer class="modal-card-foot modal-actions">
		<div class="right-actions">
			<b-button @click="$emit('cancel')">Back</b-button>
			<b-button type="is-primary" :disabled="!ready" @click="apply">Use icon</b-button>
		</div>
	</footer>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ColourPalette from './ColourPalette.vue'
import { defaultIconColour, drawMaterialIcon, glyph, iconForeground, iconGradient, loadMaterialSymbols } from './material-icon.js'

const props = defineProps({ initial: { type: Object, default: null } })
const emit = defineEmits(['apply', 'cancel'])

const featured = ['language', 'sync', 'home', 'folder', 'dns', 'storage', 'dashboard', 'movie', 'photo_camera', 'calendar_month',
	'checklist', 'monitoring', 'cloud', 'newspaper', 'music_note', 'terminal', 'hub', 'code', 'settings', 'public', 'vpn_key']

const symbol = ref(props.initial?.symbol || featured[0])
const colour = ref(props.initial?.colour || defaultIconColour)
const selectedCodepoint = ref('')
const icons = ref([])
const search = ref('')
const grid = ref(null)
const ready = ref(false)
const error = ref('')
const matches = computed(() => {
	const terms = search.value.trim().toLowerCase().split(/[\s_-]+/).filter(Boolean)
	if (!terms.length) return icons.value
	return icons.value.filter(([name]) => terms.every(term => name.includes(term)))
})

watch(search, () => {
	if (grid.value) grid.value.scrollTop = 0
}, { flush: 'post' })

function label(name) {
	return name.replaceAll('_', ' ')
}

function select(name, codepoint) {
	symbol.value = name
	selectedCodepoint.value = codepoint
}

onMounted(async () => {
	try {
		const byName = await loadMaterialSymbols()
		const picked = featured.filter(name => byName.has(name)).map(name => [name, byName.get(name)])
		icons.value = [...picked, ...[...byName].filter(([name]) => !featured.includes(name))]
		const initial = byName.has(symbol.value) ? symbol.value : featured[0]
		select(initial, byName.get(initial))
		ready.value = true
	} catch {
		error.value = 'Could not load the Material Symbols.'
	}
})

function apply() {
	if (!ready.value) return
	emit('apply', {
		icon: drawMaterialIcon(selectedCodepoint.value, colour.value),
		design: { symbol: symbol.value, colour: colour.value },
	})
}
</script>

<style>
@font-face {
	font-family: "Dashboard Material Symbols";
	src: url("./material-symbols/rounded.woff2") format("woff2");
	font-style: normal;
	font-weight: 500;
	font-display: block;
}
</style>

<style scoped>
.designer-preview {
	display: flex;
	align-items: center;
	gap: 1rem;
	margin-bottom: 1rem;
}

.icon-sample {
	display: grid;
	flex: 0 0 60px;
	height: 60px;
	place-items: center;
	border-radius: 12px;
	color: white;
	box-shadow: 0 2px 5px #152b4140;
}

.colour-field { flex: 1; min-width: 0; }
.colour-label { display: block; margin-bottom: 0.4rem; font-weight: 600; }

.symbol {
	font: 500 25px/1 "Dashboard Material Symbols";
}

.icon-sample .symbol { font-size: 41.25px; }

.symbol-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(2.35rem, 1fr));
	gap: 0.3rem;
	max-height: 13rem;
	overflow: auto;
	padding: 0.15rem;
}

.symbol-grid > button {
	display: grid;
	aspect-ratio: 1;
	place-items: center;
	border: 1px solid #dfe7ed;
	border-radius: 0.4rem;
	color: #183343;
	background: #f6f8fa;
	cursor: pointer;
}

.symbol-grid > button[aria-pressed="true"] {
	border-color: #2478ef;
	background: #e5f0ff;
}

.symbol-grid > button:focus-visible {
	outline: 2px solid #2478ef;
	outline-offset: -2px;
}

</style>
