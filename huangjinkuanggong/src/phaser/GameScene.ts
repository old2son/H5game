import * as Phaser from 'phaser'

/** 世界（逻辑）尺寸：竖版 9:16，专为手机竖屏设计（cover 适配下竖屏视口上下铺满、左右裁切）。所有坐标基于 W/H，与画布物理尺寸解耦 */
export const WORLD_W = 540
export const WORLD_H = 960
const W = WORLD_W
const H = WORLD_H

/** 设备像素比，上限 2 —— 再高对 2D 素材收益极小，显存开销却线性增长 */
export const DPR = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2)

/** 显示宽度硬上限（px）：移动端优先，桌面端也不超过 768 宽，避免在大屏上过度拉伸 */
const MAX_CSS_W = 768

/** 绳索悬挂点（矿井顶部卷扬机位置） */
const PIVOT = { x: W / 2, y: 150 }

const MIN_LEN = 34
// 竖版世界更深，爪子需能伸到接近底部（PIVOT.y=150 → 底部约 H-14，最大有效长度由 maxReach 的边界限制决定）
const MAX_ROPE = 860
const MAX_ANGLE = 1.4 // 约 80°
const SWING_SPEED = 1.7 // 摆动相位速度 rad/s
const SHOOT_SPEED = 640 // 爪子伸出速度 px/s
const RETRACT_BASE = 540 // 回收基础速度（除以重量）
const EMPTY_RETRACT = 780 // 空钩回收速度
const BOMB_RETRACT = 920 // 丢炸药后快速回收
const GRAB_PAD = 5 // 抓取判定额外容差
const LEVEL_TIME = 60 // 每关秒数
const MAX_LEVEL = 8

/**
 * 素材视觉缩放系数：1 表示图片长边恰好等于碰撞直径 2r，视觉与判定严格一致。
 * 若觉得画面太挤可下调到 0.9 左右（判定不变，视觉略小于判定圈）。
 */
const ITEM_VISUAL_RATIO = 1

type ItemKind = 'gold' | 'rock' | 'diamond' | 'bag' | 'tnt'

interface ItemDef {
  r: number
  value: number
  weight: number
  color: number
  kind: ItemKind
}

interface Item {
  type: string
  def: ItemDef
  kind: ItemKind
  sprite: Phaser.GameObjects.Image
  x: number
  y: number
  r: number
  value: number
  weight: number
  grabbed: boolean
}

type HookState = 'swing' | 'shoot' | 'retract'

interface Hook {
  angle: number
  length: number
  state: HookState
  grabbed: Item | null
  retractSpeed: number
}

const DEFS: Record<string, ItemDef> = {
  goldS: { r: 16, value: 55, weight: 1.3, color: 0xffe27a, kind: 'gold' },
  gold: { r: 25, value: 110, weight: 1.9, color: 0xffce3a, kind: 'gold' },
  goldL: { r: 36, value: 300, weight: 3.0, color: 0xf7b733, kind: 'gold' },
  rockS: { r: 20, value: 12, weight: 2.3, color: 0x9a948c, kind: 'rock' },
  rock: { r: 34, value: 22, weight: 3.7, color: 0x7d776e, kind: 'rock' },
  diamond: { r: 15, value: 620, weight: 1.0, color: 0x6fe3ff, kind: 'diamond' },
  bag: { r: 21, value: 0, weight: 1.6, color: 0xb5651d, kind: 'bag' },
  tnt: { r: 22, value: 0, weight: 1.7, color: 0xd23b2e, kind: 'tnt' },
}

export class GameScene extends Phaser.Scene {
  private hook!: Hook
  private swingPhase = 0
  private items: Item[] = []
  private money = 0
  private level = 1
  private timeLeft = LEVEL_TIME
  private state: 'start' | 'playing' | 'levelclear' | 'gameover' | 'win' = 'start'

