<template>
	<img v-if="source" :key="source" :src="source" :class="{ 'created-icon': created }" alt="" width="64" height="64" draggable="false"
		referrerpolicy="no-referrer" @error="nextIcon">
	<span v-else class="tile-icon" aria-hidden="true">
		<b-icon icon="web" size="is-medium" />
	</span>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { siteIcons } from './site-icons.js'

const props = defineProps({
	address: { type: String, required: true },
	icon: { type: String, default: '' },
	created: Boolean,
})

const candidates = ref([])
const index = ref(0)
const source = computed(() => candidates.value[index.value])

watch([() => props.address, () => props.icon], async ([address, icon], previous, onCleanup) => {
	index.value = 0
	candidates.value = icon ? [icon] : []
	if (icon) return

	let current = true
	onCleanup(() => { current = false })
	const found = await siteIcons(address)
	if (current) candidates.value = found
}, { immediate: true })

function nextIcon(event) {
	if (event.target.getAttribute('src') === source.value) index.value += 1
}
</script>
