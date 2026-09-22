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
import posturePhotoUrl from '../assets/duxiezishi.webp';
import postureLessonImageUrl from '../assets/duxiezishi-result.webp';
import lightPhotoUrl from '../assets/guangxianhuanjing.webp';
import lightLessonImageUrl from '../assets/guangxianhuanjing-result.webp';
import durationPhotoUrl from '../assets/yongyanshichang.webp';
import durationLessonImageUrl from '../assets/yongyanshichang-result.webp';
import screenPhotoUrl from '../assets/yongyanjuli.webp';
import screenLessonImageUrl from '../assets/yongyanjuli-result.webp';
import outdoorPhotoUrl from '../assets/huwaiyundong.webp';
import outdoorLessonImageUrl from '../assets/huwaiyundong-result.webp';
import { S, type Diff, type DiffBox, type MarkerPoint, type Point, type Scene } from './types';

type SceneAssetRecord = {
	photoUrl: string;
	lessonImageUrl: string;
	photo: HTMLImageElement | null;
	photoPromise: Promise<void> | null;
	lessonPromise: Promise<void> | null;
};

const sceneAssets: SceneAssetRecord[] = [
	{
		photoUrl: posturePhotoUrl,
		lessonImageUrl: postureLessonImageUrl,
		photo: null,
		photoPromise: null,
		lessonPromise: null
	},
	{
		photoUrl: lightPhotoUrl,
		lessonImageUrl: lightLessonImageUrl,
		photo: null,
		photoPromise: null,
		lessonPromise: null
	},
	{
		photoUrl: durationPhotoUrl,
		lessonImageUrl: durationLessonImageUrl,
		photo: null,
		photoPromise: null,
		lessonPromise: null
	},
	{
		photoUrl: screenPhotoUrl,
		lessonImageUrl: screenLessonImageUrl,
		photo: null,
		photoPromise: null,
		lessonPromise: null
	},
	{
		photoUrl: outdoorPhotoUrl,
		lessonImageUrl: outdoorLessonImageUrl,
		photo: null,
		photoPromise: null,
		lessonPromise: null
	}
];

function emitSceneAssetsReady() {
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new Event('scene-assets-ready'));
	}
}

function ensurePhotoLoaded(record: SceneAssetRecord) {
	if (typeof Image === 'undefined') return Promise.resolve();
	if (record.photo?.complete && record.photo.naturalWidth) return Promise.resolve();
	if (record.photoPromise) return record.photoPromise;

	const image = record.photo || new Image();
	record.photo = image;
	record.photoPromise = new Promise((resolve) => {
		const finalize = () => {
			image.removeEventListener('load', finalize);
			image.removeEventListener('error', finalize);
			record.photoPromise = null;
			emitSceneAssetsReady();
			resolve();
		};

		if (image.complete && image.naturalWidth) {
			finalize();
			return;
		}

		image.addEventListener('load', finalize);
		image.addEventListener('error', finalize);
		image.src = record.photoUrl;
	});
	return record.photoPromise;
}

function preloadLessonImage(record: SceneAssetRecord) {
	if (!record.lessonImageUrl || typeof Image === 'undefined') return Promise.resolve();
	if (record.lessonPromise) return record.lessonPromise;

	record.lessonPromise = new Promise((resolve) => {
		const image = new Image();
		const finalize = () => {
			image.removeEventListener('load', finalize);
			image.removeEventListener('error', finalize);
			resolve();
		};

		image.addEventListener('load', finalize);
		image.addEventListener('error', finalize);
		image.src = record.lessonImageUrl;
	});
	return record.lessonPromise;
}

export async function ensureSceneAssetsLoaded(index: number) {
	const record = sceneAssets[index];
	if (!record) return;
	await ensurePhotoLoaded(record);
	void preloadLessonImage(record);
}

export function preloadSceneAssets(index: number) {
	const record = sceneAssets[index];
	if (!record) return;
	void ensurePhotoLoaded(record);
	void preloadLessonImage(record);
}

