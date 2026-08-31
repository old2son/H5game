<template>
  <div class="page game">
    <!-- HUD -->
    <header class="hud">
      <div class="hud-left">
        <div class="badge">第 {{ levelIndex + 1 }} / {{ totalLevels }} 关</div>
        <div class="level-name">{{ scene.name }}</div>
      </div>
      <div class="hud-right">
        <div class="timer" :class="{ danger: timeLeft <= 10 }">{{ timeLeft }}s</div>
        <div class="progress">已找到 {{ found.length }} / {{ scene.diffs.length }}</div>
      </div>
    </header>

    <p class="tip-line">在两幅图中找出不同之处，点击任意一幅图标记差异。</p>

    <div class="boards">
      <canvas ref="cv0" class="board" @pointerdown="onTap"></canvas>
      <canvas ref="cv1" class="board" @pointerdown="onTap"></canvas>
    </div>

    <div class="controls">
      <van-button plain type="primary" block @click="useHint">💡 提示</van-button>
      <van-button plain type="default" block @click="retry">↻ 重玩</van-button>
    </div>

    <!-- 护眼小课堂 -->
    <van-dialog v-model:show="showLesson" :title="lessonTitle" confirm-button-text="进入下一关" @confirm="nextAfterLesson">
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button as VanButton, Dialog as VanDialog, showToast } from 'vant'
import { SCENES, PLACEHOLDER_TIPS } from '../game/scenes'
import { useGameStore, TOTAL_LEVELS } from '../store/game'

const S = 400
const router = useRouter()
const store = useGameStore()

const cv0 = ref<HTMLCanvasElement | null>(null)
const cv1 = ref<HTMLCanvasElement | null>(null)

const levelIndex = ref(0)
const found = ref<number[]>([])
const timeLeft = ref(60)
const hintsUsed = ref(0)
const hintIndex = ref(-1)
const running = ref(false)
const showLesson = ref(false)
const showFail = ref(false)

let timerId: number | null = null
let hintTimer: number | null = null

const totalLevels = TOTAL_LEVELS
const scene = computed(() => SCENES[levelIndex.value])
const lessonTitle = computed(() => `护眼小课堂 · ${scene.value.name}`)
const lessonTips = computed(() => PLACEHOLDER_TIPS[scene.value.name] || ['（科普图文占位）保持良好用眼习惯。'])
const isLast = computed(() => levelIndex.value + 1 >= SCENES.length)

/* ----------------------------- 绘制 ----------------------------- */
function fitCtx(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(2, 0, 0, 2, 0, 0)
}
function center(b: { x: number; y: number; w: number; h: number }) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}
function drawMarker(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, color: string, pulse = false) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(p.x, p.y, pulse ? 26 : 20, 0, Math.PI * 2)
  ctx.stroke()
  if (!pulse) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(p.x - 7, p.y)
    ctx.lineTo(p.x - 2, p.y + 6)
    ctx.lineTo(p.x + 8, p.y - 7)
    ctx.stroke()
  }
  ctx.restore()
}
function paintCanvas(ctx: CanvasRenderingContext2D, variant: number) {
  fitCtx(ctx)
  ctx.clearRect(0, 0, S, S)
  scene.value.render(ctx, variant)
  scene.value.diffs.forEach((d, i) => {
    if (found.value.includes(i)) drawMarker(ctx, center(d.bbox), '#2ecc71')
  })
  if (hintIndex.value >= 0 && !found.value.includes(hintIndex.value)) {
    drawMarker(ctx, center(scene.value.diffs[hintIndex.value].bbox), '#ffb300', true)
  }
}
function repaint() {
  if (cv0.value && cv1.value) {
    paintCanvas(cv0.value.getContext('2d')!, 0)
    paintCanvas(cv1.value.getContext('2d')!, 1)
  }
}

