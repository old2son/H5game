<template>
  <div class="game-root">
    <!-- Phaser 画布挂载点 -->
    <div ref="container" class="game-container"></div>

    <!-- 开始界面（Vue 状态驱动） -->
    <div v-if="phase === 'start'" class="overlay">
      <div class="panel">
        <div class="logo">👓</div>
        <h1>护眼接接乐</h1>
        <p class="sub">接住护眼好物，躲开伤眼陷阱！</p>
        <ul class="rules">
          <li>🕹 左右滑动 / 拖动控制小人移动</li>
          <li>🥕 接住护眼好物 → 加分（偶尔回血）</li>
          <li>📱 误接伤眼物品 → 扣 1 生命</li>
          <li>❤️ 5 点生命 · ⏱ 限时 60 秒</li>
        </ul>
        <button class="btn" @click="start">开始游戏</button>
      </div>
    </div>

    <!-- 报告界面（Vue 状态驱动） -->
    <div v-else-if="phase === 'report' && report" class="overlay">
      <div class="panel report">
        <h2>近视风险指数报告</h2>
        <div class="index-ring" :style="ringStyle">
          <div class="index-num">{{ report.risk }}</div>
          <div class="index-label">{{ report.level }}</div>
        </div>
        <div class="title-badge" :style="{ color: report.color }">{{ report.title }}</div>
        <div class="stats">
          <div><span>{{ report.score }}</span><label>护眼得分</label></div>
          <div><span>{{ report.caughtGood }}</span><label>接住好物</label></div>
          <div><span>{{ report.caughtBad }}</span><label>误接陷阱</label></div>
          <div><span>{{ report.lives }}</span><label>剩余生命</label></div>
        </div>
        <div class="tips">
          <h3>📋 个性化护眼建议</h3>
          <ul>
            <li v-for="(t, i) in report.tips" :key="i">{{ t }}</li>
          </ul>
        </div>
        <button class="btn" @click="restart">再来一局</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { createEyeCatchGame } from '../game/eyeCatchGame.js'

const container = ref(null)
const phase = ref('start')   // 'start' | 'playing' | 'report'
const report = ref(null)
let gameApi = null

const ringStyle = computed(() => {
  const c = report.value?.color || '#2196f3'
  return {
    background: `radial-gradient(circle at 32% 28%, ${c}, ${c}cc)`,
    boxShadow: `0 10px 26px ${c}66, inset 0 0 0 6px rgba(255,255,255,.25)`
  }
})

onMounted(() => {
  gameApi = createEyeCatchGame(container.value, {
    onReport: (r) => {
      report.value = r
      phase.value = 'report'
    }
  })
})

onBeforeUnmount(() => {
  gameApi?.destroy()
})

function start () {
  phase.value = 'playing'
  gameApi?.start()
}
function restart () {
  report.value = null
  phase.value = 'playing'
  gameApi?.start()
}
</script>

<style>
.game-root {
  position: relative;
  width: 100%;
  max-width: 480px;
  height: 100vh;
  height: 100dvh;
  margin: 0 auto;
  overflow: hidden;
  background: #bfe9ff;
}
.game-container { width: 100%; height: 100%; }
.game-container canvas { display: block; margin: 0 auto; }

.overlay {
  position: absolute; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  padding: 18px;
  background: rgba(11, 22, 34, .74);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.panel {
  width: 100%; max-width: 380px;
  background: linear-gradient(160deg, #ffffff, #eef6ff);
  border-radius: 24px; padding: 26px 22px 24px; text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .4);
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
}
.logo { font-size: 54px; line-height: 1; }
.panel h1 { margin: 8px 0 4px; font-size: 28px; color: #16324f; letter-spacing: 1px; }
.panel h2 { margin: 0 0 6px; font-size: 23px; color: #16324f; }
.sub { margin: 0 0 14px; color: #5b7185; font-size: 14px; }

.rules { list-style: none; padding: 0; margin: 0 0 18px; text-align: left; }
.rules li {
  background: #fff; border: 1px solid #e3edf7; border-radius: 12px;
  padding: 9px 12px; margin-bottom: 8px; font-size: 14px; color: #33485c;
}

.btn {
  display: inline-block; width: 100%; border: none; border-radius: 14px;
  padding: 14px 0; font-size: 18px; font-weight: 700; color: #fff; cursor: pointer;
  background: linear-gradient(135deg, #4fc3f7, #2196f3);
  box-shadow: 0 8px 20px rgba(33, 150, 243, .4);
  transition: transform .08s ease;
}
.btn:active { transform: scale(.97); }

/* 报告 */
.report .index-ring {
  width: 150px; height: 150px; border-radius: 50%; margin: 14px auto 6px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #fff;
  box-shadow: 0 10px 26px rgba(0, 0, 0, .25), inset 0 0 0 6px rgba(255, 255, 255, .25);
}
.index-num { font-size: 56px; font-weight: 800; line-height: 1; }
.index-label { font-size: 15px; margin-top: 2px; opacity: .95; }
.title-badge {
  display: inline-block; margin: 4px auto 14px; padding: 6px 16px; border-radius: 999px;
  font-size: 16px; font-weight: 700; color: #16324f; background: #fff;
}

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 16px; }
.stats > div { background: #fff; border-radius: 12px; padding: 10px 4px; border: 1px solid #e3edf7; }
.stats span { display: block; font-size: 20px; font-weight: 800; color: #2196f3; }
.stats label { font-size: 11px; color: #7b8da0; }

.tips {
  text-align: left; background: #fff; border: 1px solid #e3edf7; border-radius: 14px;
  padding: 12px 14px; margin: 0 0 18px;
}
.tips h3 { margin: 0 0 8px; font-size: 15px; color: #16324f; }
.tips ul { margin: 0; padding-left: 18px; }
.tips li { font-size: 13px; color: #3a4d60; line-height: 1.6; margin-bottom: 6px; }
.tips li:last-child { margin-bottom: 0; }
</style>
