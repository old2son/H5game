import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 大家来找茬·护眼版 —— 基于工程内置的 Vite + Vue3 + TS 环境
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2018',
  },
})