function getScenePhoto(index: number) {
	return sceneAssets[index]?.photo || null;
}

function drawStackedPhoto(
	ctx: CanvasRenderingContext2D,
	image: HTMLImageElement | null,
	layout: { topY: number; panelHeight: number }
) {
	if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return false;
	ctx.drawImage(image, 0, layout.topY, S, layout.panelHeight * 2);
	return true;
}
function drawPosturePhoto(ctx: CanvasRenderingContext2D) {
	return drawStackedPhoto(ctx, getScenePhoto(0), postureStackLayout);
}
function drawLightPhoto(ctx: CanvasRenderingContext2D) {
	return drawStackedPhoto(ctx, getScenePhoto(1), lightStackLayout);
}
function drawDurationPhoto(ctx: CanvasRenderingContext2D) {
	return drawStackedPhoto(ctx, getScenePhoto(2), durationStackLayout);
}
function drawScreenPhoto(ctx: CanvasRenderingContext2D) {
	return drawStackedPhoto(ctx, getScenePhoto(3), screenStackLayout);
}
function drawOutdoorPhoto(ctx: CanvasRenderingContext2D) {
	return drawStackedPhoto(ctx, getScenePhoto(4), outdoorStackLayout);
}

const postureStackLayout = {
	width: S,
	height: 600,
	topY: 0,
	panelHeight: 300
};
const lightStackLayout = {
	width: S,
	height: 600,
	topY: 0,
	panelHeight: 300
};
const durationStackLayout = {
	width: S,
	height: 600,
	topY: 0,
	panelHeight: 300
};
const screenStackLayout = {
	width: S,
	height: 600,
	topY: 0,
	panelHeight: 300
};
const outdoorStackLayout = {
	width: S,
	height: 600,
	topY: 0,
	panelHeight: 300
};

function mapStackedTapPoint(point: Point, layout: { topY: number; panelHeight: number }): Point | null {
	const { x, y } = point;
	const secondPanelY = layout.topY + layout.panelHeight;
	const inTopPanel = y >= layout.topY && y <= layout.topY + layout.panelHeight;
	const inBottomPanel = y >= secondPanelY && y <= secondPanelY + layout.panelHeight;

	if (!inTopPanel && !inBottomPanel) return null;

	const panelStartY = inBottomPanel ? secondPanelY : layout.topY;
	return {
		x,
		y: ((y - panelStartY) / layout.panelHeight) * S
	};
}

function mapPostureTapPoint(point: Point) {
	return mapStackedTapPoint(point, postureStackLayout);
}
function mapLightTapPoint(point: Point) {
	return mapStackedTapPoint(point, lightStackLayout);
}
function mapDurationTapPoint(point: Point) {
	return mapStackedTapPoint(point, durationStackLayout);
}
function mapScreenTapPoint(point: Point) {
	return mapStackedTapPoint(point, screenStackLayout);
}
function mapOutdoorTapPoint(point: Point) {
	return mapStackedTapPoint(point, outdoorStackLayout);
}

function getStackedTapBox(diff: Diff, point: Point, layout: { topY: number; panelHeight: number }): DiffBox {
	const secondPanelY = layout.topY + layout.panelHeight;
	return point.y >= secondPanelY ? diff.bottomBox || diff.bbox : diff.bbox;
}
function getPostureTapBox(diff: Diff, point: Point): DiffBox {
	return getStackedTapBox(diff, point, postureStackLayout);
}
function getLightTapBox(diff: Diff, point: Point): DiffBox {
	return getStackedTapBox(diff, point, lightStackLayout);
}
function getDurationTapBox(diff: Diff, point: Point): DiffBox {
	return getStackedTapBox(diff, point, durationStackLayout);
}
function getScreenTapBox(diff: Diff, point: Point): DiffBox {
	return getStackedTapBox(diff, point, screenStackLayout);
}
function getOutdoorTapBox(diff: Diff, point: Point): DiffBox {
	return getStackedTapBox(diff, point, outdoorStackLayout);
}

