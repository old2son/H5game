<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { MAX_LEVEL, emptyBuffs } from '../game/config'
import { sfx } from '../game/audio'
import { GoldMinerEngine } from '../game/Engine'
import type { GameSnapshot } from '../game/types'
import HudBar from './HudBar.vue'
import ShopPanel from './ShopPanel.vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engine = shallowRef<GoldMinerEngine | null>(null)
const muted = ref(false)

const initialSnapshot: GameSnapshot = {
  status: 'ready',
  level: 1,
  money: 0,
  target: 650,
  time: 60,
  dynamite: 0,
  overtime: false,
  buffs: emptyBuffs(),
  purchased: {},
  canDynamite: false,
}
const snapshot = ref<GameSnapshot>(initialSnapshot)

function onKeydown(event: KeyboardEvent) {
  const game = engine.value
  if (!game) return
  const key = event.key.toLowerCase()
  if (key === ' ' || key === 'enter' || key === 'arrowdown') {
    event.preventDefault()
    if (snapshot.value.status === 'ready') start()
    else game.shoot()
  } else if (key === 'x' || key === 'd') {
    game.useDynamite()
  } else if (key === 'p' || key === 'escape') {
    if (snapshot.value.status === 'ready') return
    game.togglePause()
  } else if (key === 'r') {
    start()
  }
}

function onCanvasClick() {
  const game = engine.value
  if (!game) return
  if (snapshot.value.status === 'playing') game.shoot()
}

function start() {
  sfx.unlock()
  engine.value?.startGame()
}

function nextLevel() {
  engine.value?.nextLevel()
}

function buy(key: string) {
  engine.value?.buy(key)
}

function toggleMute() {
  muted.value = !muted.value
  sfx.muted = muted.value
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const game = new GoldMinerEngine(canvas, {
    onState: (state) => {
      snapshot.value = state
    },
  })
  engine.value = game
  if (import.meta.env.DEV) {
    ;(window as unknown as { __engine?: GoldMinerEngine }).__engine = game
  }
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', () => game.resize())
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => game.resize())
    resizeObserver.observe(canvas)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
  engine.value?.destroy()
})
</script>

<template>
  <div class="stage-wrap">
    <HudBar :snapshot="snapshot" :muted="muted" @pause="engine?.togglePause()" @dynamite="engine?.useDynamite()" @toggle-mute="toggleMute" />

    <div class="stage">
      <canvas ref="canvasRef" class="canvas" @pointerdown="onCanvasClick" />

      <!-- 开始 -->
      <div v-if="snapshot.status === 'ready'" class="overlay">
        <div class="card">
          <h1>黄 金 矿 工</h1>
          <p class="sub">摆动爪子，抓金子，别抓石头</p>
          <ul class="rules">
            <li><b>空格 / 点击</b> 放出爪子抓取</li>
            <li><b>X / 炸药按钮</b> 拉到重物时引爆甩掉</li>
            <li><b>P / Esc</b> 暂停，<b>R</b> 重新开始</li>
            <li>大金块值钱但拉得慢，钻石又轻又贵</li>
            <li>拉上 TNT 会在坑口爆炸，炸飞周围矿藏</li>
          </ul>
          <button class="primary" @click="start">开始挖矿</button>
        </div>
      </div>

      <!-- 暂停 -->
      <div v-else-if="snapshot.status === 'paused'" class="overlay">
        <div class="card">
          <h2>已暂停</h2>
          <p class="sub">喝口水，矿脉不会跑</p>
          <div class="row">
            <button class="primary" @click="engine?.resume()">继续</button>
            <button class="ghost" @click="start">重新开始</button>
          </div>
        </div>
      </div>

      <!-- 商店 -->
      <div v-else-if="snapshot.status === 'shop'" class="overlay">
        <ShopPanel :snapshot="snapshot" @buy="buy" @next="nextLevel" />
      </div>

      <!-- 失败 -->
      <div v-else-if="snapshot.status === 'gameover'" class="overlay">
        <div class="card">
          <h2 class="fail">矿难了…</h2>
          <p class="sub">
            第 {{ snapshot.level }} 关目标 <b class="gold">{{ snapshot.target }}</b
            >，你只挖到 <b class="gold">{{ snapshot.money }}</b>
          </p>
          <button class="primary" @click="start">再来一次</button>
        </div>
      </div>

      <!-- 通关 -->
      <div v-else-if="snapshot.status === 'win'" class="overlay">
        <div class="card">
          <h2 class="win">通关！</h2>
          <p class="sub">
            你挖穿了全部 {{ MAX_LEVEL }} 关，最终身家 <b class="gold">{{ snapshot.money }}</b>
          </p>
          <button class="primary" @click="start">再挖一遍</button>
        </div>
      </div>
    </div>

    <div class="tips">
      <span>爪子在摆动时按下才有效 · 越重的东西拉得越慢 · 老鼠会乱跑但很值钱</span>
    </div>
  </div>
</template>

<style scoped>
.stage-wrap {
  width: 100%;
}

.stage {
  position: relative;
  width: 100%;
  aspect-ratio: 960 / 600;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid #5a4028;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
  background: #3a2311;
}

.canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(12, 8, 5, 0.72);
  backdrop-filter: blur(2px);
  padding: 16px;
}

.card {
  width: min(560px, 92%);
  background: linear-gradient(180deg, #33261a, #221811);
  border: 1px solid #6b4f31;
  border-radius: 16px;
  padding: 26px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}

h1 {
  margin: 0 0 6px;
  font-size: 38px;
  letter-spacing: 6px;
  background: linear-gradient(180deg, #fff3b0, #e0a300);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

h2 {
  margin: 0 0 6px;
  font-size: 28px;
  color: var(--gold);
}

h2.fail {
  color: var(--danger);
}

h2.win {
  color: var(--ok);
}

.sub {
  margin: 0 0 16px;
  color: var(--text-dim);
  font-size: 14px;
}

.rules {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  text-align: left;
  display: inline-block;
  color: #d9c8ad;
  font-size: 13.5px;
  line-height: 2;
}

.rules b {
  color: var(--gold);
}

.gold {
  color: var(--gold);
}

.row {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.primary {
  height: 48px;
  padding: 0 34px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffd447, #e0a300);
  color: #3a2a06;
  font-size: 17px;
  font-weight: 800;
  box-shadow: 0 6px 0 #a97600;
}

.primary:active {
  transform: translateY(3px);
  box-shadow: 0 3px 0 #a97600;
}

.ghost {
  height: 48px;
  padding: 0 24px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  font-size: 15px;
}

.ghost:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tips {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
}

@media (max-width: 640px) {
  h1 {
    font-size: 28px;
    letter-spacing: 3px;
  }
  .card {
    padding: 18px;
  }
}
</style>
