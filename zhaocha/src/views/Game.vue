<template>
	<div class="page game">
		<!-- HUD -->
		<header class="hud">
			<div class="hud-left">
				<div class="badge">第 {{ levelIndex + 1 }} / {{ totalLevels }} 关</div>
			</div>
			<div class="hud-right">
				<div class="progress">已找到 {{ found.length }} / {{ scene.diffs.length }}</div>
				<div class="timer" :class="{ danger: timeLeft <= 10 }">{{ timeLeft }}s</div>
			</div>
		</header>

		<p class="tip-line">{{ tipLine }}</p>

		<div ref="boardsRef" class="boards" :class="{ stacked: isStackedBoard }">
			<canvas
				v-if="isStackedBoard"
				ref="cvSingle"
				class="board board-single"
				:style="singleBoardStyle"
				@pointerdown="onTap"
			></canvas>
			<template v-else>
				<canvas ref="cv0" class="board" :style="dualBoardStyle" @pointerdown="onTap"></canvas>
				<canvas ref="cv1" class="board" :style="dualBoardStyle" @pointerdown="onTap"></canvas>
			</template>
		</div>

		<div class="controls">
			<van-button plain type="primary" block @click="useHint">💡 提示</van-button>
			<van-button plain type="default" block @click="retry">↻ 重玩</van-button>
		</div>

		<!-- 护眼小课堂 -->
		<van-dialog
			v-model:show="showLesson"
			:title="lessonTitle"
			confirm-button-text="进入下一关"
			@confirm="nextAfterLesson"
		>
			<div class="lesson">
				<div class="lesson-illus">🖼️<br /><span>科普图文占位</span></div>
				<p class="lesson-desc">{{ scene.desc }}</p>
				<ul class="lesson-tips">
					<li v-for="(t, i) in lessonTips" :key="i">{{ t }}</li>
				</ul>
			</div>
		</van-dialog>

		<!-- 失败 -->
		<van-dialog v-model:show="showFail" title="⏰ 时间到" confirm-button-text="重玩本关" @confirm="retry">
			<div class="fail">
				<p>还有差异没找到，再试一次吧！</p>
			</div>
		</van-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Button as VanButton, Dialog as VanDialog, showToast } from 'vant';
import { SCENES, PLACEHOLDER_TIPS } from '../game/scenes';
import { useGameStore, TOTAL_LEVELS } from '../store/game';

const S = 400;
// debug: 打开后会把当前关卡所有差异点圈出来，便于校准 bbox 坐标。
const DEBUG_SHOW_DIFFS = false;
// debug: 临时从第 2 关开始，便于跳过第一关直接测试。
const DEBUG_START_LEVEL = 0;
const BOARD_GAP = 10;
const HINT_DURATION = 1400;
const HINT_FADE_DURATION = 240;
const WRONG_MARK_DURATION = 1200;
const WRONG_TAP_DEBOUNCE_DURATION = 380;
const FEEDBACK_LABEL_DURATION = 1100;
const FEEDBACK_LABEL_FADE_IN_DURATION = 220;
const FEEDBACK_LABEL_FADE_OUT_DURATION = 360;
const FEEDBACK_LABEL_RISE = 18;
const router = useRouter();
const store = useGameStore();

const boardsRef = ref<HTMLDivElement | null>(null);
const cvSingle = ref<HTMLCanvasElement | null>(null);
const cv0 = ref<HTMLCanvasElement | null>(null);
const cv1 = ref<HTMLCanvasElement | null>(null);

const levelIndex = ref(0);
const found = ref<number[]>([]);
const timeLeft = ref(60);
const hintsUsed = ref(0);
const hintIndex = ref(-1);
const wrongTapMark = ref<{ x: number; y: number; variant: number } | null>(null);
const feedbackLabels = ref<
	Array<{ x: number; y: number; text: string; color: string; variant: number | null; startedAt: number }>
>([]);
const running = ref(false);
const showLesson = ref(false);
const showFail = ref(false);

let timerId: number | null = null;
let hintTimer: number | null = null;
let wrongTapTimer: number | null = null;
let hintFrameId: number | null = null;
let feedbackFrameId: number | null = null;
let boardsResizeObserver: ResizeObserver | null = null;
let hintStartedAt = 0;
let lastWrongTapAt = 0;

