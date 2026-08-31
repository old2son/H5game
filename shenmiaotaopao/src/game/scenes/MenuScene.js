import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, HS_KEY, DPR } from '../config.js';
import { createSky, createClouds } from '../background.js';

// 菜单场景：标题、玩法说明、最高分展示
export default class MenuScene extends Phaser.Scene {
	constructor() {
		super('Menu');
	}

	create() {
		// 高分屏锐化：画布内部分辨率已 ×DPR，用相机 zoom=DPR 并居中到世界中心，
		// 使可见区仍为 (0,0)-(GAME_WIDTH,GAME_HEIGHT) 的 CSS 坐标系，但按高清渲染（文字/图形清晰）
		this.cameras.main.setZoom(DPR);
		this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
		// 背景：天空渐变 + 随机云朵 + 地面（hill 已移除）
		createSky(this);
		createClouds(this, 5);
		// 地面：横向平铺；纵向只显示单层（按纹理自然高度拉伸填满，避免上下重复）
		const groundH = GAME_HEIGHT - GROUND_Y;
		const groundTexH = this.textures.get('ground').getSourceImage().height;
		this.add
			.tileSprite(GAME_WIDTH / 2, GROUND_Y, GAME_WIDTH, groundTexH, 'ground')
			.setOrigin(0.5, 0)
			.setScale(1, groundH / groundTexH)
			.setDepth(-70);

		// 标题
		this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.16, '逃跑', {
				fontFamily: 'sans-serif',
				fontSize: '64px',
				color: '#ffffff',
				fontStyle: 'bold',
				stroke: '#0277bd',
				strokeThickness: 8
			})
			.setOrigin(0.5);

		const hs = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
		this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38, '最远：' + hs + 'm', {
				lineSpacing: 10,
				padding: { top: 20 },
				color: '#fff59d',
				fontSize: '24px'
			})
			.setOrigin(0.5);

		const instr = [
			'点击屏幕 / 右侧按钮 = 跳跃',
			'左侧按钮 / 下滑 = 躲避横杆',
			'躲避障碍、收集金币，跑得越远越好'
		].join('\n');
		this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.58, instr, {
				padding: { top: 10 },
				lineSpacing: 10,
				align: 'center',
				fontSize: '18px',
				color: '#ffffff'
			})
			.setOrigin(0.5);

		const start = this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.8, '▶ 点击开始', {
				fontSize: '28px',
				color: '#ffffff',
				backgroundColor: '#43a047',
				padding: { x: 18, y: 10 }
			})
			.setOrigin(0.5);
		this.tweens.add({ targets: start, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

		const begin = () => this.scene.start('Game');
		this.input.keyboard.once('keydown-SPACE', begin);
		this.input.keyboard.once('keydown-UP', begin);
		this.input.once('pointerdown', begin);
	}
}
