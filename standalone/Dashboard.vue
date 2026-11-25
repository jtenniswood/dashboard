<template>
	<div class="dashboard is-dark-bg">
		<div class="wallpaper" :style="{ backgroundImage: 'url(/img/wallpaper/' + wallpaper + '.jpg)' }" aria-hidden="true"></div>
		<header class="dashboard-bar container">
			<h1>Dashboard</h1>
			<div class="bar-actions">
				<button v-if="state" type="button" class="glass-button mobile-widgets" aria-label="Widgets" :aria-expanded="showWidgets" @click="showWidgets = !showWidgets">
					<b-icon icon="view-dashboard-outline" />
				</button>
				<button v-if="state" type="button" class="glass-button" aria-label="Settings" @click="openSettings">
					<b-icon icon="cog-outline" />
				</button>
			</div>
		</header>

		<main v-if="state" class="dashboard-layout container">
			<aside class="widget-column" :class="{ 'widgets-open': showWidgets }" aria-label="Widgets">
				<template v-for="widget in state.widgets" :key="widget">
					<Clock v-if="widget === 'clock'" />
					<section v-else class="widget has-text-white">
						<div class="blur-background"></div>
						<div class="widget-content">
							<h2 class="widget-title">{{ widgetNames[widget] }}</h2>
							<p v-if="!metrics" class="mt-2">{{ metricsUnavailable ? 'Metrics unavailable' : 'Reading metrics…' }}</p>
							<div v-else-if="widget === 'system'" class="columns is-mobile mt-1">
								<div class="column is-half"><RadialBar :percent="metrics.cpuPercent" label="CPU" /></div>
								<div class="column is-half"><RadialBar :percent="metrics.ramPercent" label="RAM" /></div>
							</div>
							<template v-else-if="widget === 'storage'">
								<div class="is-flex is-align-items-center mt-2">
									<img :src="storageIcon" alt="" width="64" height="64">
									<p class="ml-3 is-size-7">Used {{ size(metrics.diskUsed) }}<br>Total {{ size(metrics.diskTotal) }}</p>
								</div>
								<b-progress class="mt-2" size="is-small" type="is-info" :value="100 * metrics.diskUsed / metrics.diskTotal" aria-label="Storage used" />
							</template>
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
				</template>
			</aside>

			<section class="main-column" aria-labelledby="apps-heading">
				<SearchBar v-if="state.search" />
				<div class="section-heading">
					<h2 id="apps-heading">Apps</h2>
					<button type="button" class="glass-button" aria-label="Add app link" @click="openLink()">
						<b-icon icon="plus" />
						<span class="is-sr-only">Add app link</span>
					</button>
				</div>
				<div class="app-grid">
					<article v-for="link in state.links" :key="link.id" class="app-card common-card">
						<div class="blur-background"></div>
						<a class="app-link" :href="link.url" target="_blank" rel="noopener noreferrer">
							<img :src="link.icon || defaultIcon" alt="" width="64" height="64" @error="fallbackIcon">
							<span class="one-line">{{ link.name }}</span>
						</a>
						<button type="button" class="glass-button card-action" :aria-label="'Edit ' + link.name" @click="openLink(link)">
							<b-icon icon="dots-horizontal" />
						</button>
					</article>
					<button v-if="!state.links.length" type="button" class="app-card common-card empty-card" aria-label="Add your first app" @click="openLink()">
						<div class="blur-background"></div>
						<span class="app-link">
							<b-icon icon="plus-circle-outline" size="is-large" />
							<span>Add your first app</span>
						</span>
					</button>
				</div>
			</section>
		</main>
		<p v-else class="container has-text-white" role="status">
			{{ error || 'Loading dashboard…' }}
			<button v-if="error" type="button" class="button is-small ml-2" @click="load">Retry</button>
		</p>

		<b-modal v-model="linkOpen" has-modal-card :can-cancel="!saving" aria-role="dialog" aria-modal aria-label="App link">
			<form v-if="linkDraft" class="modal-card" @submit.prevent="saveLink">
				<header class="modal-card-head"><h2 class="modal-card-title">{{ editing ? 'Edit app link' : 'Add external link' }}</h2></header>
				<section class="modal-card-body">
					<b-field label="Address" label-for="app-url"><input class="input" id="app-url" v-model.trim="linkDraft.url" type="url" placeholder="https://example.com" maxlength="2048" required /></b-field>
					<b-field label="App name" label-for="app-name"><input class="input" id="app-name" v-model.trim="linkDraft.name" maxlength="80" required /></b-field>
					<b-field label="Icon URL" label-for="app-icon"><input class="input" id="app-icon" v-model.trim="linkDraft.icon" type="url" maxlength="2048" placeholder="Optional" /></b-field>
					<div v-if="editing" class="buttons mt-4">
						<b-button outlined size="is-small" :disabled="saving || editingIndex === 0" @click="move(-1)">Move earlier</b-button>
						<b-button outlined size="is-small" :disabled="saving || editingIndex === state.links.length - 1" @click="move(1)">Move later</b-button>
					</div>
					<p v-if="error" class="has-text-danger" role="alert">{{ error }}</p>
				</section>
				<footer class="modal-card-foot modal-actions">
					<b-button v-if="editing" type="is-danger is-light" :disabled="saving" @click="deleteLink">{{ confirmingRemoval ? 'Confirm removal' : 'Remove' }}</b-button>
					<div class="right-actions">
						<b-button :disabled="saving" @click="linkOpen = false">Cancel</b-button>
						<b-button native-type="submit" type="is-primary" :loading="saving">{{ editing ? 'Save' : 'Connect' }}</b-button>
					</div>
				</footer>
			</form>
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
						<b-checkbox v-model="settings.search">Web search</b-checkbox>
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
import Clock from '@/widgets/Clock.vue'
import RadialBar from '@/components/widgets/RadialBar.vue'
import SearchBar from '@/components/SearchBar.vue'
import defaultIcon from '@/assets/img/app/default.svg'
import storageIcon from '@/assets/img/storage/storage.svg'
import { readThemePreference, setThemePreference } from '@/mixins/app/themePreference'