function getStackedMarkerPoints(diff: Diff, layout: { topY: number; panelHeight: number }): MarkerPoint[] {
	const topBox = diff.bbox;
	const bottomBox = diff.bottomBox || diff.bbox;
	const secondPanelY = layout.topY + layout.panelHeight;
	const topMarker = diff.marker || { x: topBox.x + topBox.w / 2, y: topBox.y + topBox.h / 2 };
	const bottomMarker = diff.bottomMarker ||
		diff.marker || { x: bottomBox.x + bottomBox.w / 2, y: bottomBox.y + bottomBox.h / 2 };
	const scale = layout.panelHeight / S;
	return [
		{
			x: topMarker.x,
			y: layout.topY + topMarker.y * scale,
			radius: topMarker.radius ? topMarker.radius * scale : undefined
		},
		{
			x: bottomMarker.x,
			y: secondPanelY + bottomMarker.y * scale,
			radius: bottomMarker.radius ? bottomMarker.radius * scale : undefined
		}
	];
}
function getPostureMarkerPoints(diff: Diff): MarkerPoint[] {
	return getStackedMarkerPoints(diff, postureStackLayout);
}
function getLightMarkerPoints(diff: Diff): MarkerPoint[] {
	return getStackedMarkerPoints(diff, lightStackLayout);
}
function getDurationMarkerPoints(diff: Diff): MarkerPoint[] {
	return getStackedMarkerPoints(diff, durationStackLayout);
}
function getScreenMarkerPoints(diff: Diff): MarkerPoint[] {
	return getStackedMarkerPoints(diff, screenStackLayout);
}
function getOutdoorMarkerPoints(diff: Diff): MarkerPoint[] {
	return getStackedMarkerPoints(diff, outdoorStackLayout);
}
function getStackedDebugBoxes(diff: Diff, layout: { topY: number; panelHeight: number }): DiffBox[] {
	const topBox = diff.bbox;
	const bottomBox = diff.bottomBox || diff.bbox;
	const secondPanelY = layout.topY + layout.panelHeight;
	return [
		{
			x: topBox.x,
			y: layout.topY + (topBox.y / S) * layout.panelHeight,
			w: topBox.w,
			h: (topBox.h / S) * layout.panelHeight,
			angle: topBox.angle,
			radius: topBox.radius
		},
		{
			x: bottomBox.x,
			y: secondPanelY + (bottomBox.y / S) * layout.panelHeight,
			w: bottomBox.w,
			h: (bottomBox.h / S) * layout.panelHeight,
			angle: bottomBox.angle,
			radius: bottomBox.radius
		}
	];
}
function getPostureDebugBoxes(diff: Diff): DiffBox[] {
	return getStackedDebugBoxes(diff, postureStackLayout);
}
function getLightDebugBoxes(diff: Diff): DiffBox[] {
	return getStackedDebugBoxes(diff, lightStackLayout);
}
function getDurationDebugBoxes(diff: Diff): DiffBox[] {
	return getStackedDebugBoxes(diff, durationStackLayout);
}
function getScreenDebugBoxes(diff: Diff): DiffBox[] {
	return getStackedDebugBoxes(diff, screenStackLayout);
}
function getOutdoorDebugBoxes(diff: Diff): DiffBox[] {
	return getStackedDebugBoxes(diff, outdoorStackLayout);
}

/* ===========================================================================
 * 场景 1：读写姿势
 * ========================================================================= */
