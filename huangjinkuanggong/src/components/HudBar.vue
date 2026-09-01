<script setup lang="ts">
import type { GameSnapshot } from '../game/types'

const props = defineProps<{
  snapshot: GameSnapshot
  muted: boolean
}>()

const emit = defineEmits<{
  (e: 'pause'): void
  (e: 'dynamite'): void
  (e: 'toggle-mute'): void
}>()

const goalPercent = () => {
  const { money, target } = props.snapshot
  return Math.min(100, Math.round((money / target) * 100))
}

const timePercent = () => Math.min(100, Math.round((props.snapshot.time / 60) * 100))

const timeClass = () => {
  const t = props.snapshot.time
  if (t <= 10) return 'danger'
  if (t <= 20) return 'warn'
  return ''
}
</script>

<template>
  <div class="hud">
    <div class="hud-row">
      <div class="chip">
        <span class="label">关卡</span>
        <strong>{{ snapshot.level }} / 10</strong>
      </div>
      <div class="chip">
        <span class="label">金钱</span>
        <strong class="gold">{{ snapshot.money }}</strong>
      </div>

      <div class="chip grow">
        <span class="label">目标</span>
        <div class="bar">
          <div class="bar-fill goal" :style="{ width: goalPercent() + '%' }" />
          <span class="bar-text">{{ snapshot.money }} / {{ snapshot.target }}</span>
        </div>
      </div>

      <div class="chip grow">
        <span class="label" :class="timeClass()">剩余时间</span>
        <div class="bar">
          <div class="bar-fill" :class="timeClass()" :style="{ width: timePercent() + '%' }" />
          <span class="bar-text">{{ snapshot.time }}s</span>
        </div>
      </div>

      <button class="btn tnt" :disabled="snapshot.dynamite <= 0 || !snapshot.canDynamite" @click="emit('dynamite')">
        炸药 ×{{ snapshot.dynamite }}
      </button>
      <button class="btn icon" :title="muted ? '开启音效' : '关闭音效'" @click="emit('toggle-mute')">
        <svg v-if="muted" viewBox="0 0 24 24" width="18" height="18">
          <path d="M4 9h3l4-4v14l-4-4H4z" fill="currentColor" />
          <path d="M15 9l5 6M20 9l-5 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18">
          <path d="M4 9h3l4-4v14l-4-4H4z" fill="currentColor" />
          <path d="M15 8a5 5 0 010 8M18 5a9 9 0 010 14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </svg>
      </button>
      <button class="btn icon" title="暂停 / 继续（P）" @click="emit('pause')">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
        </svg>
      </button>
    </div>

    <div v-if="snapshot.buffs.strength || snapshot.buffs.stoneBook || snapshot.buffs.clover" class="buffs">
      <span v-if="snapshot.buffs.strength" class="buff">力量饮料生效中</span>
      <span v-if="snapshot.buffs.stoneBook" class="buff">石头价值 ×4</span>
      <span v-if="snapshot.buffs.clover" class="buff">幸运四叶草</span>
    </div>
  </div>
</template>

<style scoped>
.hud {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.hud-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chip {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 62px;
}

.chip.grow {
  flex: 1;
  min-width: 150px;
}

.label {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

.label.danger {
  color: var(--danger);
}

.label.warn {
  color: #ffb454;
}

strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.gold {
  color: var(--gold);
}

.bar {
  position: relative;
  height: 20px;
  border-radius: 10px;
  background: #1a120c;
  border: 1px solid var(--line);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4c9be8, #7bd88f);
  transition: width 0.2s linear;
}

.bar-fill.goal {
  background: linear-gradient(90deg, var(--gold-deep), var(--gold));
}

.bar-fill.warn {
  background: linear-gradient(90deg, #d9821f, #ffb454);
}

.bar-fill.danger {
  background: linear-gradient(90deg, #b3321f, #ff6b57);
}

.bar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  font-variant-numeric: tabular-nums;
}

.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  transition: transform 0.1s ease, background 0.15s ease;
}

.btn:hover:not(:disabled) {
  background: #4a3826;
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn.tnt {
  background: linear-gradient(180deg, #c9402f, #8d2216);
  border-color: #e0604a;
}

.btn.icon {
  width: 38px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gold);
}

.buffs {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.buff {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 20px;
  background: rgba(255, 212, 71, 0.14);
  border: 1px solid rgba(255, 212, 71, 0.4);
  color: var(--gold);
}

@media (max-width: 640px) {
  .chip.grow {
    min-width: 120px;
  }
  strong {
    font-size: 17px;
  }
}
</style>
