<script setup lang="ts">
import GameStage from './components/GameStage.vue'
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div class="title">
        <span class="pick">⛏</span>
        <div>
          <h1>黄金矿工</h1>
          <p>Vue 3 + Vite + Canvas 复刻版 · 10 关卡 · 商店道具</p>
        </div>
      </div>
    </header>

    <GameStage />
  </main>
</template>

<style scoped>
.page-head {
  margin-bottom: 14px;
}

.title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pick {
  font-size: 30px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 2px;
  color: var(--gold);
}

p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--text-dim);
}
</style>
