import * as Phaser from 'phaser'

/** 逻辑画布尺寸（与 phaser.html 中 CSS 自适应缩放匹配） */
const W = 960
const H = 600

/** 绳索悬挂点（矿井顶部卷扬机位置） */
const PIVOT = { x: W / 2, y: 150 }

const MIN_LEN = 34
const MAX_ROPE = 660
const MAX_ANGLE = 1.4 // 约 80°
const SWING_SPEED = 1.7 // 摆动相位速度 rad/s
const SHOOT_SPEED = 640 // 爪子伸出速度 px/s
const RETRACT_BASE = 540 // 回收基础速度（除以重量）
const EMPTY_RETRACT = 780 // 空钩回收速度
const BOMB_RETRACT = 920 // 丢炸药后快速回收
const GRAB_PAD = 5 // 抓取判定额外容差
const LEVEL_TIME = 60 // 每关秒数
const MAX_LEVEL = 8

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
  private audioCtx?: AudioContext

  constructor() {
    super('game')
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a120b')
    this.bgGfx = this.add.graphics().setDepth(0)
    this.drawBackground()
    this.drawMiner()

    this.fx = this.add.graphics().setDepth(8)
    this.makeTextures()

    const style = { fontFamily: 'sans-serif', fontSize: '20px', color: '#ffe9a8' } as const
    this.txtMoney = this.add.text(20, 14, '', style).setDepth(20)
    this.txtGoal = this.add.text(20, 42, '', { ...style, fontSize: '15px', color: '#c9b48f' }).setDepth(20)
    this.txtTime = this.add
      .text(W / 2, 14, '', { ...style, fontSize: '22px', color: '#fff' })
      .setOrigin(0.5, 0)
      .setDepth(20)
    this.txtLevel = this.add
      .text(W - 20, 14, '', { ...style, fontSize: '18px', color: '#ffd447' })
      .setOrigin(1, 0)
      .setDepth(20)
    this.txtHint = this.add
      .text(W / 2, H - 26, '空格 / 点击 放爪    ·    X 丢弃石头或炸药', {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#d8c7a3',
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.hook = { angle: 0, length: MIN_LEN, state: 'swing', grabbed: null, retractSpeed: RETRACT_BASE }

    // 输入
    this.input.on('pointerdown', () => this.onAction())
    this.input.keyboard?.on('keydown-SPACE', () => this.onAction())
    this.input.keyboard?.on('keydown-X', () => this.onBomb())

    this.showStart()
  }

  // ---------- 资源生成（零素材，运行时绘制纹理）----------

  private makeTextures() {
    for (const [type, def] of Object.entries(DEFS)) {
      const pad = 6
      const size = (def.r + pad) * 2
      const c = def.r + pad
      const g = this.make.graphics({ x: 0, y: 0 }, false)
      if (def.kind === 'gold') this.drawGold(g, c, def.r, def.color)
      else if (def.kind === 'rock') this.drawRock(g, c, def.r, def.color)
      else if (def.kind === 'diamond') this.drawDiamond(g, c, def.r, def.color)
      else if (def.kind === 'bag') this.drawBag(g, c, def.r, def.color)
      else if (def.kind === 'tnt') this.drawTnt(g, c, def.r, def.color)
      g.generateTexture('item-' + type, size, size)
      g.destroy()
    }
  }

  private drawGold(g: Phaser.GameObjects.Graphics, c: number, r: number, color: number) {
    g.fillStyle(0x8a5a12, 1)
    g.fillCircle(c, c + 2, r)
    g.fillStyle(color, 1)
    g.fillCircle(c, c, r)
    g.fillStyle(0xffffff, 0.35)
    g.fillCircle(c - r * 0.32, c - r * 0.32, r * 0.34)
  }

  private drawRock(g: Phaser.GameObjects.Graphics, c: number, r: number, color: number) {
    g.fillStyle(0x4a463f, 1)
    g.fillCircle(c, c + 2, r)
    g.fillStyle(color, 1)
    g.fillCircle(c, c, r)
    g.fillStyle(0x000000, 0.18)
    g.fillCircle(c + r * 0.3, c + r * 0.25, r * 0.4)
    g.fillStyle(0xffffff, 0.16)
    g.fillCircle(c - r * 0.3, c - r * 0.3, r * 0.3)
  }

  private drawDiamond(g: Phaser.GameObjects.Graphics, c: number, r: number, color: number) {
    const pts = (s: number): Phaser.Math.Vector2[] => [
      new Phaser.Math.Vector2(c, c - r * s),
      new Phaser.Math.Vector2(c + r * 0.85 * s, c),
      new Phaser.Math.Vector2(c, c + r * s),
      new Phaser.Math.Vector2(c - r * 0.85 * s, c),
    ]
    g.fillStyle(0x0a6b86, 1)
    g.fillPoints(pts(1.12), true)
    g.fillStyle(color, 1)
    g.fillPoints(pts(1), true)
    g.fillStyle(0xffffff, 0.5)
    g.fillTriangle(c, c - r, c + r * 0.4, c - r * 0.1, c, c)
  }

  private drawBag(g: Phaser.GameObjects.Graphics, c: number, r: number, color: number) {
    g.fillStyle(0x6e3d12, 1)
    g.fillRoundedRect(c - r * 0.85, c - r * 0.7, r * 1.7, r * 1.7, 7)
    g.fillStyle(color, 1)
    g.fillRoundedRect(c - r * 0.78, c - r * 0.55, r * 1.56, r * 1.5, 6)
    g.fillStyle(0x3d2208, 1)
    g.fillRect(c - r * 0.4, c - r * 0.85, r * 0.8, r * 0.3) // 扎口
    g.fillStyle(0xffe27a, 0.9)
    g.fillCircle(c + r * 0.3, c + r * 0.1, r * 0.16) // 金币露头
  }

  private drawTnt(g: Phaser.GameObjects.Graphics, c: number, r: number, color: number) {
    g.fillStyle(0x7a1a12, 1)
    g.fillRoundedRect(c - r * 0.7, c - r + 2, r * 1.4, r * 2, 4)
    g.fillStyle(color, 1)
    g.fillRoundedRect(c - r * 0.66, c - r, r * 1.32, r * 2 - 2, 4)
    g.fillStyle(0xffe27a, 1)
    g.fillRect(c - r * 0.5, c - r * 0.15, r * 1.0, r * 0.3) // 标签带
    g.lineStyle(3, 0x3d2208, 1)
    g.beginPath()
    g.moveTo(c, c - r)
    g.lineTo(c + r * 0.4, c - r - r * 0.55)
    g.strokePath()
    g.fillStyle(0xff8a3d, 1)
    g.fillCircle(c + r * 0.4, c - r - r * 0.55, 3) // 引线头
  }

  // ---------- 背景与矿工 ----------

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
    // 泥土纹理点
    g.fillStyle(0x000000, 0.12)
    for (let i = 0; i < 90; i++) {
      const x = (i * 137) % W
      const y = PIVOT.y + 20 + ((i * 211) % (H - PIVOT.y - 30))
      g.fillCircle(x, y, 3 + (i % 3))
    }
  }

  private drawMiner() {
    const g = this.add.graphics().setDepth(7)
    const x = PIVOT.x
    const y = PIVOT.y
    // 卷扬机架
    g.fillStyle(0x3a2c1c, 1)
    g.fillRect(x - 26, y - 8, 52, 14)
    // 身体
    g.fillStyle(0x2f6fb0, 1)
    g.fillRoundedRect(x - 13, y - 30, 26, 26, 6)
    // 头
    g.fillStyle(0xf2c9a0, 1)
    g.fillCircle(x, y - 38, 12)
    // 头盔
    g.fillStyle(0xffd447, 1)
    g.fillCircle(x, y - 42, 13)
    g.fillRect(x - 14, y - 42, 28, 5)
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
      const x = Phaser.Math.Between(r + 24, W - r - 24)
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
      const sprite = this.add.image(x, y, 'item-' + type).setDepth(5)
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
    const t = this.add
      .text(x, y, text, { fontFamily: 'sans-serif', fontSize: '26px', color, fontStyle: 'bold' })
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
    const t = this.add
      .text(W / 2, H / 2 - 78, title, {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        color: '#ffd447',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    const body = this.add
      .text(W / 2, H / 2 - 6, lines.join('\n'), {
        fontFamily: 'sans-serif',
        fontSize: '19px',
        color: '#f5e9d6',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5)
    const btn = this.add
      .rectangle(W / 2, H / 2 + 88, 220, 58, 0xffd447)
      .setInteractive({ useHandCursor: true })
    const btnTxt = this.add
      .text(W / 2, H / 2 + 88, btnLabel, {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#1a120b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    btn.on('pointerover', () => btn.setFillStyle(0xffe27a))
    btn.on('pointerout', () => btn.setFillStyle(0xffd447))
    btn.on('pointerdown', () => {
      this.clearOverlay()
      onBtn()
    })
    layer.add([bg, t, body, btn, btnTxt])
    this.overlay = layer
  }

  private clearOverlay() {
    this.overlay?.destroy()
    this.overlay = null
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
