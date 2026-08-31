import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from './config.js';

// 天空渐变背景（不再使用图片）
export function createSky(scene) {
	const g = scene.add.graphics();
	// 上深下浅的竖向渐变（topLeft/topRight 深，bottomLeft/bottomRight 浅）
	// Phaser 4 的 fillGradientStyle 第 5~8 参数为四角各自的 alpha
	g.fillGradientStyle(0x4a90d9, 0x4a90d9, 0xcdeafc, 0xcdeafc, 1, 1, 1, 1);
	g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
	g.setDepth(-100);
	return g;
}

// 程序化生成 CSS 风格云朵纹理（参考用户提供的 .cloud-item 样式）
export function createCloudTexture(scene) {
	if (scene.textures.exists('cloud')) return;
	const g = scene.make.graphics({ x: 0, y: 0, add: false });
	g.fillStyle(0xffffff, 1);
	// 主体药丸：175 x 55，border-radius 100px（半径取半高 → 全圆角）
	g.fillRoundedRect(0, 55, 175, 55, 27.5);
	// ::before：100 x 100 圆形，top:-90% right:10%
	g.fillCircle(100.5, 55.5, 50);
	// ::after：50 x 50 圆形，top:-54% left:14%
	g.fillCircle(49.5, 50.3, 25);
	g.generateTexture('cloud', 210, 115);
	g.destroy();
}

// 生成多朵随机云：大小、飘动速度、透明度均随机
export function createClouds(scene, count) {
	const clouds = [];
	for (let i = 0; i < count; i++) {
		const c = scene.add.image(
			Phaser.Math.Between(0, GAME_WIDTH),
			Phaser.Math.Between(70, Math.floor(GROUND_Y * 0.55)),
			'cloud'
		);
		c.setScale(Phaser.Math.FloatBetween(0.35, 0.85));
		c.setAlpha(Phaser.Math.FloatBetween(0.4, 0.85));
		c.setDepth(-90);
		c.cloudSpeed = Phaser.Math.FloatBetween(10, 32); // 飘动速度 px/秒
		clouds.push(c);
	}
	return clouds;
}
