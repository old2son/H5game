import * as Phaser from 'phaser';
import { RENDER_SCALE, VIEW_HEIGHT, VIEW_WIDTH } from '../constants';

type GameState = 'intro' | 'scatter' | 'assemble' | 'quiz' | 'result';
type PartId = 'cornea' | 'iris' | 'lens' | 'body' | 'retina' | 'optic';

interface EyePart {
	id: PartId;
	name: string;
	color: number;
	textColor?: string;
	asset: string;
	iconSize: [number, number];
	placedSize: [number, number];
	placedOffset?: [number, number];
	placedAlpha?: number;
	placedDepth?: number;
	placedAngle?: number;
	placedBlendMode?: Phaser.BlendModes;
	target: Phaser.Math.Vector2;
	fact: string;
	clue: string;
}

interface QuizItem {
	question: string;
	options: string[];
	answer: number;
	score: number;
}

// 问答选项按钮：root 用来挂交互，paint 用来在答题后改底色
type QuizOptionView = {
	root: Phaser.GameObjects.Container;
	paint: (fill: number) => void;
};

const QUIZ_OPTION_FILL = 0x6d5bd7;
const QUIZ_OPTION_RIGHT = 0x2fa96b;
const QUIZ_OPTION_WRONG = 0xd9503f;

const PARTS: EyePart[] = [
	{
		id: 'cornea',
		name: '角膜',
		color: 0x5ed9ef,
		textColor: '#164E63',
		asset: 'part-cornea',
		iconSize: [46, 52],
		placedSize: [112, 132],
		placedOffset: [33, 0],
		placedAlpha: 0.95,
		placedDepth: 7,
		target: new Phaser.Math.Vector2(62, 300),
		clue: '透明小圆顶',
		fact: '角膜像透明小窗，是光线进入眼睛的第一站，还能帮助光线聚焦。'
	},
	{
		id: 'iris',
		name: '虹膜',
		color: 0x32b58c,
		textColor: '#FFFFFF',
		asset: 'part-iris',
		iconSize: [52, 52],
		placedSize: [56, 106],
		placedAlpha: 0.98,
		placedDepth: 8,
		target: new Phaser.Math.Vector2(111, 300),
		clue: '彩色光圈',
		fact: '虹膜是眼睛有颜色的部分，像相机光圈一样调节进入眼内的光量。'
	},
	{
		id: 'lens',
		name: '晶状体',
		color: 0xffc94d,
		textColor: '#593800',
		asset: 'part-lens',
		iconSize: [56, 54],
		placedSize: [74, 80],
		placedAlpha: 0.96,
		placedDepth: 9,
		target: new Phaser.Math.Vector2(158, 300),
		clue: '透明小镜片',
		fact: '晶状体像一块会变形的小镜片，帮助远近不同的物体清晰成像。'
	},
	{
		id: 'body',
		name: '玻璃体',
		color: 0x79d7ff,
		textColor: '#164E63',
		asset: 'part-body',
		iconSize: [58, 58],
		placedSize: [126, 168],
		placedOffset: [-20, 0],
		placedAlpha: 0.9,
		placedDepth: 6,
		target: new Phaser.Math.Vector2(208, 300),
		clue: '透明凝胶',
		fact: '玻璃体像透明果冻，填满眼球中间的大空间，帮助眼球保持圆润形状，并让光线顺利通过。'
	},
	{
		id: 'retina',
		name: '视网膜',
		color: 0xff7185,
		textColor: '#FFFFFF',
		asset: 'part-retina',
		iconSize: [54, 42],
		placedSize: [248, 188],
		placedOffset: [-55, 30],
		placedAlpha: 0.88,
		placedDepth: 5,
		placedBlendMode: Phaser.BlendModes.MULTIPLY,
		target: new Phaser.Math.Vector2(255, 270),
		clue: '感光屏幕',
		fact: '视网膜像相机的感光屏幕，把光转换成大脑能读懂的电信号。'
	},
	{
		id: 'optic',
		name: '视神经',
		color: 0x9b78e7,
		textColor: '#FFFFFF',
		asset: 'part-optic',
		iconSize: [58, 38],
		placedSize: [82, 42],
		placedOffset: [-22, -3],
		placedAlpha: 0.96,
		placedDepth: 10,
		placedAngle: 24,
		target: new Phaser.Math.Vector2(332, 320),
		clue: '信号电缆',
		fact: '视神经像信号电缆，把视网膜产生的视觉信号送往大脑。'
	}
];

const labelOffsets: Record<string, number> = {
	iris: 63,
	lens: -52,
	body: 63,
	retina: -48,
	optic: -48
};

const QUIZ = [
	{
		question: '哪一部分像相机光圈一样，\n控制进入眼睛的光量？',
		options: ['视网膜', '虹膜', '视神经'],
		answer: 1,
		score: 10
	},
	{
		question: '光线最后到达哪里，\n才会被转换成电信号？',
		options: ['视网膜', '角膜', '巩膜'],
		answer: 0,
		score: 10
	},
	{
		question: '谁像“信号电缆”，\n把视觉信号送往大脑？',
		options: ['晶状体', '虹膜', '视神经'],
		answer: 2,
		score: 10
	},
	{
		question: '眼睛最外层的透明小窗，\n帮助光线进入并聚焦的是？',
		options: ['角膜', '玻璃体', '视网膜'],
		answer: 0,
		score: 10
	},
	{
		question: '哪一部分像会变形的小镜片，\n帮助我们看清远近物体？',
		options: ['虹膜', '晶状体', '视神经'],
		answer: 1,
		score: 10
	},
	{
		question: '眼球内部像透明果冻一样，\n填充空间并帮助保持眼球形状的是？',
		options: ['玻璃体', '晶状体', '虹膜'],
		answer: 0,
		score: 10
	}
];