const widgetNames = { clock: 'Time', system: 'System Status', storage: 'Storage', network: 'Network Status' }
const state = ref(null)
const metrics = ref(null)
const networkHistory = ref([])
const metricsUnavailable = ref(false)
const error = ref('')
const saving = ref(false)
const showWidgets = ref(false)
const linkOpen = ref(false)
const settingsOpen = ref(false)
const linkDraft = ref(null)
const settings = ref(null)
const confirmingRemoval = ref(false)
const editingIndex = computed(() => state.value?.links.findIndex(link => link.id === linkDraft.value?.id) ?? -1)
const editing = computed(() => editingIndex.value !== -1)
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

function openLink(link) {
	error.value = ''
	confirmingRemoval.value = false
	linkDraft.value = link ? { ...link } : { id: nanoid(), name: '', url: '', icon: '' }
	linkOpen.value = true
}

async function saveLink() {
	const links = [...state.value.links]
	if (editing.value) links[editingIndex.value] = linkDraft.value
	else links.push(linkDraft.value)
	if (await save({ links })) linkOpen.value = false
}

async function deleteLink() {
	if (!confirmingRemoval.value) {
		confirmingRemoval.value = true
		return
	}
	const links = state.value.links.filter(link => link.id !== linkDraft.value.id)
	if (await save({ links })) linkOpen.value = false
}

async function move(offset) {
	const links = [...state.value.links]
	const index = editingIndex.value
	const to = index + offset
	if (to < 0 || to >= links.length) return
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
		search: state.value.search,
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
	timer = setInterval(refreshMetrics, 5000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style lang="scss">
.dashboard {
	min-height: 100vh;
	padding: 0 1.5rem 3rem;
	background: #000;

	.wallpaper {
		position: fixed;
		inset: 0;
		background-position: center;
		background-size: cover;
		pointer-events: none;
	}

	.dashboard-bar {
		min-height: 4.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: white;
	}

	h1 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		text-shadow: 0 1px 4px #2228;
	}

	.bar-actions, .section-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dashboard-layout {
		display: grid;
		grid-template-columns: minmax(222px, 1fr) minmax(0, 3fr);
		gap: 1rem;
	}

	.section-heading {
		justify-content: space-between;
		margin: 0.25rem 0 0.75rem;
		color: white;

		h2 {
			font-size: 1.5rem;
			font-weight: 600;
			text-shadow: 0 1px 4px #2228;
		}
	}

	.glass-button {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		background: var(--casa-glass);
		border: 1px solid #ffffff26;
		border-radius: 0.55rem;
		color: white;
		cursor: pointer;

		&:hover { background-color: #ffffff2e; }
		&:focus-visible { outline: 2px solid white; outline-offset: 2px; }
	}

	.blur-background { inset: 0; pointer-events: none; }

	.app-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
	}

	.app-link {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.75rem;
		color: white;
		font-weight: 500;
		text-align: center;

		img { object-fit: contain; border-radius: 0.5rem; }
		span { max-width: 100%; }
		&:focus-visible { outline: 2px solid white; border-radius: inherit; }
	}

	.empty-card {
		border: 0;
		background: transparent;
		font: inherit;
		cursor: pointer;
	}

	.card-action {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 1.75rem;
		height: 1.75rem;
		background: #18181855;
	}

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

@media (max-width: 820px) {
	.dashboard .app-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
	.dashboard { padding-inline: 1rem; }
	.dashboard .dashboard-layout { display: block; }
	.dashboard .widget-column { display: none; }
	.dashboard .widget-column.widgets-open { display: block; }
	.dashboard .mobile-widgets { display: grid; }
	.dashboard .app-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
