import { createApp } from 'vue'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-sans/700.css'
import './style.css'
import App from './App.vue'
import { i18n } from './i18n'

createApp(App).use(i18n).mount('#app')
