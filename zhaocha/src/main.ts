import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import 'vant/lib/index.css'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// 移动端调试面板（仅开发环境）
if (import.meta.env.DEV) {
  import('vconsole').then((m) => {
    // eslint-disable-next-line no-new
    new m.default()
  })
}