/* ----------------------------- 关卡流程 ----------------------------- */
function loadLevel(i: number) {
  levelIndex.value = i
  found.value = []
  timeLeft.value = 60
  hintsUsed.value = 0
  hintIndex.value = -1
  running.value = true
  repaint()
  startTimer()
}
function startTimer() {
  stopTimer()
  timerId = window.setInterval(() => {
    if (!running.value) return
    timeLeft.value--
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      failLevel()
    }
  }, 1000)
}
function stopTimer() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

/* ----------------------------- 点击找茬 ----------------------------- */
function onTap(e: PointerEvent) {
  if (!running.value) return
  const cv = e.currentTarget as HTMLCanvasElement
  const rect = cv.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * S
  const y = ((e.clientY - rect.top) / rect.height) * S
  const diffs = scene.value.diffs
  for (let i = 0; i < diffs.length; i++) {
    if (found.value.includes(i)) continue
    const b = diffs[i].bbox
    if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) {
      found.value = [...found.value, i]
      clearHint()
      repaint()
      beep(880, 0.08)
      if (found.value.length === diffs.length) completeLevel()
      return
    }
  }
  showToast('再仔细看看～')
}

/* ----------------------------- 提示 ----------------------------- */
function useHint() {
  if (!running.value) return
  const remain = scene.value.diffs.map((_, i) => i).filter((i) => !found.value.includes(i))
  if (!remain.length) return
  hintIndex.value = remain[Math.floor(Math.random() * remain.length)]
  hintsUsed.value++
  repaint()
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = window.setTimeout(() => {
    hintIndex.value = -1
    repaint()
  }, 1400)
}
function clearHint() {
  if (hintTimer) {
    clearTimeout(hintTimer)
    hintTimer = null
  }
  hintIndex.value = -1
}

function retry() {
  showFail.value = false
  clearHint()
  loadLevel(levelIndex.value)
}

/* ----------------------------- 通关 / 失败 ----------------------------- */
function completeLevel() {
  running.value = false
  stopTimer()
  clearHint()
  const base = Math.round((100 * timeLeft.value) / 60)
  const score = Math.max(0, Math.min(100, base - hintsUsed.value * 8))
  store.setScore(levelIndex.value, score)
  beep(1320, 0.12)
  showLesson.value = true
}
function failLevel() {
  running.value = false
  stopTimer()
  clearHint()
  beep(160, 0.2)
  showFail.value = true
}
function nextAfterLesson() {
  showLesson.value = false
  if (isLast.value) {
    store.finishAll()
    router.push('/result')
  } else {
    loadLevel(levelIndex.value + 1)
  }
}

/* ----------------------------- 声音反馈 ----------------------------- */
let actx: AudioContext | null = null
function beep(freq: number, dur: number) {
  try {
    actx = actx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.frequency.value = freq
    o.type = 'sine'
    g.gain.value = 0.06
    o.connect(g)
    g.connect(actx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur)
    o.stop(actx.currentTime + dur)
  } catch (e) {
    /* 忽略音频异常 */
  }
}

onMounted(() => {
  // 初始化画布分辨率
  ;[cv0, cv1].forEach((c) => {
    if (c.value) {
      c.value.width = S * 2
      c.value.height = S * 2
    }
  })
  loadLevel(0)
})
onUnmounted(() => {
  stopTimer()
  clearHint()
})
</script>

<style scoped>
.game {
  padding-top: 4px;
}
.hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card);
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 6px 18px rgba(60, 90, 160, 0.08);
}
.badge {
  font-size: 12px;
  color: var(--muted);
}
.level-name {
  font-size: 20px;
  font-weight: 700;
  margin-top: 2px;
}
.timer {
  font-size: 24px;
  font-weight: 800;
  color: var(--green);
  text-align: right;
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
  font-size: 12px;
  color: var(--muted);
  text-align: right;
  margin-top: 2px;
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
}
.board {
  flex: 1;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(60, 90, 160, 0.12);
  cursor: pointer;
  touch-action: manipulation;
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