const totalLevels = TOTAL_LEVELS;
const scene = computed(() => SCENES[levelIndex.value]);
const lessonTitle = computed(() => `护眼小课堂 · ${scene.value.name}`);
const lessonTips = computed(() => PLACEHOLDER_TIPS[scene.value.name] || ['（科普图文占位）保持良好用眼习惯。']);
const isLast = computed(() => levelIndex.value + 1 >= SCENES.length);
const isStackedBoard = computed(() => scene.value.boardMode === 'stacked');
const boardSize = computed(() => scene.value.boardSize || { width: S, height: S });
const boardArea = ref({ width: 0, height: 0 });
const boardRatio = computed(() => boardSize.value.width / boardSize.value.height);
const tipLine = computed(() =>
	isStackedBoard.value
		? '在上下两幅图中找出不同之处，点击任意一处差异位置进行标记。'
		: '在两幅图中找出不同之处，点击任意一幅图标记差异。'
);
const dualBoardStyle = computed(() => {
	const width = Math.max(
		140,
		Math.min((boardArea.value.width - BOARD_GAP) / 2, boardArea.value.height * boardRatio.value)
	);
	const height = width / boardRatio.value;
	return width
		? {
				width: `${width}px`,
				height: `${height}px`
			}
		: {};
});
const singleBoardStyle = computed(() => {
	const width = Math.max(140, Math.min(boardArea.value.width, boardArea.value.height * boardRatio.value));
	return width
		? {
				width: `${width}px`,
				height: `${width / boardRatio.value}px`
			}
		: {};
});

/* ----------------------------- 绘制 ----------------------------- */
function fitCtx(ctx: CanvasRenderingContext2D) {
	ctx.setTransform(2, 0, 0, 2, 0, 0);
}
function center(b: { x: number; y: number; w: number; h: number }) {
	return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}
function easeInOut(t: number) {
	return t * t * (3 - 2 * t);
}
function easeOutCubic(t: number) {
	return 1 - Math.pow(1 - t, 3);
}
function easeInCubic(t: number) {
	return t * t * t;
}
function drawFeedbackLabel(
	ctx: CanvasRenderingContext2D,
	p: { x: number; y: number },
	text: string,
	color: string,
	alpha = 1,
	offsetY = 0,
	scale = 1
) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.font = 'bold 14px "PingFang SC","Microsoft YaHei",sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.lineWidth = 4;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
	ctx.fillStyle = color;
	ctx.translate(p.x, p.y - 24 + offsetY);
	ctx.scale(scale, scale);
	ctx.strokeText(text, 0, 0);
	ctx.fillText(text, 0, 0);
	ctx.restore();
}
function drawMarker(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, color: string, pulse = false) {
	ctx.save();
	const now = performance.now();
	let radius = 20;
	let alpha = 1;
	if (pulse) {
		const elapsed = now - hintStartedAt;
		const remain = Math.max(0, HINT_DURATION - elapsed);
		const fadeIn = Math.min(1, elapsed / HINT_FADE_DURATION);
		const fadeOut = Math.min(1, remain / HINT_FADE_DURATION);
		const visibility = easeInOut(Math.min(fadeIn, fadeOut));
		const breath = (Math.sin(now / 260) + 1) / 2;
		radius = 18 + breath * 8;
		alpha = visibility * (0.45 + breath * 0.55);
	}
	ctx.globalAlpha = alpha;
	ctx.beginPath();
	ctx.lineWidth = 5;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.89)';
	ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.lineWidth = 3;

	if (pulse) {
		ctx.strokeStyle = color;
	} else {
		const ringGradient = ctx.createLinearGradient(p.x - radius, p.y - radius, p.x + radius, p.y + radius);
		ringGradient.addColorStop(0, '#ffffff');
		ringGradient.addColorStop(0.45, color);
		ringGradient.addColorStop(1, '#7fd6ff');
		ctx.strokeStyle = ringGradient;
	}
	ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}
