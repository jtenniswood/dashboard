<template>
	<div class="dashboard is-dark-bg">
		<div class="wallpaper" :style="{ backgroundImage: 'url(/img/wallpaper/' + wallpaper + '.jpg)' }" aria-hidden="true"></div>
		<header class="dashboard-bar" aria-label="Dashboard controls">
			<h1 class="is-sr-only">Dashboard</h1>
			<div v-if="state" class="bar-actions">
				<button type="button" class="toolbar-button" aria-label="System overview" @click="openSystem">
					<b-icon icon="chart-box-outline" />
				</button>
				<button type="button" class="toolbar-button" aria-label="Settings" @click="openSettings">
					<b-icon icon="tune-vertical" />
				</button>
				<button type="button" class="toolbar-button" aria-label="Drive capacities" @click="storageOpen = true">
					<b-icon icon="harddisk" />
				</button>
				<button type="button" class="toolbar-button mobile-widgets" aria-label="Widgets" :aria-expanded="showWidgets" @click="showWidgets = !showWidgets">
					<b-icon icon="view-dashboard-outline" />
				</button>
			</div>
		</header>
		<main v-if="state" class="dashboard-layout container">
			<aside class="widget-column" :class="{ 'widgets-open': showWidgets }" aria-label="Widgets">
				<section v-for="widget in state.widgets" :key="widget" class="widget has-text-white">
					<div class="blur-background"></div>
					<div class="widget-content">
						<div class="widget-heading">
							<h2 class="widget-title">{{ widgetNames[widget] }}</h2>
							<button v-if="widget !== 'network'" type="button" class="plain-button" :aria-label="widget === 'system' ? 'System details' : 'Storage details'" @click="widget === 'system' ? openSystem() : storageOpen = true">
								<b-icon :icon="widget === 'system' ? 'chevron-right' : 'cog-outline'" />
							</button>
						</div>
						<template v-if="widget === 'storage'">
							<p v-if="!drives.length" class="mt-2">Reading drive capacities…</p>
							<div v-for="drive in drives" :key="drive.name" class="drive">
								<div class="drive-details">
									<img :src="storageIcon" alt="" width="64" height="64">
									<div>
										<p class="drive-name">{{ drive.name }}</p>
										<template v-if="drive.total">
											<p>Used: {{ size(drive.used) }}</p>
											<p>Total: {{ size(drive.total) }}</p>
										</template>
										<p v-else>Capacity unavailable</p>
									</div>
								</div>
								<b-progress v-if="drive.total" class="mt-2" size="is-small" type="is-info" :value="100 * drive.used / drive.total" :aria-label="drive.name + ' used'" />
							</div>
						</template>
						<p v-else-if="!metrics" class="mt-2">{{ metricsUnavailable ? 'Metrics unavailable' : 'Reading metrics…' }}</p>
						<div v-else-if="widget === 'system'" class="columns is-mobile mt-1">
							<div class="column is-half"><RadialBar :percent="metrics.cpuPercent" label="CPU" /></div>
							<div class="column is-half"><RadialBar :percent="metrics.ramPercent" :extend-content="size(metrics.ramTotal)" label="RAM" /></div>
						</div>
						<template v-else-if="metrics.network">
							<svg v-if="networkHistory.length > 1" class="network-chart" viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
								<polyline :points="networkLine('down')" class="download-line" />
								<polyline :points="networkLine('up')" class="upload-line" />
							</svg>
							<div class="is-flex is-flex-wrap-wrap network-rates mt-3 is-size-7">
								<span><b-icon icon="arrow-up" size="is-small" /> {{ size(metrics.network.up) }}/s</span>
								<span><b-icon icon="arrow-down" size="is-small" /> {{ size(metrics.network.down) }}/s</span>
							</div>
						</template>
						<p v-else class="mt-2">Network metrics unavailable</p>
					</div>
				</section>
				<button type="button" class="widget widget-settings" @click="openSettings">
					<div class="blur-background"></div>
					<span class="widget-content widget-heading"><span class="widget-title">Widget settings</span><b-icon icon="chevron-right" /></span>
				</button>
			</aside>

			<section class="main-column" aria-labelledby="apps-heading">
				<div class="section-heading">
					<h2 id="apps-heading">Apps</h2>
					<button type="button" class="plain-button" aria-label="Add web card" @click="openCard('web')">
						<b-icon icon="plus" />
					</button>
				</div>
				<p v-if="inventoryUnavailable" class="inventory-status" role="status">Docker inventory unavailable. Web cards are still available.</p>
				<div class="app-grid">
					<article v-for="card in cards" :key="card.kind + ':' + card.id" class="app-card common-card">
						<div class="blur-background"></div>
						<component :is="card.url ? 'a' : 'button'" class="app-link" :href="card.url || undefined"
							:type="card.url ? undefined : 'button'" :target="card.url ? '_blank' : undefined" :rel="card.url ? 'noopener noreferrer' : undefined"
							@click="!card.url && openCard(card.kind, card)">
							<img v-if="card.icon" :src="card.icon" alt="" width="64" height="64" @error="fallbackIcon">
							<span v-else class="tile-icon" :class="card.kind" aria-hidden="true">
								<b-icon :icon="card.kind === 'container' ? 'cube-outline' : 'web'" size="is-medium" />
							</span>
							<span class="one-line">{{ card.name }}</span>
						</component>
						<button type="button" class="plain-button card-action" :aria-label="'Edit ' + card.name" @click="openCard(card.kind, card)">
							<b-icon icon="dots-horizontal" />
						</button>
					</article>
					<button v-if="!cards.length && inventoryLoaded" type="button" class="app-card common-card empty-card" @click="openCard('web')">
						<div class="blur-background"></div>
						<span class="app-link"><b-icon icon="plus-circle-outline" size="is-large" aria-hidden="true" /><span>Add web card</span></span>
					</button>
				</div>
			</section>
		</main>
		<p v-else class="container has-text-white" role="status">
			{{ error || 'Loading dashboard…' }}
			<button v-if="error" type="button" class="button is-small ml-2" @click="load">Retry</button>
		</p>

		<b-modal v-model="cardOpen" has-modal-card :can-cancel="!saving" aria-role="dialog" aria-modal aria-label="Edit dashboard card">
			<CardEditor v-if="editingCard" :key="editingCard.kind + ':' + editingCard.id" :card="editingCard" :kind="editingCard.kind"
				:ports="editingCard.ports" :can-remove="webIndex >= 0" :can-move-earlier="webIndex > 0"
				:can-move-later="webIndex < state.links.length - 1" :error="error" :saving="saving"
				@save="saveCard" @cancel="cardOpen = false" @remove="deleteCard" @move="moveWeb" />
		</b-modal>

		<b-modal v-model="systemOpen" has-modal-card aria-role="dialog" aria-modal aria-label="System details">
			<div class="modal-card">
				<header class="modal-card-head"><h2 class="modal-card-title">System details</h2></header>
				<section class="modal-card-body">
					<p v-if="metrics">CPU {{ metrics.cpuPercent }}% · RAM {{ metrics.ramPercent }}% of {{ size(metrics.ramTotal) }}</p>
					<p v-else>Metrics unavailable</p>
					<p v-if="inventory.containers" class="mt-2">{{ inventory.containers.length }} running app containers</p>
				</section>
				<footer class="modal-card-foot"><b-button @click="systemOpen = false">Close</b-button></footer>
			</div>
		</b-modal>

		<b-modal v-model="storageOpen" has-modal-card aria-role="dialog" aria-modal aria-label="Drive capacities">
			<div class="modal-card">
				<header class="modal-card-head"><h2 class="modal-card-title">Drive capacities</h2></header>
				<section class="modal-card-body">
					<p v-if="!drives.length">No drive readings available.</p>
					<dl v-for="drive in drives" :key="drive.name" class="mb-4">
						<dt class="has-text-weight-semibold">{{ drive.name }}</dt>
						<dd v-if="drive.total">{{ size(drive.used) }} used · {{ size(drive.available) }} available · {{ size(drive.total) }} total</dd>
						<dd v-else>Capacity unavailable</dd>
					</dl>
				</section>
				<footer class="modal-card-foot"><b-button @click="storageOpen = false">Close</b-button></footer>
			</div>
		</b-modal>

		<b-modal v-model="settingsOpen" has-modal-card :can-cancel="!saving" aria-role="dialog" aria-modal aria-label="Dashboard settings">
			<form v-if="settings" class="modal-card" @submit.prevent="saveSettings">
				<header class="modal-card-head"><h2 class="modal-card-title">Dashboard settings</h2></header>
				<section class="modal-card-body">
					<b-field label="Appearance" label-for="theme">
						<div class="select"><select id="theme" v-model="settings.theme">
							<option value="system">Match this device</option>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
						</select></div>
					</b-field>
					<b-field label="Wallpaper" label-for="wallpaper">
						<div class="select"><select id="wallpaper" v-model="settings.wallpaper">
							<option value="wallpaper01">Wallpaper 1</option>
							<option value="wallpaper02">Wallpaper 2</option>
						</select></div>
					</b-field>
					<div class="settings-options mt-4">
						<b-checkbox v-for="(name, key) in widgetNames" :key="key" v-model="settings.widgets" :native-value="key">{{ name }}</b-checkbox>
					</div>
					<p v-if="error" class="has-text-danger mt-3" role="alert">{{ error }}</p>
				</section>
				<footer class="modal-card-foot modal-actions">
					<div class="right-actions">
						<b-button :disabled="saving" @click="settingsOpen = false">Cancel</b-button>
						<b-button native-type="submit" type="is-primary" :loading="saving">Save</b-button>
					</div>
				</footer>
			</form>
		</b-modal>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { nanoid } from 'nanoid'
