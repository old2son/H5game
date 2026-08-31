// 游戏全局配置常量（自适应横版：设计分辨率恒为「横屏比例」，
// 宽取长边、高取短边，竖屏时由 Scale.FIT 居中显示并由竖屏遮罩提醒旋转）
// 用函数式取值，便于在无 window 环境（如构建期）降级为设计基准值
function getViewSize() {
	const w = typeof window !== 'undefined' ? window.innerWidth : 960;
	const h = typeof window !== 'undefined' ? window.innerHeight : 540;
	return { w, h };
}

const _view = getViewSize();
// 横版：长边作宽、短边作高，保证永远是横屏比例；宽度上限 1280 避免大屏过度铺开
const _long = Math.max(_view.w, _view.h);
const _short = Math.min(_view.w, _view.h);
export const GAME_WIDTH = Math.min(_long, 1280);
export const GAME_HEIGHT = _short;

export const GROUND_OFFSET = 80; // 地面带高度（从底部往上）
export const GROUND_Y = GAME_HEIGHT - GROUND_OFFSET; // 地面顶部 y 坐标
export const GRAVITY = 2200; // 重力加速度
export const PLAYER_X = Math.round(GAME_WIDTH * 0.24); // 玩家横坐标（按比例靠左）

// 设备像素比（高分屏锐化）：渲染内部分辨率按 DPR 放大，再配合相机 zoom=1/DPR 还原坐标，
// 让文字/图形在 Retina 屏上清晰。上限 2 兼顾性能（3x 屏会略软但远好于当前）。
export const DPR = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
export const JUMP_VELOCITY = 820; // 跳跃初速度

export const START_SPEED = 300; // 初始滚动速度
export const MAX_SPEED = 760; // 最大速度
export const SPEED_ACCEL = 8; // 每秒速度增量

export const HS_KEY = 'shenmiao_highscore'; // 最高分本地存储 key
