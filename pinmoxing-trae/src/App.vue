<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
	BOARD_HEIGHT,
	BOARD_WIDTH,
	DROP_RADIUS,
	INTRO_DURATION,
	PLACE_SCORE,
	QUIZ_SCORE,
	QUIZ_WRONG_PENALTY,
	SCATTER_DURATION,
	STORAGE_KEY,
	WRONG_DROP_PENALTY
} from './constants';
import { boardBackgroundAsset, partPieceAssets, partSlotAssets } from './eyeAssets';
import { anatomyParts, quizQuestions, type AnatomyPartConfig, type PartKind } from './gameData';

type Phase = 'intro' | 'assemble' | 'quiz' | 'result';
type FeedbackTone = 'neutral' | 'success' | 'warning';

interface PartState extends AnatomyPartConfig {
	x: number;
	y: number;
	placed: boolean;
	bump: boolean;
}

interface DragState {
	id: string;
	pointerId: number;
	offsetX: number;
	offsetY: number;
}

const boardRef = ref<HTMLElement | null>(null);

const phase = ref<Phase>('intro');
const parts = ref<PartState[]>([]);
const unlockedIds = ref<string[]>([]);
const activeCardId = ref<string>('');
const draggingId = ref<string>('');
const dragState = ref<DragState | null>(null);
const canDrag = ref(false);

const score = ref(0);
const bestScore = ref(0);
const placementPoints = ref(0);
const penaltyPoints = ref(0);
const quizPoints = ref(0);
const assemblyBonus = ref(0);
const quizCorrectCount = ref(0);
const wrongDropCount = ref(0);

const statusText = ref('观察完整眼球剖面，马上进入拆解。');
const statusTone = ref<FeedbackTone>('neutral');
const nowMs = ref(Date.now());
const introStartedAt = ref(0);
const assemblyStartedAt = ref<number | null>(null);
const assemblyFinishedAt = ref<number | null>(null);
const quizStartedAt = ref<number | null>(null);
const finishedAt = ref<number | null>(null);

const quizIndex = ref(0);
const chosenAnswer = ref<number | null>(null);
const quizLocked = ref(false);

let introTimer: number | null = null;
let statusTimer: number | null = null;
let answerTimer: number | null = null;
let clockTimer: number | null = null;

function cloneParts(): PartState[] {
	return anatomyParts.map((part) => ({
		...part,
		x: part.target.x,
		y: part.target.y,
		placed: false,
		bump: false
	}));
}

function setStatus(text: string, tone: FeedbackTone = 'neutral') {
	statusText.value = text;
	statusTone.value = tone;

	if (statusTimer) {
		window.clearTimeout(statusTimer);
	}

	statusTimer = window.setTimeout(() => {
		statusTone.value = 'neutral';
	}, 1100);
}

function clearTimers() {
	if (introTimer) {
		window.clearTimeout(introTimer);
		introTimer = null;
	}

	if (statusTimer) {
		window.clearTimeout(statusTimer);
		statusTimer = null;
	}

	if (answerTimer) {
		window.clearTimeout(answerTimer);
		answerTimer = null;
	}
}

function startClock() {
	if (clockTimer) {
		window.clearInterval(clockTimer);
	}

	clockTimer = window.setInterval(() => {
		nowMs.value = Date.now();
	}, 100);
}

function startIntro() {
	clearTimers();
	phase.value = 'intro';
	parts.value = cloneParts();
	unlockedIds.value = [];
	activeCardId.value = '';
	draggingId.value = '';
	dragState.value = null;
	canDrag.value = false;

	score.value = 0;
	placementPoints.value = 0;
	penaltyPoints.value = 0;
	quizPoints.value = 0;
	assemblyBonus.value = 0;
	quizCorrectCount.value = 0;
	wrongDropCount.value = 0;

	quizIndex.value = 0;
	chosenAnswer.value = null;
	quizLocked.value = false;

	introStartedAt.value = Date.now();
	assemblyStartedAt.value = null;
	assemblyFinishedAt.value = null;
	quizStartedAt.value = null;
	finishedAt.value = null;

	statusText.value = '观察完整眼球剖面，马上进入拆解。';
	statusTone.value = 'neutral';

	introTimer = window.setTimeout(() => {
		beginAssembly();
	}, INTRO_DURATION);
}