const INFO_CARD_X = 195;
const INFO_CARD_Y = 418;
const INFO_CARD_ENTER_Y = 431;
const PARTS_TITLE_X = 38;
const PARTS_TITLE_Y = INFO_CARD_Y + 80;
const PARTS_ROW1_Y = INFO_CARD_Y + 150;
const PARTS_ROW2_Y = INFO_CARD_Y + 250;
const PARTS_HOME_POSITIONS = [
	[78, PARTS_ROW1_Y],
	[195, PARTS_ROW1_Y],
	[312, PARTS_ROW1_Y],
	[78, PARTS_ROW2_Y],
	[195, PARTS_ROW2_Y],
	[312, PARTS_ROW2_Y]
] as const;
const INTRO_PANEL_X = 195;
const INTRO_PANEL_Y = 438;
const INTRO_MODEL_Y = -90;
const INTRO_MODEL_FLOAT_OFFSET = 3;
const INTRO_MODEL_SHADOW_OFFSET_Y = 88;
const INTRO_MODEL_SHADOW_Y = INTRO_MODEL_Y + INTRO_MODEL_SHADOW_OFFSET_Y;
const SCENE_BACKGROUND_FILL_Y = 426;
const SCENE_BACKGROUND_FILL_HEIGHT = 718;
const SCENE_PANEL_RADIUS = 8;
const SCENE_PANEL_STROKE_WIDTH = 1;
const SCENE_MAIN_PANEL = {
	x: 18,
	y: 124,
	width: 354,
	height: 326,
	fillAlpha: 0.97,
	strokeColor: 0xbfc9f4,
	strokeAlpha: 0.8
} as const;
const SCENE_PARTS_PANEL = {
	x: 18,
	y: 478,
	width: 354,
	height: 254,
	fillAlpha: 0.9,
	strokeColor: 0xc9d7f2,
	strokeAlpha: 0.7
} as const;
const SCENE_PARTS_DECOR_TOP_Y = SCENE_PARTS_PANEL.y - 22;
const SCENE_PARTS_DECOR_BOTTOM_Y = SCENE_PARTS_PANEL.y + SCENE_PARTS_PANEL.height + 16;
const SCENE_PARTS_DECOR_DOTS = [
	[36, SCENE_PARTS_DECOR_TOP_Y - 10, 4, 0],
	[112, SCENE_PARTS_DECOR_TOP_Y + 7, 6, 1],
	[184, SCENE_PARTS_DECOR_TOP_Y - 4, 5, 0],
	[232, SCENE_PARTS_DECOR_TOP_Y + 11, 7, 1],
	[338, SCENE_PARTS_DECOR_TOP_Y - 6, 4, 0],
	[58, SCENE_PARTS_DECOR_BOTTOM_Y + 8, 6, 1],
	[146, SCENE_PARTS_DECOR_BOTTOM_Y - 9, 4, 0],
	[224, SCENE_PARTS_DECOR_BOTTOM_Y + 12, 7, 1],
	[286, SCENE_PARTS_DECOR_BOTTOM_Y - 5, 5, 0],
	[346, SCENE_PARTS_DECOR_BOTTOM_Y + 3, 4, 1]
] as const;
const SCENE_DECOR_CIRCLES = [
	[46, 250, 82],
	[360, 492, 96]
] as const;

const AUTO_START_FOR_DEBUG = false;
const AUTO_COMPLETE_FOR_DEBUG = false;
const AUTO_STARTQUIZ_FOR_DEBUG = false;
const AUTO_SHOWRESULT_FOR_DEBUG = false;

