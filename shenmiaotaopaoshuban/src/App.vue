<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createRunnerGame } from './game/createRunnerGame'

const ready = ref(false)
let destroyGame: (() => void) | undefined

onMounted(() => {
  destroyGame = createRunnerGame('game-canvas')
  requestAnimationFrame(() => (ready.value = true))
})

onBeforeUnmount(() => destroyGame?.())
</script>

<template>
  <main class="app-shell" :class="{ ready }">
    <div id="game-canvas" class="game-host" aria-label="明眸守护队儿童护眼科普跑酷游戏"></div>
    <div class="loading-mark" aria-hidden="true">
      <span>明眸守护队</span>
      <i></i>
    </div>
    <div class="rotate-tip">请旋转回竖屏，继续护眼挑战</div>
  </main>
</template>
