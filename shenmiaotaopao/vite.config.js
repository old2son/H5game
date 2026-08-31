import { defineConfig } from 'vite';

// 神秘跳跳跑（Phaser 2D 跑酷）—— 纯 JS + Vite 配置
export default defineConfig({
	// 相对 base：构建产物里的 JS/CSS 及代码内静态资源引用均为相对地址，
	// 部署在 /taopao/ 下会自动解析为 /taopao/...，部署到根目录或其它子路径也能用，
	// 避免把子路径写死导致 public 图片 404。
	base: './',
	server: {
		host: true,
		port: 5175
	}
});
