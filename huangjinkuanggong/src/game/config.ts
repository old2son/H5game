import type { Buffs, ItemDef, ItemType } from './types'

/** 逻辑分辨率，所有绘制都基于这个尺寸 */
export const VIEW_W = 960
export const VIEW_H = 600

/** 地表线：以上为天空，以下为矿洞土层 */
export const GROUND_Y = 150

/** 绳索悬挂点（矿工手部） */
export const PIVOT = { x: 480, y: 106 }

export const MIN_LEN = 30
export const MAX_ROPE = 470

/**
 * 爪子的几何：绳索末端在 length 处，
 * 两爪合拢的"怀抱"中心在 length + CLAW_GRAB_OFFSET，
 * 爪尖尖端在 length + CLAW_TIP_OFFSET。
 * 抓取判定必须用怀抱中心，否则判定点和肉眼看到的爪尖对不上。
 */
export const CLAW_GRAB_OFFSET = 14
export const CLAW_TIP_OFFSET = 22

/** 爪子下探速度 px/s */
export const SHOOT_SPEED = 820
/** 空爪回收速度 px/s */
export const EMPTY_RETRACT = 700

/** 摆动最大角度（弧度），约 ±76° */
export const MAX_ANGLE = 1.33

export const LEVEL_TIME = 60
export const MAX_LEVEL = 10
export const MAX_LEVEL_TIME = 60

export const ITEM_DEFS: Record<ItemType, ItemDef> = {
  goldSmall: { type: 'goldSmall', name: '小金块', radius: 13, weight: 6, value: 50, yRange: [230, 545] },
  gold: { type: 'gold', name: '金块', radius: 21, weight: 11, value: 100, yRange: [250, 540] },
  goldBig: { type: 'goldBig', name: '大金块', radius: 30, weight: 19, value: 250, yRange: [330, 540] },
  goldHuge: { type: 'goldHuge', name: '巨型金块', radius: 40, weight: 29, value: 500, yRange: [400, 538] },
  rockSmall: { type: 'rockSmall', name: '小石头', radius: 19, weight: 11, value: 11, yRange: [230, 545] },
  rock: { type: 'rock', name: '大石头', radius: 30, weight: 21, value: 20, yRange: [265, 545] },
  diamond: { type: 'diamond', name: '钻石', radius: 13, weight: 3, value: 600, yRange: [300, 545] },
  bag: { type: 'bag', name: '神秘宝袋', radius: 18, weight: 7, value: 0, yRange: [280, 520] },
  tnt: { type: 'tnt', name: 'TNT 炸药桶', radius: 17, weight: 6, value: 0, yRange: [350, 540] },
  bone: { type: 'bone', name: '骨头', radius: 14, weight: 4, value: 7, yRange: [240, 505] },
  mouse: { type: 'mouse', name: '钻石老鼠', radius: 15, weight: 4, value: 300, yRange: [340, 520] },
}

/** 累计金钱目标：650 / 1400 / 2250 / 3200 ... */
export function levelTarget(level: number): number {
  let target = 650
  for (let i = 2; i <= level; i++) target += 750 + (i - 2) * 100
  return target
}

/** 摆动速度随关卡提升 */
export function swingSpeedFor(level: number): number {
  return 1.45 + (level - 1) * 0.13
}

export interface ShopItem {
  key: 'dynamite' | 'strength' | 'stoneBook' | 'clover'
  name: string
  desc: string
  price: number
  max: number
}

export const SHOP_ITEMS: ShopItem[] = [
  { key: 'dynamite', name: '炸药', desc: '拉不动时引爆，立刻甩掉猎物', price: 150, max: 3 },
  { key: 'strength', name: '力量饮料', desc: '下一关拉拽速度 +45%', price: 350, max: 1 },
  { key: 'stoneBook', name: '石头收藏册', desc: '下一关石头价值 ×4', price: 300, max: 1 },
  { key: 'clover', name: '幸运四叶草', desc: '下一关钻石与宝袋数量翻倍', price: 500, max: 1 },
]

export function emptyBuffs(): Buffs {
  return { strength: false, clover: false, stoneBook: false }
}

/** 神秘宝袋开出的金额 */
export function rollBagValue(): number {
  const table: [number, number][] = [
    [20, 28],
    [100, 30],
    [300, 20],
    [600, 15],
    [1000, 7],
  ]
  const total = table.reduce((sum, item) => sum + item[1], 0)
  let roll = Math.random() * total
  for (const [value, weight] of table) {
    roll -= weight
    if (roll <= 0) return value
  }
  return 20
}