const postureDiffs: Diff[] = [
	{
		name: '孩子坐姿',
		bbox: { x: 210, y: 140, w: 36, h: 100, angle: 0 }
	},
	{
		name: '书本距离',
		bbox: { x: 145, y: 55, w: 100, h: 125 },
		marker: { x: 175, y: 133, radius: 50 }
	},
	{
		name: '台灯',
		bbox: { x: 72, y: 75, w: 74, h: 118 },
		marker: { x: 109, y: 160, radius: 30 }
	},
	{
		name: '窗帘',
		bbox: { x: 25, y: 6, w: 150, h: 132 },
		marker: { x: 100, y: 68, radius: 52 }
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
	lessonImage: postureLessonImageUrl,
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
		name: '头顶灯',
		bbox: { x: 160, y: 3, w: 79, h: 26 },
		marker: { x: 199.5, y: 24, radius: 20 },
		bottomMarker: { x: 199.5, y: 16, radius: 20 }
	},
	{
		name: '台灯',
		bbox: { x: 288, y: 120, w: 40, h: 40, angle: 32 }
	},
	{
		name: '笔筒',
		bbox: { x: 302, y: 204, w: 26, h: 70 }
	},
	{
		name: '铅笔盒',
		bbox: { x: 300, y: 290, w: 80, h: 48, angle: -19 }
	},
	{
		name: '壁画',
		bbox: { x: 215, y: 61, w: 52, h: 66 }
	}
];

const sceneLight: Scene = {
	name: '光线环境',
	desc: '读写要在充足、均匀的光线下进行；光线应从左上方来，避免眩光与阴影。',
	tip: '开主灯 + 台灯，屏幕避开反光。',
	lessonImage: lightLessonImageUrl,
	boardMode: 'stacked',
	boardSize: lightStackLayout,
	mapTapPoint: mapLightTapPoint,
	getTapBox: getLightTapBox,
	getMarkerPoints: getLightMarkerPoints,
	getDebugBoxes: getLightDebugBoxes,
	diffs: lightDiffs,
	render(ctx, v) {
		drawLightPhoto(ctx);
	}
};

/* ===========================================================================
 * 场景 3：用眼时长
 * ========================================================================= */
const durationDiffs: Diff[] = [
	{
		name: '墙上时钟',
		bbox: { x: 290, y: 10, w: 53, h: 73, radius: 25 }
	},
	{
		name: '休息提示牌',
		bbox: { x: 339, y: 220, w: 40, h: 28 },
		marker: { x: 359, y: 234, radius: 19 }
	},
	{
		name: '盆栽',
		bbox: { x: 380, y: 198, w: 19, h: 43 },
		marker: { x: 389.5, y: 221.5, radius: 12 }
	},
	{
		name: '眼睛状态',
		bbox: { x: 112, y: 154, w: 18, h: 28 },
		marker: { x: 121, y: 168, radius: 17 }
	},
	{
		name: '水杯',
		bbox: { x: 170, y: 278, w: 40, h: 36 }
	}
];

const sceneDuration: Scene = {
	name: '用眼时长',
	desc: '近距离用眼 20~30 分钟，就远眺 20 秒（20-20-20 法则），让眼睛休息。',
	tip: '定时休息，别连续苦读两小时。',
	lessonImage: durationLessonImageUrl,
	boardMode: 'stacked',
	boardSize: durationStackLayout,
	mapTapPoint: mapDurationTapPoint,
	getTapBox: getDurationTapBox,
	getMarkerPoints: getDurationMarkerPoints,
	getDebugBoxes: getDurationDebugBoxes,
	diffs: durationDiffs,
	render(ctx, v) {
		drawDurationPhoto(ctx);
	}
};

/* ===========================================================================
 * 场景 4：屏幕距离
 * ========================================================================= */
const screenDiffs: Diff[] = [
	{
		name: '手臂',
		bbox: { x: 110, y: 140, w: 60, h: 68 },
		bottomBox: { x: 110, y: 140, w: 50, h: 68 },
		marker: { x: 140, y: 179, radius: 32 },
		bottomMarker: { x: 135, y: 179, radius: 32 }
	},
	{
		name: '手机挂饰',
		bbox: { x: 185, y: 130, w: 20, h: 30 },
		bottomBox: { x: 165, y: 135, w: 15, h: 30 },
		marker: { x: 195, y: 145, radius: 16 },
		bottomMarker: { x: 172.5, y: 150, radius: 16 }
	},
	{
		name: '眼镜',
		bbox: { x: 120, y: 105, w: 30, h: 30 },
		marker: { x: 135, y: 120, radius: 18 }
	},
	{
		name: '抱枕',
		bbox: { x: 30, y: 180, w: 66, h: 66, radius: 30 }
	},
	{
		name: '盆栽',
		bbox: { x: 310, y: 86, w: 36, h: 62 }
	}
];

