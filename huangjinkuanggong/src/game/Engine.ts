import {
  CLAW_GRAB_OFFSET,
  CLAW_TIP_OFFSET,
  EMPTY_RETRACT,
  LEVEL_TIME,
  MAX_ANGLE,
  MAX_LEVEL,
  MAX_ROPE,
  MIN_LEN,
  PIVOT,
  SHOP_ITEMS,
  SHOOT_SPEED,
  VIEW_H,
  VIEW_W,
  emptyBuffs,
  levelTarget,
  swingSpeedFor,
} from './config'
import { sfx } from './audio'
import { drawBackground, drawHook, drawItem, drawMiner } from './draw'
import { generateItems } from './items'
import type { Buffs, FloatText, GameSnapshot, GameStatus, GameObject, HookState, Particle } from './types'

const TAU = Math.PI * 2

export interface EngineOptions {
  onState?: (snapshot: GameSnapshot) => void
}

export class GoldMinerEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private raf = 0
  private lastTime = 0
  private time = 0
  private clock = 0
  private options: EngineOptions

  status: GameStatus = 'ready'
  level = 1
  money = 0
  target = 650
  dynamite = 0
  overtime = false
  buffs: Buffs = emptyBuffs()
  purchased: Record<string, number> = {}

  private items: GameObject[] = []
  private particles: Particle[] = []
  private texts: FloatText[] = []
  private shake = 0
  private swingSpeed = swingSpeedFor(1)
  private lastTickSecond = -1

  private hook: { state: HookState; length: number; angle: number; phase: number; grabbed: GameObject | null } = {
    state: 'swing',
    length: MIN_LEN,
    angle: 0,
    phase: 0,
    grabbed: null,
  }

  private snapshotCache = ''
  private onState?: (snapshot: GameSnapshot) => void

  constructor(canvas: HTMLCanvasElement, options: EngineOptions = {}) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文')
    this.canvas = canvas
    this.ctx = ctx
    this.options = options
    this.onState = options.onState
    this.resize()
    this.items = generateItems(1, false)
    this.target = levelTarget(1)
    this.loop = this.loop.bind(this)
    this.lastTime = performance.now()
    this.raf = requestAnimationFrame(this.loop)
    this.emit(true)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(VIEW_W * this.dpr)
    this.canvas.height = Math.round(VIEW_H * this.dpr)
  }

  // ---------------------------------------------------------------- 生命周期

  startGame() {
    this.level = 1
    this.money = 0
    this.dynamite = 0
    this.buffs = emptyBuffs()
    this.purchased = {}
    this.startLevel()
  }

  private startLevel() {
    this.items = generateItems(this.level, this.buffs.clover)
    this.target = levelTarget(this.level)
    this.time = LEVEL_TIME
    this.overtime = false
    this.lastTickSecond = -1
    this.swingSpeed = swingSpeedFor(this.level)
    this.particles = []
    this.texts = []
    this.hook = { state: 'swing', length: MIN_LEN, angle: 0, phase: 0, grabbed: null }
    this.status = 'playing'
    this.emit(true)
  }

  nextLevel() {
    if (this.level >= MAX_LEVEL) {
      this.status = 'win'
      sfx.levelUp()
      this.emit(true)
      return
    }
    this.level += 1
    this.startLevel()
    // buff 只作用于购买后的下一关，进入关卡后即消耗
    this.buffs = emptyBuffs()
  }

  pause() {
    if (this.status === 'playing') {
      this.status = 'paused'
      this.emit(true)
    }
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'playing'
      this.emit(true)
    }
  }

  togglePause() {
    if (this.status === 'playing') this.pause()
    else if (this.status === 'paused') this.resume()
  }

  // ---------------------------------------------------------------- 操作

  shoot() {
    if (this.status !== 'playing') return
    if (this.overtime) return
    if (this.hook.state !== 'swing') return
    sfx.unlock()
    this.hook.state = 'shoot'
    sfx.shoot()
    this.emit(true)
  }

  useDynamite() {
    if (this.status !== 'playing') return
    if (this.dynamite <= 0) return
    if (this.hook.state !== 'retract' || !this.hook.grabbed) return
    this.dynamite -= 1
    const item = this.hook.grabbed
    if (item.type === 'tnt') {
      this.explode(item.x, item.y, 130)
    } else {
      this.burst(item.x, item.y, item.type.startsWith('gold') ? '#ffd447' : '#a8a29a', 22)
      this.removeItem(item)
    }
    this.hook.grabbed = null
    sfx.boom()
    this.shake = 0.45
    this.emit(true)
  }

  buy(key: string): boolean {
    const def = SHOP_ITEMS.find((item) => item.key === key)
    if (!def) return false
    const bought = this.purchased[key] ?? 0
    if (bought >= def.max) return false
    if (this.money < def.price) return false
    this.money -= def.price
    this.purchased[key] = bought + 1
    if (key === 'dynamite') this.dynamite += 1
    if (key === 'strength') this.buffs.strength = true
    if (key === 'stoneBook') this.buffs.stoneBook = true
    if (key === 'clover') this.buffs.clover = true
    sfx.coin(300)
    this.emit(true)
    return true
  }

  // ---------------------------------------------------------------- 主循环

  private loop(now: number) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    if (this.status === 'playing') this.update(dt)
    this.clock += dt
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt)
    this.updateEffects(dt)
    this.render()
    this.emit(false)
    this.raf = requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    if (!this.overtime) {
      this.time -= dt
      const second = Math.ceil(this.time)
      if (second <= 5 && second > 0 && second !== this.lastTickSecond) {
        this.lastTickSecond = second
        sfx.tick()
      }
      if (this.time <= 0) {
        this.time = 0
        if (this.hook.state === 'retract' && this.hook.grabbed) {
          // 时间到了但还在往回拉，给一次“最后一抓”的机会
          this.overtime = true
        } else {
          this.finishLevel()
          return
        }
      }
    }

    this.updateMice(dt)
    this.updateHook(dt)
  }

  private updateMice(dt: number) {
    for (const item of this.items) {
      if (item.type !== 'mouse' || item.grabbed) continue
      const speed = item.vx ?? 40
      item.x += speed * dt
      if (item.x < 46) {
        item.x = 46
        item.vx = Math.abs(speed)
      } else if (item.x > VIEW_W - 46) {
        item.x = VIEW_W - 46
        item.vx = -Math.abs(speed)
      }
      item.rot = Math.sin(item.x / 30) * 0.08
    }
  }

  private maxReach(): number {
    const { x: dx, y: dy } = this.direction()
    // 边界要按爪尖算，不然爪尖会捅出画布
    let max = MAX_ROPE
    if (dy > 0.001) max = Math.min(max, (VIEW_H - 18 - CLAW_TIP_OFFSET - PIVOT.y) / dy)
    if (dx > 0.001) max = Math.min(max, (VIEW_W - 14 - CLAW_TIP_OFFSET - PIVOT.x) / dx)
    if (dx < -0.001) max = Math.min(max, (14 + CLAW_TIP_OFFSET - PIVOT.x) / dx)
    return Math.max(max, MIN_LEN + 40)
  }

  private updateHook(dt: number) {
    const hook = this.hook
    if (hook.state === 'swing') {
      hook.phase += this.swingSpeed * dt
      hook.angle = Math.sin(hook.phase) * MAX_ANGLE
      hook.length = MIN_LEN
      return
    }

    if (hook.state === 'shoot') {
      const remain = SHOOT_SPEED * dt
      // 分步推进，避免高速穿透
      const steps = Math.max(1, Math.ceil(remain / 6))
      const stepLen = remain / steps
      for (let i = 0; i < steps; i++) {
        hook.length += stepLen
        const target = this.hitTest()
        if (target) {
          target.grabbed = true
          hook.grabbed = target
          hook.state = 'retract'
          sfx.grab()
          this.emit(true)
          return
        }
        if (hook.length >= this.maxReach()) {
          hook.state = 'retract'
          return
        }
      }
      return
    }

    // retract
    const weight = hook.grabbed ? hook.grabbed.weight : 0
    let speed = weight === 0 ? EMPTY_RETRACT : 620 / (1 + weight * 0.42)
    speed = Math.max(speed, 52)
    if (this.buffs.strength) speed *= 1.45
    hook.length -= speed * dt

    if (hook.grabbed) {
      // 不再瞬移：爪子收紧，物品平滑归位到爪子上（约 0.1s）
      const hold = this.holdPosition(hook.grabbed)
      const k = Math.min(1, dt * 14)
      hook.grabbed.x += (hold.x - hook.grabbed.x) * k
      hook.grabbed.y += (hold.y - hook.grabbed.y) * k
    }

    if (hook.length <= MIN_LEN) {
      hook.length = MIN_LEN
      this.resolveCatch()
    }
  }

  /**
   * 抓取判定：用爪子"怀抱"中心（而不是绳索末端）作为判定点，
   * 判定半径也收紧到物品本体大小，避免爪子擦个边就把东西吸走。
   */
  private hitTest(): GameObject | null {
    const grab = this.clawPoint(CLAW_GRAB_OFFSET)
    let best: GameObject | null = null
    let bestDist = Infinity
    for (const item of this.items) {
      if (item.grabbed) continue
      const dist = Math.hypot(item.x - grab.x, item.y - grab.y)
      if (dist < item.radius * 0.85 + 6 && dist < bestDist) {
        best = item
        bestDist = dist
      }
    }
    return best
  }

  /** 物品被抓住后应该待的位置：爪尖抱住它 */
  private holdPosition(item: GameObject) {
    return this.clawPoint(CLAW_GRAB_OFFSET + item.radius * 0.3)
  }

  private resolveCatch() {
    const item = this.hook.grabbed
    this.hook.state = 'swing'
    this.hook.grabbed = null

    if (this.overtime) {
      if (item) this.collect(item)
      this.finishLevel()
      return
    }
    if (item) this.collect(item)
  }

  private collect(item: GameObject) {
    if (item.type === 'tnt') {
      // 拉到地面爆炸，炸掉坑口附近的矿藏，什么也拿不到
      this.explode(item.x, item.y, 150)
      this.removeItem(item)
      return
    }

    let value = item.type === 'bag' ? (item.bagValue ?? 20) : item.value
    if ((item.type === 'rock' || item.type === 'rockSmall') && this.buffs.stoneBook) value *= 4

    this.money += value
    this.texts.push({
      x: item.x,
      y: item.y - 26,
      vy: -34,
      life: 1.2,
      text: `+${value}`,
      color: value >= 250 ? '#ffd447' : value >= 100 ? '#ffe9a8' : '#d8d3cf',
      size: value >= 250 ? 30 : 24,
    })

    if (item.type.startsWith('gold') || item.type === 'diamond' || item.type === 'bag') {
      sfx.coin(value)
      this.burst(item.x, item.y, '#ffd447', 16)
    } else {
      sfx.rock()
      this.burst(item.x, item.y, '#a8a29a', 12)
    }
    this.removeItem(item)
  }

  private removeItem(item: GameObject) {
    const index = this.items.indexOf(item)
    if (index >= 0) this.items.splice(index, 1)
  }

  private finishLevel() {
    this.overtime = false
    this.hook.grabbed = null
    this.hook.state = 'swing'
    if (this.money >= this.target) {
      if (this.level >= MAX_LEVEL) {
        this.status = 'win'
        sfx.levelUp()
      } else {
        this.status = 'shop'
        sfx.levelUp()
      }
    } else {
      this.status = 'gameover'
      sfx.fail()
    }
    this.emit(true)
  }

  // ---------------------------------------------------------------- 特效

  /** 绳索方向上的某个点：extra 是相对绳索末端的偏移 */
  private clawPoint(extra = 0) {
    const dir = this.direction()
    const len = this.hook.length + extra
    return { x: PIVOT.x + dir.x * len, y: PIVOT.y + dir.y * len }
  }

  private tipPosition() {
    return this.clawPoint(0)
  }

  /**
   * 绳索方向（单位向量）。约定：angle > 0 时爪子偏右（x 增大），angle = 0 时垂直向下。
   * 渲染端必须传 -angle 给 ctx.rotate，才能和这里的方向对上。
   */
  private direction() {
    return { x: Math.sin(this.hook.angle), y: Math.cos(this.hook.angle) }
  }

  private burst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU
      const speed = 40 + Math.random() * 190
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 2 + Math.random() * 3.5,
        color,
        gravity: 420,
      })
    }
  }

  private explode(x: number, y: number, radius: number) {
    sfx.boom()
    this.shake = 0.55
    for (let i = 0; i < 46; i++) {
      const angle = Math.random() * TAU
      const speed = 80 + Math.random() * 320
      const warm = Math.random() > 0.4
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.55,
        maxLife: 1,
        size: 3 + Math.random() * 5,
        color: warm ? '#ff9a3c' : '#5a5148',
        gravity: 260,
      })
    }
    for (const item of [...this.items]) {
      if (Math.hypot(item.x - x, item.y - y) <= radius + item.radius) {
        this.burst(item.x, item.y, '#8a7f70', 10)
        this.removeItem(item)
      }
    }
    this.texts.push({ x, y: y - 30, vy: -30, life: 1.1, text: 'BOOM!', color: '#ff8a3c', size: 34 })
  }

  private updateEffects(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]
      t.life -= dt
      if (t.life <= 0) {
        this.texts.splice(i, 1)
        continue
      }
      t.y += t.vy * dt
      t.vy *= 0.94
    }
  }

  // ---------------------------------------------------------------- 渲染

  private render() {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, VIEW_W, VIEW_H)

    if (this.shake > 0) {
      const power = this.shake * 14
      ctx.translate((Math.random() - 0.5) * power, (Math.random() - 0.5) * power)
    }

    drawBackground(ctx, this.clock)

    for (const item of this.items) drawItem(ctx, item, this.clock)

    // 绳索与爪子
    // 注意：Canvas 的 y 轴向下，ctx.rotate(θ) 会把局部的 +y 方向转到 (-sinθ, cosθ)，
    // 而 direction() 约定的是 (sinθ, cosθ)（θ>0 向右）。所以这里必须传 -angle，
    // 否则画出来的爪子会和抓取判定点左右镜像 —— 也就是"虚空抓取"的根因。
    ctx.save()
    ctx.translate(PIVOT.x, PIVOT.y)
    ctx.rotate(-this.hook.angle)
    drawHook(ctx, this.hook.length, !!this.hook.grabbed)
    ctx.restore()

    drawMiner(ctx, this.hook.angle, this.clock, this.buffs.strength)

    // 粒子
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // 飘字
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life))
      ctx.font = `bold ${t.size}px "Segoe UI", system-ui, sans-serif`
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.strokeText(t.text, t.x, t.y)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, t.x, t.y)
    }
    ctx.globalAlpha = 1

    if (this.overtime) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 246, VIEW_W, 52)
      ctx.fillStyle = '#ffd447'
      ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif'
      ctx.fillText('时间到 · 最后一抓！', VIEW_W / 2, 272)
    }
  }

  // ---------------------------------------------------------------- 状态同步

  private emit(force: boolean) {
    if (!this.onState) return
    const snapshot: GameSnapshot = {
      status: this.status,
      level: this.level,
      money: this.money,
      target: this.target,
      time: Math.ceil(this.time),
      dynamite: this.dynamite,
      overtime: this.overtime,
      buffs: { ...this.buffs },
      purchased: { ...this.purchased },
      canDynamite: this.hook.state === 'retract' && !!this.hook.grabbed,
    }
    const key = `${snapshot.status}|${snapshot.level}|${snapshot.money}|${snapshot.target}|${snapshot.time}|${snapshot.dynamite}|${snapshot.overtime}|${snapshot.canDynamite}`
    if (!force && key === this.snapshotCache) return
    this.snapshotCache = key
    this.onState(snapshot)
  }

  /** 输入坐标换算（CSS 像素 -> 逻辑坐标） */
  toLogical(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H,
    }
  }
}
