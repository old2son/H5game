/* =============================================================================
 * scenes.ts ——「大家来找茬·护眼版」场景占位绘制（TypeScript）
 * -----------------------------------------------------------------------------
 * 说明：当前没有美术资源，所有关卡画面均由代码「程序化绘制」生成占位图，
 *       保证游戏可玩。后续接入真实美术时，只需把 scene.render / diff.paint
 *       换成 canvas.drawImage(真实图片) 即可，diffs 的命中框 bbox 与 name 保持不变。
 *
 * 约定：
 *   - 每张图逻辑画布为 400 x 400。
 *   - scene.render(ctx, variant)：variant 0 = 原图，1 = 含全部差异的图。
 *   - diff.paint(ctx, variant)：绘制该处差异元素（0/1 两种状态）。
 * ===========================================================================*/
import posturePhotoUrl from '../../eye-find-diff/duxiezishi.png';
import { S, type Diff, type DiffBox, type Point, type Scene } from './types';

const posturePhoto = typeof Image === 'undefined' ? null : new Image();

if (posturePhoto) {
	posturePhoto.src = posturePhotoUrl;
	posturePhoto.addEventListener('load', () => {
		window.dispatchEvent(new Event('scene-assets-ready'));
	});
}

/* ----------------------------- 通用绘制工具 ----------------------------- */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.closePath();
}
function roundDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
	ctx.fillStyle = color;
	circle(ctx, x, y, r);
	ctx.fill();
}
function text(
	ctx: CanvasRenderingContext2D,
	str: string,
	x: number,
	y: number,
	size: number,
	color: string,
	align: CanvasTextAlign = 'center'
) {
	ctx.fillStyle = color;
	ctx.font = `bold ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
	ctx.textAlign = align;
	ctx.textBaseline = 'middle';
	ctx.fillText(str, x, y);
}
function paintDiff(diff: Diff, ctx: CanvasRenderingContext2D, variant: number) {
	diff.paint?.(ctx, variant);
}
/* 简易房间背景（墙 + 地板 + 左窗） */
function drawRoom(ctx: CanvasRenderingContext2D, wall1: string, wall2: string, floor: string) {
	const g = ctx.createLinearGradient(0, 0, 0, 300);
	g.addColorStop(0, wall1);
	g.addColorStop(1, wall2);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 400, 300);
	ctx.fillStyle = floor;
	ctx.fillRect(0, 300, 400, 100);
	ctx.fillStyle = 'rgba(0,0,0,0.08)';
	ctx.fillRect(0, 300, 400, 5);
	ctx.fillStyle = '#bfe3f2';
	rr(ctx, 28, 48, 104, 124, 8);
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 5;
	rr(ctx, 28, 48, 104, 124, 8);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(80, 48);
	ctx.lineTo(80, 172);
	ctx.moveTo(28, 110);
	ctx.lineTo(132, 110);
	ctx.stroke();
}
/* 书桌（通用） */
function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
	ctx.fillStyle = '#caa06a';
	rr(ctx, x, y, w, 16, 4);
	ctx.fill();
	ctx.fillStyle = '#a87f4d';
	ctx.fillRect(x + 10, y + 16, 12, 84);
	ctx.fillRect(x + w - 22, y + 16, 12, 84);
}
function drawPosturePhoto(ctx: CanvasRenderingContext2D) {
	if (!posturePhoto?.complete || !posturePhoto.naturalWidth || !posturePhoto.naturalHeight) return false;
	ctx.drawImage(posturePhoto, 0, postureStackLayout.topY, S, postureStackLayout.panelHeight * 2);
	return true;
}

const postureStackLayout = {
	width: S,
	// height: 620,
	// topY: 5,
	height: 600,
	topY: 0,
	panelHeight: 300
};

function mapPostureTapPoint(point: Point): Point | null {
	const { x, y } = point;
	const secondPanelY = postureStackLayout.topY + postureStackLayout.panelHeight;
	const inTopPanel = y >= postureStackLayout.topY && y <= postureStackLayout.topY + postureStackLayout.panelHeight;
	const inBottomPanel = y >= secondPanelY && y <= secondPanelY + postureStackLayout.panelHeight;

	if (!inTopPanel && !inBottomPanel) return null;

	const panelStartY = inBottomPanel ? secondPanelY : postureStackLayout.topY;
	return {
		x,
		y: ((y - panelStartY) / postureStackLayout.panelHeight) * S
	};
}

function getPostureTapBox(diff: Diff, point: Point): DiffBox {
  const secondPanelY = postureStackLayout.topY + postureStackLayout.panelHeight;
  return point.y >= secondPanelY ? diff.bottomBox || diff.bbox : diff.bbox;
}

function getPostureMarkerPoints(diff: Diff): Point[] {
  const topBox = diff.bbox;
  const bottomBox = diff.bottomBox || diff.bbox;
	const secondPanelY = postureStackLayout.topY + postureStackLayout.panelHeight;
  const topY = ((topBox.y + topBox.h / 2) / S) * postureStackLayout.panelHeight;
  const bottomY = ((bottomBox.y + bottomBox.h / 2) / S) * postureStackLayout.panelHeight;
	return [
          { x: topBox.x + topBox.w / 2, y: postureStackLayout.topY + topY },
          { x: bottomBox.x + bottomBox.w / 2, y: secondPanelY + bottomY }
	];
}
function getPostureDebugBoxes(diff: Diff): DiffBox[] {
  const topBox = diff.bbox;
  const bottomBox = diff.bottomBox || diff.bbox;
	const secondPanelY = postureStackLayout.topY + postureStackLayout.panelHeight;
	return [
		{
                  x: topBox.x,
                  y: postureStackLayout.topY + (topBox.y / S) * postureStackLayout.panelHeight,
                  w: topBox.w,
                  h: (topBox.h / S) * postureStackLayout.panelHeight
		},
		{
                  x: bottomBox.x,
                  y: secondPanelY + (bottomBox.y / S) * postureStackLayout.panelHeight,
                  w: bottomBox.w,
                  h: (bottomBox.h / S) * postureStackLayout.panelHeight
		}
	];
}

/* ===========================================================================
 * 场景 1：读写姿势
 * ========================================================================= */
const postureDiffs: Diff[] = [
	{
		name: '孩子坐姿',
		bbox: { x: 210, y: 140, w: 36, h: 100 }
	},
	{
		name: '书本距离',
		bbox: { x: 130, y: 135, w: 72, h: 52 }
	},
	{
		name: '台灯',
		bbox: { x: 72, y: 75, w: 74, h: 118 }
	},
	{
		name: '窗帘',
		bbox: { x: 50, y: 6, w: 76, h: 132 },
		bottomBox: { x: 25, y: 6, w: 150, h: 132 }
	},
	{
		name: '腿',
		bbox: { x: 146, y: 303, w: 46, h: 66 }
	}
];

const scenePosture: Scene = {
	name: '读写姿势',
	desc: '保持「一尺一拳一寸」：眼离书本一尺、胸离桌边一拳、手离笔尖一寸。',
	tip: '坐端正，不趴桌、不歪头。',
	boardMode: 'stacked',
	boardSize: postureStackLayout,
	mapTapPoint: mapPostureTapPoint,
  getTapBox: getPostureTapBox,
	getMarkerPoints: getPostureMarkerPoints,
	getDebugBoxes: getPostureDebugBoxes,
	diffs: postureDiffs,
	render(ctx, v) {
		drawPosturePhoto(ctx);
	}
};

/* ===========================================================================
 * 场景 2：光线环境
 * ========================================================================= */
const lightDiffs: Diff[] = [
	{
		name: '顶灯',
		bbox: { x: 168, y: 18, w: 64, h: 40 },
		paint(ctx, v) {
			const on = v === 0;
			ctx.fillStyle = '#777';
			rr(ctx, 184, 30, 32, 8, 2);
			ctx.fill();
			ctx.fillStyle = on ? '#fff4c2' : '#b8bdc4';
			ctx.beginPath();
			ctx.moveTo(176, 38);
			ctx.lineTo(224, 38);
			ctx.lineTo(214, 52);
			ctx.lineTo(186, 52);
			ctx.closePath();
			ctx.fill();
			if (on) {
				ctx.fillStyle = 'rgba(255,244,194,0.35)';
				ctx.beginPath();
				ctx.moveTo(200, 52);
				ctx.lineTo(120, 300);
				ctx.lineTo(280, 300);
				ctx.closePath();
				ctx.fill();
			}
		}
	},
	{
		name: '台灯',
		bbox: { x: 328, y: 206, w: 60, h: 72 },
		paint(ctx, v) {
			const on = v === 0;
			ctx.strokeStyle = '#555';
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.moveTo(356, 264);
			ctx.lineTo(356, 230);
			ctx.lineTo(344, 216);
			ctx.stroke();
			ctx.fillStyle = on ? '#ffd24d' : '#9aa0a6';
			ctx.beginPath();
			ctx.moveTo(330, 218);
			ctx.lineTo(362, 218);
			ctx.lineTo(356, 206);
			ctx.lineTo(336, 206);
			ctx.closePath();
			ctx.fill();
			if (on) {
				ctx.fillStyle = 'rgba(255,221,120,0.45)';
				circle(ctx, 344, 224, 40);
				ctx.fill();
			}
		}
	},
	{
		name: '窗帘',
		bbox: { x: 150, y: 46, w: 130, h: 150 },
		paint(ctx, v) {
			const closed = v === 1;
			if (closed) {
				ctx.fillStyle = '#f4b6c2';
				rr(ctx, 150, 46, 64, 150, 4);
				ctx.fill();
				rr(ctx, 216, 46, 64, 150, 4);
				ctx.fill();
				ctx.strokeStyle = 'rgba(0,0,0,0.08)';
				ctx.lineWidth = 2;
				for (let i = 0; i < 4; i++) {
					ctx.beginPath();
					ctx.moveTo(158 + i * 16, 50);
					ctx.lineTo(158 + i * 16, 192);
					ctx.stroke();
				}
			}
		}
	},
	{
		name: '窗外天色',
		bbox: { x: 150, y: 46, w: 130, h: 150 },
		paint(ctx, v) {
			const night = v === 1;
			ctx.fillStyle = night ? '#1c2540' : '#bfe3f2';
			rr(ctx, 152, 48, 126, 146, 6);
			ctx.fill();
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 4;
			rr(ctx, 152, 48, 126, 146, 6);
			ctx.stroke();
			if (night) {
				ctx.fillStyle = '#fff';
				[
					[190, 90],
					[230, 120],
					[260, 80],
					[210, 150]
				].forEach((p) => roundDot(ctx, p[0], p[1], 2.5, '#fff'));
				ctx.fillStyle = '#ffe27a';
				circle(ctx, 250, 100, 16);
				ctx.fill();
			} else {
				ctx.fillStyle = '#fff';
				circle(ctx, 240, 95, 18);
				ctx.fill();
			}
		}
	},
	{
		name: '屏幕眩光',
		bbox: { x: 188, y: 196, w: 80, h: 64 },
		paint(ctx, v) {
			ctx.fillStyle = '#2c3140';
			rr(ctx, 188, 200, 80, 56, 4);
			ctx.fill();
			ctx.fillStyle = v === 1 ? '#7fb6ff' : '#cfe6ff';
			rr(ctx, 194, 206, 68, 44, 2);
			ctx.fill();
			ctx.fillStyle = '#2c3140';
			rr(ctx, 220, 256, 16, 8, 2);
			ctx.fill();
			if (v === 1) {
				ctx.fillStyle = 'rgba(255,255,255,0.6)';
				ctx.beginPath();
				ctx.moveTo(196, 208);
				ctx.lineTo(228, 208);
				ctx.lineTo(200, 248);
				ctx.lineTo(196, 248);
				ctx.closePath();
				ctx.fill();
			}
		}
	}
];

const sceneLight: Scene = {
	name: '光线环境',
	desc: '读写要在充足、均匀的光线下进行；光线应从左上方来，避免眩光与阴影。',
	tip: '开主灯 + 台灯，屏幕避开反光。',
	diffs: lightDiffs,
	render(ctx, v) {
		drawRoom(ctx, '#eef1f6', '#dfe4ee', '#cdbfa6');
		paintDiff(lightDiffs[0], ctx, v);
		paintDiff(lightDiffs[3], ctx, v);
		paintDiff(lightDiffs[2], ctx, v);
		drawDesk(ctx, 150, 264, 230);
		paintDiff(lightDiffs[4], ctx, v);
		paintDiff(lightDiffs[1], ctx, v);
	}
};

/* ===========================================================================
 * 场景 3：用眼时长
 * ========================================================================= */
const durationDiffs: Diff[] = [
	{
		name: '墙上时钟',
		bbox: { x: 290, y: 50, w: 84, h: 84 },
		paint(ctx, v) {
			const long = v === 1;
			ctx.fillStyle = '#fff';
			circle(ctx, 332, 92, 36);
			ctx.fill();
			ctx.strokeStyle = '#444';
			ctx.lineWidth = 3;
			circle(ctx, 332, 92, 36);
			ctx.stroke();
			ctx.strokeStyle = '#222';
			ctx.lineWidth = 4;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(332, 92);
			ctx.lineTo(332, long ? 64 : 74);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(332, 92);
			ctx.lineTo(long ? 354 : 348, 92);
			ctx.stroke();
			text(ctx, long ? '2小时' : '20分', 332, 140, 13, long ? '#e74c3c' : '#2ecc71');
		}
	},
	{
		name: '休息提示牌',
		bbox: { x: 300, y: 232, w: 70, h: 40 },
		paint(ctx, v) {
			if (v === 1) return;
			ctx.fillStyle = '#2ecc71';
			rr(ctx, 304, 234, 62, 30, 5);
			ctx.fill();
			text(ctx, '休息一下', 335, 249, 13, '#fff');
		}
	},
	{
		name: '眼睛状态',
		bbox: { x: 176, y: 150, w: 80, h: 60 },
		paint(ctx, v) {
			const tired = v === 1;
			const cx = 214;
			const headY = 176;
			ctx.fillStyle = '#5b8def';
			rr(ctx, cx - 34, 214, 68, 74, 20);
			ctx.fill();
			ctx.strokeStyle = '#5b8def';
			ctx.lineWidth = 14;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(cx - 26, 222);
			ctx.lineTo(cx - 6, 262);
			ctx.moveTo(cx + 26, 222);
			ctx.lineTo(cx + 8, 262);
			ctx.stroke();
			roundDot(ctx, cx - 6, 264, 7, '#ffd9b3');
			roundDot(ctx, cx + 8, 264, 7, '#ffd9b3');
			roundDot(ctx, cx, headY, 23, '#ffd9b3');
			ctx.fillStyle = '#3a2a1d';
			ctx.beginPath();
			ctx.arc(cx, headY, 23, Math.PI * 1.02, Math.PI * 1.98);
			ctx.fill();
			if (tired) {
				ctx.strokeStyle = '#333';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(cx - 12, headY - 3);
				ctx.lineTo(cx - 4, headY - 3);
				ctx.moveTo(cx + 4, headY - 3);
				ctx.lineTo(cx + 12, headY - 3);
				ctx.stroke();
				ctx.strokeStyle = '#8a6d3b';
				ctx.beginPath();
				ctx.arc(cx - 9, headY + 6, 5, 0, Math.PI);
				ctx.arc(cx + 9, headY + 6, 5, 0, Math.PI);
				ctx.stroke();
			} else {
				roundDot(ctx, cx - 9, headY - 2, 3, '#333');
				roundDot(ctx, cx + 9, headY - 2, 3, '#333');
			}
		}
	},
	{
		name: '书本堆',
		bbox: { x: 150, y: 224, w: 60, h: 50 },
		paint(ctx, v) {
			const tall = v === 1;
			const n = tall ? 4 : 1;
			for (let i = 0; i < n; i++) {
				const yy = 262 - i * 11;
				ctx.fillStyle = ['#e07a5f', '#81b29a', '#f2cc8f', '#6d8ea0'][i % 4];
				rr(ctx, 154 + i, yy - 9, 52 - i * 2, 10, 2);
				ctx.fill();
			}
		}
	},
	{
		name: '水杯',
		bbox: { x: 320, y: 236, w: 34, h: 36 },
		paint(ctx, v) {
			const empty = v === 1;
			ctx.fillStyle = '#cfe8f5';
			rr(ctx, 324, 240, 24, 26, 4);
			ctx.fill();
			ctx.strokeStyle = '#7fb6d6';
			ctx.lineWidth = 2;
			rr(ctx, 324, 240, 24, 26, 4);
			ctx.stroke();
			if (!empty) {
				ctx.fillStyle = '#4aa3df';
				rr(ctx, 327, 248, 18, 15, 2);
				ctx.fill();
			}
		}
	}
];

const sceneDuration: Scene = {
	name: '用眼时长',
	desc: '近距离用眼 20~30 分钟，就远眺 20 秒（20-20-20 法则），让眼睛休息。',
	tip: '定时休息，别连续苦读两小时。',
	diffs: durationDiffs,
	render(ctx, v) {
		drawRoom(ctx, '#fdf3e7', '#f3e6d2', '#d9b38c');
		paintDiff(durationDiffs[0], ctx, v);
		drawDesk(ctx, 140, 268, 240);
		paintDiff(durationDiffs[2], ctx, v);
		paintDiff(durationDiffs[3], ctx, v);
		paintDiff(durationDiffs[4], ctx, v);
		paintDiff(durationDiffs[1], ctx, v);
	}
};

/* ===========================================================================
 * 场景 4：屏幕距离
 * ========================================================================= */
const screenDiffs: Diff[] = [
	{
		name: '人脸距离',
		bbox: { x: 120, y: 150, w: 150, h: 120 },
		paint(ctx, v) {
			const close = v === 1;
			if (!close) {
				ctx.strokeStyle = '#2ecc71';
				ctx.lineWidth = 3;
				ctx.setLineDash([6, 4]);
				ctx.beginPath();
				ctx.moveTo(196, 210);
				ctx.lineTo(248, 210);
				ctx.stroke();
				ctx.setLineDash([]);
				text(ctx, '一臂远', 222, 198, 12, '#2ecc71');
			}
		}
	},
	{
		name: '屏幕高度',
		bbox: { x: 250, y: 170, w: 110, h: 110 },
		paint(ctx, v) {
			const low = v === 1;
			const topY = low ? 232 : 196;
			ctx.fillStyle = '#2c3140';
			rr(ctx, 280, topY, 78, 58, 4);
			ctx.fill();
			ctx.fillStyle = '#1c2230';
			rr(ctx, 300, topY + 58, 38, 8, 2);
			ctx.fill();
			ctx.fillStyle = '#3a4150';
			rr(ctx, 308, topY + 66, 22, 6, 2);
			ctx.fill();
		}
	},
	{
		name: '护眼模式',
		bbox: { x: 282, y: 192, w: 74, h: 56 },
		paint(ctx, v) {
			const low = v === 1;
			const topY = low ? 236 : 200;
			ctx.fillStyle = v === 1 ? '#8ec5ff' : '#ffe9b0';
			rr(ctx, 286, topY + 4, 66, 44, 2);
			ctx.fill();
			if (v === 0) {
				ctx.fillStyle = 'rgba(255,180,80,0.25)';
				rr(ctx, 286, topY + 4, 66, 44, 2);
				ctx.fill();
			}
		}
	},
	{
		name: '坐姿',
		bbox: { x: 96, y: 150, w: 110, h: 150 },
		paint(ctx, v) {
			const close = v === 1;
			const cx = close ? 168 : 150;
			const headX = close ? 196 : 168;
			const headY = close ? 196 : 184;
			ctx.fillStyle = '#ef7d54';
			rr(ctx, cx - 30, 226, 60, 70, 20);
			ctx.fill();
			ctx.strokeStyle = '#ef7d54';
			ctx.lineWidth = 14;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(cx + 18, 236);
			ctx.lineTo(cx + 30, 262);
			ctx.moveTo(cx + 24, 236);
			ctx.lineTo(cx + 40, 262);
			ctx.stroke();
			roundDot(ctx, cx + 30, 264, 7, '#ffd9b3');
			roundDot(ctx, cx + 40, 264, 7, '#ffd9b3');
			roundDot(ctx, headX, headY, 22, '#ffd9b3');
			ctx.fillStyle = '#2e2a26';
			ctx.beginPath();
			ctx.arc(headX, headY, 22, Math.PI * 1.02, Math.PI * 1.98);
			ctx.fill();
			roundDot(ctx, headX - 8, headY - 1, 2.6, '#333');
			roundDot(ctx, headX + 8, headY - 1, 2.6, '#333');
		}
	},
	{
		name: '环境顶灯',
		bbox: { x: 168, y: 16, w: 64, h: 42 },
		paint(ctx, v) {
			const on = v === 0;
			ctx.fillStyle = '#777';
			rr(ctx, 184, 28, 32, 8, 2);
			ctx.fill();
			ctx.fillStyle = on ? '#fff4c2' : '#b8bdc4';
			ctx.beginPath();
			ctx.moveTo(176, 36);
			ctx.lineTo(224, 36);
			ctx.lineTo(214, 52);
			ctx.lineTo(186, 52);
			ctx.closePath();
			ctx.fill();
			if (on) {
				ctx.fillStyle = 'rgba(255,244,194,0.3)';
				ctx.beginPath();
				ctx.moveTo(200, 52);
				ctx.lineTo(150, 240);
				ctx.lineTo(250, 240);
				ctx.closePath();
				ctx.fill();
			}
		}
	}
];

const sceneScreen: Scene = {
	name: '屏幕距离',
	desc: '看屏幕保持一臂距离（约 50~70cm），屏幕顶端与视线平齐，并开启护眼模式。',
	tip: '屏幕别凑太近，开护眼滤蓝光。',
	diffs: screenDiffs,
	render(ctx, v) {
		drawRoom(
			ctx,
			v === 1 ? '#2a2f3a' : '#eef1f6',
			v === 1 ? '#222632' : '#dfe4ee',
			v === 1 ? '#3a3f4a' : '#cdbfa6'
		);
		if (v === 1) {
			ctx.fillStyle = 'rgba(0,0,0,0.18)';
			ctx.fillRect(0, 0, 400, 400);
		}
		paintDiff(screenDiffs[4], ctx, v);
		paintDiff(screenDiffs[2], ctx, v);
		paintDiff(screenDiffs[1], ctx, v);
		paintDiff(screenDiffs[3], ctx, v);
		paintDiff(screenDiffs[0], ctx, v);
	}
};

/* ===========================================================================
 * 场景 5：户外活动
 * ========================================================================= */
const outdoorDiffs: Diff[] = [
	{
		name: '太阳',
		bbox: { x: 40, y: 30, w: 90, h: 90 },
		paint(ctx, v) {
			if (v === 1) {
				ctx.fillStyle = '#ffffff';
				circle(ctx, 80, 80, 26);
				ctx.fill();
				circle(ctx, 110, 80, 22);
				ctx.fill();
				circle(ctx, 95, 66, 22);
				ctx.fill();
				return;
			}
			ctx.fillStyle = '#ffd24d';
			circle(ctx, 80, 80, 26);
			ctx.fill();
			ctx.strokeStyle = '#ffd24d';
			ctx.lineWidth = 4;
			for (let i = 0; i < 8; i++) {
				const a = (i * Math.PI) / 4;
				ctx.beginPath();
				ctx.moveTo(80 + Math.cos(a) * 32, 80 + Math.sin(a) * 32);
				ctx.lineTo(80 + Math.cos(a) * 44, 80 + Math.sin(a) * 44);
				ctx.stroke();
			}
		}
	},
	{
		name: '孩子活动',
		bbox: { x: 150, y: 210, w: 100, h: 150 },
		paint(ctx, v) {
			const sit = v === 1;
			if (sit) {
				ctx.fillStyle = 'rgba(120,120,160,0.25)';
				rr(ctx, 158, 220, 92, 110, 8);
				ctx.fill();
				const cx = 204;
				roundDot(ctx, cx, 250, 20, '#ffd9b3');
				ctx.fillStyle = '#5b8def';
				rr(ctx, cx - 24, 270, 48, 50, 14);
				ctx.fill();
				ctx.fillStyle = '#3a2a1d';
				ctx.beginPath();
				ctx.arc(cx, 250, 20, Math.PI * 1.02, Math.PI * 1.98);
				ctx.fill();
				roundDot(ctx, cx - 7, 249, 2.6, '#333');
				roundDot(ctx, cx + 7, 249, 2.6, '#333');
				text(ctx, '宅家', cx, 335, 13, '#555');
			} else {
				const cx = 200;
				ctx.strokeStyle = '#ef7d54';
				ctx.lineWidth = 16;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(cx - 6, 300);
				ctx.lineTo(cx - 14, 340);
				ctx.moveTo(cx + 6, 300);
				ctx.lineTo(cx + 18, 342);
				ctx.stroke();
				ctx.fillStyle = '#ef7d54';
				rr(ctx, cx - 22, 268, 44, 40, 16);
				ctx.fill();
				roundDot(ctx, cx, 250, 20, '#ffd9b3');
				ctx.fillStyle = '#2e2a26';
				ctx.beginPath();
				ctx.arc(cx, 250, 20, Math.PI * 1.02, Math.PI * 1.98);
				ctx.fill();
				roundDot(ctx, cx - 7, 249, 2.6, '#333');
				roundDot(ctx, cx + 7, 249, 2.6, '#333');
				ctx.strokeStyle = '#ef7d54';
				ctx.lineWidth = 8;
				ctx.beginPath();
				ctx.moveTo(cx - 18, 276);
				ctx.lineTo(cx - 40, 262);
				ctx.moveTo(cx + 18, 276);
				ctx.lineTo(cx + 40, 258);
				ctx.stroke();
			}
		}
	},
	{
		name: '树木',
		bbox: { x: 290, y: 180, w: 110, h: 140 },
		paint(ctx, v) {
			const few = v === 1;
			const trees = few
				? [[330, 250, 0.8]]
				: [
						[320, 250, 0.9],
						[360, 240, 1],
						[388, 260, 0.7]
					];
			trees.forEach((t) => {
				ctx.fillStyle = '#8a5a32';
				ctx.fillRect(t[0] - 4, t[1], 8, 50 * t[2]);
				ctx.fillStyle = '#5fae46';
				circle(ctx, t[0], t[1] - 6, 24 * t[2]);
				ctx.fill();
				ctx.fillStyle = '#76c25a';
				circle(ctx, t[0] - 10, t[1] - 16, 16 * t[2]);
				ctx.fill();
			});
		}
	},
	{
		name: '同伴',
		bbox: { x: 240, y: 280, w: 70, h: 90 },
		paint(ctx, v) {
			if (v === 1) return;
			const cx = 268;
			ctx.fillStyle = '#9b6dd6';
			rr(ctx, cx - 16, 312, 32, 36, 12);
			ctx.fill();
			roundDot(ctx, cx, 300, 14, '#ffd9b3');
			ctx.fillStyle = '#3a2a1d';
			ctx.beginPath();
			ctx.arc(cx, 300, 14, Math.PI * 1.02, Math.PI * 1.98);
			ctx.fill();
			roundDot(ctx, cx - 5, 299, 2, '#333');
			roundDot(ctx, cx + 5, 299, 2, '#333');
		}
	},
	{
		name: '天色',
		bbox: { x: 0, y: 0, w: 400, h: 300 },
		paint(ctx, v) {
			const dusk = v === 1;
			const g = ctx.createLinearGradient(0, 0, 0, 300);
			if (dusk) {
				g.addColorStop(0, '#ff9e6d');
				g.addColorStop(0.6, '#ffd1a1');
				g.addColorStop(1, '#fff0d6');
			} else {
				g.addColorStop(0, '#7ec8f0');
				g.addColorStop(1, '#cfeeff');
			}
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 400, 300);
		}
	}
];

const sceneOutdoor: Scene = {
	name: '户外活动',
	desc: '每天户外活动 2 小时，自然光可预防近视；多在户外跑跳、看看远方。',
	tip: '出门晒晒太阳，别总宅着。',
	diffs: outdoorDiffs,
	render(ctx, v) {
		paintDiff(outdoorDiffs[4], ctx, v);
		paintDiff(outdoorDiffs[0], ctx, v);
		ctx.fillStyle = '#8fd06a';
		ctx.fillRect(0, 300, 400, 100);
		ctx.fillStyle = '#79bd57';
		ctx.fillRect(0, 300, 400, 8);
		paintDiff(outdoorDiffs[2], ctx, v);
		paintDiff(outdoorDiffs[1], ctx, v);
		paintDiff(outdoorDiffs[3], ctx, v);
	}
};

/* ----------------------------- 关卡总表 + 文案 ----------------------------- */
export const SCENES: Scene[] = [scenePosture, sceneLight, sceneDuration, sceneScreen, sceneOutdoor];

export const PLACEHOLDER_TIPS: Record<string, string[]> = {
	读写姿势: [
		'（科普图文占位）眼离书本约 33cm（一尺）。',
		'胸口离桌沿一拳，握笔离笔尖一寸。',
		'不趴桌、不歪头，脊柱保持自然直立。'
	],
	光线环境: [
		'（科普图文占位）主灯 + 台灯双光源更均匀。',
		'光线从左上方来，避免手部阴影。',
		'屏幕避开窗户反光，可拉上遮光帘。'
	],
	用眼时长: ['（科普图文占位）遵循 20-20-20 法则。', '近距离用眼 20~30 分钟远眺 20 秒。', '连续用眼不超过 1 小时。'],
	屏幕距离: [
		'（科普图文占位）屏幕距离一臂（50~70cm）。',
		'屏幕顶端与视线平齐，略向下看。',
		'开启护眼/滤蓝光模式，亮度随环境。'
	],
	户外活动: ['（科普图文占位）每天户外 2 小时。', '自然光有助于延缓近视发展。', '多望远、多跑跳，放松睫状肌。']
};

export { S };
