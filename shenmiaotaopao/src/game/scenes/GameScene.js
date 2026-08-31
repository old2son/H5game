import * as Phaser from 'phaser';
import {
	GAME_WIDTH,
	GAME_HEIGHT,
	GROUND_Y,
	PLAYER_X,
	JUMP_VELOCITY,
	START_SPEED,
	MAX_SPEED,
	SPEED_ACCEL,
	HS_KEY,
	DPR
} from '../config.js';
import { createSky, createClouds } from '../background.js';
import Player from '../objects/Player.js';

// 核心游戏场景：奔跑、跳跃、下滑、障碍生成、金币收集、计分与结算
export default class GameScene extends Phaser.Scene {
	constructor() {
		super('Game');
	}

	create() {
		// 高分屏锐化：画布内部分辨率已 ×DPR，用相机 zoom=DPR 并居中到世界中心，
		// 使可见区仍为 (0,0)-(GAME_WIDTH,GAME_HEIGHT) 的 CSS 坐标系，但按高清渲染（文字/图形清晰）
		this.cameras.main.setZoom(DPR);
		this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
		this.isGameOver = false;
		this.speed = START_SPEED;
		this.distance = 0;
		this.coins = 0;
		this.nextObstacle = 1100;
		this.nextCoin = 500;

		// 背景：天空渐变 + 随机云朵 + 地面（hill 已移除）
		createSky(this);
		this.clouds = createClouds(this, 6);
		// 地面：横向平铺滚动；纵向只显示单层（按纹理自然高度拉伸填满，避免上下重复）
		const groundH = GAME_HEIGHT - GROUND_Y;
		const groundTexH = this.textures.get('ground').getSourceImage().height;
		this.ground = this.add
			.tileSprite(GAME_WIDTH / 2, GROUND_Y, GAME_WIDTH, groundTexH, 'ground')
			.setOrigin(0.5, 0)
			.setScale(1, groundH / groundTexH)
			.setDepth(-70);

		// 不可见的地面物理体，让玩家能「落地」
		this.groundBody = this.physics.add.staticImage(GAME_WIDTH / 2, GROUND_Y + 20, 'pixel');
		this.groundBody.setDisplaySize(GAME_WIDTH, 40).refreshBody();
		this.groundBody.setVisible(false);

		// 玩家
		this.player = new Player(this, PLAYER_X, GROUND_Y);
		this.physics.add.collider(this.player, this.groundBody);

		// 障碍 / 金币分组（不受重力影响）
		this.obstacles = this.physics.add.group({ allowGravity: false });
		this.coinsGroup = this.physics.add.group({ allowGravity: false });

		this.physics.add.overlap(this.player, this.obstacles, this.onHit, null, this);
		this.physics.add.overlap(this.player, this.coinsGroup, this.onCoin, null, this);

		// 奔跑尘土粒子
		this.dust = this.add.particles(0, 0, 'pixel', {
			speed: { min: 20, max: 70 },
			angle: { min: 150, max: 210 },
			lifespan: 350,
			scale: { start: 1.2, end: 0 },
			alpha: { start: 0.6, end: 0 },
			tint: 0xffffff,
			frequency: 50,
			follow: this.player,
			followOffset: { x: -6, y: -4 }
		});

		// 键盘输入
		this.input.keyboard.on('keydown-SPACE', () => this.tryJump());
		this.input.keyboard.on('keydown-UP', () => this.tryJump());
		this.input.keyboard.on('keydown-W', () => this.tryJump());
		this.input.keyboard.on('keydown-DOWN', () => this.setSlide(true));
		this.input.keyboard.on('keyup-DOWN', () => this.setSlide(false));
		this.input.keyboard.on('keydown-S', () => this.setSlide(true));
		this.input.keyboard.on('keyup-S', () => this.setSlide(false));
		// 点击屏幕跳跃（点在按钮上时不触发，避免重复）
		this.input.on('pointerdown', (pointer, over) => {
			if (over && over.length > 0) return;
			this.tryJump();
		});

		this.createTouchButtons();

		// HUD
		this.scoreText = this.add.text(20, 16, '距离 0m', {
			fontFamily: 'sans-serif',
			fontSize: '28px',
			color: '#ffffff',
			stroke: '#000',
			strokeThickness: 4
		});
		this.coinText = this.add.text(20, 52, '👑 0', {
			fontSize: '24px',
			color: '#fff59d',
			stroke: '#000',
			strokeThickness: 4
		});
		this.highScore = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
		this.hsText = this.add
			.text(GAME_WIDTH - 20, 16, '最远 ' + this.highScore + 'm', {
				padding: { top: 10 },
				color: '#ffffff',
				fontSize: '22px',
				stroke: '#000',
				strokeThickness: 4
			})
			.setOrigin(1, 0);
	}

