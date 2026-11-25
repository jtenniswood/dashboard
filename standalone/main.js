import { createApp } from 'vue'
import Buefy from 'buefy'
import Dashboard from './Dashboard.vue'
import '@/assets/scss/app.scss'

createApp(Dashboard)
	.use(Buefy)
	.mount('#app')
