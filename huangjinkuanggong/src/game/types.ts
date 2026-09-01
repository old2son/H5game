export type ItemType =
  | 'goldSmall'
  | 'gold'
  | 'goldBig'
  | 'goldHuge'
  | 'rockSmall'
  | 'rock'
  | 'diamond'
  | 'bag'
  | 'tnt'
  | 'bone'
  | 'mouse'

export interface ItemDef {
  type: ItemType
  name: string
  radius: number
  weight: number
  value: number
  /** 生成时允许的纵向范围 */
  yRange: [number, number]
}

export interface GameObject extends ItemDef {
  id: number
  x: number
  y: number
  /** 绘制旋转角 */
  rot: number
  grabbed: boolean
  seed: number
  /** 多边形轮廓半径系数，保证每帧形状稳定 */
  shape: number[]
  vx?: number
  bagValue?: number
}

export type HookState = 'swing' | 'shoot' | 'retract'

export type GameStatus =
  | 'ready'
  | 'playing'
  | 'paused'
  | 'shop'
  | 'gameover'
  | 'win'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
}

export interface FloatText {
  x: number
  y: number
  vy: number
  life: number
  text: string
  color: string
  size: number
}

export interface Buffs {
  strength: boolean
  clover: boolean
  stoneBook: boolean
}

export interface GameSnapshot {
  status: GameStatus
  level: number
  money: number
  target: number
  time: number
  dynamite: number
  overtime: boolean
  buffs: Buffs
  purchased: Record<string, number>
  canDynamite: boolean
}
