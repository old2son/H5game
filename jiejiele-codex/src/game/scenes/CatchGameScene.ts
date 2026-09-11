import * as Phaser from 'phaser';

type GameState = 'intro' | 'playing' | 'ending' | 'result';
type ItemKind = 'good' | 'bad';

type ItemDefinition = {
	key: string;
	kind: ItemKind;
	glyph: string;
	iconKey?: string;
	label: string;
	color: number;
	edge: number;
	score: number;
};

type FallingItem = {
	view: Phaser.GameObjects.Container;
	definition: ItemDefinition;
	speed: number;
	sway: number;
	phase: number;
	resolved: boolean;
};

type CloudPart = {
	offsetX: number;
	offsetY: number;
	radius: number;
};

type CloudState = {
	baseX: number;
	baseY: number;
	driftX: number;
	driftY: number;
	speed: number;
	phase: number;
	parts: CloudPart[];
};

const WIDTH = 390;
const HEIGHT = 844;
const RENDER_SCALE = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
const GAME_SECONDS = 45;
const MAX_LIVES = 5;
const CATCH_Y = 650;
const GAME_OVER_TOAST_DELAY = 1850;
const PLAYER_MOVE_SPEED = 750;
const PLAYER_SLOW_DURATION = 2000;
const PLAYER_SLOW_FACTOR = 0.22;

const GOOD_ITEMS: ItemDefinition[] = [
	{
		key: 'sun',
		kind: 'good',
		glyph: '🌞',
		iconKey: 'icon-relax',
		label: '日间户外',
		color: 0xffc84d,
		edge: 0xe99b24,
		score: 10
	},
	{
		key: 'far',
		kind: 'good',
		glyph: '',
		iconKey: 'icon-explore',
		label: '20秒远眺',
		color: 0x65c2dd,
		edge: 0x318cae,
		score: 10
	},
	{
		key: 'sleep',
		kind: 'good',
		glyph: '',
		iconKey: 'icon-sleep',
		label: '充足睡眠',
		color: 0x8f86dd,
		edge: 0x6659be,
		score: 10
	},
	{
		key: 'posture',
		kind: 'good',
		glyph: '',
		iconKey: 'icon-correct-sit',
		label: '正确坐姿',
		color: 0x69c894,
		edge: 0x2f9d65,
		score: 10
	},
	{
		key: 'food',
		kind: 'good',
		glyph: '',
		iconKey: 'icon-food-healthy',
		label: '均衡饮食',
		color: 0x7566c5,
		edge: 0x4d3b9c,
		score: 10
	}
];

const BAD_ITEMS: ItemDefinition[] = [
	{
		key: 'phone',
		kind: 'bad',
		glyph: '久',
		iconKey: 'icon-watch-phone',
		label: '久看手机',
		color: 0xff7d73,
		edge: 0xd84850,
		score: 0
	},
	{
		key: 'tablet',
		kind: 'bad',
		glyph: '',
		iconKey: 'icon-screen',
		label: '连续看屏',
		color: 0xff9b62,
		edge: 0xcf5e2e,
		score: 0
	},
	{
		key: 'lie',
		kind: 'bad',
		glyph: '',
		iconKey: 'icon-lie-read',
		label: '躺着阅读',
		color: 0xe86d9e,
		edge: 0xb93870,
		score: 0
	},
	{
		key: 'dark',
		kind: 'bad',
		glyph: '',
		iconKey: 'icon-moon',
		label: '昏暗用眼',
		color: 0x6b7395,
		edge: 0x424965,
		score: 0
	},
	{
		key: 'close',
		kind: 'bad',
		glyph: '',
		iconKey: 'icon-eye',
		label: '距离过近',
		color: 0xec6d68,
		edge: 0xb93f3d,
		score: 0
	}
];

const TIPS = [
	'每天保证充足的日间户外活动，建议儿童青少年每天不少于2小时。',
	'近距离用眼20分钟，向约6米外远眺至少20秒。',
	'读写保持“一尺一拳一寸”，不要躺着、趴着或在移动中阅读。',
	'保持光线适度；发现视力异常，应及时到正规眼科医疗机构检查。'
];

export class CatchGameScene extends Phaser.Scene {
	private gameState: GameState = 'intro';
	private player!: Phaser.GameObjects.Container;
	private playerTargetX = WIDTH / 2;
	private items: FallingItem[] = [];
	private spawnElapsed = 0;
	private timeLeft = GAME_SECONDS;
	private lives = MAX_LIVES;
	private score = 0;
	private goodCaught = 0;
	private badCaught = 0;
	private badAvoided = 0;
	private goodMissed = 0;
	private streak = 0;
	private maxStreak = 0;
	private best = Number(localStorage.getItem('jie-jie-le-best') ?? 0);
	private introPanel!: Phaser.GameObjects.Container;
	private resultPanel?: Phaser.GameObjects.Container;
	private scoreText!: Phaser.GameObjects.Text;
	private hearts: Phaser.GameObjects.Text[] = [];
	private timeBar!: Phaser.GameObjects.Graphics;
	private toast?: Phaser.GameObjects.Container;
	private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
	private hdTexts = new WeakSet<Phaser.GameObjects.Text>();
	private cloudLayer!: Phaser.GameObjects.Graphics;
	private clouds: CloudState[] = [];
	private cloudTime = 0;
	private activePointerId?: number;
	private lastPointerX = 0;
	private slowedUntil = 0;