  private fx!: Phaser.GameObjects.Graphics // 绳索 + 爪子
  private bgGfx!: Phaser.GameObjects.Graphics
  private txtMoney!: Phaser.GameObjects.Text
  private txtGoal!: Phaser.GameObjects.Text
  private txtTime!: Phaser.GameObjects.Text
  private txtLevel!: Phaser.GameObjects.Text
  private txtHint!: Phaser.GameObjects.Text
  private overlay: Phaser.GameObjects.Container | null = null
  /** 当前覆盖层按钮的回调，使空格/点击可直接确认，而不必精确点中按钮 */
  private overlayAction: (() => void) | null = null
  private audioCtx?: AudioContext
  /** 需要跟随画布缩放重建纹理的常驻文字（HUD） */
  private hudTexts: Phaser.GameObjects.Text[] = []
  /** 上一次应用到文字的纹理分辨率，避免每帧重复重建纹理 */
  private textRes = 0
  /** HUD 安全内边距（世界单位）：cover 模式下画面会被裁切，HUD 须缩进到可见区 */
  private hudSafe = { x: 10, y: 10 }

  constructor() {
    super('game')
  }

  /**
   * 自适应画布：让 canvas 物理像素 = CSS 显示尺寸 × DPR，实现 1:1 采样。
   *
   * 世界为竖版 540×960（9:16），scale.mode = NONE，由本方法按容器算适配比例：
   * - 视口比世界更窄（手机竖屏，viewRatio ≤ 9:16）→ cover：高度铺满、左右裁切
   * - 视口比世界更宽（PC / 平板横屏，viewRatio > 9:16）→ contain：完整显示、左右留白
   * 这样 PC 上保持竖屏比例且高度自适应占满，HUD / 物品不被裁切；手机维持上下铺满。
   * 所有坐标按 W/H 编写，与画布物理尺寸解耦，无需改动。
   */
  private fitCamera() {
    const parent = this.game.canvas.parentElement
    // 显示宽度硬上限 MAX_CSS_W：移动端按屏宽自适应，桌面端不超过 768 宽
    const availW = Math.min(parent?.clientWidth || window.innerWidth || W, MAX_CSS_W)
    const availH = parent?.clientHeight || window.innerHeight || H
    // cover 模式：画布 = 视口尺寸，世界等比填满视口（较小边对齐、较大边裁切溢出）。
    // 竖屏手机下高度对齐 → 上下铺满、左右裁掉少许（体验优先，代价是边缘物品不入画）。
    const cssW = Math.max(Math.floor(availW), 1)
    const cssH = Math.max(Math.floor(availH), 1)
    // 画布物理像素 = CSS 尺寸 × DPR，做到 1:1 采样。
    // 此前 FIT 模式不乘 DPR，高清屏下画布被浏览器二次放大而整体发虚。
    const devW = Math.max(Math.round(cssW * DPR), 1)
    const devH = Math.max(Math.round(cssH * DPR), 1)

    if (this.scale.width !== devW || this.scale.height !== devH) {
      this.scale.setGameSize(devW, devH)
    }
    // NONE 模式下 Phaser 会把 canvas 样式设为设备像素尺寸，这里改回 CSS 逻辑尺寸，
    // 使每个 CSS 像素对应 DPR 个物理像素（高清屏锐利）。
    const canvas = this.game.canvas
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'

    const cam = this.cameras.main
    // 自适应策略：视口比世界更窄（手机竖屏）→ cover 上下铺满、左右裁切；
    // 视口比世界更宽（PC / 横屏）→ contain 完整显示、左右留白（竖屏比例、高度自适应占满）。
    const worldRatio = W / H
    const viewRatio = devW / devH
    const z = viewRatio <= worldRatio ? Math.max(devW / W, devH / H) : Math.min(devW / W, devH / H)
    cam.setZoom(z)
    cam.centerOn(W / 2, H / 2)

    // cover 下可见世界范围：居中裁切，算出左右/上下被裁掉的世界单位，
    // 用作 HUD 安全内边距，保证角落文字不被裁切。
    const visW = devW / z
    const visH = devH / z
    this.hudSafe = {
      x: Math.max((W - visW) / 2, 0) + 10,
      y: Math.max((H - visH) / 2, 0) + 10,
    }
    this.layoutHud()

    // 文字是预渲染位图纹理：相机 zoom 放大后纹理会被拉伸发虚，
    // 按实际缩放倍率重建纹理（上限 3，避免 4K 屏下纹理过大）。
    const res = Math.min(z, 3)
    if (Math.abs(res - this.textRes) > 0.01) {
      this.textRes = res
      for (const t of this.hudTexts) t.setResolution(res)
    }
  }

