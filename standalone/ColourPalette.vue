<template>
	<div class="colour-grid" role="group" :aria-label="label">
		<button v-for="[name, colour] in swatches" :key="colour" type="button" :aria-label="name" :title="name"
			:aria-pressed="selected === colour" :style="{ backgroundColor: colour }" @click="$emit('select', colour)"></button>
		<label class="custom-swatch" :class="{ selected: custom }" :style="{ backgroundColor: custom ? selected : undefined }" title="Custom colour">
			<b-icon icon="eyedropper" size="is-small" aria-hidden="true" />
			<input aria-label="Custom colour" type="color" :value="selected" @change="$emit('select', $event.target.value)">
		</label>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import { defaultIconColour } from './material-icon.js'

const props = defineProps({
	colour: { type: String, required: true },
	label: { type: String, default: 'Background colour' },
})
defineEmits(['select'])

const swatches = [
	['Red', '#e42f26'], ['Pink', '#d62e60'], ['Purple', '#8e279f'], ['Deep violet', '#5c35a4'], ['Indigo', '#3b499d'],
	['Green', '#65a953'], ['Emerald', '#3e8b6b'], ['Teal', '#4eafbf'], ['Blue', defaultIconColour], ['Royal blue', '#3a5fce'],
	['Lime', '#a9c84a'], ['Yellow-green', '#d5cd46'], ['Yellow', '#ebcb42'], ['Orange', '#f08b16'], ['Burnt orange', '#d54f2a'],
	['Black', '#202020'], ['Charcoal', '#303030'], ['Grey', '#7e7d84'], ['White', '#f4f4f4'],
]
const selected = computed(() => props.colour.toLowerCase())
const custom = computed(() => !swatches.some(([, colour]) => colour === selected.value))
</script>

<style scoped>
.colour-grid {
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 0.45rem;
	width: min(100%, 12rem);
}

.colour-grid > * {
	position: relative;
	display: grid;
	aspect-ratio: 1;
	min-width: 0;
	place-items: center;
	padding: 0;
	border: 1px solid #0003;
	border-radius: 50%;
	cursor: pointer;
}

.colour-grid button[aria-pressed="true"], .custom-swatch.selected { box-shadow: 0 0 0 1px white, 0 0 0 3px #183343; }
.colour-grid button:focus-visible, .custom-swatch:focus-within { outline: 2px solid #2478ef; outline-offset: 2px; }
.custom-swatch { border: 1px dashed #677a96; color: #183343; }
.custom-swatch.selected .icon {
	border-radius: 50%;
	background: white;
}
.custom-swatch input {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	opacity: 0;
	cursor: pointer;
}
</style>
