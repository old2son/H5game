import * as Phaser from 'phaser';

// 玩家角色：支持跑步 / 跳跃 / 下滑三种状态，碰撞体随状态变化
// 注：run.png 为 8 帧精灵图（每帧 64x64）。跳跃/下滑暂未出图，
// 临时以「拉高 / 缩小」同一张 run 图来表现。
export default class Player extends Phaser.Physics.Arcade.Sprite {
	constructor(scene, x, y) {
		super(scene, x, y, 'run');
		scene.add.existing(this);
		scene.physics.add.existing(this);
		this.setOrigin(0.5, 1); // 锚点在脚底中心，便于贴地
		this.setCollideWorldBounds(false);
		this.mode = null; // 'run' | 'jump' | 'slide'
		this.isSliding = false;
		this.stand();
	}

	// 设定碰撞体并强制底部贴脚底。
	// 纹理每帧 64x64、origin(0.5,1)：必须保持 offsetY + h === 64，
	// 否则 body 底部脱离脚底（浮空 / 陷地 / 跳不起来）。
	// x 为水平偏移（按美术构图微调），y 按帧高自动推导，改高度不再需手动算偏移。
	setBody(w, h, x) {
		const FRAME = 64;
		this.body.setSize(w, h);
		this.body.setOffset(x, FRAME - h);
	}

	// 跑步：只在状态切换时重设纹理/碰撞体，并强制保证 run 动画在播放
	stand() {
		if (this.mode !== 'run') {
			this.mode = 'run';
			this.isSliding = false;
			this.setTexture('run');
			this.setDisplaySize(96, 96);
			// 纹理 64x64：碰撞体 22x50，底部对齐 sprite 底边
			this.setBody(18, 29, 20);
			// 偏移由 setBody 按 64-高度 自动推导
		}
		// Phaser 的 stop() 后 currentAnim.key 仍为 'run'（仅暂停），
		// 因此直接 play(ignoreIfPlaying) 即可无缝续播/重启。
		this.anims.play('run', true);
	}

	// 下滑：暂无专属图，用同一张 run 图「缩小/压扁」并冻结一帧
	slide() {
		if (this.mode === 'slide') return;
		this.mode = 'slide';
		this.isSliding = true;
		this.anims.stop();
		this.setTexture('run');
		this.setFrame(2);
		this.setDisplaySize(110, 52);
		// 纹理 64x64：碰撞体 44x30，底部对齐底边
		this.setBody(44, 30, 10);
		// 偏移由 setBody 按 64-高度 自动推导
	}

	// 跳跃：暂无专属图，用同一张 run 图「拉高」并冻结一帧
	jump() {
		if (this.mode === 'jump') return;
		this.mode = 'jump';
		this.isSliding = false;
		this.anims.stop();
		this.setTexture('run');
		this.setFrame(0);
		this.setDisplaySize(80, 130);
		// 纹理 64x64：碰撞体 30x58，底部对齐底边
		this.setBody(30, 58, 8);
		// 偏移由 setBody 按 64-高度 自动推导
	}
}