function beginAssembly() {
	if (phase.value !== 'intro') {
		return;
	}

	if (introTimer) {
		window.clearTimeout(introTimer);
		introTimer = null;
	}

	phase.value = 'assemble';
	assemblyStartedAt.value = Date.now();
	setStatus('拖拽结构回到空位，每拼好一个都会解锁一张科普卡片。', 'neutral');

	parts.value = parts.value.map((part) => ({
		...part,
		x: part.scatter.x,
		y: part.scatter.y
	}));

	window.setTimeout(() => {
		canDrag.value = true;
	}, SCATTER_DURATION);
}

function getBoardRect() {
	return boardRef.value?.getBoundingClientRect() ?? null;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function startDrag(part: PartState, event: PointerEvent) {
	if (phase.value !== 'assemble' || !canDrag.value || part.placed) {
		return;
	}

	const boardRect = getBoardRect();
	if (!boardRect) {
		return;
	}

	event.preventDefault();

	const centerX = (part.x / 100) * boardRect.width;
	const centerY = (part.y / 100) * boardRect.height;

	dragState.value = {
		id: part.id,
		pointerId: event.pointerId,
		offsetX: event.clientX - boardRect.left - centerX,
		offsetY: event.clientY - boardRect.top - centerY
	};
	draggingId.value = part.id;
	(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
	const activeDrag = dragState.value;
	if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
		return;
	}

	const boardRect = getBoardRect();
	if (!boardRect) {
		return;
	}

	const part = parts.value.find((item) => item.id === activeDrag.id);
	if (!part) {
		return;
	}

	const halfWidthPercent = part.size.w / 2;
	const halfHeightPercent = part.size.h / 2;
	const nextX = ((event.clientX - boardRect.left - activeDrag.offsetX) / boardRect.width) * 100;
	const nextY = ((event.clientY - boardRect.top - activeDrag.offsetY) / boardRect.height) * 100;

	part.x = clamp(nextX, halfWidthPercent, 100 - halfWidthPercent);
	part.y = clamp(nextY, halfHeightPercent, 100 - halfHeightPercent);
}

function pulsePart(id: string) {
	const part = parts.value.find((item) => item.id === id);
	if (!part) {
		return;
	}

	part.bump = true;
	window.setTimeout(() => {
		part.bump = false;
	}, 320);
}

function tryPlacePart(part: PartState) {
	const boardRect = getBoardRect();
	if (!boardRect) {
		return;
	}

	const dx = ((part.x - part.target.x) / 100) * boardRect.width;
	const dy = ((part.y - part.target.y) / 100) * boardRect.height;
	const distance = Math.hypot(dx, dy);

	if (distance <= DROP_RADIUS) {
		part.x = part.target.x;
		part.y = part.target.y;
		part.placed = true;
		unlockedIds.value = [...unlockedIds.value, part.id];
		activeCardId.value = part.id;

		placementPoints.value += PLACE_SCORE;
		score.value += PLACE_SCORE;

		setStatus(`拼装成功，已解锁「${part.name}」知识卡片。`, 'success');

		if (parts.value.every((item) => item.placed)) {
			finishAssembly();
		}
		return;
	}

	wrongDropCount.value += 1;
	penaltyPoints.value += WRONG_DROP_PENALTY;
	score.value -= WRONG_DROP_PENALTY;
	pulsePart(part.id);
	setStatus('位置还差一点，轻轻对齐轮廓再试一次。', 'warning');
}

function handlePointerUp(event: PointerEvent) {
	const activeDrag = dragState.value;
	if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
		return;
	}

	const part = parts.value.find((item) => item.id === activeDrag.id);

	dragState.value = null;
	draggingId.value = '';

	if (part && !part.placed) {
		tryPlacePart(part);
	}
}

function finishAssembly() {
	canDrag.value = false;
	assemblyFinishedAt.value = Date.now();

	const seconds = assemblyDurationMs.value / 1000;
	assemblyBonus.value = Math.max(40, 220 - Math.floor(seconds * 10));
	score.value += assemblyBonus.value;

	setStatus('眼球结构已重建完成，进入功能问答巩固记忆。', 'success');

	window.setTimeout(() => {
		phase.value = 'quiz';
		quizStartedAt.value = Date.now();
		activeCardId.value = unlockedIds.value[unlockedIds.value.length - 1] ?? '';
	}, 900);
}

