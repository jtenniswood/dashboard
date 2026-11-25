import { createApp } from 'vue'
import Buefy from 'buefy'
import Dashboard from './Dashboard.vue'
import { applyThemePreference, readThemePreference } from '@/mixins/app/themePreference'
import '@/assets/scss/app.scss'

applyThemePreference(readThemePreference())

createApp(Dashboard)
	.use(Buefy)
	.mount('#app')
