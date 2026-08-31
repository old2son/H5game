<template>
	<div class="game">
		<header class="stats">
			<div class="stat">
				<span class="label">关卡</span><span class="value">{{ level }}</span>
			</div>
			<div class="stat">
				<span class="label">得分</span><span class="value">{{ score }}</span>
			</div>
			<div class="stat">
				<span class="label">最佳</span><span class="value">{{ best }}</span>
			</div>
		</header>

		<div class="timer" v-show="phase === 'playing'">
			<div class="timer-fill" :style="{ width: pct + '%', background: barColor }"></div>
		</div>

		<div class="board" :style="{ width: boardSize + 'px', height: boardSize + 'px' }">
			<canvas ref="canvasRef" class="canvas" @pointerdown="handlePoint"></canvas>

			<div v-if="phase === 'ready'" class="overlay">
				<h1 class="title">色差挑战</h1>
				<p class="sub">在色块中找出颜色不同的那一个</p>
				<p class="tip">关卡越高 · 色差越小 · 速度要快</p>
				<button class="btn" @click="startGame">开始游戏</button>
			</div>

		</div>

		<div v-if="phase === 'over'" class="overlay over-modal">
			<div class="modal-card">
				<h1 class="title over">游戏结束</h1>
				<div class="result">
					<div>
						<span>本局得分</span><b>{{ score }}</b>
					</div>
					<div>
						<span>到达关卡</span><b>{{ level }}</b>
					</div>
					<div>
						<span>历史最佳</span><b>{{ best }}</b>
					</div>
				</div>
				<div class="sensitivity">
					<div class="sens-score">
						<span class="sens-num">{{ sensitivity }}</span>
						<span class="sens-unit">分</span>
					</div>
					<div class="sens-info">
						<div class="sens-grade">色觉灵敏度 · {{ sensGrade }}</div>
						<div class="sens-detail">
							最小可辨亮度差 {{ minDiffPct > 0 ? minDiffPct + '%' : '—' }}
							<span class="sens-best">历史最佳 {{ bestSens }} 分</span>
						</div>
					</div>
				</div>
				<p class="sens-desc">{{ sensDesc }}</p>
				<div class="knowledge" v-if="currentCard">
					<div class="k-head">📘 色觉小课堂 · {{ currentCard.title }}</div>
					<p class="k-body">{{ currentCard.body }}</p>
					<ul class="k-list">
						<li v-for="item in currentCard.list" :key="item.name">
							<b>{{ item.name }}</b><span>{{ item.desc }}</span>
						</li>
					</ul>
					<p class="k-extra" v-if="currentCard.extra">💡 {{ currentCard.extra }}</p>
				</div>
				<button class="btn" @click="onReplay">再来一局</button>
			</div>
		</div>

		<p class="hint" v-show="phase === 'playing'">点击颜色不同的方块</p>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';

type Phase = 'ready' | 'playing' | 'over';

const phase = ref<Phase>('ready');
const level = ref(1);
const score = ref(0);

function loadBest(): number {
	try {
		return Number(localStorage.getItem('color-diff-best') || 0) || 0;
	} catch {
		return 0;
	}
}
const best = ref(loadBest());

// 结束页「再来一局」按钮是否可点击
// 防止「点错方块→游戏结束」的同一手势穿透到刚出现的按钮
const replayReady = ref(false);

