import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY, DPR } from './game/config.js';
import BootScene from './game/scenes/BootScene.js';
import MenuScene from './game/scenes/MenuScene.js';
import GameScene from './game/scenes/GameScene.js';

const config = {
	type: Phaser.AUTO,
	// 内部分辨率按 DPR 放大（高清渲染），坐标仍用 CSS 单位，配合各场景相机 zoom=DPR
	width: GAME_WIDTH * DPR,
	height: GAME_HEIGHT * DPR,
	parent: 'game-container',
	backgroundColor: '#87CEEB',
	scale: {
		mode: Phaser.Scale.FIT,
		// 关闭 Phaser 自带居中：其 CENTER_BOTH 会给 canvas 加 margin 居中，
		// 会和我们下面的 rotate/scale 变换叠加，导致画布中心偏移、顶部被推出可视区。
		// 改为由 applyOrientation 用 position:fixed + translate(-50%,-50%) 自行精确居中。
		autoCenter: Phaser.Scale.NO_CENTER
	},
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: GRAVITY },
			debug: false
		}
	},
	scene: [BootScene, MenuScene, GameScene]
};

// eslint-disable-next-line no-new
const game = new Phaser.Game(config);

// ===== 竖屏强制横版：显示旋转 + 输入坐标反旋转 =====
// 竖握时把 canvas 旋转 90° 并放大填满整屏（显示层）。
// 但 Phaser 的输入映射默认只处理「未旋转的轴对齐矩形」，旋转后屏幕 X/Y 互换，
// 必须重写 transformPointer：在拿到完整 (pageX,pageY) 时统一做「反旋转」，
// 把屏幕坐标还原成游戏内坐标（baseSize 像素空间），触摸才能落对位置。
const orient = {
	rotated: false,
	cover: 1,
	dW: 0,
	dH: 0, // canvas 经 FIT 后的 CSS 显示尺寸（未旋转）
	cx: 0,
	cy: 0, // 屏幕中心（CSS px）
	baseW: GAME_WIDTH * DPR,
	baseH: GAME_HEIGHT * DPR // 游戏内部像素尺寸
};

function applyOrientation() {
	const canvas = game.canvas;
	if (!canvas || !game.scale) return;
	const w = window.innerWidth;
	const h = window.innerHeight;

	// 自行精确居中：fixed + 屏幕正中 + translate(-50%,-50%)，
	// 旋转/缩放均绕屏幕正中心进行，绝不会被 Phaser 的 margin 居中干扰而偏移。
	canvas.style.position = 'fixed';
	canvas.style.left = '50%';
	canvas.style.top = '50%';
	canvas.style.transformOrigin = 'center center';

	// 实际 FIT 显示尺寸（CSS px），优先读 ScaleManager，避免自己算与 FIT 结果不一致
	let dW = game.scale.displaySize.width;
	let dH = game.scale.displaySize.height;
	if (!dW || !dH) {
		const fit = Math.min(w / orient.baseW, h / orient.baseH);
		dW = orient.baseW * fit;
		dH = orient.baseH * fit;
	}

	if (h > w) {
		// 竖屏：等比 contain（取两项较小者）保证整块画布完整可见、绝不裁切边缘文字。
		// 手机竖屏下画布宽高比本就等于屏幕旋转后的比例，故此处通常 ≈ 填满且不裁不空；
		// 仅在比例异常时改为留极窄边条（body 底色为天空蓝，可融合）。
		// visScale 取 0.995 留 0.5% 安全边，杜绝因四舍五入导致的边缘过盈裁切。
		const cover = Math.min(w / dH, h / dW);
		const visScale = cover * 0.995;
		canvas.style.transform = `translate(-50%, -50%) rotate(90deg) scale(${visScale})`;
		orient.rotated = true;
		orient.cover = cover; // 输入映射用真实 cover，保证触摸精准
	} else {
		// 横屏：FIT 已按窗口缩放好显示尺寸，仅居中即可
		canvas.style.transform = 'translate(-50%, -50%)';
		orient.rotated = false;
		orient.cover = 1;
	}

	orient.dW = dW;
	orient.dH = dH;
	orient.cx = w / 2;
	orient.cy = h / 2;
}

// 重写输入坐标变换：旋转时用反旋转公式，未旋转时走官方默认逻辑
function installInputTransform() {
	const mgr = game.input;
	if (!mgr || !mgr.transformPointer) return;
	const orig = mgr.transformPointer.bind(mgr);

	mgr.transformPointer = function (pointer, pageX, pageY, wasMove) {
		let x, y;
		if (orient.rotated) {
			// 反旋转：屏幕点 → canvas 局部(未旋转)坐标
			// 显示变换为 rotate(90deg) scale(cover)，故 局部(lx,ly) → 屏幕偏移(-ly, lx)*cover
			const lx = (pageY - orient.cy) / orient.cover;
			const ly = -(pageX - orient.cx) / orient.cover;
			x = (lx / orient.dW + 0.5) * orient.baseW;
			y = (ly / orient.dH + 0.5) * orient.baseH;
		} else {
			// 官方默认：轴对齐矩形映射
			const b = game.scale.canvasBounds;
			const s = game.scale.displayScale;
			x = (pageX - b.left) * s.x;
			y = (pageY - b.top) * s.y;
		}

		const p0 = pointer.position;
		const p1 = pointer.prevPosition;
		p1.x = p0.x;
		p1.y = p0.y;
		const a = pointer.smoothFactor;
		if (!wasMove || a === 0) {
			p0.x = x;
			p0.y = y;
		} else {
			p0.x = x * a + p1.x * (1 - a);
			p0.y = y * a + p1.y * (1 - a);
		}
	};
}

game.events.once('ready', () => {
	applyOrientation();
	installInputTransform();
});

window.addEventListener('resize', () => setTimeout(applyOrientation, 0));
window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 300));
