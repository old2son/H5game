<script setup lang="ts">
import { SHOP_ITEMS, levelTarget } from '../game/config'
import type { GameSnapshot } from '../game/types'

const props = defineProps<{
  snapshot: GameSnapshot
}>()

const emit = defineEmits<{
  (e: 'buy', key: string): void
  (e: 'next'): void
}>()

const bought = (key: string) => props.snapshot.purchased[key] ?? 0
const maxOf = (key: string) => SHOP_ITEMS.find((item) => item.key === key)?.max ?? 1
const affordable = (price: number) => props.snapshot.money >= price

function icon(key: string) {
  return key
}
</script>

<template>
  <div class="shop">
    <header>
      <div class="tag">第 {{ snapshot.level }} 关完成</div>
      <h2>矿工商店</h2>
      <p class="hint">
        目标已达成：<strong class="gold">{{ snapshot.money }}</strong> / {{ snapshot.target }}　·　下一关目标
        <strong class="gold">{{ levelTarget(snapshot.level + 1) }}</strong>
      </p>
    </header>

    <div class="grid">
      <div v-for="item in SHOP_ITEMS" :key="item.key" class="card" :class="{ disabled: bought(item.key) >= item.max || !affordable(item.price) }">
        <div class="icon" :data-icon="icon(item.key)">
          <!-- 炸药 -->
          <svg v-if="item.key === 'dynamite'" viewBox="0 0 48 48" width="34" height="34">
            <rect x="14" y="14" width="20" height="26" rx="3" fill="#e2443a" stroke="#7d140d" stroke-width="2" />
            <rect x="14" y="20" width="20" height="4" fill="#2c2c2c" />
            <rect x="14" y="30" width="20" height="4" fill="#2c2c2c" />
            <path d="M24 14c-3-4 3-6 0-10" stroke="#d8c9a3" stroke-width="2.5" fill="none" stroke-linecap="round" />
            <circle cx="24" cy="5" r="3" fill="#ffb454" />
          </svg>
          <!-- 力量饮料 -->
          <svg v-else-if="item.key === 'strength'" viewBox="0 0 48 48" width="34" height="34">
            <path d="M18 8h12l-2 8 5 6v20a3 3 0 01-3 3H18a3 3 0 01-3-3V22l5-6z" fill="#7bd88f" stroke="#2c6b3f" stroke-width="2" />
            <path d="M15 28h18v10a3 3 0 01-3 3H18a3 3 0 01-3-3z" fill="#4fae6b" />
            <path d="M21 31l3 3 3-4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <!-- 石头收藏册 -->
          <svg v-else-if="item.key === 'stoneBook'" viewBox="0 0 48 48" width="34" height="34">
            <path d="M8 10c8-3 16 3 24 0v28c-8 3-16-3-24 0z" fill="#a8a29a" stroke="#5f5a53" stroke-width="2" />
            <path d="M32 10c6-2 8 1 8 1v27s-2 3-8 1z" fill="#8d8683" stroke="#5f5a53" stroke-width="2" />
            <circle cx="18" cy="22" r="4" fill="#c9c3bb" />
            <circle cx="26" cy="30" r="3" fill="#c9c3bb" />
          </svg>
          <!-- 四叶草 -->
          <svg v-else viewBox="0 0 48 48" width="34" height="34">
            <path d="M24 24C24 14 18 8 12 12S10 24 24 24z" fill="#6cc36c" stroke="#2f7a38" stroke-width="2" />
            <path d="M24 24c10 0 16-6 12-12S24 10 24 24z" fill="#7bd88f" stroke="#2f7a38" stroke-width="2" />
            <path d="M24 24c0 10 6 16 12 12S38 24 24 24z" fill="#6cc36c" stroke="#2f7a38" stroke-width="2" />
            <path d="M24 24C14 24 8 30 12 36s12 0 12-12z" fill="#7bd88f" stroke="#2f7a38" stroke-width="2" />
            <path d="M24 24v18" stroke="#2f7a38" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="info">
          <div class="name">
            {{ item.name }}
            <span v-if="item.max > 1" class="stock">×{{ bought(item.key) }}/{{ item.max }}</span>
          </div>
          <div class="desc">{{ item.desc }}</div>
        </div>
        <button
          class="buy"
          :disabled="bought(item.key) >= item.max || !affordable(item.price)"
          @click="emit('buy', item.key)"
        >
          {{ bought(item.key) >= item.max ? '已购买' : `¥${item.price}` }}
        </button>
      </div>
    </div>

    <footer>
      <span class="warn">提示：商店消费会从总金额里扣除，而关卡目标是累计金额，买之前算清楚。</span>
      <button class="next" @click="emit('next')">进入第 {{ snapshot.level + 1 }} 关</button>
    </footer>
  </div>
</template>

<style scoped>
.shop {
  width: min(720px, 92%);
  background: linear-gradient(180deg, #33261a, #241a12);
  border: 1px solid #6b4f31;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

header {
  text-align: center;
  margin-bottom: 16px;
}

.tag {
  display: inline-block;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(123, 216, 143, 0.16);
  border: 1px solid rgba(123, 216, 143, 0.45);
  color: var(--ok);
  margin-bottom: 8px;
}

h2 {
  margin: 0 0 6px;
  font-size: 26px;
  color: var(--gold);
  letter-spacing: 2px;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-dim);
}

.gold {
  color: var(--gold);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.card:hover:not(.disabled) {
  border-color: var(--gold);
  transform: translateY(-2px);
}

.card.disabled {
  opacity: 0.45;
}

.icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 2px;
}

.stock {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
}

.desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.4;
}

.buy {
  min-width: 68px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--gold-deep);
  background: linear-gradient(180deg, #ffd447, #e0a300);
  color: #3a2a06;
  font-weight: 800;
  font-size: 14px;
}

.buy:disabled {
  background: #3a2c1e;
  color: var(--text-dim);
  border-color: var(--line);
  cursor: not-allowed;
}

footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.warn {
  font-size: 12px;
  color: #d8a06a;
  flex: 1;
  min-width: 240px;
}

.next {
  height: 44px;
  padding: 0 26px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(180deg, #7bd88f, #3fa85c);
  color: #0d2b16;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 6px 0 #2b7a43;
}

.next:active {
  transform: translateY(3px);
  box-shadow: 0 3px 0 #2b7a43;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .shop {
    padding: 16px;
  }
}
</style>