function drawDebugBox(
	ctx: CanvasRenderingContext2D,
	box: { x: number; y: number; w: number; h: number; angle?: number; radius?: number },
	index: number
) {
	ctx.save();
	ctx.strokeStyle = '#1677ff';
	ctx.lineWidth = 2;
	ctx.setLineDash([6, 4]);
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	const angle = ((box.angle || 0) * Math.PI) / 180;
	const radius = Math.max(0, Math.min(box.radius || 0, box.w / 2, box.h / 2));
	ctx.translate(cx, cy);
	ctx.rotate(angle);
	if (radius > 0) {
		ctx.beginPath();
		ctx.roundRect(-box.w / 2, -box.h / 2, box.w, box.h, radius);
		ctx.stroke();
	} else {
		ctx.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h);
	}
	ctx.setLineDash([]);
	ctx.fillStyle = '#1677ff';
	ctx.font = 'bold 14px Arial, sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'bottom';
	ctx.rotate(-angle);
	ctx.translate(-cx, -cy);
	ctx.fillText(String(index + 1), box.x, box.y - 6);
	ctx.restore();
}
function drawWrongMark(ctx: CanvasRenderingContext2D, p: { x: number; y: number }) {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
	ctx.lineWidth = 9;
	ctx.moveTo(p.x - 6, p.y - 6);
	ctx.lineTo(p.x + 6, p.y + 6);
	ctx.moveTo(p.x + 6, p.y - 6);
	ctx.lineTo(p.x - 6, p.y + 6);
	ctx.stroke();
	ctx.beginPath();
	ctx.strokeStyle = 'rgba(255, 59, 48, 0.95)';
	ctx.lineWidth = 5;
	ctx.moveTo(p.x - 6, p.y - 6);
	ctx.lineTo(p.x + 6, p.y + 6);
	ctx.moveTo(p.x + 6, p.y - 6);
	ctx.lineTo(p.x - 6, p.y + 6);
	ctx.stroke();
	ctx.restore();
}
function enqueueFeedbackLabel(
	points: Array<{ x: number; y: number }>,
	text: string,
	color: string,
	variant: number | null
) {
	const startedAt = performance.now();
	feedbackLabels.value = [
		...feedbackLabels.value,
		...points.map((point) => ({ ...point, text, color, variant, startedAt }))
	];
	startFeedbackAnimation();
}
function pruneFeedbackLabels(now = performance.now()) {
	feedbackLabels.value = feedbackLabels.value.filter((label) => now - label.startedAt < FEEDBACK_LABEL_DURATION);
}
function drawAnimatedFeedbackLabels(ctx: CanvasRenderingContext2D, variant: number) {
	const now = performance.now();
	feedbackLabels.value.forEach((label) => {
		if (label.variant !== null && label.variant !== variant) return;
		const elapsed = now - label.startedAt;
		if (elapsed >= FEEDBACK_LABEL_DURATION) return;
		const remain = FEEDBACK_LABEL_DURATION - elapsed;
		const fadeInProgress = Math.min(1, elapsed / FEEDBACK_LABEL_FADE_IN_DURATION);
		const fadeOutProgress = 1 - Math.min(1, remain / FEEDBACK_LABEL_FADE_OUT_DURATION);
		const fadeInAlpha = easeOutCubic(fadeInProgress);
		const fadeOutAlpha = 1 - easeInCubic(fadeOutProgress);
		const visibility = Math.min(fadeInAlpha, fadeOutAlpha);
		const moveProgress = easeInOut(Math.min(1, elapsed / FEEDBACK_LABEL_DURATION));
		const offsetY = 12 - moveProgress * FEEDBACK_LABEL_RISE;
		const scale = easeOutCubic(fadeInProgress);
		drawFeedbackLabel(ctx, label, label.text, label.color, visibility, offsetY, scale);
	});
}
function isPointInTapBox(
	point: { x: number; y: number },
	box: { x: number; y: number; w: number; h: number; angle?: number; radius?: number },
	padding = 6
) {
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	const angle = -(((box.angle || 0) * Math.PI) / 180);
	const dx = point.x - cx;
	const dy = point.y - cy;
	const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + cx;
	const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + cy;
	const left = box.x - padding;
	const top = box.y - padding;
	const width = box.w + padding * 2;
	const height = box.h + padding * 2;
	const radius = Math.max(0, Math.min((box.radius || 0) + padding, width / 2, height / 2));
	if (radius <= 0) {
		return localX >= left && localX <= left + width && localY >= top && localY <= top + height;
	}
	const right = left + width;
	const bottom = top + height;
	if (localX >= left + radius && localX <= right - radius && localY >= top && localY <= bottom) return true;
	if (localX >= left && localX <= right && localY >= top + radius && localY <= bottom - radius) return true;
	const nearestCornerX = localX < left + radius ? left + radius : right - radius;
	const nearestCornerY = localY < top + radius ? top + radius : bottom - radius;
	const cornerDx = localX - nearestCornerX;
	const cornerDy = localY - nearestCornerY;
	return cornerDx * cornerDx + cornerDy * cornerDy <= radius * radius;
}
function getMarkerPoints(index: number) {
	const diff = scene.value.diffs[index];
	return scene.value.getMarkerPoints ? scene.value.getMarkerPoints(diff) : [center(diff.bbox)];
}
function getDebugBoxes(index: number) {
	const diff = scene.value.diffs[index];
	return scene.value.getDebugBoxes ? scene.value.getDebugBoxes(diff) : [diff.bbox];
}
function updateBoardArea() {
	const boardsEl = boardsRef.value;
	if (!boardsEl) return;
	boardArea.value = {
		width: boardsEl.clientWidth,
		height: boardsEl.clientHeight
	};
}
function paintCanvas(ctx: CanvasRenderingContext2D, variant: number) {
	fitCtx(ctx);
	ctx.clearRect(0, 0, boardSize.value.width, boardSize.value.height);
	scene.value.render(ctx, variant);
	if (DEBUG_SHOW_DIFFS) {
		scene.value.diffs.forEach((_, i) => {
			getDebugBoxes(i).forEach((box) => drawDebugBox(ctx, box, i));
		});
	}
	scene.value.diffs.forEach((d, i) => {
		if (found.value.includes(i)) {
			getMarkerPoints(i).forEach((point) => drawMarker(ctx, point, '#2ecc71'));
		}
	});
	if (hintIndex.value >= 0 && !found.value.includes(hintIndex.value)) {
		getMarkerPoints(hintIndex.value).forEach((point) => drawMarker(ctx, point, '#ffb300', true));
	}
	if (wrongTapMark.value && wrongTapMark.value.variant === variant) {
		drawWrongMark(ctx, wrongTapMark.value);
	}
	drawAnimatedFeedbackLabels(ctx, variant);
}
function syncCanvasSize() {
	const { width, height } = boardSize.value;
	[cvSingle.value, cv0.value, cv1.value].forEach((canvas) => {
		if (canvas) {
			canvas.width = width * 2;
			canvas.height = height * 2;
		}
	});
}
function repaint() {
	if (isStackedBoard.value) {
		if (cvSingle.value) {
			paintCanvas(cvSingle.value.getContext('2d')!, 0);
		}
		return;
	}
	if (cv0.value && cv1.value) {
		paintCanvas(cv0.value.getContext('2d')!, 0);
		paintCanvas(cv1.value.getContext('2d')!, 1);
	}
}
function onSceneAssetsReady() {
	repaint();
}