function selectAnswer(index: number) {
	if (phase.value !== 'quiz' || quizLocked.value) {
		return;
	}

	const question = currentQuestion.value;
	if (!question) {
		return;
	}

	chosenAnswer.value = index;
	quizLocked.value = true;

	if (index === question.answer) {
		quizCorrectCount.value += 1;
		quizPoints.value += QUIZ_SCORE;
		score.value += QUIZ_SCORE;
		setStatus('回答正确，视觉知识吸收中。', 'success');
	} else {
		penaltyPoints.value += QUIZ_WRONG_PENALTY;
		score.value -= QUIZ_WRONG_PENALTY;
		setStatus(question.explanation, 'warning');
	}

	answerTimer = window.setTimeout(() => {
		if (quizIndex.value >= quizQuestions.length - 1) {
			finishGame();
			return;
		}

		quizIndex.value += 1;
		chosenAnswer.value = null;
		quizLocked.value = false;
	}, 1100);
}

function finishGame() {
	phase.value = 'result';
	finishedAt.value = Date.now();
	chosenAnswer.value = null;
	quizLocked.value = false;

	const safeScore = Math.max(0, score.value);
	score.value = safeScore;

	if (safeScore > bestScore.value) {
		bestScore.value = safeScore;
		window.localStorage.setItem(STORAGE_KEY, String(safeScore));
	}

	setStatus('本轮完成，欢迎继续挑战更高分。', 'success');
}

function getPartName(id: string) {
	return anatomyParts.find((part) => part.id === id)?.name ?? '';
}

function pieceStyle(part: PartState) {
	return {
		left: `${part.x}%`,
		top: `${part.y}%`,
		width: `${part.size.w}%`,
		height: `${part.size.h}%`,
		zIndex: part.placed ? 10 + part.zIndex : 20 + part.zIndex
	};
}

function getPartAsset(kind: PartKind, variant: 'piece' | 'slot') {
	return variant === 'piece' ? partPieceAssets[kind] : partSlotAssets[kind];
}

const assembledCount = computed(() => parts.value.filter((part) => part.placed).length);
const assemblyProgress = computed(() => Math.round((assembledCount.value / anatomyParts.length) * 100));
const currentQuestion = computed(() => quizQuestions[quizIndex.value] ?? null);

const activeCard = computed(() => {
	const preferredId = activeCardId.value || unlockedIds.value[unlockedIds.value.length - 1];
	return anatomyParts.find((part) => part.id === preferredId) ?? null;
});

const introRemainingMs = computed(() => {
	if (phase.value !== 'intro') {
		return 0;
	}

	return Math.max(0, INTRO_DURATION - (nowMs.value - introStartedAt.value));
});

const assemblyDurationMs = computed(() => {
	if (!assemblyStartedAt.value) {
		return 0;
	}

	const end = assemblyFinishedAt.value ?? nowMs.value;
	return Math.max(0, end - assemblyStartedAt.value);
});

const totalDurationMs = computed(() => {
	const end = finishedAt.value ?? nowMs.value;
	return Math.max(0, end - introStartedAt.value);
});

const scoreLabel = computed(() => Math.max(0, score.value));

const phaseTitle = computed(() => {
	if (phase.value === 'intro') return '完整结构观察';
	if (phase.value === 'assemble') return '拖拽拼装';
	if (phase.value === 'quiz') return '眼球功能问答';
	return '挑战结算';
});

const resultTitle = computed(() => {
	if (scoreLabel.value >= 1100) return '眼球结构大师';
	if (scoreLabel.value >= 920) return '视觉侦察员';
	return '解剖新秀';
});

