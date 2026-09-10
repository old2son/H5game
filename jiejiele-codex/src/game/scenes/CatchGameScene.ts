import * as Phaser from 'phaser';

type GameState = 'intro' | 'playing' | 'result';
type ItemKind = 'good' | 'bad';

type ItemDefinition = {
	key: string;
	kind: ItemKind;
	glyph: string;
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

const WIDTH = 390;
const HEIGHT = 844;
const RENDER_SCALE = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
const GAME_SECONDS = 45;
const MAX_LIVES = 5;
const CATCH_Y = 650;

const GOOD_ITEMS: ItemDefinition[] = [
	{ key: 'sun', kind: 'good', glyph: '日', label: '日间户外', color: 0xffc84d, edge: 0xe99b24, score: 10 },
	{ key: 'far', kind: 'good', glyph: '远', label: '20秒远眺', color: 0x65c2dd, edge: 0x318cae, score: 10 },
	{ key: 'sleep', kind: 'good', glyph: '眠', label: '充足睡眠', color: 0x8f86dd, edge: 0x6659be, score: 10 },
	{ key: 'posture', kind: 'good', glyph: '正', label: '正确坐姿', color: 0x69c894, edge: 0x2f9d65, score: 10 },
	{ key: 'food', kind: 'good', glyph: '莓', label: '均衡饮食', color: 0x7566c5, edge: 0x4d3b9c, score: 10 }
];

const BAD_ITEMS: ItemDefinition[] = [
	{ key: 'phone', kind: 'bad', glyph: '机', label: '久看手机', color: 0xff7d73, edge: 0xd84850, score: 0 },
	{ key: 'tablet', kind: 'bad', glyph: '屏', label: '连续看屏', color: 0xff9b62, edge: 0xcf5e2e, score: 0 },
	{ key: 'lie', kind: 'bad', glyph: '躺', label: '躺着阅读', color: 0xe86d9e, edge: 0xb93870, score: 0 },
	{ key: 'dark', kind: 'bad', glyph: '暗', label: '昏暗用眼', color: 0x6b7395, edge: 0x424965, score: 0 },
	{ key: 'close', kind: 'bad', glyph: '近', label: '距离过近', color: 0xec6d68, edge: 0xb93f3d, score: 0 }
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
	private timerText!: Phaser.GameObjects.Text;
	private hearts: Phaser.GameObjects.Text[] = [];
	private timeBar!: Phaser.GameObjects.Graphics;
	private toast?: Phaser.GameObjects.Container;
	private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
	private hdTexts = new WeakSet<Phaser.GameObjects.Text>();

	constructor() {
		super('jie-jie-le');
	}

	preload() {
		this.load.image('orange-eye-mascot-original', 'assets/orange-eye-mascot-original.png');
	}

	create() {
		this.cameras.main.setZoom(RENDER_SCALE).centerOn(WIDTH / 2, HEIGHT / 2);
		this.drawWorld();
		this.createHud();
		this.createPlayer();
		this.createIntro();

		/** debug b*/
		this.startGame();
		/** debug e*/

		this.cursors = this.input.keyboard?.createCursorKeys();
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.followPointer(pointer));
		this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
			if (pointer.isDown) this.followPointer(pointer);
		});
		this.refreshHdText();
	}

	update(_time: number, delta: number) {
		this.refreshHdText();
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

		// debug
		// if (this.timeLeft <= 0) this.finishGame('时间到，挑战完成');
	}

	private drawWorld() {
		const g = this.add.graphics();
		g.fillGradientStyle(0xbceaff, 0xbceaff, 0xf8fcff, 0xf8fcff).fillRect(0, 0, WIDTH, HEIGHT);
		g.fillStyle(0xffffff, 0.72);
		g.fillCircle(58, 150, 31).fillCircle(88, 144, 41).fillCircle(125, 153, 29);
		g.fillCircle(297, 244, 28).fillCircle(330, 235, 38).fillCircle(360, 246, 24);
		g.fillStyle(0xd6f0df).fillEllipse(72, 768, 255, 170);
		g.fillStyle(0xbbe3cd).fillEllipse(335, 788, 300, 156);
		g.fillStyle(0x80c7a0).fillRect(0, 768, WIDTH, 76);
		g.fillStyle(0xffffff, 0.2);
		for (let i = 0; i < 9; i++) g.fillCircle(28 + i * 47, 300 + (i % 3) * 86, 3 + (i % 2) * 2);
		this.add
			.text(195, 815, '左右滑动 · 接住好习惯 · 避开坏习惯', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '11px',
				color: '#2c6d5a',
				fontStyle: 'bold'
			})
			.setOrigin(0.5);
	}

	private createHud() {
		const panelShadowSoft = this.makeTopRoundedPanel(195, 6, 390, 150, 18, 0x000000, 0.08);
		panelShadowSoft.setDepth(18);
		const panelShadowTight = this.makeTopRoundedPanel(195, 3, 390, 150, 18, 0x000000, 0.12);
		panelShadowTight.setDepth(19);
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
		this.timerText = this.add
			.text(268, 104, '🕐', {
				fontFamily: 'Arial',
				fontSize: '14px',
				fontStyle: 'bold',
				color: '#46626f'
			})
			.setOrigin(0, 0.5)
			.setDepth(22);
		this.timeBar = this.add.graphics().setDepth(22);
		this.updateTimer();
	}

	private createPlayer() {
		this.player = this.add.container(WIDTH / 2, 690).setDepth(12);
		const shadow = this.add.ellipse(0, 44, 70, 14, 0x295c4b, 0.2);
		const mascot = this.makeMascotWithBasket(0, 0, 96);
		this.player.add([shadow, mascot]);
	}

	private makeMascotWithBasket(x: number, y: number, size: number) {
		const root = this.add.container(x, y);
		const scale = size / 148;
		const mascot = this.add.image(0, 0, 'orange-eye-mascot-original').setDisplaySize(size, size);
		const basketBody = this.add
			.rectangle(0, -65 * scale, 104 * scale, 20 * scale, 0xffcf63)
			.setStrokeStyle(3 * scale, 0xb87532);
		const basketRim = this.add
			.rectangle(0, -78 * scale, 116 * scale, 8 * scale, 0xffe49b)
			.setStrokeStyle(2 * scale, 0xb87532);
		const basketLine1 = this.add
			.line(-22 * scale, -65 * scale, 0, -9 * scale, 0, 9 * scale, 0xb87532)
			.setLineWidth(Math.max(1, 2 * scale));
		const basketLine2 = this.add
			.line(22 * scale, -65 * scale, 0, -9 * scale, 0, 9 * scale, 0xb87532)
			.setLineWidth(Math.max(1, 2 * scale));
		root.add([mascot, basketBody, basketLine1, basketLine2, basketRim]);
		return root;
	}

	private createIntro() {
		this.player.setVisible(false);
		this.introPanel = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(60);
		const shade = this.makeIntroGradient(0, 0, WIDTH, HEIGHT);
		const glowLeft = this.add.circle(-124, -238, 98, 0xf2ff95, 0.1);
		const glowRight = this.add.circle(128, -178, 86, 0xffffff, 0.1);
		const card = this.makeRoundedPanel(0, -10, 342, 588, 28, 0xf8fffe, 0.97, 0x82d7c8, 0.85, 3);
		const tagBg = this.makeRoundedPanel(0, -258, 208, 28, 14, 0x82d7c8, 0.22, 0xd1fae5, 0.9, 1);
		const tag = this.add
			.text(0, -258, '全国爱眼日特献 · 科学护眼小游戏', {
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
		this.showToast('准备好了吗？接绿色，躲红色！', 0x315f9a);
	}

	private followPointer(pointer: Phaser.Input.Pointer) {
		if (this.gameState !== 'playing') return;
		this.playerTargetX = Phaser.Math.Clamp(pointer.worldX, 60, WIDTH - 60);
	}

	private updatePlayer(delta: number) {
		const keyboardSpeed = (260 * delta) / 1000;
		if (this.cursors?.left.isDown) this.playerTargetX -= keyboardSpeed;
		if (this.cursors?.right.isDown) this.playerTargetX += keyboardSpeed;
		this.playerTargetX = Phaser.Math.Clamp(this.playerTargetX, 60, WIDTH - 60);
		this.player.x = Phaser.Math.Linear(this.player.x, this.playerTargetX, Math.min(1, delta / 70));
	}

	private spawnItem(elapsed: number) {
		const badChance = Phaser.Math.Linear(0.42, 0.58, elapsed / GAME_SECONDS);
		const pool = Math.random() < badChance ? BAD_ITEMS : GOOD_ITEMS;
		const definition = Phaser.Utils.Array.GetRandom(pool);
		const x = Phaser.Math.Between(42, WIDTH - 42);
		const y = 126;
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
		const glyph = this.add
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
				fontSize: '9px',
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
				item.view.y >= CATCH_Y - 32 &&
				item.view.y <= CATCH_Y + 17 &&
				Math.abs(item.view.x - this.player.x) < 48;
			if (inBasket) {
				this.resolveCatch(item);
			} else if (item.view.y > 780) {
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
			this.animateResolved(item.view, 0xe94e58, '-1 生命');
			this.loseHeart(this.lives);
			this.cameras.main.shake(180, 0.002);
			if ('vibrate' in navigator) navigator.vibrate?.(80);
			this.showToast(`小心：${item.definition.label}`, 0xbd3d47);

			// debug
			// if (this.lives <= 0) this.time.delayedCall(280, () => this.finishGame('生命值归零'));
		}
	}

	private resolveMiss(item: FallingItem) {
		item.resolved = true;
		if (item.definition.kind === 'bad') {
			this.badAvoided += 1;
			this.score += 10;
			this.scoreText.setText(this.score.toString().padStart(4, '0'));
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

	private showToast(message: string, color: number) {
		this.toast?.destroy(true);
		const toast = this.add.container(195, 132).setDepth(40).setAlpha(0);
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
			y: 140,
			duration: 150,
			yoyo: true,
			hold: 900,
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
		this.timeBar.fillStyle(color).fillRoundedRect(290, 102, 76 * ratio, 6, 3);
	}

	private finishGame(reason: string) {
		if (this.gameState !== 'playing') return;
		this.gameState = 'result';
		this.items.forEach((item) => item.view.destroy(true));
		this.items = [];
		this.player.setVisible(false);
		this.best = Math.max(this.best, this.score);
		localStorage.setItem('jie-jie-le-best', String(this.best));
		this.showResult(reason);
	}

	private calculateRiskIndex() {
		const raw = 50 + this.badCaught * 10 + this.goodMissed * 2 - this.goodCaught * 4 - this.badAvoided * 2;
		return Phaser.Math.Clamp(Math.round(raw), 5, 95);
	}

	private showResult(reason: string) {
		const risk = this.calculateRiskIndex();
		const level = risk <= 30 ? '低' : risk <= 60 ? '中' : '高';
		const color = risk <= 30 ? 0x3eaa75 : risk <= 60 ? 0xe99b35 : 0xd84c56;
		const insight =
			this.badCaught === 0
				? '你成功避开了全部坏习惯，动作判断很出色。'
				: this.goodCaught >= this.badCaught * 3
					? '你接住了很多好习惯，再留意连续近距离用眼。'
					: '本轮接到了较多坏习惯，下次先观察标签再移动。';
		const tipIndex = this.badCaught >= 3 ? 1 : this.goodCaught < 4 ? 0 : 2;

		const panel = this.add.container(195, 441).setDepth(70);
		const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x14334f, 0.34);
		const card = this.add.rectangle(0, 0, 348, 650, 0xffffff, 0.992).setStrokeStyle(3, color);
		const eyebrow = this.add
			.text(0, -289, '本轮近视风险指数报告', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '13px',
				fontStyle: 'bold',
				color: '#5a7181'
			})
			.setOrigin(0.5);
		const reasonText = this.add
			.text(0, -262, reason, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '10px',
				color: '#87969f'
			})
			.setOrigin(0.5);
		const ring = this.add.circle(0, -185, 57, color, 0.11).setStrokeStyle(9, color);
		const riskValue = this.add
			.text(0, -194, String(risk), {
				fontFamily: 'Arial',
				fontSize: '49px',
				fontStyle: 'bold',
				color: Phaser.Display.Color.IntegerToColor(color).rgba
			})
			.setOrigin(0.5);
		const riskLabel = this.add
			.text(0, -155, `${level}风险表现`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#4b6170'
			})
			.setOrigin(0.5);
		const disclaimer = this.add
			.text(0, -111, '游戏表现指数 ≠ 真实近视风险', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '11px',
				fontStyle: 'bold',
				color: '#c05259'
			})
			.setOrigin(0.5);

		const statsBg = this.add.rectangle(0, -50, 308, 78, 0xf3f8fb).setStrokeStyle(1, 0xd4e4ed);
		const stats = this.add
			.text(
				0,
				-50,
				`得分  ${this.score}     接对  ${this.goodCaught}     接错  ${this.badCaught}\n成功避开  ${this.badAvoided}     最高连击  ${this.maxStreak}`,
				{
					fontFamily: 'Microsoft YaHei',
					fontSize: '12px',
					color: '#3f5968',
					align: 'center',
					lineSpacing: 10
				}
			)
			.setOrigin(0.5);
		const insightTitle = this.add
			.text(-142, 12, '表现解读', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#315f9a'
			})
			.setOrigin(0, 0.5);
		const insightText = this.add
			.text(-142, 37, insight, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '11px',
				color: '#5c6e78',
				wordWrap: { width: 284, useAdvancedWrap: true },
				lineSpacing: 4
			})
			.setOrigin(0, 0);
		const tipBg = this.add.rectangle(0, 112, 308, 88, 0xeaf7f0).setStrokeStyle(1, 0xb9dfca);
		const tipTitle = this.add
			.text(-137, 83, '带走一个护眼行动', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '11px',
				fontStyle: 'bold',
				color: '#2b855e'
			})
			.setOrigin(0, 0.5);
		const tip = this.add
			.text(-137, 104, TIPS[tipIndex], {
				fontFamily: 'Microsoft YaHei',
				fontSize: '11px',
				color: '#416555',
				wordWrap: { width: 274, useAdvancedWrap: true },
				lineSpacing: 4
			})
			.setOrigin(0, 0);
		const slogan = this.add
			.text(0, 174, '近视难可逆，但可防、可控', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '17px',
				fontStyle: 'bold',
				color: '#2e8567'
			})
			.setOrigin(0.5);
		const restart = this.makeButton(0, 226, 218, 52, '再挑战一次', () => this.startGame());
		const bestText = this.add
			.text(0, 272, `历史最高分 ${this.best}`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '10px',
				color: '#81919a'
			})
			.setOrigin(0.5);
		const note = this.add
			.text(0, 302, '如发现看远模糊、眯眼等情况，请及时进行专业检查', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '9px',
				color: '#89969c'
			})
			.setOrigin(0.5);
		panel.add([
			shade,
			card,
			eyebrow,
			reasonText,
			ring,
			riskValue,
			riskLabel,
			disclaimer,
			statsBg,
			stats,
			insightTitle,
			insightText,
			tipBg,
			tipTitle,
			tip,
			slogan,
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