// 游戏结束后的色觉科普知识卡（每次随机抽一张）
interface Knowledge {
	title: string;
	body: string;
	list: { name: string; desc: string }[];
	extra?: string;
}
const knowledgeCards: Knowledge[] = [
	{
		title: '色盲有哪些类型',
		body: '色盲（色觉缺陷）多因视网膜视锥细胞里的感光色素异常，导致某些颜色难以区分。按缺失的色觉通道分为三大类：',
		list: [
			{ name: '红色盲 Protanopia', desc: '缺红色觉通道，红绿难分，且红色看起来更暗。' },
			{ name: '绿色盲 Deuteranopia', desc: '缺绿色觉通道，最常见，红绿容易混淆。' },
			{ name: '蓝色盲 Tritanopia', desc: '缺蓝色觉通道，蓝黄难分，极为少见。' },
			{ name: '全色盲 Achromatopsia', desc: '几乎只剩明暗感知，世界如同黑白照片。' }
		],
		extra: '红绿色盲约占所有色觉缺陷的 99%，蓝黄色盲不足 1%。'
	},
	{
		title: '色盲是怎么遗传的',
		body: '决定红、绿色觉的基因位于 X 染色体上，呈 X 连锁隐性遗传；蓝色觉基因则在常染色体上。',
		list: [
			{ name: '男性更易患病', desc: '男性只有 1 条 X，基因异常即发病；女性需 2 条 X 都异常才发病，故男性发病率（约 8%）远高于女性（约 0.5%）。' },
			{ name: '母传子', desc: '男性患者的致病 X 必来自母亲，且一定传给全部女儿（女儿多为携带者），不会传给儿子。' },
			{ name: '携带者女儿', desc: '女性携带者本人多正常，但所生儿子有 50% 概率患病。' },
			{ name: '蓝黄色盲', desc: '为常染色体显性遗传，男女患病机会均等。' }
		],
		extra: '「外公 → 女儿（携带者）→ 外孙」的隔代遗传，是红绿色盲的典型特征。'
	},
	{
		title: '色盲与色觉训练',
		body: '先天性色盲多为基因所致、难以根治，但可借工具与训练改善日常体验。',
		list: [
			{ name: '矫正眼镜 / 隐形', desc: '特殊滤光片增强红绿色对比，帮助区分颜色。' },
			{ name: '手机取色 App', desc: '拍照识别颜色，辅助辨认交通灯、果蔬成熟度等。' },
			{ name: '职业限制', desc: '飞行员、交警、部分化工与美术岗位对色觉有要求。' },
			{ name: '后天性色觉异常', desc: '由眼病、药物或中毒引起，治疗原发病后可能恢复。' }
		],
		extra: '本游戏的「色差」关卡刻意放大亮度差，正是对色觉敏感度的一场趣味训练。'
	}
];
const currentCard = ref<Knowledge>(knowledgeCards[0]);

// 色觉灵敏度评分
const sensitivity = ref(0);
const sensGrade = ref('');
const sensDesc = ref('');
const minDiffPct = ref(0);
function loadBestSens(): number {
	try {
		return Number(localStorage.getItem('color-sens-best') || 0) || 0;
	} catch {
		return 0;
	}
}
const bestSens = ref(loadBestSens());

const canvasRef = ref<HTMLCanvasElement | null>(null);

// 棋盘逻辑尺寸（CSS 像素），随屏幕自适应
const boardSize = ref(360);
const GAP = 6;
let dpr = 1;
let ctx: CanvasRenderingContext2D | null = null;
let rafId = 0;
let endTime = 0;
let locked = false;

// 当前关卡数据
const state = reactive({
	n: 2, // 网格边长
	baseH: 0,
	baseS: 0,
	baseL: 0,
	diff: 0, // 色差（HSL 亮度差）
	dir: 1, // 偏亮/偏暗
	target: 0, // 不同方块索引
	cell: 0, // 单格边长
	clickedWrong: -1 // >=0 表示点错的方块；-2 表示答对高亮
});

// 倒计时
const timeMax = ref(5000);
const timeLeft = ref(5000);
const pct = computed(() => (timeMax.value ? (timeLeft.value / timeMax.value) * 100 : 100));
const barColor = computed(() => {
	const r = timeLeft.value / (timeMax.value || 1);
	return `hsl(${Math.max(0, r * 120)}, 75%, 50%)`;
});

function rand(a: number, b: number) {
	return Math.random() * (b - a) + a;
}
function randInt(a: number, b: number) {
	return Math.floor(Math.random() * (b - a + 1)) + a;
}
function gridForLevel(lv: number) {
	return Math.min(2 + Math.floor((lv - 1) / 2), 10);
}
function diffForLevel(lv: number) {
	// 关卡越高，色差越小（更难点）
	return Math.max(2.2, 13 - (lv - 1) * 0.7);
}
function timeForLevel(lv: number) {
	// 关卡越高，时间越紧
	return Math.max(1800, 5200 - (lv - 1) * 220);
}