function formatDuration(ms: number) {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function answerButtonClass(index: number) {
	const question = currentQuestion.value;
	if (!question || chosenAnswer.value === null) {
		return '';
	}

	if (index === question.answer) {
		return 'is-correct';
	}

	if (index === chosenAnswer.value) {
		return 'is-wrong';
	}

	return '';
}

onMounted(() => {
	startClock();

	const savedScore = Number(window.localStorage.getItem(STORAGE_KEY) ?? '0');
	bestScore.value = Number.isFinite(savedScore) ? savedScore : 0;

	startIntro();

	window.addEventListener('pointermove', handlePointerMove);
	window.addEventListener('pointerup', handlePointerUp);
	window.addEventListener('pointercancel', handlePointerUp);
});

onBeforeUnmount(() => {
	clearTimers();

	if (clockTimer) {
		window.clearInterval(clockTimer);
		clockTimer = null;
	}

	window.removeEventListener('pointermove', handlePointerMove);
	window.removeEventListener('pointerup', handlePointerUp);
	window.removeEventListener('pointercancel', handlePointerUp);
});
</script>

<template>
	<div class="app-shell">
		<header class="hero">
			<div>
				<p class="eyebrow">互动 H5 小游戏</p>
				<h1>眼球解剖拼装实验室</h1>
				<p class="hero-copy">
					先观察完整眼球剖面，再把散落的核心结构拖回原位。每次拼对都会解锁一张趣味科普卡片，最终通过功能问答巩固记忆。
				</p>
			</div>
			<div class="hero-stats">
				<div class="stat-card">
					<span>当前阶段</span>
					<strong>{{ phaseTitle }}</strong>
				</div>
				<div class="stat-card">
					<span>当前得分</span>
					<strong>{{ scoreLabel }}</strong>
				</div>
				<div class="stat-card">
					<span>历史最高</span>
					<strong>{{ bestScore }}</strong>
				</div>
			</div>
		</header>

		<main class="layout">
			<section class="playground">
				<div class="hud">
					<div class="hud-pill">{{ statusText }}</div>
					<div class="hud-meta">
						<span
							class="status-badge"
							:class="{
								'is-success': statusTone === 'success',
								'is-warning': statusTone === 'warning'
							}"
						>
							{{ phaseTitle }}
						</span>
						<span>拼装进度 {{ assembledCount }}/{{ anatomyParts.length }}</span>
						<span>用时 {{ formatDuration(totalDurationMs) }}</span>
					</div>
					<div class="progress">
						<div class="progress-fill" :style="{ width: `${assemblyProgress}%` }"></div>
					</div>
				</div>

				<div class="board-frame">
					<div ref="boardRef" class="board">
						<img
							class="board-bg board-bg-image"
							:src="boardBackgroundAsset"
							alt="眼球结构底图"
							:width="BOARD_WIDTH"
							:height="BOARD_HEIGHT"
							draggable="false"
						/>

						<div
							v-for="part in parts"
							v-show="phase !== 'intro'"
							:key="`${part.id}-slot`"
							class="slot-piece"
							:style="pieceStyle({ ...part, x: part.target.x, y: part.target.y })"
						>
							<img
								class="piece-image"
								:src="getPartAsset(part.kind, 'slot')"
								:alt="`${part.name} 空位提示图`"
								draggable="false"
							/>
						</div>

						<button
							v-for="part in parts"
							:key="part.id"
							type="button"
							class="part-piece"
							:class="{
								'is-placed': part.placed,
								'is-dragging': draggingId === part.id,
								'is-bump': part.bump
							}"
							:style="pieceStyle(part)"
							:disabled="part.placed || phase !== 'assemble'"
							:aria-label="`拖拽 ${part.name}`"
							@pointerdown="startDrag(part, $event)"
						>
							<img
								class="piece-image"
								:src="getPartAsset(part.kind, 'piece')"
								:alt="part.name"
								draggable="false"
							/>
						</button>

						<div v-if="phase === 'intro'" class="overlay intro-overlay">
							<p class="overlay-tag">观察完整剖面</p>
							<h2>先认识这颗眼球</h2>
							<p>完整结构会在 {{ (introRemainingMs / 1000).toFixed(1) }} 秒后拆解散开。</p>
							<button type="button" class="primary-btn" @click="beginAssembly">立即开始拼装</button>
						</div>

						<div v-if="phase === 'quiz'" class="corner-banner">结构重建完成</div>
						<div v-if="phase === 'result'" class="corner-banner is-finished">本轮已完成</div>
					</div>
				</div>

				<section v-if="phase === 'quiz'" class="quiz-card">
					<div class="quiz-topline">
						<span>问答 {{ quizIndex + 1 }}/{{ quizQuestions.length }}</span>
						<span>答对 {{ quizCorrectCount }} 题</span>
					</div>
					<h3>{{ currentQuestion?.prompt }}</h3>
					<div class="quiz-options">
						<button
							v-for="(option, index) in currentQuestion?.options ?? []"
							:key="option"
							type="button"
							class="quiz-option"
							:class="answerButtonClass(index)"
							:disabled="quizLocked"
							@click="selectAnswer(index)"
						>
							{{ option }}
						</button>
					</div>
					<p class="quiz-tip">答题正确可获得额外分数，错误会轻微扣分。</p>
				</section>

				<section v-if="phase === 'result'" class="result-card">
					<div class="result-title">
						<p>挑战结算</p>
						<h3>{{ resultTitle }}</h3>
					</div>
					<div class="result-grid">
						<div class="result-metric">
							<span>最终得分</span>
							<strong>{{ scoreLabel }}</strong>
						</div>
						<div class="result-metric">
							<span>拼装基础分</span>
							<strong>{{ placementPoints }}</strong>
						</div>
						<div class="result-metric">
							<span>拼装速度奖</span>
							<strong>{{ assemblyBonus }}</strong>
						</div>
						<div class="result-metric">
							<span>问答得分</span>
							<strong>{{ quizPoints }}</strong>
						</div>
						<div class="result-metric">
							<span>扣分合计</span>
							<strong>-{{ penaltyPoints }}</strong>
						</div>
						<div class="result-metric">
							<span>总用时</span>
							<strong>{{ formatDuration(totalDurationMs) }}</strong>
						</div>
					</div>
					<div class="result-actions">
						<button type="button" class="primary-btn" @click="startIntro">再挑战一次</button>
						<span
							>本轮错放 {{ wrongDropCount }} 次，答对 {{ quizCorrectCount }}/{{
								quizQuestions.length
							}}
							题。</span
						>
					</div>
				</section>
			</section>

			<aside class="sidebar">
				<section class="info-card">
					<div class="section-head">
						<h3>任务目标</h3>
						<span>{{ assembledCount }}/{{ anatomyParts.length }}</span>
					</div>
					<ul class="goal-list">
						<li>观察完整的 2D 伪 3D 眼球剖面结构</li>
						<li>拖拽角膜、虹膜、晶状体、视网膜和视神经回到空位</li>
						<li>解锁全部科普卡片后，进入功能问答阶段</li>
						<li>尽量减少错放次数，争取更高总分</li>
					</ul>
				</section>

				<section class="info-card">
					<div class="section-head">
						<h3>知识卡片</h3>
						<span>已解锁 {{ unlockedIds.length }}</span>
					</div>
					<div class="chip-row">
						<button
							v-for="part in anatomyParts"
							:key="`${part.id}-chip`"
							type="button"
							class="chip"
							:class="{
								'is-unlocked': unlockedIds.includes(part.id),
								'is-active': activeCardId === part.id
							}"
							:disabled="!unlockedIds.includes(part.id)"
							@click="activeCardId = part.id"
						>
							{{ unlockedIds.includes(part.id) ? part.shortName : '待解锁' }}
						</button>
					</div>

					<div v-if="activeCard" class="fact-card">
						<p class="fact-tag">{{ activeCard.name }}</p>
						<h4>{{ activeCard.description }}</h4>
						<p>{{ activeCard.detail }}</p>
						<div class="fun-fact">
							<strong>趣味补充</strong>
							<span>{{ activeCard.funFact }}</span>
						</div>
					</div>
					<div v-else class="fact-placeholder">每成功放置一个结构，这里都会解锁一张图文卡片。</div>
				</section>

				<section class="info-card">
					<div class="section-head">
						<h3>结构清单</h3>
						<span>{{ phaseTitle }}</span>
					</div>
					<ul class="parts-list">
						<li
							v-for="part in anatomyParts"
							:key="`${part.id}-list`"
							:class="{ 'is-done': unlockedIds.includes(part.id) }"
						>
							<div>
								<strong>{{ part.name }}</strong>
								<p>{{ part.description }}</p>
							</div>
							<span>{{ unlockedIds.includes(part.id) ? '已归位' : '待拼装' }}</span>
						</li>
					</ul>
				</section>
			</aside>
		</main>
	</div>
