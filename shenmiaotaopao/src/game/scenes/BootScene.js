import * as Phaser from 'phaser';
import { generateTextures } from '../textures.js';
import { createCloudTexture } from '../background.js';

// 启动场景：加载角色/障碍/地面图片、生成程序化纹理后进入菜单
export default class BootScene extends Phaser.Scene {
	constructor() {
		super('Boot');
	}

	preload() {
		// 角色跑步精灵图：512x64，8 帧 → 每帧 64x64。
		// 用 run_fixed.png（已把每帧人物下移到脚贴帧底，避免悬空；原图 run.png 保留）
		// 注意：路径用相对写法（不带前导 /），跟随 vite base 自动解析，
		// 部署在 /taopao/ 下会解析为 /taopao/characters/...，根目录部署则为 /characters/...
		this.load.spritesheet('run', 'characters/run_fixed.png', {
			frameWidth: 64,
			frameHeight: 64
		});
		// 障碍图片
		this.load.image('obs', 'boss/obs.png');
		// 地面图片（重复平铺）
		this.load.image('ground', 'backgrounds/ground.png');
	}

	create() {
		generateTextures(this);
		createCloudTexture(this); // 程序化云朵纹理（不使用图片）
		this.anims.create({
			key: 'run',
			frames: this.anims.generateFrameNumbers('run', { start: 0, end: 7 }),
			frameRate: 12,
			repeat: -1
		});
		this.scene.start('Menu');
	}
}