import CardEditor from './CardEditor.vue'
import RadialBar from '@/components/widgets/RadialBar.vue'
import defaultIcon from '@/assets/img/app/default.svg'
import storageIcon from '@/assets/img/storage/storage.svg'
import { readThemePreference, setThemePreference } from '@/mixins/app/themePreference'

const widgetNames = { system: 'System status', storage: 'Storage', network: 'Network status' }
const state = ref(null)
const metrics = ref(null)
const networkHistory = ref([])
const metricsUnavailable = ref(false)
const error = ref('')
const saving = ref(false)
const showWidgets = ref(false)
const cardOpen = ref(false)
const settingsOpen = ref(false)
const systemOpen = ref(false)
const storageOpen = ref(false)
const editingCard = ref(null)
const settings = ref(null)
const inventory = ref({ containers: null, drives: null })
const inventoryLoaded = ref(false)
const inventoryUnavailable = computed(() => inventoryLoaded.value && inventory.value.containers === null)
const webIndex = computed(() => editingCard.value?.kind === 'web'
	? state.value.links.findIndex(link => link.id === editingCard.value.id)
	: -1)
const drives = computed(() => {
	const host = inventory.value.drives || []
	if (!metrics.value) return host
	const { diskTotal: total, diskUsed: used, diskAvailable: available } = metrics.value
	return [...host, { name: 'Docker data', total, used, available }]
})
const cards = computed(() => {
	if (!state.value) return []
	const custom = new Map(state.value.containers.map(card => [card.id, card]))
	const running = (inventory.value.containers || []).map(({ name, ports }) => ({
		id: name, name, url: '', icon: '', ...custom.get(name), kind: 'container', ports,
	}))
	return [...running, ...state.value.links.map(card => ({ ...card, kind: 'web' }))]
})
const wallpaper = computed(() => state.value?.wallpaper || 'wallpaper01')
let timer