	// 移动端两个虚拟按钮：跳跃（右）、下滑（左）
	createTouchButtons() {
		const mkBtn = (x, label) => {
			this.add.circle(x, GAME_HEIGHT - 70, 44, 0x000000, 0.28).setInteractive({ useHandCursor: true });
			this.add.text(x, GAME_HEIGHT - 70, label, { fontSize: '28px', color: '#fff' }).setOrigin(0.5);
		};
		const jumpBtn = this.add
			.circle(GAME_WIDTH - 70, GAME_HEIGHT - 70, 44, 0x000000, 0.28)
			.setInteractive({ useHandCursor: true });
		this.add.text(GAME_WIDTH - 70, GAME_HEIGHT - 70, '↑', { fontSize: '30px', color: '#fff' }).setOrigin(0.5);
		jumpBtn.on('pointerdown', () => this.tryJump());

		const slideBtn = this.add
			.circle(70, GAME_HEIGHT - 70, 44, 0x000000, 0.28)
			.setInteractive({ useHandCursor: true });
		this.add.text(70, GAME_HEIGHT - 70, '↓', { fontSize: '30px', color: '#fff' }).setOrigin(0.5);
		slideBtn.on('pointerdown', () => this.setSlide(true));
		slideBtn.on('pointerup', () => this.setSlide(false));
		slideBtn.on('pointerout', () => this.setSlide(false));
	}

	tryJump() {
		if (this.isGameOver) return;
		if (this.player.body.blocked.down) {
			this.player.setVelocityY(-JUMP_VELOCITY);
			this.player.jump();
		}
	}

	setSlide(v) {
		if (this.isGameOver) return;
		if (v) this.player.slide();
		else this.player.stand();
	}

	update(time, delta) {
		if (this.isGameOver) return;
		const dt = delta / 1000;

		// 提速
		this.speed = Math.min(MAX_SPEED, this.speed + SPEED_ACCEL * dt);

		// 背景滚动：云朵随机飘动 + 地面视差
		this.clouds.forEach((c) => {
			c.x -= c.cloudSpeed * dt;
			if (c.x < -c.displayWidth / 2) c.x = GAME_WIDTH + c.displayWidth / 2;
		});
		this.ground.tilePositionX += this.speed * dt;

		// 根据落地/空中状态切换角色纹理/动画
		if (this.player.body.blocked.down) {
			if (!this.player.isSliding) this.player.stand();
			else this.player.slide();
		} else {
			this.player.jump();
		}
		this.dust.emitting = this.player.body.blocked.down && !this.player.isSliding;

		// 障碍 / 金币生成（速度越快间隔越短 → 难度递增）
		const gap = START_SPEED / this.speed;
		this.nextObstacle -= delta;
		this.nextCoin -= delta;
		if (this.nextObstacle <= 0) {
			this.spawnObstacle();
			this.nextObstacle = Phaser.Math.Between(900, 1500) * gap;
		}
		if (this.nextCoin <= 0) {
			this.spawnCoins();
			this.nextCoin = Phaser.Math.Between(700, 1200) * gap;
		}

		// 推动所有障碍 / 金币随速度移动，并回收出界对象
		this.obstacles.getChildren().forEach((o) => {
			o.setVelocityX(-this.speed);
			if (o.x < -120) o.destroy();
		});
		this.coinsGroup.getChildren().forEach((c) => {
			c.setVelocityX(-this.speed);
			if (c.x < -60) c.destroy();
		});

		// 距离（米）随速度累积
		this.distance += this.speed * dt * 0.05;
		this.scoreText.setText('距离 ' + Math.floor(this.distance) + 'm');
	}

