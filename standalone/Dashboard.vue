<template>
	<div class="dashboard is-dark-bg">
		<div class="wallpaper" :style="{ backgroundImage: 'url(/img/wallpaper/' + wallpaper + '.jpg)' }" aria-hidden="true"></div>
		<h1 class="is-sr-only">Dashboard</h1>
		<main v-if="state" class="dashboard-layout">
			<aside class="widget-column" aria-label="Widgets">
				<section v-for="widget in state.widgets" :key="widget" class="widget has-text-white" :class="{ 'storage-widget': widget === 'storage' }">
					<div class="blur-background"></div>
					<div class="widget-content">
						<h2 class="widget-title">{{ widgetNames[widget] }}</h2>
						<template v-if="widget === 'storage'">
							<p v-if="!drives.length" class="mt-2">Reading drive capacities…</p>
							<div v-for="drive in drives" :key="drive.name" class="drive">
								<div class="drive-details">
									<img :src="storageIcon" alt="" width="64" height="64">
									<div>
										<p class="drive-name">{{ drive.name }}</p>
										<div v-if="drive.total" class="drive-badges">
											<span class="drive-badge">
												<span class="is-sr-only">Total capacity </span>{{ driveSize(drive.total) }}
											</span>
											<span class="drive-badge">{{ Math.round(driveUsage(drive)) }}% used</span>
										</div>
										<p v-else>Capacity unavailable</p>
									</div>
								</div>
								<progress v-if="drive.total" class="drive-progress" :value="driveUsage(drive)" max="100" :aria-label="drive.name + ' used'"></progress>
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
			</aside>

			<section class="main-column" aria-label="Apps">
				<Draggable class="app-grid" :class="{ 'can-reorder': state.links.length > 1 }"
					:model-value="pendingOrder ?? state.links" item-key="id" draggable=".web-card"
					:disabled="saving || cardOpen || state.links.length < 2" :animation="150"
					:force-fallback="true" :fallback-tolerance="5" :delay-on-touch-only="true" :delay="180"
					:touch-start-threshold="5" filter=".card-action, .add-card" :prevent-on-filter="false"
					ghost-class="card-drop-position" fallback-class="card-drag-preview"
					@update:model-value="reorderCards">
					<template #item="{ element: card }">
						<article class="app-card common-card web-card">
							<div class="blur-background"></div>
							<a class="app-link" :href="card.url" target="_blank" rel="noopener noreferrer" draggable="false">
								<img v-if="card.icon" :src="card.icon" alt="" width="64" height="64" draggable="false" @error="fallbackIcon">
								<span v-else class="tile-icon" aria-hidden="true">
									<b-icon icon="web" size="is-medium" />
								</span>
								<span class="one-line">{{ card.name }}</span>
							</a>
							<button type="button" class="plain-button card-action" :aria-label="'Edit ' + card.name" :disabled="saving" @click="openCard(card)">
								<b-icon icon="dots-horizontal" />
							</button>
						</article>
					</template>
					<template #footer>
						<button type="button" class="app-card common-card add-card" :disabled="saving" @click="openCard()">
							<div class="blur-background"></div>
							<span class="app-link"><span class="add-symbol" aria-hidden="true">+</span><span>Add web card</span></span>
						</button>
					</template>
				</Draggable>
				<p v-if="error && !cardOpen" class="has-text-white mt-3" role="alert">{{ error }}</p>
			</section>
		</main>
		<p v-else class="container has-text-white" role="status">
			{{ error || 'Loading dashboard…' }}
			<button v-if="error" type="button" class="button is-small ml-2" @click="load">Retry</button>
		</p>

		<b-modal v-model="cardOpen" has-modal-card :can-cancel="!saving" aria-role="dialog" aria-modal aria-label="Edit dashboard card">
			<CardEditor v-if="editingCard" :key="editingCard.id" :card="editingCard"
				:can-remove="webIndex >= 0" :can-move-earlier="webIndex > 0"
				:can-move-later="webIndex < state.links.length - 1" :error="error" :saving="saving"
				@save="saveCard" @cancel="cardOpen = false" @remove="deleteCard" @move="moveWeb" />
		</b-modal>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { nanoid } from 'nanoid'
import Draggable from 'vuedraggable'
import CardEditor from './CardEditor.vue'
import RadialBar from '@/components/widgets/RadialBar.vue'
import defaultIcon from '@/assets/img/app/default.svg'
import storageIcon from '@/assets/img/storage/storage.svg'