function calcBoard() {
	const w = Math.min(window.innerWidth - 36, 460);
	boardSize.value = Math.max(260, Math.floor(w));
}

function setupCanvas() {
	const canvas = canvasRef.value;
	if (!canvas) return;
	dpr = window.devicePixelRatio || 1;
	canvas.width = Math.round(boardSize.value * dpr);
	canvas.height = Math.round(boardSize.value * dpr);
	canvas.style.width = boardSize.value + 'px';
	canvas.style.height = boardSize.value + 'px';
	const c = canvas.getContext('2d');
	if (c) {
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.scale(dpr, dpr);
		ctx = c;
	}
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	c.beginPath();
	c.moveTo(x + r, y);
	c.arcTo(x + w, y, x + w, y + h, r);
	c.arcTo(x + w, y + h, x, y + h, r);
	c.arcTo(x, y + h, x, y, r);
	c.arcTo(x, y, x + w, y, r);
	c.closePath();
}

function colorFor(i: number): string {
	const l = i === state.target ? state.baseL + state.dir * state.diff : state.baseL;
	return `hsl(${state.baseH}, ${state.baseS}%, ${l}%)`;
}

function draw() {
	if (!ctx) return;
	const b = boardSize.value;
	ctx.clearRect(0, 0, b, b);
	const n = state.n;
	const cell = state.cell;
	for (let i = 0; i < n * n; i++) {
		const row = Math.floor(i / n);
		const col = i % n;
		const x = GAP + col * (cell + GAP);
		const y = GAP + row * (cell + GAP);

		ctx.fillStyle = colorFor(i);
		roundRect(ctx, x, y, cell, cell, 8);
		ctx.fill();

		if (i === state.target) {
			if (state.clickedWrong === -2) {
				ctx.strokeStyle = 'rgba(34,197,94,0.95)';
				ctx.lineWidth = 4;
				roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 7);
				ctx.stroke();
			} else if (state.clickedWrong !== -1 || phase.value === 'over') {
				ctx.strokeStyle = 'rgba(255,255,255,0.92)';
				ctx.lineWidth = 3;
				roundRect(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 7);
				ctx.stroke();
			}
		}
		if (state.clickedWrong >= 0 && i === state.clickedWrong) {
			ctx.fillStyle = 'rgba(239,68,68,0.6)';
			roundRect(ctx, x, y, cell, cell, 8);
			ctx.fill();
		}
	}
}

function newLevel() {
	const n = gridForLevel(level.value);
	state.n = n;
	state.baseH = rand(0, 360);
	state.baseS = rand(55, 82);
	state.baseL = rand(40, 62);
	state.diff = diffForLevel(level.value);
	state.dir = Math.random() < 0.5 ? 1 : -1;
	state.target = randInt(0, n * n - 1);
	state.clickedWrong = -1;
	state.cell = (boardSize.value - GAP * (n + 1)) / n;
	timeMax.value = timeForLevel(level.value);
	timeLeft.value = timeMax.value;
	endTime = performance.now() + timeMax.value;
	draw();
}

function tick() {
	if (phase.value !== 'playing') return;
	const left = Math.max(0, endTime - performance.now());
	timeLeft.value = left;
	if (left <= 0) {
		gameOver();
		return;
	}
	rafId = requestAnimationFrame(tick);
}