function startHintAnimation() {
	stopHintAnimation();
	const tick = () => {
		if (hintIndex.value < 0 || found.value.includes(hintIndex.value)) {
			hintFrameId = null;
			return;
		}
		repaint();
		hintFrameId = window.requestAnimationFrame(tick);
	};
	hintFrameId = window.requestAnimationFrame(tick);
}
function stopHintAnimation() {
	if (hintFrameId) {
		cancelAnimationFrame(hintFrameId);
		hintFrameId = null;
	}
}
function startFeedbackAnimation() {
	stopFeedbackAnimation();
	const tick = () => {
		pruneFeedbackLabels();
		if (!feedbackLabels.value.length) {
			feedbackFrameId = null;
			repaint();
			return;
		}
		repaint();
		feedbackFrameId = window.requestAnimationFrame(tick);
	};
	feedbackFrameId = window.requestAnimationFrame(tick);
}
function stopFeedbackAnimation() {
	if (feedbackFrameId) {
		cancelAnimationFrame(feedbackFrameId);
		feedbackFrameId = null;
	}
}
function clearFeedbackLabels() {
	stopFeedbackAnimation();
	feedbackLabels.value = [];
}
function clearWrongTapMark() {
	if (wrongTapTimer) {
		clearTimeout(wrongTapTimer);
		wrongTapTimer = null;
	}
	wrongTapMark.value = null;
}

