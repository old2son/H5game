import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

// 大家来找茬·护眼版 —— 基于工程内置的 Vite + Vue3 + TS 环境
export default defineConfig({
	plugins: [
		vue(),
		ViteImageOptimizer({
			png: {
				quality: 70
			},
			jpeg: {
				quality: 70
			},
			jpg: {
				quality: 70
			},
			webp: {
				quality: 70
			},
		})
	],
	base: './',
	server: {
		host: true,
		port: 5173
	},
	build: {
		target: 'es2018'
	}
});