const widgetNames = { system: 'System status', storage: 'Storage', network: 'Network status' }
const state = ref(null)
const metrics = ref(null)
const networkHistory = ref([])
const metricsUnavailable = ref(false)
const error = ref('')
const saving = ref(false)
const cardOpen = ref(false)
const editingCard = ref(null)
const pendingOrder = ref(null)
const hostDrives = ref([])
const webIndex = computed(() => state.value?.links.findIndex(link => link.id === editingCard.value?.id) ?? -1)
const drives = computed(() => {
	if (!metrics.value) return hostDrives.value
	const { diskTotal: total, diskUsed: used } = metrics.value
	return [...hostDrives.value, { name: 'Docker data', total, used }]
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

const capacityNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

function driveUsage(drive) {
	return Math.max(0, Math.min(100, 100 * drive.used / drive.total))
}

function driveSize(bytes) {
	const gigabytes = bytes / 1_000_000_000
	if (gigabytes >= 1000) return `${capacityNumber.format(gigabytes / 1000)} TB`
	return `${capacityNumber.format(Math.round(gigabytes))} GB`
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

async function refreshDrives() {
	try {
		const response = await fetch('/api/inventory', { signal: AbortSignal.timeout(4500) })
		if (!response.ok) throw new Error()
		const { drives } = await response.json()
		hostDrives.value = drives
	} catch {
		hostDrives.value = []
	}
}

function openCard(card) {
	error.value = ''
	editingCard.value = card ? { ...card } : { id: nanoid(), name: '', url: '', icon: '' }
	cardOpen.value = true
}

async function saveCard(card) {
	const links = [...state.value.links]
	if (webIndex.value >= 0) links[webIndex.value] = card
	else links.push(card)
	if (await save({ links })) cardOpen.value = false
}

async function deleteCard() {
	const links = state.value.links.filter(link => link.id !== editingCard.value.id)
	if (await save({ links })) cardOpen.value = false
}

async function reorderCards(links) {
	if (saving.value) return
	pendingOrder.value = links
	try {
		await save({ links })
	} finally {
		pendingOrder.value = null
	}
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

onMounted(() => {
	load()
	refreshMetrics()
	refreshDrives()
	timer = setInterval(() => {
		refreshMetrics()
		refreshDrives()
	}, 5000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style lang="scss">
.dashboard {
	min-height: 100vh;
	padding-block: 2rem;
	background: #000;

	.wallpaper {
		position: fixed;
		inset: 0;
		background-position: center;
		background-size: cover;
		pointer-events: none;
	}

	.dashboard-layout {
		position: relative;
		display: grid;
		grid-template-columns: minmax(222px, 1fr) minmax(0, 3.1fr);
		width: min(calc(100% - 3rem), 1344px);
		margin-inline: auto;
		gap: 1rem;
	}

	.plain-button {
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
	.add-card {
		order: 1;
		border: 0;
		background: transparent;
		font: inherit;
		cursor: pointer;
	}
	.widget-title {
		font-size: 1.375rem;
		line-height: 1.3;
	}

	.storage-widget > .blur-background {
		background-color: rgb(0 63 94 / 50%);
		border-color: rgb(191 236 255 / 12%);
	}

	.drive { margin-top: 0.75rem; }
	.drive + .drive { margin-top: 1rem; }
	.drive-details {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		color: #d8eaf4;
		font-size: 0.875rem;
		line-height: 1.45;
	}
	.drive-name { color: #f4fbff; font-weight: 600; }
	.drive-details img { flex: 0 0 58px; }
	.drive-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0.15rem 0 0.25rem;
	}
	.drive-badge {
		padding: 0 0.35rem;
		border: 1px solid currentColor;
		border-radius: 0.3rem;
		color: #6ce4ad;
		font-size: 0.75rem;
	}
	.drive-progress {
		display: block;
		appearance: none;
		width: 100%;
		height: 0.4rem;
		margin-top: 0.65rem;
		overflow: hidden;
		border: 0;
		border-radius: 999px;
		background: rgb(190 222 239 / 30%);

		&::-webkit-progress-bar { background: transparent; }
		&::-webkit-progress-value { background: #2478ef; border-radius: inherit; }
		&::-moz-progress-bar { background: #2478ef; border-radius: inherit; }
	}

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

	.can-reorder .web-card .app-link { cursor: grab; }

	.web-card.card-drop-position {
		outline: 2px dashed #b9e9ff;
		outline-offset: -3px;
		background: rgb(4 67 106 / 55%);
	}
	.card-drop-position > * { visibility: hidden; }
	.card-drag-preview { opacity: 0.9; }

	.tile-icon {
		display: grid;
		place-items: center;
		background: #10969b;
		box-shadow: 0 1px 3px #0005;
	}
	.add-symbol {
		font-size: clamp(2.75rem, 5vw, 3.75rem);
		font-weight: 300;
		line-height: 1;
	}

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

.modal-actions { display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
.right-actions { margin-left: auto; display: flex; gap: 0.5rem; }

@media (max-width: 1050px) {
	.dashboard .app-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 820px) {
	.dashboard .app-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
	.dashboard { padding-top: 1.25rem; }
	.dashboard .dashboard-layout { grid-template-columns: minmax(0, 1fr); width: calc(100% - 2rem); }
	.dashboard .main-column { grid-row: 1; }
}
@media (max-width: 360px) {
	.dashboard .app-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (hover: none) {
	.dashboard .app-card .card-action { opacity: 1; }
}
</style>