/* ----------------------------- 关卡流程 ----------------------------- */
async function loadLevel(i: number) {
	levelIndex.value = i;
	await nextTick();
	updateBoardArea();
	syncCanvasSize();
	found.value = [];
	timeLeft.value = 60;
	hintsUsed.value = 0;
	hintIndex.value = -1;
	clearFeedbackLabels();
	clearWrongTapMark();
	running.value = true;
	repaint();
	startTimer();
}
function startTimer() {
	stopTimer();
	timerId = window.setInterval(() => {
		if (!running.value) return;
		timeLeft.value--;
		if (timeLeft.value <= 0) {
			timeLeft.value = 0;
			failLevel();
		}
	}, 1000);
}
function stopTimer() {
	if (timerId) {
		clearInterval(timerId);
		timerId = null;
	}
}

/* ----------------------------- 点击找茬 ----------------------------- */
function onTap(e: PointerEvent) {
	if (!running.value) return;
	const cv = e.currentTarget as HTMLCanvasElement;
	const variant = isStackedBoard.value || cv !== cv1.value ? 0 : 1;
	const rect = cv.getBoundingClientRect();
	const rawPoint = {
		x: ((e.clientX - rect.left) / rect.width) * boardSize.value.width,
		y: ((e.clientY - rect.top) / rect.height) * boardSize.value.height
	};
	const point = scene.value.mapTapPoint ? scene.value.mapTapPoint(rawPoint) : rawPoint;
	if (!point) return;
	const { x, y } = point;
	const diffs = scene.value.diffs;
	for (let i = 0; i < diffs.length; i++) {
		if (found.value.includes(i)) continue;
		const b = scene.value.getTapBox ? scene.value.getTapBox(diffs[i], rawPoint) : diffs[i].bbox;
		if (isPointInTapBox({ x, y }, b)) {
			found.value = [...found.value, i];
			enqueueFeedbackLabel(getMarkerPoints(i), '正确', '#2ecc71', isStackedBoard.value ? 0 : null);
			clearHint();
			repaint();
			beep(880, 0.08);
			if (found.value.length === diffs.length) completeLevel();
			return;
		}
	}
	const now = performance.now();
	if (now - lastWrongTapAt < WRONG_TAP_DEBOUNCE_DURATION) return;
	clearWrongTapMark();
	lastWrongTapAt = now;
	wrongTapMark.value = { ...rawPoint, variant };
	enqueueFeedbackLabel([rawPoint], '再找找~', '#ff3b30', variant);
	repaint();
	wrongTapTimer = window.setTimeout(() => {
		wrongTapMark.value = null;
		repaint();
		wrongTapTimer = null;
	}, WRONG_MARK_DURATION);
}

/* ----------------------------- 提示 ----------------------------- */
function useHint() {
	if (!running.value) return;
	const remain = scene.value.diffs.map((_, i) => i).filter((i) => !found.value.includes(i));
	if (!remain.length) return;
	hintIndex.value = remain[Math.floor(Math.random() * remain.length)];
	hintsUsed.value++;
	hintStartedAt = performance.now();
	startHintAnimation();
	repaint();
	if (hintTimer) clearTimeout(hintTimer);
	hintTimer = window.setTimeout(() => {
		stopHintAnimation();
		hintIndex.value = -1;
		repaint();
	}, HINT_DURATION);
}
function clearHint() {
	if (hintTimer) {
		clearTimeout(hintTimer);
		hintTimer = null;
	}
	stopHintAnimation();
	hintIndex.value = -1;
}

function retry() {
	showFail.value = false;
	clearHint();
	loadLevel(levelIndex.value);
}

/* ----------------------------- 通关 / 失败 ----------------------------- */
function completeLevel() {
	running.value = false;
	stopTimer();
	clearHint();
	const base = Math.round((100 * timeLeft.value) / 60);
	const score = Math.max(0, Math.min(100, base - hintsUsed.value * 8));
	store.setScore(levelIndex.value, score);
	beep(1320, 0.12);
	showLesson.value = true;
}
function failLevel() {
	running.value = false;
	stopTimer();
	clearHint();
	beep(160, 0.2);
	showFail.value = true;
}
function nextAfterLesson() {
	showLesson.value = false;
	if (isLast.value) {
		store.finishAll();
		router.push('/result');
	} else {
		loadLevel(levelIndex.value + 1);
	}
}