	spawnObstacle() {
		// 障碍使用图片 /boss/obs.png（128x128），缩小到约 64px 高（scale 0.5）
		// 两种位置随机：①贴地（跳跃越过）②空中悬浮（下滑钻过）
		const x = GAME_WIDTH + 80;
		// 避免与现有金币在生成点重叠（金币半宽 ~14，留足缓冲）
		if (this.coinsGroup.getChildren().some((c) => Math.abs(c.x - x) < 50)) return;
		const obs = this.obstacles.create(x, GROUND_Y, 'obs');
		obs.setOrigin(0.5, 1);
		obs.setScale(0.5); // 同步缩小显示与碰撞体
		obs.body.setCircle(60, 4, 4); // 设置圆形盒子
		obs.body.setAllowGravity(false);
		obs.setVelocityX(-this.speed);

		// 约 50% 概率生成「空中障碍」：底部悬浮在地面上方 40px，
		// 玩家站立（碰撞体高 ~75）会撞上、跳跃会顶到，必须下滑（碰撞体高 ~24）钻过
		if (Phaser.Math.Between(0, 1) === 1) {
			obs.y = GROUND_Y - 40;
			obs.isAir = true;
		} else {
			obs.isAir = false;
		}
	}

	spawnCoins() {
		const pattern = Phaser.Math.Between(0, 2);
		let baseX = GAME_WIDTH + 80;
		const count = Phaser.Math.Between(3, 6);
		const span = (count - 1) * 42;
		// 避免与现有障碍水平重叠（障碍缩小后约 64px 宽，留足缓冲）
		const overlaps = () => this.obstacles.getChildren().some((o) => o.x + 64 > baseX && o.x - 64 < baseX + span);
		let guard = 0;
		while (overlaps() && guard < 16) {
			baseX += 70;
			guard++;
		}
		if (overlaps()) return; // 找不到安全位置则本次跳过
		for (let i = 0; i < count; i++) {
			let y;
			if (pattern === 0) y = GROUND_Y - 30;
			else if (pattern === 1) y = GROUND_Y - 130;
			else y = GROUND_Y - 30 - Math.sin((i / (count - 1)) * Math.PI) * 120;
			const c = this.coinsGroup.create(baseX + i * 42, y, 'coin');
			c.body.setAllowGravity(false);
			c.setVelocityX(-this.speed);
			this.tweens.add({ targets: c, scaleX: 0.3, duration: 400, yoyo: true, repeat: -1 });
		}
	}

	onHit() {
		if (this.isGameOver) return;
		this.gameOver();
	}

	onCoin(player, coin) {
		if (!coin.active) return;
		this.tweens.killTweensOf(coin);
		this.coins += 1;
		this.coinText.setText('👑 ' + this.coins);
		this.add
			.particles(coin.x, coin.y, 'pixel', {
				speed: 140,
				lifespan: 300,
				scale: { start: 1.6, end: 0 },
				quantity: 10,
				tint: 0xffd54f
			})
			.explode(10);
		coin.destroy();
	}

	gameOver() {
		this.isGameOver = true;
		this.physics.pause();
		this.dust.emitting = false;
		this.player.setAngle(0);
		this.player.setTint(0xff5252);
		this.obstacles.getChildren().forEach((o) => o.setVelocityX(0));
		this.coinsGroup.getChildren().forEach((c) => c.setVelocityX(0));

		const finalDist = Math.floor(this.distance);
		if (finalDist > this.highScore) {
			this.highScore = finalDist;
			localStorage.setItem(HS_KEY, String(finalDist));
		}

		this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55);
		this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.32, '游戏结束', {
				padding: { top: 10 },
				color: '#fff',
				fontSize: '56px',
				fontStyle: 'bold'
			})
			.setOrigin(0.5);
		this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.46, '本局距离 ' + finalDist + 'm', {
				padding: { top: 10 },
				color: '#fff',
				fontSize: '30px'
			})
			.setOrigin(0.5);
		this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.58, '金币 ' + this.coins + '    最远 ' + this.highScore + 'm', {
				padding: { top: 10 },
				color: '#fff59d',
				fontSize: '24px'
			})
			.setOrigin(0.5);
		const restart = this.add
			.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.76, '▶ 点击重新开始', {
				fontSize: '26px',
				color: '#fff',
				backgroundColor: '#43a047',
				padding: { x: 16, y: 10 }
			})
			.setOrigin(0.5);
		this.tweens.add({ targets: restart, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

		this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
		this.input.keyboard.once('keydown-UP', () => this.scene.restart());
		this.input.once('pointerdown', () => this.scene.restart());
	}
}
