<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { createCatchGame } from './game/createCatchGame'

let dispose: (() => void) | undefined
onMounted(() => { dispose = createCatchGame('game') })
onBeforeUnmount(() => dispose?.())
</script>

<template>
  <main>
    <div id="game" aria-label="接睫乐近视防控科普游戏"></div>
    <p class="rotate">请竖屏体验《接睫乐》</p>
  </main>
</template>