const sceneScreen: Scene = {
	name: '屏幕距离',
	desc: '近距离用眼时多眨眼能有效缓解眼疲劳，看屏幕保持一臂距离（约 50~70cm），屏幕顶端与视线平齐，并开启护眼模式。',
	tip: '屏幕别凑太近，开护眼滤蓝光。',
	lessonImage: screenLessonImageUrl,
	boardMode: 'stacked',
	boardSize: screenStackLayout,
	mapTapPoint: mapScreenTapPoint,
	getTapBox: getScreenTapBox,
	getMarkerPoints: getScreenMarkerPoints,
	getDebugBoxes: getScreenDebugBoxes,
	diffs: screenDiffs,
	render(ctx, v) {
		drawScreenPhoto(ctx);
	}
};

/* ===========================================================================
 * 场景 5：户外活动
 * ========================================================================= */
const outdoorDiffs: Diff[] = [
	{
		name: '小鸟',
		bbox: { x: 72, y: 23, w: 30, h: 40 }
	},
	{
		name: '毛巾',
		bbox: { x: 288, y: 180, w: 60, h: 72 }
	},
	{
		name: '帽子',
		bbox: { x: 112, y: 141, w: 64, h: 40, angle: -46 },
		marker: { x: 138, y: 151, radius: 27 }
	},
	{
		name: '眼镜',
		bbox: { x: 150, y: 166, w: 46, h: 30, angle: -32 },
		marker: { x: 173, y: 181, radius: 21 }
	},
	{
		name: '水瓶',
		bbox: { x: 80, y: 255, w: 23, h: 82 }
	}
];

const sceneOutdoor: Scene = {
	name: '户外活动',
	desc: '每天户外活动 2 小时，自然光可预防近视；多在户外跑跳、看看远方。',
	tip: '出门晒晒太阳，别总宅着。',
	lessonImage: outdoorLessonImageUrl,
	boardMode: 'stacked',
	boardSize: outdoorStackLayout,
	mapTapPoint: mapOutdoorTapPoint,
	getTapBox: getOutdoorTapBox,
	getMarkerPoints: getOutdoorMarkerPoints,
	getDebugBoxes: getOutdoorDebugBoxes,
	diffs: outdoorDiffs,
	render(ctx, v) {
		drawOutdoorPhoto(ctx);
	}
};

/* ----------------------------- 关卡总表 + 文案 ----------------------------- */
export const SCENES: Scene[] = [scenePosture, sceneLight, sceneDuration, sceneScreen, sceneOutdoor];

export const PLACEHOLDER_TIPS: Record<string, string[]> = {
	读写姿势: ['眼离书本约 33cm（一尺）。', '胸口离桌沿一拳，握笔离笔尖一寸。', '不趴桌、不歪头，脊柱保持自然直立。'],
	光线环境: ['主灯 + 台灯双光源更均匀。', '光线从左上方来，避免手部阴影。', '屏幕避开窗户反光，可拉上遮光帘。'],
	用眼时长: ['遵循 20-20-20 法则。', '近距离用眼 20~30 分钟远眺 20 秒。', '连续用眼不超过 1 小时。'],
	屏幕距离: ['屏幕距离一臂（50~70cm）。', '屏幕顶端与视线平齐，略向下看。', '开启护眼/滤蓝光模式，亮度随环境。'],
	户外活动: ['每天户外 2 小时。', '自然光有助于延缓近视发展。', '多望远、多跑跳，放松睫状肌。']
};

export { S };
