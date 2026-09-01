import { ITEM_DEFS, VIEW_W, rollBagValue } from './config'
import type { GameObject, ItemType } from './types'

let uid = 1

/** 确定性伪随机，保证同一物体每帧形状一致 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createItem(type: ItemType, x: number, y: number): GameObject {
  const def = ITEM_DEFS[type]
  const seed = Math.floor(Math.random() * 1e9)
  const rnd = mulberry32(seed)
  const shape: number[] = []
  for (let i = 0; i < 11; i++) shape.push(0.76 + rnd() * 0.36)

  const item: GameObject = {
    ...def,
    id: uid++,
    x,
    y,
    rot: rnd() * Math.PI * 2,
    grabbed: false,
    seed,
    shape,
  }

  if (type === 'mouse') item.vx = (rnd() > 0.5 ? 1 : -1) * (36 + rnd() * 26)
  if (type === 'bag') item.bagValue = rollBagValue()
  return item
}

interface Plan {
  type: ItemType
  count: number
}

/** 每关的物品配方 */
export function buildPlan(level: number, clover: boolean): Plan[] {
  const diamondBase = 1 + Math.floor(level / 3)
  const plan: Plan[] = [
    { type: 'goldSmall', count: 4 + Math.floor(level / 4) },
    { type: 'gold', count: 3 + Math.floor(level / 2) },
    { type: 'goldBig', count: level >= 2 ? 1 + Math.floor(level / 3) : 1 },
    { type: 'goldHuge', count: level >= 3 ? Math.floor((level - 1) / 3) : 0 },
    { type: 'rockSmall', count: 2 + Math.floor(level / 2) },
    { type: 'rock', count: 1 + Math.floor(level / 3) },
    { type: 'diamond', count: clover ? diamondBase * 2 : diamondBase },
    { type: 'bag', count: level >= 2 ? (clover ? 2 : 1) : 0 },
    { type: 'tnt', count: level >= 3 ? Math.floor((level - 1) / 3) : 0 },
    { type: 'bone', count: 1 + (level % 2) },
    { type: 'mouse', count: level >= 4 ? 1 : 0 },
  ]
  return plan.filter((row) => row.count > 0)
}

/** 生成一关的物品，使用拒绝采样避免重叠 */
export function generateItems(level: number, clover: boolean): GameObject[] {
  const items: GameObject[] = []
  for (const plan of buildPlan(level, clover)) {
    const def = ITEM_DEFS[plan.type]
    for (let i = 0; i < plan.count; i++) {
      const [minY, maxY] = def.yRange
      for (let attempt = 0; attempt < 260; attempt++) {
        const x = 46 + Math.random() * (VIEW_W - 92)
        const y = minY + Math.random() * (maxY - minY)
        const ok = items.every((other) => {
          const dx = other.x - x
          const dy = other.y - y
          const need = other.radius + def.radius + 16
          return dx * dx + dy * dy > need * need
        })
        if (ok) {
          items.push(createItem(plan.type, x, y))
          break
        }
      }
    }
  }
  return items
}
