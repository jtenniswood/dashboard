<template>
	<form class="modal-card web-card-editor" @submit.prevent="submit">
		<header class="modal-card-head"><h2 class="modal-card-title">{{ title }}</h2></header>
		<section class="modal-card-body">
			<b-field label="Name" label-for="card-name">
				<input id="card-name" v-model.trim="draft.name" class="input" maxlength="80" required>
			</b-field>
			<b-field label="Address" label-for="card-url">
				<input id="card-url" v-model.trim="draft.url" class="input" type="url" placeholder="https://example.com" maxlength="2048" required>
			</b-field>
			<b-field label="Icon URL" label-for="card-icon">
				<input id="card-icon" v-model.trim="iconURL" class="input" type="url" maxlength="2048" placeholder="https://example.com/icon.png" @input="clearUpload">
			</b-field>
			<div class="icon-editor mt-4">
				<img v-if="upload" :src="upload" alt="Uploaded icon" width="48" height="48">
				<div>
					<label for="card-icon-file" class="label">Upload an icon</label>
					<input id="card-icon-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="readIcon">
				</div>
				<b-button v-if="upload" size="is-small" @click="clearUpload">Clear upload</b-button>
			</div>
			<div v-if="canRemove" class="buttons mt-4">
				<b-button outlined size="is-small" :disabled="saving || !canMoveEarlier" @click="$emit('move', -1)">Move earlier</b-button>
				<b-button outlined size="is-small" :disabled="saving || !canMoveLater" @click="$emit('move', 1)">Move later</b-button>
			</div>
			<p v-if="uploadError || error" class="has-text-danger mt-3" role="alert">{{ uploadError || error }}</p>
		</section>
		<footer class="modal-card-foot modal-actions">
			<b-button v-if="canRemove" type="is-danger is-light" :disabled="saving" @click="remove">{{ confirmRemoval ? 'Confirm removal' : 'Remove' }}</b-button>
			<div class="right-actions">
				<b-button :disabled="saving" @click="$emit('cancel')">Cancel</b-button>
				<b-button native-type="submit" type="is-primary" :loading="saving || processing" :disabled="!!uploadError">{{ canRemove ? 'Save' : 'Add web card' }}</b-button>
			</div>
		</footer>
	</form>
</template>

<script setup>
import { computed, ref } from 'vue'

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
const upload = ref(props.card.icon.startsWith('data:image/png;') ? props.card.icon : '')
const iconURL = ref(upload.value ? '' : props.card.icon)
const processing = ref(false)
const uploadError = ref('')
const confirmRemoval = ref(false)
const title = computed(() => props.canRemove ? 'Edit web card' : 'Add web card')
let selection = 0

function clearUpload() {
	selection += 1
	upload.value = ''
	uploadError.value = ''
	processing.value = false
}

async function readIcon(event) {
	const file = event.target.files?.[0]
	event.target.value = ''
	if (!file) return
	const current = ++selection
	uploadError.value = ''
	processing.value = true
	try {
		if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 4 * 1024 * 1024) {
			throw new Error('Choose a PNG, JPEG, WebP, or GIF under 4 MB.')
		}
		const image = await createImageBitmap(file)
		if (current !== selection) {
			image.close()
			return
		}
		const scale = Math.min(1, 128 / Math.max(image.width, image.height))
		const canvas = document.createElement('canvas')
		canvas.width = Math.max(1, Math.round(image.width * scale))
		canvas.height = Math.max(1, Math.round(image.height * scale))
		canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
		image.close()
		upload.value = canvas.toDataURL('image/png')
		iconURL.value = ''
	} catch (error) {
		if (current === selection) uploadError.value = error.message || 'Could not read the icon.'
	} finally {
		if (current === selection) processing.value = false
	}
}

function submit() {
	if (processing.value || uploadError.value) return
	emit('save', { ...draft.value, icon: upload.value || iconURL.value })
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
</style>