</template>

<style scoped>
.app-shell {
	max-width: 1380px;
	margin: 0 auto;
	padding: 28px 20px 40px;
}

.hero {
	display: flex;
	justify-content: space-between;
	gap: 20px;
	align-items: flex-start;
	margin-bottom: 24px;
}

.eyebrow {
	margin: 0 0 8px;
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: #4d7db0;
}

.hero h1 {
	margin: 0;
	font-size: clamp(34px, 5vw, 56px);
	line-height: 1.05;
	color: #0f2740;
}

.hero-copy {
	max-width: 720px;
	margin: 12px 0 0;
	color: #4d6580;
	line-height: 1.7;
}

.hero-stats {
	display: grid;
	grid-template-columns: repeat(3, minmax(120px, 1fr));
	gap: 14px;
	width: min(430px, 100%);
}

.stat-card,
.info-card,
.quiz-card,
.result-card {
	background: rgba(255, 255, 255, 0.84);
	border: 1px solid rgba(155, 187, 214, 0.45);
	box-shadow: 0 18px 42px rgba(72, 103, 136, 0.12);
	backdrop-filter: blur(16px);
}

.stat-card {
	padding: 16px 18px;
	border-radius: 22px;
}

.stat-card span {
	display: block;
	font-size: 13px;
	color: #6180a0;
}