  /** 根据 cover 裁切量，把 HUD 文字缩进到可见区（角落不被裁掉） */
  private layoutHud() {
    if (!this.txtMoney) return
    const { x: sx, y: sy } = this.hudSafe
    this.txtMoney.setPosition(sx, sy)
    this.txtGoal.setPosition(sx, sy + 28)
    this.txtTime.setPosition(W / 2, sy).setOrigin(0.5, 0)
    this.txtLevel.setPosition(W - sx, sy).setOrigin(1, 0)
    this.txtHint.setPosition(W / 2, H - sy).setOrigin(0.5, 1)
  }

  /** 新建文字时按当前渲染倍率设定纹理分辨率，并按需登记到 HUD 列表 */
  private mkText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    persistent = false,
  ) {
    const t = this.add.text(x, y, text, style)
    const res = Math.min((this.cameras.main?.zoom || 1) * DPR, 3)
    if (res > 1) t.setResolution(res)
    if (persistent) this.hudTexts.push(t)
    return t
  }

  /**
   * 等比缩放精灵：让长边等于 target，保持素材原始宽高比。
   * 素材已裁紧到内容边界且多为非正方形，用 setDisplaySize(w, h) 会拉伸变形。
   */
  private fitSprite(sprite: Phaser.GameObjects.Image, target: number) {
    const s = target / Math.max(sprite.width, sprite.height)
    sprite.setScale(s)
    return sprite
  }

  preload() {
    // 物品按 kind 共用纹理（金块大中小/石头大小均按 def.r 缩放显示）
    this.load.image('item-gold', '/assets/gold.png')
    this.load.image('item-rock', '/assets/rock.png')
    this.load.image('item-diamond', '/assets/diamond.png')
    this.load.image('item-bag', '/assets/bag.png')
    this.load.image('item-tnt', '/assets/tnt.png')
    this.load.image('miner', '/assets/miner.png')
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a120b')

    // 先按容器定好画布尺寸与 camera zoom，文字才能按正确倍率建纹理
    this.hudTexts = []
    this.fitCamera()

    // 防止首屏跳变：画布初始 visibility:hidden（见 phaser.html），
    // 等首帧「正确布局」渲染完成（POST_RENDER 事件，保证已用当前相机画过一帧）后
    // 再翻为可见，杜绝「默认位置先显示 → 调整 → 正确位置」的中间态被看到。
    const canvasEl = this.game.canvas
    const reveal = () => {
      if (canvasEl) canvasEl.style.visibility = 'visible'
    }
    this.game.events.once(Phaser.Core.Events.POST_RENDER, reveal)
    // 兜底：极端情况下若 500ms 内 POST_RENDER 未触发，直接显示避免永久隐藏
    this.time.delayedCall(500, reveal)

    this.bgGfx = this.add.graphics().setDepth(0)
    this.drawBackground()

    this.fx = this.add.graphics().setDepth(8)

    // 矿工图片精灵（替代原 drawMiner 矢量绘制），置于 PIVOT 上方
    // 素材裁紧后不再是正方形，须等比缩放，否则会被拉扁
    this.fitSprite(this.add.image(PIVOT.x, PIVOT.y - 38, 'miner').setDepth(7), 84)

    const style = { fontFamily: 'sans-serif', fontSize: '20px', color: '#ffe9a8' } as const
    this.txtMoney = this.mkText(20, 14, '', style, true).setDepth(20)
    this.txtGoal = this.mkText(20, 42, '', { ...style, fontSize: '15px', color: '#c9b48f' }, true).setDepth(
      20,
    )
    this.txtTime = this.mkText(W / 2, 14, '', { ...style, fontSize: '22px', color: '#fff' }, true)
      .setOrigin(0.5, 0)
      .setDepth(20)
    this.txtLevel = this.mkText(W - 20, 14, '', { ...style, fontSize: '18px', color: '#ffd447' }, true)
      .setOrigin(1, 0)
      .setDepth(20)
    this.txtHint = this.mkText(
      W / 2,
      H - 26,
      '空格 / 点击 放爪    ·    X 丢弃石头或炸药',
      {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#d8c7a3',
      },
      true,
    )
      .setOrigin(0.5)
      .setDepth(20)

    // HUD 文字已建好，按当前 cover 裁切量定位到可见区
    this.layoutHud()

    this.hook = { angle: 0, length: MIN_LEN, state: 'swing', grabbed: null, retractSpeed: RETRACT_BASE }

    // 输入
    this.input.on('pointerdown', () => this.onAction())
    this.input.keyboard?.on('keydown-SPACE', () => this.onAction())
    this.input.keyboard?.on('keydown-X', () => this.onBomb())

    // 窗口尺寸变化时重新适配画布（Scale.NONE 不会自动跟随容器）
    const onResize = () => this.fitCamera()
    window.addEventListener('resize', onResize)
    this.scale.on('resize', onResize)
    this.events.once('shutdown', () => {
      window.removeEventListener('resize', onResize)
      this.scale.off('resize', onResize)
    })

    if (import.meta.env.DEV) {
      const tm = this.textures
      console.log(
        '[PHASER]',
        Phaser.VERSION,
        JSON.stringify({
          miner: tm.exists('miner'),
          gold: tm.exists('item-gold'),
          rock: tm.exists('item-rock'),
          diamond: tm.exists('item-diamond'),
          bag: tm.exists('item-bag'),
          tnt: tm.exists('item-tnt'),
        }),
      )
      // 测试钩子：暴露场景便于无头断言（prod 下不存在，会被摇树移除）
      ;(window as unknown as { __scene: GameScene }).__scene = this
    }

    this.showStart()
  }

  // ---------- 背景 ----------

  private drawBackground() {
    const g = this.bgGfx
    g.clear()
    // 顶部岩层（矿井天花板）
    g.fillStyle(0x2a2018, 1)
    g.fillRect(0, 0, W, PIVOT.y)
    g.fillStyle(0x33271c, 1)
    for (let i = 0; i < 14; i++) {
      g.fillRect((i * 73) % W, 10 + ((i * 37) % (PIVOT.y - 20)), 40, 6)
    }
    // 泥土层
    g.fillGradientStyle(0x6b4a2b, 0x6b4a2b, 0x3a2616, 0x3a2616, 1)
    g.fillRect(0, PIVOT.y, W, H - PIVOT.y)
    // 泥土纹理点（竖版面积更大，按面积增密）
    g.fillStyle(0x000000, 0.12)
    const speckN = Math.round((W * (H - PIVOT.y)) / 3200)
    for (let i = 0; i < speckN; i++) {
      const x = (i * 137) % W
      const y = PIVOT.y + 20 + ((i * 211) % (H - PIVOT.y - 30))
      g.fillCircle(x, y, 3 + (i % 3))
    }
  }

  
  // ---------- 几何工具 ----------

  private dir() {
    return { x: Math.sin(this.hook.angle), y: Math.cos(this.hook.angle) }
  }

  private tip() {
    const d = this.dir()
    return { x: PIVOT.x + d.x * this.hook.length, y: PIVOT.y + d.y * this.hook.length }
  }

  private maxReach() {
    const d = this.dir()
    let m = MAX_ROPE
    if (d.y > 0.001) m = Math.min(m, (H - 14 - PIVOT.y) / d.y)
    if (d.x > 0.001) m = Math.min(m, (W - 14 - PIVOT.x) / d.x)
    if (d.x < -0.001) m = Math.min(m, (14 - PIVOT.x) / d.x)
    return Math.max(m, MIN_LEN + 30)
  }

  // ---------- 关卡流程 ----------

  private goal(level: number) {
    return 240 + level * 200
  }

  private startNewGame() {
    this.clearItems()
    this.money = 0
    this.level = 1
    this.startLevel(1)
  }

  private startLevel(level: number) {
    this.clearItems()
    this.clearOverlay() // 任何路径进入关卡都不留遮罩
    this.level = level
    this.timeLeft = LEVEL_TIME
    this.spawnItems(level)
    this.hook = { angle: 0, length: MIN_LEN, state: 'swing', grabbed: null, retractSpeed: RETRACT_BASE }
    this.swingPhase = 0
    this.state = 'playing'
    this.updateHud()
  }

  private spawnItems(level: number) {
    const count = 9 + Math.min(level, 5)
    const pool: string[] = []
    const add = (t: string, n: number) => {
      for (let i = 0; i < n; i++) pool.push(t)
    }
    add('goldS', 3)
    add('gold', 2)
    add('goldL', 1 + Math.floor(level / 3))
    add('rockS', 2)
    add('rock', 1 + Math.floor(level / 4))
    add('diamond', level >= 2 ? 1 : 0)
    add('bag', 1)
    add('tnt', level >= 3 ? 1 : 0)

    let placed = 0
    let guard = 0
    while (placed < count && guard < 600) {
      guard++
      const type = pool[Math.floor(Math.random() * pool.length)]
      const def = DEFS[type]
      const r = def.r
      // cover 模式下左右会被裁切，物品须生成在可见区（hudSafe.x 为左右被裁的世界单位）
      const inset = this.hudSafe.x
      const left = r + 24 + inset
      const right = W - r - 24 - inset
      const x = left <= right ? Phaser.Math.Between(left, right) : W / 2
      const y = Phaser.Math.Between(PIVOT.y + 70, H - r - 22)
      let ok = true
      for (const it of this.items) {
        if (Math.hypot(it.x - x, it.y - y) < it.r + r + 8) {
          ok = false
          break
        }
      }
      if (!ok) continue
      const value = type === 'bag' ? Phaser.Math.Between(60, 320) : def.value
      // 等比缩放：让素材长边等于碰撞直径 def.r*2，保持宽高比不被拉伸
      const sprite = this.add.image(x, y, 'item-' + def.kind).setDepth(5)
      this.fitSprite(sprite, def.r * ITEM_VISUAL_RATIO * 2)
      this.items.push({
        type,
        def,
        kind: def.kind,
        sprite,
        x,
        y,
        r,
        value,
        weight: def.weight,
        grabbed: false,
      })
      placed++
    }
  }

  private clearItems() {
    for (const it of this.items) it.sprite.destroy()
    this.items = []
  }

  private removeItem(item: Item) {
    const i = this.items.indexOf(item)
    if (i >= 0) this.items.splice(i, 1)
    item.sprite.destroy()
  }

  // ---------- 主循环 ----------

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000

    if (this.state === 'playing') {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) {
        this.timeLeft = 0
        this.endLevel()
      }
    }

    if (this.state === 'playing' || this.state === 'start') {
      this.stepHook(dt)
    }

    this.updateHud()
    this.drawHook()
  }

  private stepHook(dt: number) {
    const hook = this.hook
    if (hook.state === 'swing') {
      this.swingPhase += SWING_SPEED * dt
      hook.angle = MAX_ANGLE * Math.sin(this.swingPhase)
      return
    }
    if (hook.state === 'shoot') {
      hook.length += SHOOT_SPEED * dt
      const tip = this.tip()
      if (hook.length >= this.maxReach()) {
        this.beginRetract(hook.grabbed)
        return
      }
      const hit = this.hitTest(tip)
      if (hit) this.grab(hit)
      return
    }
    if (hook.state === 'retract') {
      hook.length -= hook.retractSpeed * dt
      if (hook.grabbed) {
        const d = this.dir()
        const tip = this.tip()
        hook.grabbed.x = tip.x + d.x * hook.grabbed.r * 0.3
        hook.grabbed.y = tip.y + d.y * hook.grabbed.r * 0.3
        hook.grabbed.sprite.setPosition(hook.grabbed.x, hook.grabbed.y)
      }
      if (hook.length <= MIN_LEN) {
        hook.length = MIN_LEN
        if (hook.grabbed) this.collect(hook.grabbed)
        hook.grabbed = null
        hook.state = 'swing'
      }
    }
  }

  private hitTest(tip: { x: number; y: number }): Item | null {
    let best: Item | null = null
    let bestDist = Infinity
    for (const it of this.items) {
      if (it.grabbed) continue
      const dist = Math.hypot(it.x - tip.x, it.y - tip.y)
      if (dist < it.r + GRAB_PAD && dist < bestDist) {
        best = it
        bestDist = dist
      }
    }
    return best
  }

  private grab(hit: Item) {
    hit.grabbed = true
    this.hook.grabbed = hit
    this.beginRetract(hit)
    this.beep(520, 0.07, 'sine', 0.15)
  }

  private beginRetract(grabbed: Item | null) {
    this.hook.state = 'retract'
    this.hook.retractSpeed = grabbed ? RETRACT_BASE / grabbed.weight : EMPTY_RETRACT
  }

  private collect(item: Item) {
    if (item.kind === 'tnt') {
      this.boom(item.x, item.y)
      const near = this.items.filter(
        (o) => o !== item && Math.hypot(o.x - item.x, o.y - item.y) < 130,
      )
      near.forEach((o) => this.removeItem(o))
      this.removeItem(item)
      return
    }
    const val = item.value
    this.money += val
    this.floatText(item.x, item.y, '+' + val, val >= 250 ? '#ffd447' : '#ffe9a8')
    if (item.kind === 'gold' || item.kind === 'diamond' || item.kind === 'bag') {
      this.beep(880, 0.12, 'triangle', 0.18)
    } else {
      this.beep(200, 0.12, 'square', 0.16)
    }
    this.removeItem(item)
  }

  private onAction() {
    // 覆盖层（开始 / 过关 / 失败 / 通关）状态下，空格与点击等同于按下画面上的按钮
    if (this.overlayAction) {
      const fn = this.overlayAction
      this.overlayAction = null
      this.clearOverlay()
      fn()
      return
    }
    if (this.state === 'playing' && this.hook.state === 'swing') {
      this.hook.state = 'shoot'
    }
  }

  private onBomb() {
    if (this.state !== 'playing') return
    const g = this.hook.grabbed
    if (g && (g.kind === 'rock' || g.kind === 'tnt')) {
      this.beep(90, 0.25, 'sawtooth', 0.25)
      this.removeItem(g)
      this.hook.grabbed = null
      this.hook.state = 'retract'
      this.hook.retractSpeed = BOMB_RETRACT
    }
  }

  // ---------- 表现层 ----------

  private drawHook() {
    const tip = this.tip()
    const d = this.dir()
    const g = this.fx
    g.clear()
    // 绳索
    g.lineStyle(4, 0xd9c7a3, 1)
    g.beginPath()
    g.moveTo(PIVOT.x, PIVOT.y)
    g.lineTo(tip.x, tip.y)
    g.strokePath()
    // 爪子
    const perp = { x: -d.y, y: d.x }
    const open = this.hook.grabbed ? 3 : 8
    const baseL = { x: tip.x - perp.x * open, y: tip.y - perp.y * open }
    const baseR = { x: tip.x + perp.x * open, y: tip.y + perp.y * open }
    const end = { x: tip.x + d.x * 14, y: tip.y + d.y * 14 }
    g.lineStyle(5, 0x9aa0a8, 1)
    g.beginPath()
    g.moveTo(baseL.x, baseL.y)
    g.lineTo(tip.x, tip.y)
    g.lineTo(baseR.x, baseR.y)
    g.strokePath()
    g.lineStyle(4, 0x9aa0a8, 1)
    g.beginPath()
    g.moveTo(end.x, end.y)
    g.lineTo(end.x - d.x * 7, end.y - d.y * 7)
    g.strokePath()
  }

  private updateHud() {
    this.txtMoney.setText('💰 ' + this.money)
    this.txtGoal.setText('目标 ' + this.goal(this.level))
    this.txtTime.setText('⏱ ' + Math.ceil(this.timeLeft) + 's')
    this.txtLevel.setText('第 ' + this.level + ' 关')
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.mkText(x, y, text, {
      fontFamily: 'sans-serif',
      fontSize: '26px',
      color,
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setDepth(25)
    this.tweens.add({
      targets: t,
      y: y - 52,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    })
  }

  private boom(x: number, y: number) {
    this.beep(90, 0.3, 'sawtooth', 0.3)
    this.cameras.main.shake(220, 0.01)
    const flash = this.add.circle(x, y, 10, 0xffae42, 0.9).setDepth(24)
    this.tweens.add({
      targets: flash,
      radius: 120,
      alpha: 0,
      duration: 360,
      onComplete: () => flash.destroy(),
    })
  }

  private beep(freq: number, dur: number, type: OscillatorType, vol: number) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const ctx = this.audioCtx || (this.audioCtx = new Ctor())
      if (ctx.state === 'suspended') void ctx.resume()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.destination)
      const now = ctx.currentTime
      g.gain.setValueAtTime(vol, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      o.start(now)
      o.stop(now + dur)
    } catch {
      /* 忽略音频异常 */
    }
  }

  // ---------- 覆盖层（开始 / 过关 / 失败）----------

  private showOverlay(title: string, lines: string[], btnLabel: string, onBtn: () => void) {
    this.clearOverlay()
    const layer = this.add.container(0, 0).setDepth(30)
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6)
    const t = this.mkText(W / 2, H / 2 - 78, title, {
      fontFamily: 'sans-serif',
      fontSize: '40px',
      color: '#ffd447',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    const body = this.mkText(W / 2, H / 2 - 6, lines.join('\n'), {
      fontFamily: 'sans-serif',
      fontSize: '19px',
      color: '#f5e9d6',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5)
    const btn = this.add
      .rectangle(W / 2, H / 2 + 88, 220, 58, 0xffd447)
      .setInteractive({ useHandCursor: true })
    const btnTxt = this.mkText(W / 2, H / 2 + 88, btnLabel, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#1a120b',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    btn.on('pointerover', () => btn.setFillStyle(0xffe27a))
    btn.on('pointerout', () => btn.setFillStyle(0xffd447))
    // 走 onAction 统一入口：场景级 pointerdown 与按钮自身 pointerdown 都可能触发，
    // onAction 内部消费后即置空，保证只执行一次
    btn.on('pointerdown', () => this.onAction())
    layer.add([bg, t, body, btn, btnTxt])
    this.overlay = layer
    this.overlayAction = onBtn
  }

  private clearOverlay() {
    this.overlay?.destroy()
    this.overlay = null
    this.overlayAction = null
  }

  private showStart() {
    this.showOverlay(
      '⛏️ 黄金矿工',
      ['Phaser 4 引擎版', '摆动爪子 → 抓金块 / 钻石', '在时限内达到目标金额即可过关'],
      '开始挖矿',
      () => this.startNewGame(),
    )
  }

  private endLevel() {
    if (this.money >= this.goal(this.level)) {
      if (this.level >= MAX_LEVEL) {
        this.state = 'win'
        this.showOverlay('🏆 全部通关！', [`最终资产 ¥${this.money}`], '再玩一次', () => this.startNewGame())
      } else {
        this.state = 'levelclear'
        this.showOverlay(
          `第 ${this.level} 关 达成！`,
          [`目标 ¥${this.goal(this.level)} · 实得 ¥${this.money}`, '准备进入下一关'],
          `进入第 ${this.level + 1} 关`,
          () => this.startLevel(this.level + 1),
        )
      }
    } else {
      this.state = 'gameover'
      this.showOverlay(
        '💥 未达标',
        [`目标 ¥${this.goal(this.level)} · 实得 ¥${this.money}`, '再试一次吧'],
        '重新开始',
        () => this.startNewGame(),
      )
    }
  }
}