async function load() {
	error.value = ''
	try {
		const response = await fetch('/api/dashboard')
		if (!response.ok) throw new Error('Could not load the dashboard.')
		state.value = await response.json()
	} catch {
		error.value = 'Could not load the dashboard.'
	}
}

async function refreshMetrics() {
	try {
		const response = await fetch('/api/metrics', { signal: AbortSignal.timeout(4500) })
		if (!response.ok) throw new Error()
		metrics.value = await response.json()
		metricsUnavailable.value = false
		if (metrics.value.network) networkHistory.value = [...networkHistory.value.slice(-24), metrics.value.network]
	} catch {
		metrics.value = null
		metricsUnavailable.value = true
	}
}

function networkLine(direction) {
	const points = networkHistory.value
	const max = Math.max(1, ...points.flatMap(({ up, down }) => [up, down]))
	return points.map((point, index) => `${200 * index / (points.length - 1)},${68 - 65 * point[direction] / max}`).join(' ')
}

function size(bytes) {
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
	const unit = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, bytes)) / 10)))
	return `${(bytes / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unit]}`
}

async function save(patch) {
	if (saving.value) return false
	saving.value = true
	error.value = ''
	try {
		const response = await fetch('/api/dashboard', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...state.value, ...patch }),
		})
		const result = await response.json()
		if (!response.ok) throw new Error(result.error)
		state.value = result
		return true
	} catch (failure) {
		error.value = failure.message || 'Could not save dashboard changes.'
		return false
	} finally {
		saving.value = false
	}
}