.stat-card strong {
	display: block;
	margin-top: 8px;
	font-size: 24px;
	color: #0f2740;
}

.layout {
	display: grid;
	grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.9fr);
	gap: 20px;
	align-items: start;
}

.playground {
	display: flex;
	flex-direction: column;
	gap: 18px;
}

.hud {
	padding: 18px;
	border-radius: 22px;
	background: rgba(255, 255, 255, 0.84);
	border: 1px solid rgba(155, 187, 214, 0.45);
	box-shadow: 0 18px 42px rgba(72, 103, 136, 0.12);
}

.hud-pill {
	padding: 14px 16px;
	border-radius: 16px;
	background: linear-gradient(135deg, rgba(238, 247, 255, 0.98), rgba(219, 238, 250, 0.9));
	color: #173754;
	line-height: 1.6;
}

.hud-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	margin-top: 14px;
	font-size: 13px;
	color: #5c7897;
}

.status-badge {
	padding: 6px 12px;
	border-radius: 999px;
	background: rgba(84, 126, 169, 0.12);
	color: #315478;
	font-weight: 700;
}

.status-badge.is-success {
	background: rgba(88, 190, 155, 0.16);
	color: #1d7155;
}

.status-badge.is-warning {
	background: rgba(241, 176, 99, 0.18);
	color: #955817;
}