function gameOver() {
	phase.value = 'over';
	cancelAnimationFrame(rafId);
	if (score.value > best.value) {
		best.value = score.value;
		try {
			localStorage.setItem('color-diff-best', String(best.value));
		} catch {
			/* ignore */
		}
	}
	// 计算色觉灵敏度评分：成功闯过的关卡越多，能分辨的最小色差越小 → 评分越高
	const peak = Math.max(0, level.value - 1); // 成功清掉的关卡数
	const minDiff = diffForLevel(Math.max(1, peak)); // 最小可辨亮度差（HSL %）
	minDiffPct.value = peak >= 1 ? Number(minDiff.toFixed(1)) : 0;
	const SENS_MAX = 16; // 色差降到下限(2.2%)所需闯过的关卡数
	const s = Math.min(100, Math.round((peak / SENS_MAX) * 100));
	sensitivity.value = s;
	if (s >= 85) {
		sensGrade.value = '色觉超敏';
		sensDesc.value = '极细微的色差也能一眼分辨，色彩感知力顶尖！';
	} else if (s >= 65) {
		sensGrade.value = '灵敏';
		sensDesc.value = '对色彩变化很敏感，常人难辨的色差你也轻松拿下。';
	} else if (s >= 45) {
		sensGrade.value = '良好';
		sensDesc.value = '色觉灵敏度不错，再练练能更上一层楼。';
	} else if (s >= 25) {
		sensGrade.value = '一般';
		sensDesc.value = '对小幅色差还不太敏感，多玩几局会有提升。';
	} else {
		sensGrade.value = '待提升';
		sensDesc.value = '色差很小时容易看花眼，建议留意日常辨色并适度练习。';
	}
	if (s > bestSens.value) {
		bestSens.value = s;
		try {
			localStorage.setItem('color-sens-best', String(bestSens.value));
		} catch {
			/* ignore */
		}
	}
	draw();
	// 随机抽取一张色觉科普卡
	currentCard.value = knowledgeCards[randInt(0, knowledgeCards.length - 1)];
	// 防止「点错→结束」的同一手势（pointerup 合成 click）穿透触发「再来一局」
	replayReady.value = false;
	setTimeout(() => (replayReady.value = true), 350);
}

function handlePoint(e: PointerEvent) {
	if (phase.value !== 'playing' || locked) return;
	const canvas = canvasRef.value;
	if (!canvas) return;
	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	const n = state.n;
	const cell = state.cell;
	const col = Math.floor((x - GAP) / (cell + GAP));
	const row = Math.floor((y - GAP) / (cell + GAP));
	if (col < 0 || col >= n || row < 0 || row >= n) return;
	const cx = GAP + col * (cell + GAP);
	const cy = GAP + row * (cell + GAP);
	if (x > cx + cell || y > cy + cell) return; // 落在间隙
	const idx = row * n + col;
	if (idx === state.target) {
		locked = true;
		state.clickedWrong = -2; // 答对高亮
		draw();
		score.value += state.n * 5;
		setTimeout(() => {
			level.value += 1;
			newLevel();
			locked = false;
		}, 170);
	} else {
		state.clickedWrong = idx;
		draw();
		gameOver();
	}
}

function onReplay() {
	// 同一手势刚结束游戏时，replayReady 仍为 false，直接忽略该穿透点击
	if (!replayReady.value) return;
	startGame();
}

function startGame() {
	level.value = 1;
	score.value = 0;
	locked = false;
	phase.value = 'playing';
	calcBoard();
	setupCanvas();
	newLevel();
	cancelAnimationFrame(rafId);
	rafId = requestAnimationFrame(tick);
}

function onResize() {
	calcBoard();
	setupCanvas();
	if (phase.value === 'playing') {
		state.cell = (boardSize.value - GAP * (state.n + 1)) / state.n;
		draw();
	}
}

onMounted(() => {
	calcBoard();
	setupCanvas();
	window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
	cancelAnimationFrame(rafId);
	window.removeEventListener('resize', onResize);
});
</script>

<style scoped>
.game {
	width: 100%;
	max-width: 480px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 14px;
}

.stats {
	width: 100%;
	display: flex;
	justify-content: space-between;
	gap: 10px;
}
.stat {
	flex: 1;
	background: var(--card);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 14px;
	padding: 10px 6px;
	text-align: center;
	backdrop-filter: blur(6px);
}
.stat .label {
	display: block;
	font-size: 12px;
	color: var(--muted);
}
.stat .value {
	display: block;
	font-size: 22px;
	font-weight: 700;
	margin-top: 2px;
}

.timer {
	width: 100%;
	height: 10px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.14);
	overflow: hidden;
}
.timer-fill {
	height: 100%;
	border-radius: 999px;
	transition: width 0.08s linear;
}