async function refreshInventory() {
	try {
		const response = await fetch('/api/inventory', { signal: AbortSignal.timeout(4500) })
		if (!response.ok) throw new Error()
		inventory.value = await response.json()
	} catch {
		inventory.value = { containers: null, drives: null }
	} finally {
		inventoryLoaded.value = true
	}
}

function openSystem() {
	systemOpen.value = true
}

function openCard(kind, card) {
	error.value = ''
	editingCard.value = card ? { ...card } : { id: nanoid(), name: '', url: '', icon: '', kind }
	cardOpen.value = true
}

async function saveCard(card) {
	const key = editingCard.value.kind === 'container' ? 'containers' : 'links'
	const collection = [...state.value[key]]
	const existing = collection.findIndex(item => item.id === card.id)
	if (existing >= 0) collection[existing] = card
	else collection.push(card)
	if (await save({ [key]: collection })) cardOpen.value = false
}

async function deleteCard() {
	const links = state.value.links.filter(link => link.id !== editingCard.value.id)
	if (await save({ links })) cardOpen.value = false
}

async function moveWeb(offset) {
	const links = [...state.value.links]
	const index = webIndex.value
	const to = index + offset
	if (index < 0 || to < 0 || to >= links.length) return
	const [link] = links.splice(index, 1)
	links.splice(to, 0, link)
	await save({ links })
}

function fallbackIcon(event) {
	if (event.target.getAttribute('src') !== defaultIcon) event.target.src = defaultIcon
}

function openSettings() {
	error.value = ''
	settings.value = {
		widgets: [...state.value.widgets],
		wallpaper: state.value.wallpaper,
		theme: readThemePreference(),
	}
	settingsOpen.value = true
}

async function saveSettings() {
	const { theme, ...patch } = settings.value
	patch.widgets = Object.keys(widgetNames).filter(widget => patch.widgets.includes(widget))
	if (await save(patch)) {
		setThemePreference(theme)
		settingsOpen.value = false
	}
}