/* ----------------------------- 声音反馈 ----------------------------- */
let actx: AudioContext | null = null;
function beep(freq: number, dur: number) {
	try {
		actx = actx || new (window.AudioContext || (window as any).webkitAudioContext)();
		const o = actx.createOscillator();
		const g = actx.createGain();
		o.frequency.value = freq;
		o.type = 'sine';
		g.gain.value = 0.06;
		o.connect(g);
		g.connect(actx.destination);
		o.start();
		g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
		o.stop(actx.currentTime + dur);
	} catch (e) {
		/* 忽略音频异常 */
	}
}

onMounted(async () => {
	window.addEventListener('scene-assets-ready', onSceneAssetsReady);
	await nextTick();
	updateBoardArea();
	if (typeof ResizeObserver !== 'undefined' && boardsRef.value) {
		boardsResizeObserver = new ResizeObserver(() => {
			updateBoardArea();
		});
		boardsResizeObserver.observe(boardsRef.value);
	}
	syncCanvasSize();
	await loadLevel(DEBUG_START_LEVEL);
});
onUnmounted(() => {
	window.removeEventListener('scene-assets-ready', onSceneAssetsReady);
	boardsResizeObserver?.disconnect();
	stopTimer();
	clearHint();
	clearFeedbackLabels();
	clearWrongTapMark();
});
</script>

<style scoped>
.game {
	--game-chrome-height: 230px;
	min-height: 100%;
	padding-top: 4px;
	display: grid;
	grid-template-rows: auto auto minmax(0, 1fr) auto;
	align-content: stretch;
}
.hud {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: var(--card);
	border-radius: 16px;
	padding: 10px 14px;
	box-shadow: 0 6px 18px rgba(60, 90, 160, 0.08);
}
.hud-left,
.hud-right {
	display: flex;
	align-items: center;
}
.hud-right {
	gap: 10px;
}
.badge {
	font-size: 13px;
	font-weight: 700;
	color: #4f5d75;
}
.timer {
	font-size: 22px;
	font-weight: 800;
	color: var(--green);
	text-align: right;
	min-width: 54px;
}
.timer.danger {
	color: var(--red);
	animation: blink 0.6s infinite;
}
@keyframes blink {
	50% {
		opacity: 0.4;
	}
}
.progress {
	font-size: 13px;
	color: var(--muted);
	text-align: right;
}
.tip-line {
	font-size: 13px;
	color: var(--muted);
	text-align: center;
	margin: 12px 4px;
}
.boards {
	display: flex;
	gap: 10px;
	min-height: 0;
	align-items: flex-start;
	justify-content: center;
}
.boards.stacked {
	display: flex;
}
.board {
	flex: 0 1 auto;
	display: block;
	aspect-ratio: 1 / 1;
	background: #fff;
	border-radius: 14px;
	box-shadow: 0 6px 18px rgba(60, 90, 160, 0.12);
	cursor: pointer;
	touch-action: manipulation;
}
.board-single {
	aspect-ratio: 1 / 2;
}
.controls {
	display: flex;
	gap: 10px;
	margin-top: 14px;
}
.controls :deep(.van-button) {
	flex: 1;
}
.lesson,
.fail {
	padding: 4px 6px 8px;
	text-align: left;
}
.lesson-illus {
	background: linear-gradient(135deg, #eaf2ff, #fdf3e7);
	border: 2px dashed #cdd8ea;
	border-radius: 14px;
	padding: 22px;
	font-size: 30px;
	color: var(--muted);
	text-align: center;
	margin-bottom: 12px;
}
.lesson-illus span {
	display: block;
	font-size: 12px;
	margin-top: 6px;
}
.lesson-desc {
	font-size: 14px;
	color: #455;
	line-height: 1.7;
	background: #f7faff;
	border-radius: 12px;
	padding: 12px;
	margin-bottom: 10px;
}
.lesson-tips {
	list-style: none;
	margin: 0;
	padding: 0;
}
.lesson-tips li {
	font-size: 14px;
	padding: 8px 0 8px 24px;
	position: relative;
	border-bottom: 1px dashed #eee;
}
.lesson-tips li::before {
	content: '✅';
	position: absolute;
	left: 0;
}
</style>
