<template>
	<form class="modal-card web-card-editor" @submit.prevent="submit">
		<header class="modal-card-head"><h2 class="modal-card-title">{{ creating ? 'Create icon' : title }}</h2></header>
		<IconDesigner v-if="creating" :initial="iconDesign" @apply="useCreatedIcon" @cancel="creating = false" />
		<section v-else class="modal-card-body">
			<b-field label="Name" label-for="card-name">
				<input id="card-name" v-model.trim="draft.name" class="input" maxlength="80" required>
			</b-field>
			<b-field label="Address" label-for="card-url">
				<input id="card-url" v-model.trim="draft.url" class="input" type="url" placeholder="https://example.com" maxlength="2048" required>
			</b-field>
			<b-field label="Icon URL" label-for="card-icon">
				<input id="card-icon" v-model.trim="iconURL" class="input" type="url" maxlength="2048" placeholder="https://example.com/icon.png" @input="clearFile">
			</b-field>
			<div class="icon-editor mt-4">
				<img v-if="fileIcon" :src="fileIcon" :alt="iconDesign ? 'Created icon' : 'Uploaded icon'" width="48" height="48">
				<div>
					<label for="card-icon-file" class="label">Upload an icon</label>
					<input id="card-icon-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg" @change="readIcon">
				</div>
				<b-button v-if="fileIcon" size="is-small" @click="clearFile">Clear icon</b-button>
			</div>
			<b-button class="mt-3" icon-left="palette-outline" :disabled="saving || processing" @click="creating = true">{{ iconDesign ? 'Edit created icon' : 'Create icon' }}</b-button>
			<div v-if="canRemove" class="buttons mt-4">
				<b-button size="is-small" :disabled="saving || !canMoveEarlier" @click="$emit('move', -1)">Move earlier</b-button>
				<b-button size="is-small" :disabled="saving || !canMoveLater" @click="$emit('move', 1)">Move later</b-button>
			</div>
			<p v-if="uploadError || error" class="has-text-danger mt-3" role="alert">{{ uploadError || error }}</p>
		</section>
		<footer v-if="!creating" class="modal-card-foot modal-actions">
			<b-button v-if="canRemove" type="is-danger is-light" :disabled="saving" @click="remove">{{ confirmRemoval ? 'Confirm removal' : 'Remove' }}</b-button>
			<div class="right-actions">
				<b-button :disabled="saving" @click="$emit('cancel')">Cancel</b-button>
				<b-button native-type="submit" type="is-primary" :loading="saving || processing" :disabled="!!uploadError">{{ canRemove ? 'Save' : 'Add card' }}</b-button>
			</div>
		</footer>
	</form>
</template>

<script setup>
import { computed, ref } from 'vue'
import IconDesigner from './IconDesigner.vue'

const props = defineProps({
	card: { type: Object, required: true },
	canRemove: Boolean,
	canMoveEarlier: Boolean,
	canMoveLater: Boolean,
	saving: Boolean,
	error: { type: String, default: '' },
})
const emit = defineEmits(['cancel', 'save', 'remove', 'move'])
const draft = ref({ ...props.card })
const fileIcon = ref(/^(data:image\/png;|\/api\/icons\/)/.test(props.card.icon) ? props.card.icon : '')
const iconURL = ref(fileIcon.value ? '' : props.card.icon)
const iconSource = ref(props.card.iconSource)
const iconDesign = ref(props.card.iconDesign)
const creating = ref(false)
const processing = ref(false)
const uploadError = ref('')
const confirmRemoval = ref(false)
const title = computed(() => props.canRemove ? 'Edit card' : 'Add card')
let selection = 0

function clearFile() {
	selection += 1
	fileIcon.value = ''
	iconSource.value = undefined
	iconDesign.value = undefined
	uploadError.value = ''
	processing.value = false
}

function readDataURL(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result)
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})
}

async function rasterise(file, svg) {
	const canvas = document.createElement('canvas')
	const source = svg ? URL.createObjectURL(file) : null
	let image
	try {
		if (source) {
			image = new Image()
			image.src = source
			await image.decode()
		} else {
			image = await createImageBitmap(file)
		}
		const width = image.naturalWidth ?? image.width
		const height = image.naturalHeight ?? image.height
		if (!width || !height) throw new Error('This icon has no visible size.')
		const scale = Math.min(1, 128 / Math.max(width, height))
		canvas.width = Math.max(1, Math.round(width * scale))
		canvas.height = Math.max(1, Math.round(height * scale))
		canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
		return canvas.toDataURL('image/png')
	} finally {
		if (source) URL.revokeObjectURL(source)
		else image?.close()
	}
}

async function readIcon(event) {
	const chosen = event.target.files?.[0]
	event.target.value = ''
	if (!chosen) return
	const current = ++selection
	uploadError.value = ''
	processing.value = true
	try {
		const svg = chosen.type === 'image/svg+xml' || /\.svg$/i.test(chosen.name)
		if ((!svg && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(chosen.type)) || chosen.size > 4 * 1024 * 1024) {
			throw new Error('Choose a PNG, JPEG, WebP, GIF, or SVG under 4 MB.')
		}
		const file = svg ? new Blob([chosen], { type: 'image/svg+xml' }) : chosen
		const [rendered, source] = await Promise.all([rasterise(file, svg), svg ? readDataURL(file) : undefined])
		if (current !== selection) return
		fileIcon.value = rendered
		iconSource.value = source
		iconDesign.value = undefined
		iconURL.value = ''
	} catch {
		if (current === selection) uploadError.value = 'Could not read the icon. Choose a valid image under 4 MB.'
	} finally {
		if (current === selection) processing.value = false
	}
}

function useCreatedIcon({ icon, design }) {
	clearFile()
	fileIcon.value = icon
	iconDesign.value = design
	iconURL.value = ''
	creating.value = false
}

function submit() {
	if (creating.value || processing.value || uploadError.value) return
	emit('save', {
		id: draft.value.id,
		name: draft.value.name,
		url: draft.value.url,
		icon: fileIcon.value || iconURL.value,
		iconSource: iconSource.value,
		iconDesign: iconDesign.value,
	})
}

function remove() {
	if (confirmRemoval.value) emit('remove')
	else confirmRemoval.value = true
}
</script>

<style scoped>
.web-card-editor { width: min(28rem, calc(100vw - 2rem)); }

.icon-editor {
	display: flex;
	align-items: end;
	gap: 0.75rem;
	flex-wrap: wrap;
}
.icon-editor img { object-fit: contain; border-radius: 0.5rem; }
.icon-editor > div, .icon-editor input { min-width: 0; max-width: 100%; }

.icon-editor input[type="file"] {
	font: inherit;
	font-size: 1rem;
}

.icon-editor input[type="file"]::file-selector-button {
	min-height: 2.75rem;
	margin-inline-end: 0.5rem;
	padding-inline: 0.75rem;
	border: 1px solid #c4ced6;
	border-radius: 0.4rem;
	background: #f1f5f9;
	color: #183343;
	font: inherit;
	cursor: pointer;
}

.icon-editor input[type="file"]:hover::file-selector-button { background: #e5edf5; }
</style>
