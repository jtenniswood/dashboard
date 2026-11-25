import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import Buefy from 'buefy'
import { createStore } from 'vuex'
import Dashboard from './Dashboard.vue'
import { applyThemePreference, readThemePreference } from '@/mixins/app/themePreference'
import '@/assets/scss/app.scss'

applyThemePreference(readThemePreference())

createApp(Dashboard)
	.use(Buefy, {
		customIconPacks: {
			casa: {
				iconPrefix: 'casa-',
				sizes: { default: 'is-size-4', 'is-medium': 'is-size-3' },
			},
		},
	})
	.use(createI18n({ locale: 'en', messages: { en: { 'Search...': 'Search...' } } }))
	.use(createStore({ state: { searchEngine: '' } }))
	.mount('#app')
