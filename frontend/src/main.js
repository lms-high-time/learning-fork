import './index.css'
import { createApp, watch } from 'vue'
import router from './router'
import App from './App.vue'
import { createPinia } from 'pinia'
import dayjs from '@/utils/dayjs'
import { createDialog } from '@/utils/dialogs'
import translationPlugin, { translationsReady } from './translation'
import { usersStore } from './stores/user'
import { initSocket } from './socket'
import { FrappeUI, setConfig, frappeRequest, pageMetaPlugin } from 'frappe-ui'
import { installTelemetry } from './telemetry'
import { registerDirectives } from './directives'

let pinia = createPinia()
let app = createApp(App)
setConfig('resourceFetcher', frappeRequest)

app.use(FrappeUI)
app.use(pinia)
app.use(router)
app.use(translationPlugin)
app.use(pageMetaPlugin)
registerDirectives(app)
app.provide('$dayjs', dayjs)
app.provide('$socket', initSocket())
// After the translations, so the first paint is already Russian — strings a
// component builds once in setup would not update on a late answer (#564).
translationsReady().then(() => app.mount('#app'))

const { userResource, allUsers } = usersStore()
app.provide('$user', userResource)
app.provide('$allUsers', allUsers)

watch(userResource, () => {
	if (userResource.data) {
		installTelemetry(app)
	}
})

app.config.globalProperties.$user = userResource
app.config.globalProperties.$dialog = createDialog