	constructor() {
		super('jie-jie-le');
	}

	preload() {
		this.load.image('orange-eye-mascot-original', 'assets/orange-eye-mascot-original.png');
		this.load.image('icon-relax', 'assets/icon-relax.png');
		this.load.image('icon-explore', 'assets/icon-explore.png');
		this.load.image('icon-sleep', 'assets/icon-sleep.png');
		this.load.image('icon-correct-sit', 'assets/icon-correct-sit.png');
		this.load.image('icon-food-healthy', 'assets/icon-food-healthy.png');
		this.load.image('icon-watch-phone', 'assets/icon-watch-phone.png');
		this.load.image('icon-screen', 'assets/icon-screen.png');
		this.load.image('icon-lie-read', 'assets/icon-lie-read.png');
		this.load.image('icon-moon', 'assets/icon-moon.png');
		this.load.image('icon-eye', 'assets/icon-eye.png');
	}

	create() {
		this.cameras.main.setZoom(RENDER_SCALE).centerOn(WIDTH / 2, HEIGHT / 2);
		this.drawWorld();
		this.createHud();
		this.createPlayer();
		this.createIntro();

		this.cursors = this.input.keyboard?.createCursorKeys();
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.beginPointerDrag(pointer));
		this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.followPointer(pointer));
		this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.endPointerDrag(pointer));
		this.refreshHdText();
	}

	update(_time: number, delta: number) {
		this.refreshHdText();
		this.updateClouds(delta);
		if (this.gameState !== 'playing') return;
		this.timeLeft = Math.max(0, this.timeLeft - delta / 1000);
		this.updateTimer();
		this.updatePlayer(delta);
		this.updateItems(delta);

		this.spawnElapsed += delta;
		const elapsed = GAME_SECONDS - this.timeLeft;
		const interval = Phaser.Math.Linear(900, 470, elapsed / GAME_SECONDS);
		if (this.spawnElapsed >= interval) {
			this.spawnElapsed = 0;
			this.spawnItem(elapsed);
		}

		if (this.timeLeft <= 0) this.beginFinishGame('时间到，挑战完成', '时间到，挑战完成', 0xe99b35);
	}

	private drawWorld() {
		const g = this.add.graphics();
		g.fillGradientStyle(0xbceaff, 0xbceaff, 0xf8fcff, 0xf8fcff).fillRect(0, 0, WIDTH, HEIGHT - 150);
		g.fillStyle(0xd6f0df).fillEllipse(60, 770, 360, 230);
		g.fillStyle(0xbbe3cd).fillEllipse(330, 775, 420, 220);
		g.fillStyle(0x80c7a0).fillRect(0, 720, WIDTH, 124);
		g.fillStyle(0xffffff, 0.2);

		// 天空里的淡淡装饰点
		for (let i = 0; i < 9; i++) g.fillCircle(28 + i * 47, 300 + (i % 3) * 86, 3 + (i % 2) * 2);

		this.clouds = [
			{
				baseX: Phaser.Math.Between(88, 125),
				baseY: Phaser.Math.Between(170, 210),
				driftX: Phaser.Math.Between(10, 16),
				driftY: Phaser.Math.Between(2, 5),
				speed: Phaser.Math.FloatBetween(0.16, 0.24),
				phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
				parts: [
					{ offsetX: -30, offsetY: 6, radius: 31 },
					{ offsetX: 37, offsetY: 9, radius: 29 },
					{ offsetX: 0, offsetY: 0, radius: 41 }
				]
			},
			{
				baseX: Phaser.Math.Between(300, 336),
				baseY: Phaser.Math.Between(225, 265),
				driftX: Phaser.Math.Between(8, 14),
				driftY: Phaser.Math.Between(2, 4),
				speed: Phaser.Math.FloatBetween(0.12, 0.2),
				phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
				parts: [
					{ offsetX: -33, offsetY: 9, radius: 28 },
					{ offsetX: 30, offsetY: 11, radius: 24 },
					{ offsetX: 0, offsetY: 0, radius: 38 }
				]
			}
		];
		this.cloudTime = 0;
		this.cloudLayer = this.add.graphics();
		this.renderClouds();
		this.add
			.text(195, 785, '左右滑动 · 接住好习惯 · 避开坏习惯', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#2c6d5a',
				fontStyle: 'bold'
			})
			.setOrigin(0.5);
	}

	private drawCloud(
		g: Phaser.GameObjects.Graphics,
		x: number,
		y: number,
		parts: Array<{ offsetX: number; offsetY: number; radius: number }>
	) {
		for (const part of parts) {
			g.fillCircle(x + part.offsetX, y + part.offsetY, part.radius);
		}
	}

	private renderClouds() {
		this.cloudLayer.clear();
		this.cloudLayer.fillStyle(0xffffff, 1);
		for (const cloud of this.clouds) {
			const drift = this.cloudTime * cloud.speed + cloud.phase;
			const x = cloud.baseX + Math.sin(drift) * cloud.driftX;
			const y = cloud.baseY + Math.cos(drift * 1.12) * cloud.driftY;
			this.drawCloud(this.cloudLayer, x, y, cloud.parts);
		}
	}

	private updateClouds(delta: number) {
		if (!this.cloudLayer) return;
		this.cloudTime += delta / 1000;
		this.renderClouds();
	}

	private createHud() {
		// 简单阴影效果，效果不理想，先注释掉
		// const panelShadowSoft = this.makeTopRoundedPanel(195, 6, 390, 150, 18, 0x000000, 0.08);
		// panelShadowSoft.setDepth(18);
		// const panelShadowTight = this.makeTopRoundedPanel(195, 3, 390, 150, 18, 0x000000, 0.08);
		// panelShadowTight.setDepth(19);
		const panel = this.makeTopRoundedPanel(195, 0, 390, 150, 0, 0x244f83, 0.94, 0xffffff, 0.5, 2);
		panel.setDepth(20);
		const statusPanel = this.makeRoundedPanel(195, 104, 375, 38, 20, 0xffffff, 0.98, 0xd9e8f0, 1, 1);
		statusPanel.setDepth(21);
		this.add
			.text(30, 10, '接睫乐', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '23px',
				fontStyle: 'bold',
				color: '#ffffff'
			})
			.setDepth(21);
		this.add
			.text(31, 43, '近视不可逆转 · 可防可控', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#cbe9ff'
			})
			.setDepth(21);
		this.add
			.text(176, 104, '⭐', { fontFamily: 'Arial', fontSize: '14px', color: '#f4b63f' })
			.setOrigin(0, 0.5)
			.setDepth(22);
		this.scoreText = this.add
			.text(196, 104, '0000', {
				fontFamily: 'Arial',
				fontSize: '16px',
				fontStyle: 'bold',
				color: '#2f5668'
			})
			.setOrigin(0, 0.5)
			.setDepth(22);

		this.add
			.text(24, 104, '生命', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#46626f' })
			.setOrigin(0, 0.5)
			.setDepth(22);

		for (let i = 0; i < MAX_LIVES; i++) {
			const x = 62 + i * 18;
			this.add
				.text(x, 104, '💔', {
					fontFamily: 'Arial',
					fontSize: '14px',
					fontStyle: 'bold',
					color: '#c8d8e4'
				})
				.setOrigin(0.5)
				.setDepth(22);
			const heart = this.add
				.text(x, 104, '❤️', {
					fontFamily: 'Arial',
					fontSize: '14px',
					fontStyle: 'bold',
					color: '#ff536b'
				})
				.setOrigin(0.5)
				.setDepth(23);
			this.hearts.push(heart);
		}
		this.timeBar = this.add.graphics().setDepth(22);
		this.updateTimer();
	}

	private createPlayer() {
		this.player = this.add.container(WIDTH / 2, 190).setDepth(12);
		const shadow = this.add.ellipse(0, 44, 70, 14, 0x295c4b, 0.2);
		const mascot = this.makeMascotWithBasket(0, 0, 96);
		this.player.add([shadow, mascot]);
	}

	private makeMascotWithBasket(x: number, y: number, size: number) {
		const root = this.add.container(x, y);
		const scale = size / 148;
		const mascot = this.add.image(0, 0, 'orange-eye-mascot-original').setDisplaySize(size, size);
		const basketBody = this.add.graphics();
		const basketHalfWidth = 58 * scale;
		const basketHalfHeight = 36 * scale;
		const basketTopY = -86 * scale;
		const basketBodyPoints: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(-basketHalfWidth, basketTopY)];
		for (let i = 0; i <= 18; i++) {
			const t = (Math.PI * i) / 18;
			basketBodyPoints.push(
				new Phaser.Math.Vector2(
					Math.cos(Math.PI - t) * basketHalfWidth,
					basketTopY + Math.sin(t) * basketHalfHeight
				)
			);
		}
		basketBody.fillStyle(0xf6be5a, 1).fillPoints(basketBodyPoints, true, true);
		basketBody.lineStyle(3 * scale, 0xb87532, 1).strokePoints(basketBodyPoints, true, true);
		const basketRim = this.add
			.ellipse(0, -88 * scale, 124 * scale, 24 * scale, 0xffe3a0)
			.setStrokeStyle(2 * scale, 0xb87532);
		const basketInner = this.add
			.ellipse(0, -86 * scale, 92 * scale, 12 * scale, 0xd79634, 0.38)
			.setStrokeStyle(1 * scale, 0xe9bf72, 0.45);
		const basketHighlight = this.add.ellipse(0, -56 * scale, 74 * scale, 10 * scale, 0xffffff, 0.16);
		const basketLine1 = this.add
			.line(-25 * scale, -62 * scale, 0, -9 * scale, 0, 8 * scale, 0xb87532)
			.setLineWidth(Math.max(1, 2 * scale));
		const basketLine2 = this.add
			.line(0, -62 * scale, 0, -10 * scale, 0, 9 * scale, 0xb87532)
			.setLineWidth(Math.max(1, 2 * scale));
		const basketLine3 = this.add
			.line(25 * scale, -62 * scale, 0, -9 * scale, 0, 8 * scale, 0xb87532)
			.setLineWidth(Math.max(1, 2 * scale));
		root.add([mascot, basketBody, basketHighlight, basketLine1, basketLine2, basketLine3, basketRim, basketInner]);
		return root;
	}

	private createIntro() {
		this.player.setVisible(false);
		this.introPanel = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(60);
		const shade = this.makeIntroGradient(0, 0, WIDTH, HEIGHT);
		const glowLeft = this.add.circle(-124, -238, 98, 0xf2ff95, 0.1);
		const glowRight = this.add.circle(128, -178, 86, 0xffffff, 0.1);
		const card = this.makeRoundedPanel(0, -10, 342, 588, 28, 0xf8fffe, 0.97, 0x82d7c8, 0.85, 3);
		const tagBg = this.makeRoundedPanel(0, -258, 145, 28, 14, 0x82d7c8, 0.22, 0xd1fae5, 0.9, 1);
		const tag = this.add
			.text(0, -258, '爱护双眼 · 轻松一刻', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: 'rgb(5 150 105 / 95%)'
			})
			.setOrigin(0.5);
		const haloOuter = this.add.circle(0, -146, 78, 0xffde73, 0.18);
		const haloInner = this.add.circle(0, -146, 58, 0xffffff, 0.98).setStrokeStyle(5, 0xffd259, 0.95);
		const badge = this.add.circle(0, -146, 47, 0xfff2bf).setStrokeStyle(2, 0xffffff, 0.95);
		const mascot = this.makeMascotWithBasket(0, -146, 94);
		const title = this.add
			.text(0, -38, '接睫乐', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '34px',
				fontStyle: 'bold',
				color: '#f2a91f'
			})
			.setOrigin(0.5);
		const subtitle = this.add
			.text(0, 11, '接住益眼习惯，避开用眼陷阱', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '14px',
				color: '#3f7f78'
			})
			.setOrigin(0.5);
		const good = this.makeRuleCard(-78, 92, 0x69c894, '☀️', '接住益眼物', '阳光 远眺 睡眠');
		const bad = this.makeRuleCard(78, 92, 0xf17372, '📱', '避开危害物', '久看 躺读 昏暗');

		const start = this.makeButton(0, 210, 244, 58, '开始接睫体验', () => this.startGame(), 'primary');
		const medicalNote = this.add
			.text(0, 315, '科普互动体验，不作医学诊断', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#e2f4f3'
			})
			.setOrigin(0.5);
		this.introPanel.add([
			shade,
			glowLeft,
			glowRight,
			card,
			tagBg,
			tag,
			haloOuter,
			haloInner,
			badge,
			mascot,
			title,
			subtitle,
			good,
			bad,
			start,
			medicalNote
		]);
	}

	private makeRuleCard(x: number, y: number, color: number, icon: string, heading: string, detail: string) {
		const card = this.add.container(x, y);
		const bg = this.makeRoundedPanel(0, 0, 144, 68, 8, color, 0.12, color, 0.6, 2);
		const iconBg = this.add.circle(-45, -2, 16, color, 0.18).setStrokeStyle(2, color, 0.7);
		const iconText = this.add
			.text(-45, -2, icon, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '15px',
				fontStyle: 'bold',
				color: Phaser.Display.Color.IntegerToColor(color).rgba
			})
			.setOrigin(0.5);
		const headingText = this.add
			.text(-17, -14, heading, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '14px',
				fontStyle: 'bold',
				color: '#305260'
			})
			.setOrigin(0, 0.5);
		const detailText = this.add
			.text(-17, 10, detail, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#63737d',
				lineSpacing: 4
			})
			.setOrigin(0, 0.5);
		card.add([bg, iconBg, iconText, headingText, detailText]);
		return card;
	}

	private makeIntroGradient(x: number, y: number, width: number, height: number) {
		const gradient = this.add.graphics();
		const halfHeight = height / 2;
		const left = x - width / 2;
		const top = y - height / 2;
		gradient.fillGradientStyle(0x38bdf8, 0x38bdf8, 0x14b8a6, 0x14b8a6, 1, 1, 1, 1);
		gradient.fillRect(left, top, width, halfHeight);
		gradient.fillGradientStyle(0x14b8a6, 0x14b8a6, 0x059669, 0x059669, 1, 1, 1, 1);
		gradient.fillRect(left, top + halfHeight, width, halfHeight);
		return gradient;
	}

	private makeRoundedPanel(
		x: number,
		y: number,
		width: number,
		height: number,
		radius: number,
		fillColor: number,
		fillAlpha: number,
		strokeColor?: number,
		strokeAlpha = 1,
		strokeWidth = 0
	) {
		const panel = this.add.graphics();
		panel.fillStyle(fillColor, fillAlpha);
		panel.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
		if (strokeColor !== undefined && strokeWidth > 0) {
			panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
			panel.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
		}
		return panel;
	}

	private makeTopRoundedPanel(
		x: number,
		y: number,
		width: number,
		height: number,
		radius: number,
		fillColor: number,
		fillAlpha: number,
		strokeColor?: number,
		strokeAlpha = 1,
		strokeWidth = 0
	) {
		const panel = this.add.graphics();
		const left = x - width / 2;
		const right = x + width / 2;
		const top = y - height / 2;
		const bottom = y + height / 2;
		const safeRadius = Math.min(radius, width / 2, height);

		panel.beginPath();
		panel.moveTo(left, bottom);
		panel.lineTo(left, top + safeRadius);
		panel.arc(
			left + safeRadius,
			top + safeRadius,
			safeRadius,
			Phaser.Math.DegToRad(180),
			Phaser.Math.DegToRad(270)
		);
		panel.lineTo(right - safeRadius, top);
		panel.arc(
			right - safeRadius,
			top + safeRadius,
			safeRadius,
			Phaser.Math.DegToRad(270),
			Phaser.Math.DegToRad(360)
		);
		panel.lineTo(right, bottom);
		panel.lineTo(left, bottom);
		panel.closePath();

		panel.fillStyle(fillColor, fillAlpha);
		panel.fillPath();
		if (strokeColor !== undefined && strokeWidth > 0) {
			panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
			panel.strokePath();
		}
		return panel;
	}

	private startGame() {
		this.resultPanel?.destroy(true);
		this.introPanel.setVisible(false);
		this.player.setVisible(true).setPosition(WIDTH / 2, 690);
		this.activePointerId = undefined;
		this.lastPointerX = WIDTH / 2;
		this.slowedUntil = 0;
		this.playerTargetX = WIDTH / 2;
		this.items.forEach((item) => item.view.destroy(true));
		this.items = [];
		this.gameState = 'playing';
		this.spawnElapsed = 500;
		this.timeLeft = GAME_SECONDS;
		this.lives = MAX_LIVES;
		this.score = 0;
		this.goodCaught = 0;
		this.badCaught = 0;
		this.badAvoided = 0;
		this.goodMissed = 0;
		this.streak = 0;
		this.maxStreak = 0;
		this.scoreText.setText('0000');
		this.hearts.forEach((heart) => heart.setVisible(true).setScale(1).setAlpha(1).setAngle(0));
		this.updateTimer();
	}

	private beginPointerDrag(pointer: Phaser.Input.Pointer) {
		if (this.gameState !== 'playing') return;
		this.activePointerId = pointer.id;
		this.lastPointerX = pointer.worldX;
	}

	private followPointer(pointer: Phaser.Input.Pointer) {
		if (this.gameState !== 'playing') return;
		if (!pointer.isDown || this.activePointerId !== pointer.id) return;
		this.playerTargetX = Phaser.Math.Clamp(
			this.playerTargetX + (pointer.worldX - this.lastPointerX) * this.getPlayerSpeedFactor(),
			60,
			WIDTH - 60
		);
		this.lastPointerX = pointer.worldX;
	}

	private endPointerDrag(pointer: Phaser.Input.Pointer) {
		if (this.activePointerId !== pointer.id) return;
		this.activePointerId = undefined;
	}

	private updatePlayer(delta: number) {
		const keyboardSpeed = (PLAYER_MOVE_SPEED * this.getPlayerSpeedFactor() * delta) / 1000;
		if (this.cursors?.left.isDown) this.playerTargetX -= keyboardSpeed;
		if (this.cursors?.right.isDown) this.playerTargetX += keyboardSpeed;
		this.playerTargetX = Phaser.Math.Clamp(this.playerTargetX, 60, WIDTH - 60);
		const deltaX = this.playerTargetX - this.player.x;
		if (Math.abs(deltaX) <= keyboardSpeed) this.player.x = this.playerTargetX;
		else this.player.x += Math.sign(deltaX) * keyboardSpeed;
	}

	private getPlayerSpeedFactor() {
		return this.time.now < this.slowedUntil ? PLAYER_SLOW_FACTOR : 1;
	}

	private spawnItem(elapsed: number) {
		const badChance = Phaser.Math.Linear(0.42, 0.58, elapsed / GAME_SECONDS);
		const pool = Math.random() < badChance ? BAD_ITEMS : GOOD_ITEMS;
		const definition = Phaser.Utils.Array.GetRandom(pool);
		const x = Phaser.Math.Between(42, WIDTH - 42);
		const y = -72;
		const view = this.createItemView(definition, x, y);
		const difficulty = elapsed / GAME_SECONDS;

		this.items.push({
			view,
			definition,
			speed: Phaser.Math.Between(142, 178) + difficulty * 95,
			sway: Phaser.Math.Between(-13, 13),
			phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
			resolved: false
		});
	}

	private createItemView(definition: ItemDefinition, x: number, y: number) {
		const root = this.add.container(x, y).setDepth(8);
		const shadow = this.add.circle(3, 5, 28, 0x214158, 0.16);
		const circle = this.add.circle(0, 0, 28, definition.color).setStrokeStyle(4, 0xffffff);
		const inner = this.add.circle(0, 0, 23, definition.color).setStrokeStyle(2, definition.edge, 0.9);
		const glyph = definition.iconKey
			? this.add.image(0, -2, definition.iconKey).setDisplaySize(28, 28)
			: this.add
					.text(0, -2, definition.glyph, {
						fontFamily: 'Microsoft YaHei',
						fontSize: '24px',
						fontStyle: 'bold',
						color: '#ffffff',
						stroke: Phaser.Display.Color.IntegerToColor(definition.edge).rgba,
						strokeThickness: 2
					})
					.setOrigin(0.5);
		const labelBg = this.add.rectangle(0, 35, 70, 19, 0xffffff, 0.92).setStrokeStyle(1, definition.edge, 0.55);
		const label = this.add
			.text(0, 35, definition.label, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#3e5664'
			})
			.setOrigin(0.5);
		root.add([shadow, circle, inner, glyph, labelBg, label]);
		return root;
	}

	private updateItems(delta: number) {
		const seconds = delta / 1000;
		const elapsed = GAME_SECONDS - this.timeLeft;
		for (const item of this.items) {
			if (item.resolved) continue;
			item.view.y += item.speed * seconds;
			item.view.x += Math.sin(elapsed * 2.3 + item.phase) * item.sway * seconds;
			item.view.angle += item.sway * seconds * 0.7;

			const inBasket =
				item.view.y >= CATCH_Y - 52 &&
				item.view.y <= CATCH_Y + 17 &&
				Math.abs(item.view.x - this.player.x) < 48;
			if (inBasket) {
				this.resolveCatch(item);
			} else if (item.view.y > 710) {
				this.resolveMiss(item);
			}
		}
		this.items = this.items.filter((item) => !item.resolved);
	}

	private resolveCatch(item: FallingItem) {
		item.resolved = true;
		if (item.definition.kind === 'good') {
			this.goodCaught += 1;
			this.streak += 1;
			this.maxStreak = Math.max(this.maxStreak, this.streak);
			const gained = item.definition.score;
			this.score += gained;
			this.scoreText.setText(this.score.toString().padStart(4, '0'));
			this.animateResolved(item.view, 0x54bf87, `+${gained}`);
			if (this.streak > 1 && this.streak % 3 === 0) this.showToast(`${this.streak} 连接！护眼习惯很稳`, 0x2e9b68);
		} else {
			this.badCaught += 1;
			this.streak = 0;
			this.lives -= 1;
			this.slowedUntil = this.time.now + PLAYER_SLOW_DURATION;
			this.animateResolved(item.view, 0xe94e58, '-1 生命');
			this.loseHeart(this.lives);
			this.cameras.main.shake(180, 0.002);
			if ('vibrate' in navigator) navigator.vibrate?.(80);
			this.showToast(`小心：${item.definition.label}，减速 2 秒`, 0xbd3d47);

			if (this.lives <= 0) this.beginFinishGame('生命值归零', '生命值归零，挑战结束', 0xd84c56);
		}
	}

	private resolveMiss(item: FallingItem) {
		item.resolved = true;
		if (item.definition.kind === 'bad') {
			this.badAvoided += 1;
			this.tweens.add({
				targets: item.view,
				alpha: 0,
				y: '+=18',
				duration: 170,
				onComplete: () => item.view.destroy(true)
			});
		} else {
			this.goodMissed += 1;
			this.streak = 0;
			this.tweens.add({ targets: item.view, alpha: 0, duration: 160, onComplete: () => item.view.destroy(true) });
		}
	}

	private animateResolved(view: Phaser.GameObjects.Container, color: number, message: string) {
		const feedback = this.add
			.text(view.x, view.y - 12, message, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '16px',
				fontStyle: 'bold',
				color: '#ffffff',
				stroke: Phaser.Display.Color.IntegerToColor(color).rgba,
				strokeThickness: 5
			})
			.setOrigin(0.5)
			.setDepth(30);
		this.tweens.add({
			targets: feedback,
			y: feedback.y - 48,
			alpha: 0,
			duration: 620,
			ease: 'Cubic.Out',
			onComplete: () => feedback.destroy()
		});
		this.tweens.add({ targets: view, scale: 1.35, alpha: 0, duration: 210, onComplete: () => view.destroy(true) });
	}

	private loseHeart(index: number) {
		const heart = this.hearts[index];
		if (!heart) return;
		this.tweens.add({
			targets: heart,
			scale: 1.65,
			alpha: 0,
			angle: 16,
			duration: 260,
			ease: 'Back.In',
			onComplete: () => heart.setVisible(false)
		});
	}

	private showToast(message: string, color: number, centered = false, totalDuration = 1200) {
		this.toast?.destroy(true);
		const baseY = centered ? HEIGHT / 2 : 132;
		const fadeDuration = 150;
		const holdDuration = Math.max(0, totalDuration - fadeDuration * 2);
		const toast = this.add.container(195, baseY).setDepth(40).setAlpha(0);
		const bg = this.add.rectangle(0, 0, 286, 36, color, 0.94).setStrokeStyle(1, 0xffffff, 0.65);
		const label = this.add
			.text(0, 0, message, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#ffffff'
			})
			.setOrigin(0.5);
		toast.add([bg, label]);
		this.toast = toast;
		this.tweens.add({
			targets: toast,
			alpha: 1,
			y: baseY + (centered ? 6 : 8),
			duration: fadeDuration,
			yoyo: true,
			hold: holdDuration,
			onComplete: () => {
				toast.destroy(true);
				if (this.toast === toast) this.toast = undefined;
			}
		});
	}

	private updateTimer() {
		if (!this.timeBar) return;
		const ratio = Phaser.Math.Clamp(this.timeLeft / GAME_SECONDS, 0, 1);
		const color = ratio > 0.4 ? 0x58c896 : ratio > 0.18 ? 0xffc54f : 0xf06368;
		this.timeBar.clear().fillStyle(0xdcebf5).fillRoundedRect(290, 102, 76, 6, 3);
		const width = 76 * ratio;
		if (width <= 0) return;
		const radius = Math.min(3, width / 2);
		this.timeBar.fillStyle(color).fillRoundedRect(290, 102, width, 6, radius);
	}

	private finishGame(reason: string) {
		if (this.gameState !== 'playing' && this.gameState !== 'ending') return;
		this.gameState = 'result';
		this.items.forEach((item) => item.view.destroy(true));
		this.items = [];
		this.player.setVisible(false);
		this.best = Math.max(this.best, this.score);
		localStorage.setItem('jie-jie-le-best', String(this.best));
		this.showResult(reason);
	}

	private beginFinishGame(reason: string, message: string, color: number) {
		if (this.gameState !== 'playing') return;
		this.gameState = 'ending';
		this.activePointerId = undefined;
		this.showToast(message, color, true, GAME_OVER_TOAST_DELAY);
		this.time.delayedCall(GAME_OVER_TOAST_DELAY + 150, () => this.finishGame(reason));
	}

	private calculateRiskIndex() {
		const raw = 50 + this.badCaught * 10 + this.goodMissed * 2 - this.goodCaught * 4 - this.badAvoided * 2;
		return Phaser.Math.Clamp(Math.round(raw), 5, 95);
	}

	private showResult(reason: string) {
		const risk = this.calculateRiskIndex();
		const level = risk <= 30 ? '低' : risk <= 60 ? '中' : '高';
		const color = risk <= 30 ? 0x3eaa75 : risk <= 60 ? 0xe99b35 : 0xd84c56;
		const tipIndex = this.badCaught >= 3 ? 1 : this.goodCaught < 4 ? 0 : 2;
		const badgeText = risk <= 30 ? '眼健康守护达人' : risk <= 60 ? '继续稳住节奏' : '优先减少高风险行为';
		const captureInsight =
			this.goodCaught >= 6
				? `接住了 ${this.goodCaught} 个益眼物，护眼意识很在线。`
				: this.goodCaught >= 3
					? `接住了 ${this.goodCaught} 个益眼物，再主动一些会更稳。`
					: `本轮只接住了 ${this.goodCaught} 个益眼物，优先追户外、远眺和睡眠。`;
		const riskInsight =
			this.badCaught === 0
				? '没有误接坏习惯，判断节奏很稳。'
				: this.badAvoided >= this.badCaught
					? `误接 ${this.badCaught} 次，但也成功避开了 ${this.badAvoided} 个坏物品。`
					: `误接了 ${this.badCaught} 个坏物品，移动前先看标签会更稳。`;
		const findings = [
			{ color: 0x31a978, icon: '✓', title: '护眼好习惯', detail: captureInsight },
			{ color: color, icon: '!', title: '风险避让表现', detail: riskInsight }
		];
		const findingObjects: Phaser.GameObjects.GameObject[] = [];
		const cardTop = -306;
		const diagnosisTitleY = -64;
		let nextFindingTop = diagnosisTitleY + 18;

		findings.forEach((finding) => {
			const title = this.add
				.text(-106, nextFindingTop + 12, finding.title, {
					fontFamily: 'Microsoft YaHei',
					fontSize: '12px',
					fontStyle: 'bold',
					color: '#334e5d'
				})
				.setOrigin(0, 0);
			const detail = this.add
				.text(-106, nextFindingTop + 32, finding.detail, {
					fontFamily: 'Microsoft YaHei',
					fontSize: '12px',
					color: '#61707a',
					wordWrap: { width: 252, useAdvancedWrap: true },
					lineSpacing: 3
				})
				.setOrigin(0, 0);
			const cardHeight = Math.max(68, 48 + detail.height);
			const cardCenterY = nextFindingTop + cardHeight / 2;
			const iconCenterY = nextFindingTop + 22;
			const bg = this.makeRoundedPanel(0, cardCenterY, 308, cardHeight, 12, 0xffffff, 1, 0xe4edf4, 1, 1);
			const iconBg = this.add
				.circle(-126, iconCenterY, 11, finding.color, 0.14)
				.setStrokeStyle(2, finding.color, 0.42);
			const iconText = this.add
				.text(-126, iconCenterY, finding.icon, {
					fontFamily: 'Arial',
					fontSize: '13px',
					fontStyle: 'bold',
					color: Phaser.Display.Color.IntegerToColor(finding.color).rgba
				})
				.setOrigin(0.5);
			findingObjects.push(bg, iconBg, iconText, title, detail);
			nextFindingTop += cardHeight + 12;
		});

		const actionTop = nextFindingTop + 16;
		const actionTitle = this.add
			.text(-130, actionTop, '核心知识：近视不可逆转', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#8b5b14'
			})
			.setOrigin(0, 0);
		const actionText = this.add
			.text(-130, actionTop + 25, TIPS[tipIndex], {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#785b2c',
				wordWrap: { width: 266, useAdvancedWrap: true },
				lineSpacing: 4
			})
			.setOrigin(0, 0);
		const actionHeight = Math.max(110, 56 + actionText.height);
		const actionCenterY = actionTop + actionHeight / 2;
		const restartY = actionTop + actionHeight + 48;
		const bestTextY = restartY + 45;
		const noteY = bestTextY + 24;
		const noteBottom = noteY + 8;
		const cardHeight = Math.max(688, noteBottom - cardTop + 28);
		const cardCenterY = cardTop + cardHeight / 2;

		const panel = this.add.container(WIDTH / 2, HEIGHT / 2 - 20).setDepth(70);
		const shade = this.add.rectangle(0, 20, WIDTH, HEIGHT, 0x0f172a, 0.72);
		const card = this.makeRoundedPanel(0, cardCenterY, 350, cardHeight, 28, 0xffffff, 0.996, color, 0.34, 2);
		const title = this.add
			.text(0, -268, '近视风险指数报告', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '23px',
				fontStyle: 'bold',
				color: '#213746'
			})
			.setOrigin(0.5);
		const subtitle = this.add
			.text(0, -243, `基于本轮表现生成 · ${reason}`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#8c99a2'
			})
			.setOrigin(0.5);
		const divider = this.add.rectangle(0, -218, 306, 1, 0xeaf0f4, 1);

		const summaryBg = this.makeRoundedPanel(0, -142, 308, 112, 22, 0xf7fafc, 1, 0xe1ebf1, 1, 1);
		const scoreLabel = this.add
			.text(-120, -178, '综合护眼得分', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#6d7d88'
			})
			.setOrigin(0, 0.5);
		const scoreValue = this.add
			.text(-120, -149, String(this.score), {
				fontFamily: 'Arial',
				fontSize: '36px',
				fontStyle: 'bold',
				color: '#12a36b'
			})
			.setOrigin(0, 0.5);
		const scoreMeta = this.add
			.text(
				-120,
				-113,
				`接对 ${this.goodCaught}  ·  接错 ${this.badCaught}\n成功避开 ${this.badAvoided}  ·  连击 ${this.maxStreak}`,
				{
					fontFamily: 'Microsoft YaHei',
					fontSize: '12px',
					color: '#7e8b94',
					lineSpacing: 3
				}
			)
			.setOrigin(0, 0.5);
		const badgeCard = this.makeRoundedPanel(97, -142, 113, 113, 18, 0xffffff, 1, 0xe4edf4, 1, 1);
		const badgeLevel = this.add
			.text(97, -177, `${level}风险`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '14px',
				fontStyle: 'bold',
				color: Phaser.Display.Color.IntegerToColor(color).rgba
			})
			.setOrigin(0.5);
		const badgeRingOuter = this.add.circle(97, -142, 24, color, 0.12);
		const badgeRing = this.add.circle(97, -142, 24).setStrokeStyle(4, color, 0.95);
		const badgeValue = this.add
			.text(97, -142, `${risk}`, {
				fontFamily: 'Arial',
				fontSize: '22px',
				fontStyle: 'bold',
				color: Phaser.Display.Color.IntegerToColor(color).rgba
			})
			.setOrigin(0.5);
		const badgeSub = this.add
			.text(97, -104, badgeText, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#60717b',
				align: 'center',
				wordWrap: { width: 110, useAdvancedWrap: true },
				lineSpacing: 3
			})
			.setOrigin(0.5);

		const diagnosisTitle = this.add
			.text(-146, diagnosisTitleY, '眼健康行为诊断', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#3a4f5c'
			})
			.setOrigin(0, 0.5);

		const actionBg = this.makeRoundedPanel(
			0,
			actionCenterY - 20,
			308,
			actionHeight - 15,
			22,
			0xfff7e7,
			1,
			0xf0d39a,
			1,
			1
		);
		const restart = this.makeButton(0, restartY - 25, 232, 52, '再次挑战', () => this.startGame(), 'primary');
		const bestText = this.add
			.text(0, bestTextY - 25, `历史最高分 ${this.best}`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#7f8c95'
			})
			.setOrigin(0.5);
		const note = this.add
			.text(0, noteY, '游戏结果仅作护眼科普参考，如有视力异常请及时检查', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#98a4ab'
			})
			.setOrigin(0.5);
		panel.add([
			shade,
			card,
			title,
			subtitle,
			divider,
			summaryBg,
			scoreLabel,
			scoreValue,
			scoreMeta,
			badgeCard,
			badgeLevel,
			badgeRingOuter,
			badgeRing,
			badgeValue,
			badgeSub,
			diagnosisTitle,
			...findingObjects,
			actionBg,
			actionTitle,
			actionText,
			restart,
			bestText,
			note
		]);
		this.resultPanel = panel;
	}

	private makeButton(
		x: number,
		y: number,
		width: number,
		height: number,
		text: string,
		onClick: () => void,
		tone: 'primary' | 'secondary' = 'secondary'
	) {
		const button = this.add.container(x, y).setSize(width, height);
		const palette =
			tone === 'primary'
				? { shadow: 0x8d4f10, shadowAlpha: 0.28, fill: 0xf0a32d, stroke: 0xffecb2, text: '#ffffff' }
				: { shadow: 0x24476c, shadowAlpha: 0.2, fill: 0x347eb2, stroke: 0x9bd3ef, text: '#ffffff' };
		const radius = 8;
		const bg = this.makeRoundedPanel(0, 0, width, height, radius, palette.fill, 1, palette.stroke, 1, 2);
		const label = this.add
			.text(0, 0, text, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '15px',
				fontStyle: 'bold',
				color: palette.text
			})
			.setOrigin(0.5);
		button.add([bg, label]).setInteractive({ useHandCursor: true });
		button.on('pointerdown', () => button.setScale(0.97));
		button.on('pointerup', () => {
			button.setScale(1);
			onClick();
		});
		button.on('pointerout', () => button.setScale(1));
		return button;
	}

	private refreshHdText() {
		const visit = (object: Phaser.GameObjects.GameObject) => {
			if (object instanceof Phaser.GameObjects.Text) {
				if (!this.hdTexts.has(object)) {
					object.setResolution(RENDER_SCALE);
					this.hdTexts.add(object);
				}
				return;
			}
			if (object instanceof Phaser.GameObjects.Container) object.list.forEach(visit);
		};
		this.children.list.forEach(visit);
	}
}