export class EyeAssemblyScene extends Phaser.Scene {
	private state: GameState = 'intro';
	private score = 0;
	private placed = 0;
	private wrong = 0;
	private quizIndex = 0;
	private quizCorrect = 0;
	private best = Number(localStorage.getItem('eye-anatomy-best') ?? 0);
	private partTokens: Phaser.GameObjects.Container[] = [];
	private placedPartImages: Phaser.GameObjects.Image[] = [];
	private placedLabels: Phaser.GameObjects.Container[] = [];
	private targetMarkers = new Map<PartId, Phaser.GameObjects.Container>();
	private sceneBackground!: Phaser.GameObjects.Graphics;
	private hudBackground!: Phaser.GameObjects.Graphics;
	private headerLayer!: Phaser.GameObjects.Container;
	private targetLayer!: Phaser.GameObjects.Container;
	private eyeModel!: Phaser.GameObjects.Image;
	private hudProgress!: Phaser.GameObjects.Text;
	private hudScore!: Phaser.GameObjects.Text;
	private infoCard!: Phaser.GameObjects.Container;
	private infoCardBg!: Phaser.GameObjects.Graphics;
	private infoImage!: Phaser.GameObjects.Image;
	private infoTitle!: Phaser.GameObjects.Text;
	private infoImageBg!: Phaser.GameObjects.Arc;
	private readonly infoTitleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
		fontFamily: 'Microsoft YaHei',
		fontSize: '14px',
		fontStyle: 'bold',
		color: '#ffe28d'
	};
	private infoBody!: Phaser.GameObjects.Text;
	private introPanel!: Phaser.GameObjects.Container;
	private quizPanel?: Phaser.GameObjects.Container;
	private resultPanel?: Phaser.GameObjects.Container;
	// 组装完成后压暗全屏的遮罩：一直留到玩家重新开始一局才撤掉
	private completeShade?: Phaser.GameObjects.Rectangle;
	private closeButton!: Phaser.GameObjects.Text;
	private quizList: QuizItem[] = [];
	// 本题已作答、下一题还没渲染出来时锁住答题，避免重复计分或一次跳两题
	private answering = false;
	// 当前这一题的选项按钮，答题后用来染色
	private quizOptions: QuizOptionView[] = [];

	constructor() {
		super('eye-assembly');
	}

	preload() {
		this.load.image('mascot', 'assets/bright-eyes-mascot.png');
		this.load.image('calm', 'assets/calm.png');
		this.load.image('smile', 'assets/smile.png');
		this.load.image('laugh', 'assets/laugh.png');
		this.load.image('eye3d', 'assets/eye-3d-cutaway.png');
		this.load.image('part-cornea', 'assets/part-cornea-3d.png');
		this.load.image('part-iris', 'assets/part-iris-3d.png');
		this.load.image('part-lens', 'assets/part-lens-3d.png');
		this.load.image('part-body', 'assets/part-body-3d.png');
		this.load.image('part-retina', 'assets/part-retina-3d.png');
		this.load.image('part-optic', 'assets/part-optic-3d-v2.png');
		this.load.image('loading', 'assets/loading.png');
	}

	create() {
		const camera = this.cameras.main;
		camera.setZoom(RENDER_SCALE);
		camera.setScroll((VIEW_WIDTH - camera.width) / 2, (VIEW_HEIGHT - camera.height) / 2);
		this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (gameObject: Phaser.GameObjects.GameObject) => {
			if (gameObject instanceof Phaser.GameObjects.Text) gameObject.setResolution(RENDER_SCALE);
		});
		this.drawSceneBackground();
		this.drawHudBackground();
		this.createHeader();
		this.createEyeDiagram();
		this.createInfoCard();
		this.createIntro();
		if (AUTO_START_FOR_DEBUG) {
			this.introPanel.setVisible(false).setAlpha(0);
			this.time.delayedCall(0, () => this.startAssembly());
		}
		if (AUTO_COMPLETE_FOR_DEBUG) {
			this.time.delayedCall(0, () => {
				this.state = 'assemble';
				this.showAssemblyComplete();
			});
		}
		if (AUTO_STARTQUIZ_FOR_DEBUG) {
			this.time.delayedCall(0, () => this.startQuiz());
		}
	}

	private drawSceneBackground() {
		this.sceneBackground = this.add.graphics().setVisible(false);
		this.sceneBackground
			.fillStyle(0xeaf8ff)
			.fillRect(0, SCENE_BACKGROUND_FILL_Y, VIEW_WIDTH, SCENE_BACKGROUND_FILL_HEIGHT);
		this.sceneBackground.fillStyle(0xcfefff, 0.8);
		SCENE_DECOR_CIRCLES.forEach(([x, y, radius]) => this.sceneBackground.fillCircle(x, y, radius));
		SCENE_PARTS_DECOR_DOTS.forEach(([x, y, radius, colorIndex]) => {
			this.sceneBackground.fillStyle(colorIndex ? 0xb5a2ee : 0x8bd8ec, 0.32).fillCircle(x, y, radius);
		});
		this.drawScenePanel(SCENE_MAIN_PANEL);
		this.drawScenePanel(SCENE_PARTS_PANEL);
	}

	private drawScenePanel(panel: {
		x: number;
		y: number;
		width: number;
		height: number;
		fillAlpha: number;
		strokeColor: number;
		strokeAlpha: number;
	}) {
		this.sceneBackground
			.fillStyle(0xffffff, panel.fillAlpha)
			.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, SCENE_PANEL_RADIUS);
		this.sceneBackground
			.lineStyle(SCENE_PANEL_STROKE_WIDTH, panel.strokeColor, panel.strokeAlpha)
			.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, SCENE_PANEL_RADIUS);
	}

	private drawHudBackground() {
		this.hudBackground = this.add.graphics().setVisible(false);
		this.hudBackground.fillStyle(0x5848ca).fillRect(0, 0, 390, 96);
		this.hudBackground.fillStyle(0x786be3).fillCircle(38, 52, 58).fillCircle(352, 28, 70);
		const maskShape = this.add.rectangle(195, 48, 390, 96, 0xffffff);
		this.children.remove(maskShape);
		this.hudBackground.enableFilters();
		this.hudBackground.filters!.internal.addMask(maskShape, false, this.cameras.main);
	}

	private createHeader() {
		this.headerLayer = this.add.container(0, 0).setVisible(false);
		const title = this.add.text(22, 21, '眼球拆解大作战', {
			fontFamily: 'Microsoft YaHei',
			fontSize: '24px',
			fontStyle: 'bold',
			color: '#ffffff'
		});
		const subtitle = this.add.text(23, 55, '认识眼睛里会合作的“视觉小队”', {
			fontFamily: 'Microsoft YaHei',
			fontSize: '12px',
			color: '#e9e5ff'
		});
		const progressLabel = this.add
			.text(286, 24, '拼装进度', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#d9d4ff'
			})
			.setOrigin(1, 0);
		this.hudProgress = this.add
			.text(356, 22, `0 / ${PARTS.length}}`, {
				fontFamily: 'Arial',
				fontSize: '18px',
				fontStyle: 'bold',
				color: '#ffffff'
			})
			.setOrigin(1, 0);
		const scoreLabel = this.add
			.text(286, 54, '当前得分', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#d9d4ff'
			})
			.setOrigin(1, 0);
		this.hudScore = this.add
			.text(350, 52, '000', {
				fontFamily: 'Arial',
				fontSize: '18px',
				fontStyle: 'bold',
				color: '#ffe28d'
			})
			.setOrigin(1, 0);
		this.headerLayer.add([title, subtitle, progressLabel, this.hudProgress, scoreLabel, this.hudScore]);
	}

	private createEyeDiagram() {
		this.add
			.text(195, 163, '眼球剖面', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '15px',
				fontStyle: 'bold',
				color: '#5148a6'
			})
			.setOrigin(0.5);

		this.add.ellipse(199, 396, 286, 30, 0x52607a, 0.07).setDepth(1);
		this.eyeModel = this.add.image(195, 300, 'eye3d').setDisplaySize(330, 220).setAlpha(0.48).setDepth(2);

		const rays = this.add.graphics().setDepth(3);
		rays.lineStyle(2, 0xffcf45, 0.38);
		rays.lineBetween(28, 274, 151, 300);
		rays.lineBetween(28, 300, 286, 300);
		rays.lineBetween(28, 326, 151, 300);
		this.add
			.text(30, 250, '光', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#d69a13'
			})
			.setDepth(4);
		[0, 1, 2].forEach((index) => {
			const dot = this.add.circle(28, 274 + index * 26, 4, 0xffd44f, 0.75).setDepth(4);
			this.tweens.add({
				targets: dot,
				x: index === 1 ? 286 : 151,
				y: 300,
				alpha: { from: 0.18, to: 0.9 },
				duration: 1450 + index * 170,
				delay: index * 260,
				repeat: -1,
				repeatDelay: 260,
				ease: 'Sine.InOut'
			});
		});

		this.targetLayer = this.add.container(0, 0).setDepth(8);
		PARTS.forEach((part, index) => {
			const marker = this.add.container(part.target.x, part.target.y);
			const ring = this.createDashedRing(19, 0xf8fbff, 0.58, 0xc6d0e7, 0.9, 2);
			const number = this.add
				.text(0, 0, String(index + 1), {
					fontFamily: 'Arial',
					fontSize: '13px',
					fontStyle: 'bold',
					color: '#ffffff',
					stroke: '#4b5571',
					strokeThickness: 3
				})
				.setOrigin(0.5);
			marker.add([ring, number]);
			this.targetLayer.add(marker);
			this.targetMarkers.set(part.id, marker);
		});
		this.add.text(PARTS_TITLE_X, PARTS_TITLE_Y, '等待归位的眼球部件', {
			fontFamily: 'Microsoft YaHei',
			fontSize: '12px',
			fontStyle: 'bold',
			color: '#5a6380'
		});
	}

	private createDashedRing(
		radius: number,
		fillColor: number,
		fillAlpha: number,
		strokeColor: number,
		strokeAlpha: number,
		lineWidth: number
	) {
		const ring = this.add.graphics();
		ring.fillStyle(fillColor, fillAlpha);
		ring.fillCircle(0, 0, radius);
		ring.lineStyle(lineWidth, strokeColor, strokeAlpha);

		const dashAngle = 0.34;
		const gapAngle = 0.18;
		for (let angle = 0; angle < Math.PI * 2; angle += dashAngle + gapAngle) {
			ring.beginPath();
			ring.arc(0, 0, radius, angle, Math.min(angle + dashAngle, Math.PI * 2), false);
			ring.strokePath();
		}

		return ring;
	}

	private createInfoCard() {
		this.infoCard = this.add.container(INFO_CARD_X, INFO_CARD_Y).setDepth(35).setAlpha(0);
		const shadow = this.add.graphics();
		shadow.fillStyle(0x26335a, 0.18).fillRoundedRect(-158, -48, 330, 110, 4);
		this.infoCardBg = this.add.graphics();
		this.setInfoCardColor(0x5045ad);
		this.infoImageBg = this.add.circle(-120, 4, 39, 0xffffff, 0.95).setStrokeStyle(2, 0xbdb4f5);
		this.infoImage = this.add.image(-120, 4, 'mascot').setDisplaySize(58, 58);
		this.infoTitle = this.add.text(-70, -32, '', this.infoTitleStyle);
		this.infoBody = this.add.text(-70, -6, '', {
			fontFamily: 'Microsoft YaHei',
			fontSize: '12px',
			color: '#ffffff',
			wordWrap: { width: 228, useAdvancedWrap: true },
			lineSpacing: 5
		});

		// 右上角关闭按钮
		this.closeButton = this.add
			.text(151, -43, '×', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '24px',
				color: '#ffffff',
				fontStyle: 'bold'
			})
			.setOrigin(0.5)
			.setInteractive({ useHandCursor: true })
			.setVisible(false);
		this.closeButton.on('pointerdown', () => {
			this.hideInfoCard();
		});

		this.infoCard.add([
			shadow,
			this.infoCardBg,
			this.infoImageBg,
			this.infoImage,
			this.infoTitle,
			this.infoBody,
			this.closeButton
		]);
	}

	private setInfoCardColor(bgColor: number, isBorder = false) {
		this.infoCardBg.clear();

		this.infoCardBg.fillStyle(bgColor, 1).fillRoundedRect(-169, -59, 338, 118, 4);

		if (isBorder) {
			const borderColor = this.darkenColor(bgColor);

			this.infoCardBg.lineStyle(2, borderColor, 1).strokeRoundedRect(-169, -59, 338, 118, 4);
		}
	}

	private darkenColor(color: number, factor = 0.88): number {
		const r = (color >> 16) & 0xff;
		const g = (color >> 8) & 0xff;
		const b = color & 0xff;

		return (Math.round(r * factor) << 16) | (Math.round(g * factor) << 8) | Math.round(b * factor);
	}

	private hideInfoCard() {
		this.tweens.killTweensOf(this.infoCard);
		this.infoCard.setAlpha(0).setY(INFO_CARD_ENTER_Y);
		this.closeButton.setVisible(false);
	}

	private createIntro() {
		this.introPanel = this.add.container(INTRO_PANEL_X, INTRO_PANEL_Y).setDepth(80);
		const shade = this.add.graphics();
		shade.fillStyle(0xffffff, 0.99).fillRoundedRect(-175, -290, 350, 500, 8);
		shade.lineStyle(1, 0x7564df, 0.42).strokeRoundedRect(-175, -290, 350, 500, 8);
		const title = this.add
			.text(0, -247, '来认识一下眼球吧！', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '24px',
				fontStyle: 'bold',
				color: '#4f46a5'
			})
			.setOrigin(0.5);
		const modelShadow = this.add.ellipse(4, INTRO_MODEL_SHADOW_Y, 274, 26, 0x49536c, 0.18);
		const model = this.add.image(0, INTRO_MODEL_Y, 'eye3d').setDisplaySize(310, 207);
		this.tweens.add({
			targets: model,
			angle: { from: -1.2, to: 1.2 },
			y: { from: INTRO_MODEL_Y - INTRO_MODEL_FLOAT_OFFSET, to: INTRO_MODEL_Y + INTRO_MODEL_FLOAT_OFFSET },
			duration: 1700,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.InOut'
		});
		this.tweens.add({
			targets: modelShadow,
			y: { from: INTRO_MODEL_SHADOW_Y + 1, to: INTRO_MODEL_SHADOW_Y - 1 },
			scaleX: 0.93,
			alpha: 0.1,
			duration: 1700,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.InOut'
		});

		const best = this.add
			.text(0, 44, `历史最高分  ${this.best.toString().padStart(3, '0')}`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#8b82b8'
			})
			.setOrigin(0.5);
		const start = this.makeButton(0, 100, 218, 50, '开始 · 拆散部件', () => this.startAssembly());
		const source = this.add
			.text(0, 165, '趣味结构示意 · 不替代医学检查或诊断', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#9aa2b1'
			})
			.setOrigin(0.5);
		this.introPanel.add([shade, title, modelShadow, model, best, start, source]);
	}

	private startAssembly() {
		this.clearCompleteShade();
		this.state = 'scatter';
		this.score = 0;
		this.placed = 0;
		this.wrong = 0;
		this.sceneBackground.setVisible(true);
		this.hudBackground.setVisible(true);
		this.headerLayer.setVisible(true);
		this.eyeModel.setAlpha(0.2);
		this.targetLayer.setAlpha(0);
		this.targetMarkers.forEach((marker) => marker.setVisible(true));
		this.tweens.add({
			targets: this.introPanel,
			alpha: 0,
			duration: 240,
			onComplete: () => this.introPanel.setVisible(false)
		});
		this.quizPanel?.destroy(true);
		this.resultPanel?.destroy(true);
		this.partTokens.filter((token) => token.active).forEach((token) => token.destroy(true));
		this.placedPartImages.filter((image) => image.active).forEach((image) => image.destroy());
		this.placedLabels.filter((label) => label.active).forEach((label) => label.destroy(true));
		this.partTokens = [];
		this.placedPartImages = [];
		this.placedLabels = [];
		const homes = PARTS_HOME_POSITIONS.map(([x, y]) => new Phaser.Math.Vector2(x, y));
		Phaser.Utils.Array.Shuffle(homes);
		this.time.delayedCall(280, () => {
			PARTS.forEach((part, i) => this.createPartToken(part, homes[i], true, i));
		});
		this.tweens.add({ targets: this.targetLayer, alpha: 1, duration: 320, delay: 220 });
		this.time.delayedCall(1450, () => {
			this.state = 'assemble';
			this.showMessage('部件已经散开啦！观察形状，把它们拖回眼球的空缺位置。', 2400);
		});
		this.updateHud();
	}

	private createPartToken(part: EyePart, home: Phaser.Math.Vector2, scatter = false, order = 0) {
		const root = this.add
			.container(scatter ? part.target.x : home.x, scatter ? part.target.y : home.y)
			.setSize(108, 76)
			.setDepth(20);
		const shadow = this.add.graphics();
		shadow.fillStyle(0x74809d, 0.25).fillRoundedRect(-51, -34, 108, 76, 4);
		const card = this.add.graphics();
		card.fillStyle(0xffffff, 1).fillRoundedRect(-54, -38, 108, 76, 4);
		card.lineStyle(2, part.color, 1).strokeRoundedRect(-54, -38, 108, 76, 4);
		const iconBg = this.add.circle(-28, 0, 26, part.color, 0.12);
		const icon = this.add.image(-28, 0, part.asset).setDisplaySize(part.iconSize[0], part.iconSize[1]);
		const label = this.add
			.text(22, -13, part.name, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '14px',
				fontStyle: 'bold',
				color: '#3d4660'
			})
			.setOrigin(0.5);
		const clue = this.add
			.text(22, 13, part.clue, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#7a849b' })
			.setOrigin(0.5);
		root.add([shadow, card, iconBg, icon, label, clue]);
		root.setData('part', part).setData('homeX', home.x).setData('homeY', home.y);
		const enableDrag = () => {
			if (!root.active) return;
			root.setInteractive({ useHandCursor: true, draggable: true });
			this.input.setDraggable(root);
		};
		root.on('dragstart', () => {
			if (this.state === 'assemble') {
				root.setDepth(50).setScale(1.08);
			}
		});
		root.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
			if (this.state === 'assemble') root.setPosition(dragX, dragY);
		});
		root.on('dragend', () => {
			this.checkPlacement(root);
		});
		if (scatter) {
			root.setAlpha(0.3).setScale(0.42).setDepth(28);
			this.tweens.add({
				targets: root,
				x: home.x,
				y: home.y,
				alpha: 1,
				scale: 1,
				duration: 620,
				delay: order * 105,
				ease: 'Back.Out',
				onComplete: () => {
					root.setDepth(20);
					enableDrag();
				}
			});
		} else {
			enableDrag();
		}
		this.partTokens.push(root);
	}

	private checkPlacement(token: Phaser.GameObjects.Container) {
		if (this.state !== 'assemble' || !token.active) return;
		const part = token.getData('part') as EyePart;
		const distance = Phaser.Math.Distance.Between(token.x, token.y, part.target.x, part.target.y);
		if (distance <= 50) {
			token.disableInteractive();
			this.tweens.add({
				targets: token,
				x: part.target.x,
				y: part.target.y,
				alpha: 0,
				scale: 0.5,
				duration: 240,
				onComplete: () => token.destroy(true)
			});
			this.targetMarkers.get(part.id)?.setVisible(false);
			this.drawPlacedPart(part);
			this.placed += 1;
			this.score += 10;
			this.showFact(part);
			this.updateHud();
			if (this.placed === PARTS.length) this.time.delayedCall(1500, () => this.showAssemblyComplete());
		} else {
			this.wrong += 1;
			this.tweens.add({
				targets: token,
				x: token.getData('homeX'),
				y: token.getData('homeY'),
				scale: 1,
				duration: 280,
				ease: 'Back.Out',
				onComplete: () => token.setDepth(20)
			});
			this.showMessage(`提示：${part.name}是“${part.clue}”，再观察它的形状吧！`);
			this.updateHud();
		}
	}

	private drawPlacedPart(part: EyePart) {
		const [offsetX, offsetY] = part.placedOffset ?? [0, 0];
		const [placedWidth, placedHeight] = part.placedSize;
		const placedImage = this.add
			.image(part.target.x + offsetX, part.target.y + offsetY, part.asset)
			.setDisplaySize(placedWidth * 0.7, placedHeight * 0.7)
			.setDepth(part.placedDepth ?? 7)
			.setAngle(part.placedAngle ?? 0)
			.setBlendMode(part.placedBlendMode ?? Phaser.BlendModes.NORMAL)
			.setAlpha(0);
		this.tweens.add({
			targets: placedImage,
			alpha: part.placedAlpha ?? 1,
			displayWidth: placedWidth,
			displayHeight: placedHeight,
			duration: 240,
			ease: 'Back.Out'
		});
		this.placedPartImages.push(placedImage);

		const labelY = part.target.y + (labelOffsets[part.id] ?? -63);
		const label = this.add.container(part.target.x, labelY).setDepth(12);
		const bg = this.add.rectangle(0, 0, 67, 24, 0xffffff, 0.96).setStrokeStyle(2, part.color);
		const text = this.add
			.text(0, 0, `✓ ${part.name}`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				fontStyle: 'bold',
				color: '#465169'
			})
			.setOrigin(0.5);
		label.add([bg, text]).setScale(0.2).setAlpha(0);
		this.tweens.add({ targets: label, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
		this.placedLabels.push(label);
	}

	private showFact(part: EyePart) {
		this.setInfoCardColor(part.color, true);
		const borderColor = this.darkenColor(part.color);
		this.infoImageBg.setStrokeStyle(2, borderColor);
		this.infoImage.setTexture(part.asset).setDisplaySize(part.iconSize[0] * 1.15, part.iconSize[1] * 1.15);
		this.infoTitle.setText(`科普卡解锁 · ${part.name}`).setColor(part.textColor || '#FFFFFF');
		this.infoBody.setText(part.fact).setColor(part.textColor || '#FFFFFF');
		this.tweens.killTweensOf(this.infoCard);
		this.infoCard.setAlpha(0).setY(INFO_CARD_ENTER_Y);

		this.closeButton.setVisible(true);
		this.tweens.add({
			targets: this.infoCard,
			alpha: 0.88,
			y: INFO_CARD_Y,
			duration: 180,
			ease: 'Sine.Out'
		});
	}

	private showMessage(text: string, holdTime = 1720) {
		this.setInfoCardColor(0x5045ad);
		this.infoImageBg.setStrokeStyle(2, 0xbdb4f5);
		this.infoImage.setTexture('mascot').setDisplaySize(58, 58);
		this.infoTitle.setText('小瞳提示');
		this.infoTitle.setStyle(this.infoTitleStyle);
		this.infoBody.setText(text).setColor('#FFFFFF');
		this.tweens.killTweensOf(this.infoCard);
		this.infoCard.setAlpha(0).setY(INFO_CARD_ENTER_Y);
		this.closeButton.setVisible(false);
		this.tweens.add({
			targets: this.infoCard,
			alpha: 1,
			y: INFO_CARD_Y,
			duration: 180,
			ease: 'Sine.Out',
			yoyo: true,
			hold: holdTime
		});
	}

	private showAssemblyComplete() {
		if (this.state !== 'assemble') return;

		this.hideInfoCard();

		this.state = 'quiz';
		this.eyeModel.setAlpha(1);
		this.targetLayer.setAlpha(0);
		this.eyeModel.setDisplaySize(330 * 0.96, 220 * 0.96);
		this.tweens.add({
			targets: this.eyeModel,
			displayWidth: 330,
			displayHeight: 220,
			duration: 420,
			ease: 'Back.Out'
		});
		const panel = this.add.container(205, 422).setDepth(75);
		// 全屏遮罩：压暗背景，让完成后的问答、结果阶段也保持聚焦。
		// 刻意不加交互，避免挡住面板按钮和问答选项；它会一直留在场景里，
		// 直到玩家重新开始一局（startAssembly / 回到开场）才由 clearCompleteShade 撤掉。
		this.clearCompleteShade();
		const shade = this.add
			.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.67)
			.setDepth(74);
		shade.setAlpha(0);
		shade.setInteractive();
		this.tweens.add({ targets: shade, alpha: 1, duration: 220, ease: 'Sine.Out' });
		this.completeShade = shade;
		const bg = this.add.graphics();
		bg.fillStyle(0xffffff, 0.99);
		bg.lineStyle(3, 0x6d5bd7, 1);
		bg.fillRoundedRect(-172, -179, 324, 358, 8);
		bg.strokeRoundedRect(-172, -179, 324, 358, 8);

		const miniEye = this.add.image(-10, -95, 'eye3d').setDisplaySize(188, 125);
		const title = this.add
			.text(-10, -7, '眼球组装完成！', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '23px',
				fontStyle: 'bold',
				color: '#4f46a5'
			})
			.setOrigin(0.5);
		const body = this.add
			.text(-10, 49, '光线经过角膜、虹膜和晶状体，\n到达视网膜，再由视神经把信号送给大脑。', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#596174',
				align: 'center',
				lineSpacing: 7
			})
			.setOrigin(0.5);
		const button = this.makeButton(-10, 121, 210, 52, '进入功能问答', () => {
			panel.destroy(true);
			this.startQuiz();
		});
		panel.add([bg, miniEye, title, body, button]);
	}

	private clearCompleteShade() {
		this.completeShade?.destroy();
		this.completeShade = undefined;
	}

	private startQuiz() {
		this.quizList = this.shuffleArray(QUIZ, 4);
		this.quizIndex = 0;
		this.quizCorrect = 0;
		this.showQuizQuestion();
	}

	private showQuizQuestion() {
		this.quizPanel?.destroy(true);
		this.quizOptions = [];
		// 新题目在这里渲染，答题锁随之放开
		this.answering = false;
		if (AUTO_SHOWRESULT_FOR_DEBUG) {
			this.showResult();
			return;
		}
		if (this.quizIndex >= this.quizList.length) {
			const loadingImage = this.add
				.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 'loading')
				.setDisplaySize(64, 64)
				.setDepth(75);

			this.tweens.add({
				targets: loadingImage,
				angle: 360,
				duration: 1000,
				repeat: -1
			});

			this.time.delayedCall(1500, () => {
				this.showResult();
			});

			return;
		}
		const item = this.quizList[this.quizIndex];
		const panel = this.add.container(205, 422).setDepth(76);
		const bg = this.add.graphics();
		bg.fillStyle(0xffffff, 0.99);
		bg.lineStyle(3, 0x6d5bd7, 1);
		bg.fillRoundedRect(-172, -179, 324, 440, 8);
		bg.strokeRoundedRect(-172, -179, 324, 440, 8);

		const eye = this.add.image(-10, -112, 'eye3d').setDisplaySize(128, 85);
		const progress = this.add
			.text(-10, -50, `功能问答  ${this.quizIndex + 1} / ${this.quizList.length}`, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '13px',
				color: '#7569b1'
			})
			.setOrigin(0.5);
		const question = this.add
			.text(-10, 0, item.question, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '17px',
				fontStyle: 'bold',
				color: '#39415c',
				align: 'center',
				wordWrap: { width: 292, useAdvancedWrap: true },
				lineSpacing: 6
			})
			.setOrigin(0.5);
		panel.add([bg, eye, progress, question]);
		item.options.forEach((option, i) => {
			const view = this.makeQuizOption(
				-10,
				72 + i * 62,
				272,
				48,
				`${String.fromCharCode(65 + i)}. ${option}`,
				() => this.answerQuiz(i)
			);
			panel.add(view.root);
			this.quizOptions.push(view);
		});
		this.quizPanel = panel;
	}

	// 问答选项按钮：和 makeButton 同样的外观，但把"改底色"暴露出来，
	// 这样答题后可以直接把选项染成绿/红，而不用弹提示卡。
	private makeQuizOption(
		x: number,
		y: number,
		width: number,
		height: number,
		text: string,
		onClick: () => void
	): QuizOptionView {
		const root = this.add.container(x, y).setSize(width, height);
		const radius = 8;
		const shadow = this.add.graphics();
		shadow.fillStyle(0x3c347c, 0.24);
		shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 5, width - 2, height - 2, radius);
		const bg = this.add.graphics();
		const label = this.add
			.text(0, 0, text, {
				fontFamily: 'Microsoft YaHei',
				fontSize: '15px',
				fontStyle: 'bold',
				color: '#ffffff'
			})
			.setOrigin(0.5);
		const paint = (fill: number) => {
			bg.clear();
			bg.fillStyle(fill, 1);
			bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
			bg.lineStyle(2, 0xffffff, 0.72);
			bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
		};
		paint(QUIZ_OPTION_FILL);
		root.add([shadow, bg, label]).setInteractive({ useHandCursor: true });
		root.on('pointerdown', () => root.setScale(0.97));
		root.on('pointerup', () => {
			root.setScale(1);
			onClick();
		});
		root.on('pointerout', () => root.setScale(1));
		return { root, paint };
	}

	private answerQuiz(index: number) {
		// 这一题已经答过了：等下一题渲染出来（showQuizQuestion 解锁）之前忽略点击
		if (this.answering) return;
		this.answering = true;
		const item = this.quizList[this.quizIndex];
		const chosen = this.quizOptions[index];
		const correct = this.quizOptions[item.answer];
		if (index === item.answer) {
			this.quizCorrect += 1;
			this.score += item.score;
			chosen?.paint(QUIZ_OPTION_RIGHT);
		} else {
			// 选错：自己变红，同时把正确项高亮成绿色
			chosen?.paint(QUIZ_OPTION_WRONG);
			correct?.paint(QUIZ_OPTION_RIGHT);
		}
		this.updateHud();
		this.quizIndex += 1;
		this.time.delayedCall(1500, () => this.showQuizQuestion());
	}

	private showResult() {
		this.state = 'result';
		this.quizPanel?.destroy(true);
		this.best = Math.max(this.best, this.score);
		localStorage.setItem('eye-anatomy-best', String(this.best));
		const panel = this.add.container(205, 422).setDepth(78);
		const bg = this.add.graphics();
		bg.fillStyle(0xffffff, 0.99);
		bg.lineStyle(3, 0x6d5bd7, 1);
		bg.fillRoundedRect(-172, -200, 324, 444, 8);
		bg.strokeRoundedRect(-172, -200, 324, 444, 8);

		const img = this.add
			.image(-10, -137, this.score >= 90 ? 'laugh' : this.score >= 70 ? 'smile' : 'calm')
			.setDisplaySize(67, 67);

		const title = this.add
			.text(-10, -74, '眼球结构小专家', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '25px',
				fontStyle: 'bold',
				color: '#4f46a5'
			})
			.setOrigin(0.5);
		const score = this.add
			.text(-10, -29, `${this.score} 分`, {
				fontFamily: 'Arial',
				fontSize: '34px',
				fontStyle: 'bold',
				color: '#ef9d2e'
			})
			.setOrigin(0.5);
		const stats = this.add
			.text(
				-10,
				40,
				`成功拼装  ${this.placed} / ${PARTS.length}\n问答正确  ${this.quizCorrect} / ${this.quizList.length}\n最高纪录  ${this.best}`,
				{
					fontFamily: 'Microsoft YaHei',
					fontSize: '14px',
					color: '#596174',
					align: 'center',
					lineSpacing: 8
				}
			)
			.setOrigin(0.5);
		const fact = this.add
			.text(-10, 115, '眼睛负责接收光线，大脑负责读懂信号。\n保护眼睛，也要记得每天增加户外活动！', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#4f46a5',
				align: 'center',
				lineSpacing: 5
			})
			.setOrigin(0.5);
		const restart = this.makeButton(-10, 169, 210, 52, '再看一次眼球组装', () => {
			panel.destroy(true);
			// 重新游玩才撤掉完成后的遮罩
			this.clearCompleteShade();
			if (AUTO_START_FOR_DEBUG) {
				this.startAssembly();
				return;
			}
			this.sceneBackground.setVisible(false);
			this.hudBackground.setVisible(false);
			this.headerLayer.setVisible(false);
			this.introPanel.setVisible(true).setAlpha(1);
			this.state = 'intro';
		});
		const note = this.add
			.text(-10, 222, '趣味结构示意 · 不替代医学检查或诊断', {
				fontFamily: 'Microsoft YaHei',
				fontSize: '12px',
				color: '#a0a6b4'
			})
			.setOrigin(0.5);
		panel.add([bg, img, title, score, stats, fact, restart, note]);
		this.resultPanel = panel;
	}

	private updateHud() {
		this.hudProgress.setText(`${this.placed} / ${PARTS.length}`);
		this.hudScore.setText(this.score.toString().padStart(3, '0'));
	}

	private makeButton(x: number, y: number, width: number, height: number, text: string, onClick: () => void) {
		const button = this.add.container(x, y).setSize(width, height);
		const radius = 8;
		const shadow = this.add.graphics();
		shadow.fillStyle(0x3c347c, 0.24);
		shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 5, width - 2, height - 2, radius);
		const bg = this.add.graphics();
		bg.fillStyle(0x6d5bd7, 1);
		bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
		bg.lineStyle(2, 0xc8c0ff, 1);
		const label = this.add
			.text(0, 0, text, { fontFamily: 'Microsoft YaHei', fontSize: '15px', fontStyle: 'bold', color: '#ffffff' })
			.setOrigin(0.5);
		button.add([shadow, bg, label]).setInteractive({ useHandCursor: true });
		button.on('pointerdown', () => button.setScale(0.97));
		button.on('pointerup', () => {
			button.setScale(1);
			onClick();
		});
		button.on('pointerout', () => button.setScale(1));
		return button;
	}

	private shuffleArray<T>(array: T[], count: number): T[] {
		const result = [...array]; // 不修改原数组

		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));

			[result[i], result[j]] = [result[j], result[i]];
		}

		return result.slice(0, count);
	}
}