.progress {
	margin-top: 14px;
	height: 10px;
	border-radius: 999px;
	background: rgba(204, 222, 238, 0.7);
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	border-radius: inherit;
	background: linear-gradient(90deg, #58c3c8, #6a87ea);
	transition: width 0.35s ease;
}

.board-frame {
	padding: 20px;
	border-radius: 28px;
	background: linear-gradient(180deg, rgba(244, 250, 255, 0.95), rgba(232, 242, 252, 0.88));
	border: 1px solid rgba(155, 187, 214, 0.45);
	box-shadow: 0 20px 60px rgba(72, 103, 136, 0.14);
}

.board {
	position: relative;
	width: 100%;
	aspect-ratio: 760 / 540;
	overflow: hidden;
	border-radius: 28px;
	background:
		radial-gradient(circle at 30% 18%, rgba(255, 255, 255, 0.85), transparent 38%),
		linear-gradient(180deg, #eef7ff, #dfeefe 70%, #d8e8f7);
}

.board-bg {
	width: 100%;
	height: 100%;
}

.board-bg-image {
	display: block;
	object-fit: contain;
	object-position: center;
	user-select: none;
	pointer-events: none;
}

.slot-piece,
.part-piece {
	position: absolute;
	transform: translate(-50%, -50%);
	border: none;
	padding: 0;
	background: transparent;
	transition:
		left 0.9s cubic-bezier(0.22, 1, 0.36, 1),
		top 0.9s cubic-bezier(0.22, 1, 0.36, 1),
		transform 0.18s ease,
		filter 0.18s ease,
		opacity 0.2s ease;
}

.slot-piece {
	pointer-events: none;
	opacity: 0.38;
	filter: grayscale(0.92) brightness(1.14) contrast(0.9);
}

.part-piece {
	cursor: grab;
	touch-action: none;
	filter: drop-shadow(0 10px 16px rgba(19, 50, 79, 0.16));
}

.part-piece:hover {
	transform: translate(-50%, -50%) scale(1.04);
}

.part-piece.is-dragging {
	transition: none;
	cursor: grabbing;
	filter: drop-shadow(0 18px 22px rgba(19, 50, 79, 0.22));
	transform: translate(-50%, -50%) scale(1.05);
}

.part-piece.is-placed {
	cursor: default;
	filter: none;
}

.part-piece.is-bump {
	animation: nudge 0.32s ease;
}

.part-piece:disabled {
	pointer-events: none;
}

.piece-image {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
	object-position: center;
	user-select: none;
	pointer-events: none;
}

.overlay {
	position: absolute;
	inset: 0;
	display: grid;
	place-items: center;
	text-align: center;
	background: linear-gradient(180deg, rgba(232, 244, 255, 0.2), rgba(232, 244, 255, 0.66));
}

.intro-overlay {
	padding: 30px;
}

.overlay-tag,
.fact-tag {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: fit-content;
	padding: 7px 12px;
	margin: 0 auto 12px;
	border-radius: 999px;
	background: rgba(97, 150, 206, 0.14);
	color: #35608e;
	font-size: 12px;
	font-weight: 700;
}

.overlay h2 {
	margin: 0 0 10px;
	font-size: clamp(24px, 4vw, 34px);
	color: #102b46;
}

.overlay p {
	margin: 0;
	color: #4f6781;
}

.primary-btn {
	margin-top: 16px;
	border: none;
	border-radius: 999px;
	padding: 14px 24px;
	font-size: 15px;
	font-weight: 700;
	color: #ffffff;
	background: linear-gradient(135deg, #4f9ee7, #6d72ef);
	box-shadow: 0 12px 28px rgba(78, 132, 235, 0.28);
	cursor: pointer;
}

.corner-banner {
	position: absolute;
	right: 18px;
	top: 18px;
	padding: 10px 14px;
	border-radius: 999px;
	background: rgba(85, 194, 167, 0.14);
	color: #1a6e56;
	font-weight: 700;
}

.corner-banner.is-finished {
	background: rgba(85, 126, 187, 0.14);
	color: #355782;
}

.quiz-card,
.result-card,
.info-card {
	border-radius: 24px;
	padding: 20px;
}

.quiz-topline,
.section-head,
.result-title {
	display: flex;
	justify-content: space-between;
	gap: 14px;
	align-items: center;
}

.quiz-card h3,
.result-title h3,
.section-head h3 {
	margin: 0;
	color: #102b46;
}

.quiz-card h3 {
	margin-top: 12px;
	font-size: 24px;
	line-height: 1.4;
}

.quiz-options {
	display: grid;
	gap: 12px;
	margin-top: 18px;
}

.quiz-option,
.chip {
	border: 1px solid rgba(124, 160, 194, 0.35);
	background: #f8fbff;
	color: #173754;
	cursor: pointer;
}

.quiz-option {
	padding: 16px 18px;
	border-radius: 18px;
	text-align: left;
	font-size: 15px;
	transition:
		transform 0.18s ease,
		border-color 0.18s ease,
		background 0.18s ease;
}

.quiz-option:hover:not(:disabled),
.chip:hover:not(:disabled) {
	transform: translateY(-1px);
	border-color: rgba(92, 146, 197, 0.64);
}

.quiz-option.is-correct {
	background: rgba(87, 197, 156, 0.16);
	border-color: rgba(87, 197, 156, 0.56);
	color: #1a6e56;
}

.quiz-option.is-wrong {
	background: rgba(241, 176, 99, 0.18);
	border-color: rgba(241, 176, 99, 0.52);
	color: #955817;
}

.quiz-tip {
	margin: 14px 0 0;
	color: #63809f;
	font-size: 13px;
}

.result-title p {
	margin: 0;
	color: #5b7694;
	font-size: 13px;
}

.result-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 12px;
	margin-top: 18px;
}

.result-metric {
	padding: 16px;
	border-radius: 18px;
	background: rgba(243, 248, 255, 0.94);
}

.result-metric span {
	display: block;
	color: #607c99;
	font-size: 13px;
}

.result-metric strong {
	display: block;
	margin-top: 8px;
	color: #102b46;
	font-size: 24px;
}

.result-actions {
	display: flex;
	justify-content: space-between;
	gap: 14px;
	align-items: center;
	margin-top: 18px;
	color: #5f7a97;
}

.sidebar {
	display: flex;
	flex-direction: column;
	gap: 18px;
}

.goal-list,
.parts-list {
	display: grid;
	gap: 12px;
	margin: 16px 0 0;
	padding: 0;
	list-style: none;
}

.goal-list li,
.parts-list li {
	padding: 14px 16px;
	border-radius: 18px;
	background: rgba(244, 249, 255, 0.92);
	color: #45637f;
	line-height: 1.65;
}

.chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin-top: 16px;
}

.chip {
	padding: 10px 14px;
	border-radius: 999px;
	font-size: 13px;
}

.chip.is-unlocked {
	background: rgba(87, 195, 200, 0.14);
}

.chip.is-active {
	border-color: rgba(78, 142, 209, 0.6);
	background: rgba(95, 148, 214, 0.16);
}

.chip:disabled {
	opacity: 0.56;
	cursor: default;
}

.fact-card {
	margin-top: 18px;
	padding: 18px;
	border-radius: 20px;
	background: linear-gradient(180deg, rgba(248, 252, 255, 0.98), rgba(237, 246, 253, 0.96));
}

.fact-card h4 {
	margin: 0 0 10px;
	color: #14324f;
	line-height: 1.55;
}

.fact-card p,
.fact-placeholder,
.parts-list p {
	margin: 0;
	color: #597593;
	line-height: 1.7;
}

.fun-fact {
	margin-top: 14px;
	padding: 14px;
	border-radius: 16px;
	background: rgba(88, 160, 234, 0.1);
	color: #38597d;
}

.fun-fact strong {
	display: block;
	margin-bottom: 8px;
	color: #163554;
}

.fact-placeholder {
	margin-top: 18px;
	padding: 18px;
	border-radius: 18px;
	background: rgba(246, 250, 255, 0.92);
}

.parts-list li {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	align-items: flex-start;
}

.parts-list li strong {
	display: block;
	margin-bottom: 6px;
	color: #183a5d;
}

.parts-list li span {
	white-space: nowrap;
	font-size: 13px;
	font-weight: 700;
	color: #6a87a5;
}

.parts-list li.is-done {
	background: rgba(228, 248, 242, 0.88);
}

.parts-list li.is-done span {
	color: #1f7a5f;
}

@keyframes nudge {
	0%,
	100% {
		transform: translate(-50%, -50%);
	}
	30% {
		transform: translate(calc(-50% + 5px), -50%);
	}
	60% {
		transform: translate(calc(-50% - 4px), -50%);
	}
}

@media (max-width: 1100px) {
	.hero,
	.result-actions,
	.layout {
		grid-template-columns: 1fr;
		display: grid;
	}

	.hero-stats,
	.result-grid {
		width: 100%;
	}
}

@media (max-width: 900px) {
	.hero {
		display: block;
	}

	.hero-stats {
		margin-top: 16px;
	}

	.result-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 640px) {
	.app-shell {
		padding: 18px 12px 28px;
	}

	.hero h1 {
		font-size: 34px;
	}

	.hero-stats {
		grid-template-columns: 1fr;
	}

	.board-frame,
	.hud,
	.quiz-card,
	.result-card,
	.info-card {
		padding: 16px;
		border-radius: 20px;
	}

	.result-grid {
		grid-template-columns: 1fr;
	}

	.parts-list li {
		display: grid;
	}
}
</style>