onMounted(() => {
	load()
	refreshMetrics()
	refreshInventory()
	timer = setInterval(() => {
		refreshMetrics()
		refreshInventory()
	}, 5000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style lang="scss">
.dashboard {
	min-height: 100vh;
	padding-bottom: 2rem;
	background: #000;

	.wallpaper {
		position: fixed;
		inset: 0;
		background-position: center;
		background-size: cover;
		pointer-events: none;
	}

	.dashboard-bar {
		position: sticky;
		z-index: 20;
		top: 0;
		min-height: 42px;
		display: flex;
		align-items: center;
		padding-inline: 1.25rem;
		background: #343436;
		color: white;
	}

	.bar-actions, .section-heading, .widget-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.bar-actions { gap: 0.45rem; }

	.dashboard-layout {
		display: grid;
		grid-template-columns: minmax(222px, 1fr) minmax(0, 3.1fr);
		width: min(calc(100% - 3rem), 1344px);
		max-width: none;
		margin-top: 2rem;
		gap: 1rem;
	}

	.section-heading {
		min-height: 2rem;
		margin: 0 0 1rem;
		padding-inline: 0.5rem;
		color: white;

		h2 {
			font-size: 1.25rem;
			font-weight: 400;
			color: inherit;
		}
	}

	.toolbar-button, .plain-button {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2rem;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0.4rem;
		color: white;
		cursor: pointer;

		&:hover { background-color: #ffffff24; }
		&:focus-visible { outline: 2px solid white; outline-offset: 2px; }
	}

	.blur-background { inset: 0; pointer-events: none; }
	.widget-settings, .empty-card {
		border: 0;
		background: transparent;
		font: inherit;
		cursor: pointer;
	}
	.widget-settings { width: 100%; color: white; text-align: left; }
	.widget-settings .widget-content { padding-block: 0.85rem; }
	.drive { margin-top: 0.75rem; }
	.drive + .drive { margin-top: 1rem; }
	.drive-details { display: flex; gap: 0.65rem; align-items: center; font-size: 0.82rem; }
	.drive-name { color: #f4fbff; font-weight: 600; }
	.drive-details img { flex: 0 0 58px; }
	.inventory-status { color: white; margin: 0 0 0.75rem 0.5rem; }

	.app-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 1rem;
	}

	.app-link {
		position: absolute;
		inset: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 0;
		background: transparent;
		color: white;
		font: inherit;
		font-size: 0.875rem;
		text-align: center;
		cursor: pointer;

		img, .tile-icon {
			width: clamp(42px, 5vw, 64px);
			height: clamp(42px, 5vw, 64px);
			object-fit: contain;
			border-radius: 0.75rem;
		}
		span { max-width: 100%; }
		&:focus-visible { outline: 2px solid white; border-radius: inherit; }
	}

	.tile-icon {
		display: grid;
		place-items: center;
		background: #2a75cc;
		box-shadow: 0 1px 3px #0005;
	}
	.tile-icon.web { background: #10969b; }

	.card-action {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		width: 1.75rem;
		height: 1.75rem;
		opacity: 0;
		background: #18181855;
	}
	.app-card:hover .card-action, .app-card:focus-within .card-action { opacity: 1; }

	.mobile-widgets { display: none; }
	.network-rates { gap: 0.75rem; }
	.network-chart {
		display: block;
		width: 100%;
		height: 5.5rem;
		margin-top: 0.75rem;
		background: repeating-linear-gradient(0deg, #ffffff19 0 1px, transparent 1px 22px);
	}
	.network-chart polyline { fill: none; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
	.download-line { stroke: #8acbff; }
	.upload-line { stroke: #7ff2be; }
}

.modal-card { max-width: calc(100vw - 2rem); }
.modal-card .settings-options { display: grid; gap: 0.65rem; }
.modal-actions { display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
.right-actions { margin-left: auto; display: flex; gap: 0.5rem; }

@media (max-width: 1050px) {
	.dashboard .app-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 820px) {
	.dashboard .app-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
	.dashboard .dashboard-layout { display: block; width: calc(100% - 2rem); margin-top: 1.25rem; }
	.dashboard .widget-column { display: none; }
	.dashboard .widget-column.widgets-open { display: block; }
	.dashboard .mobile-widgets { display: grid; }
}
@media (max-width: 360px) {
	.dashboard .app-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (hover: none) {
	.dashboard .app-card .card-action { opacity: 1; }
}
</style>