.board {
	position: relative;
	border-radius: 18px;
	overflow: hidden;
	box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
	background: rgba(0, 0, 0, 0.12);
}
.canvas {
	display: block;
	touch-action: none;
	user-select: none;
}

.overlay {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	padding: 20px;
	text-align: center;
	background: rgba(20, 16, 40, 0.55);
	backdrop-filter: blur(4px);
}
.title {
	font-size: 34px;
	font-weight: 800;
	letter-spacing: 2px;
	text-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}
.title.over {
	color: #ffd166;
}
.sub {
	font-size: 15px;
	color: var(--text);
}
.tip {
	font-size: 12px;
	color: var(--muted);
}
.btn {
	margin-top: 6px;
	padding: 12px 34px;
	font-size: 17px;
	font-weight: 700;
	color: #1b1f3b;
	background: linear-gradient(135deg, #ffd166, #ff7eb3);
	border: none;
	border-radius: 999px;
	cursor: pointer;
	box-shadow: 0 10px 24px rgba(255, 126, 179, 0.4);
	transition: transform 0.12s ease;
}
.btn:active {
	transform: scale(0.96);
}

.result {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 4px 0 6px;
}
.result div {
	display: flex;
	justify-content: space-between;
	gap: 28px;
	font-size: 15px;
	color: var(--muted);
}
.result b {
	color: var(--text);
	font-size: 18px;
}

/* 色觉灵敏度评分 */
.sensitivity {
	width: 100%;
	display: flex;
	align-items: center;
	gap: 14px;
	padding: 14px 16px;
	border-radius: 16px;
	background: linear-gradient(135deg, rgba(255, 209, 102, 0.18), rgba(255, 126, 179, 0.16));
	border: 1px solid rgba(255, 209, 102, 0.4);
}
.sens-score {
	display: flex;
	align-items: baseline;
	gap: 2px;
	flex-shrink: 0;
}
.sens-num {
	font-size: 40px;
	font-weight: 800;
	line-height: 1;
	color: #ffd166;
	text-shadow: 0 3px 14px rgba(255, 126, 179, 0.35);
}
.sens-unit {
	font-size: 15px;
	font-weight: 700;
	color: #ffd166;
}
.sens-info {
	flex: 1;
	text-align: left;
	min-width: 0;
}
.sens-grade {
	font-size: 15px;
	font-weight: 700;
	color: var(--text);
}
.sens-detail {
	margin-top: 4px;
	font-size: 12px;
	color: var(--muted);
	display: flex;
	flex-wrap: wrap;
	gap: 4px 10px;
}
.sens-best {
	color: #9be7c4;
}
.sens-desc {
	width: 100%;
	margin: 0;
	font-size: 12.5px;
	line-height: 1.55;
	color: var(--muted);
	text-align: left;
}

/* 游戏结束：全屏滚动弹窗 + 色觉科普卡 */
.over-modal {
	position: fixed;
	inset: 0;
	z-index: 20;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 18px;
	background: rgba(12, 10, 28, 0.78);
	backdrop-filter: blur(6px);
	overflow-y: auto;
}
.modal-card {
	width: 100%;
	max-width: 420px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 22px 20px;
	border-radius: 20px;
	background: rgba(28, 24, 54, 0.94);
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}
.knowledge {
	width: 100%;
	text-align: left;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 14px;
	padding: 14px 16px;
}
.k-head {
	font-size: 15px;
	font-weight: 700;
	color: #ffd166;
	margin-bottom: 6px;
}
.k-body {
	font-size: 13px;
	line-height: 1.6;
	color: var(--text);
	margin: 0 0 8px;
}
.k-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 7px;
}
.k-list li {
	display: flex;
	flex-direction: column;
	gap: 2px;
	font-size: 12.5px;
	line-height: 1.5;
	color: var(--muted);
}
.k-list li b {
	color: var(--text);
	font-size: 13px;
}
.k-extra {
	margin: 10px 0 0;
	font-size: 12px;
	line-height: 1.55;
	color: #9be7c4;
}

.hint {
	font-size: 13px;
	color: var(--muted);
}
</style>
