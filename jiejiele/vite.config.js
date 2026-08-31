import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: true,
    port: 5173
  },
  // Phaser 是大型 ESM 包，预打包可避免 dev 启动时大量请求/解析卡顿
  optimizeDeps: {
    include: ['phaser']
  }
})
