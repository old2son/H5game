import { GROUND_Y, PIVOT, VIEW_H, VIEW_W } from './config'
import type { GameObject } from './types'

const TAU = Math.PI * 2

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

/** 土层里的碎石纹理，只生成一次 */
const DIRT_SPECKS = (() => {
  const rnd = mulberry32(20240831)
  const list: { x: number; y: number; r: number; a: number }[] = []
  for (let i = 0; i < 420; i++) {
    list.push({
      x: rnd() * VIEW_W,
      y: GROUND_Y + 12 + rnd() * (VIEW_H - GROUND_Y - 12),
      r: 1 + rnd() * 3.2,
      a: 0.08 + rnd() * 0.22,
    })
  }
  return list
})()

const CLOUDS = (() => {
  const rnd = mulberry32(777)
  return [0, 1, 2].map((index) => ({
    x: 120 + index * 330 + rnd() * 60,
    y: 34 + rnd() * 46,
    s: 0.7 + rnd() * 0.6,
    speed: 6 + rnd() * 10,
  }))
})()

export function drawBackground(ctx: CanvasRenderingContext2D, time: number) {
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
  sky.addColorStop(0, '#7ec8f5')
  sky.addColorStop(0.65, '#b6e3fb')
  sky.addColorStop(1, '#e6f6ff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, GROUND_Y)

  // 云
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (const cloud of CLOUDS) {
    const x = (cloud.x + time * cloud.speed) % (VIEW_W + 220) - 110
    ctx.save()
    ctx.translate(x, cloud.y)
    ctx.scale(cloud.s, cloud.s)
    ctx.beginPath()
    ctx.arc(0, 0, 20, 0, TAU)
    ctx.arc(22, 6, 15, 0, TAU)
    ctx.arc(-22, 6, 14, 0, TAU)
    ctx.arc(6, -12, 16, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  // 草地
  ctx.fillStyle = '#57a83a'
  ctx.fillRect(0, GROUND_Y - 16, VIEW_W, 20)
  ctx.fillStyle = '#3f8527'
  ctx.fillRect(0, GROUND_Y + 4, VIEW_W, 6)

  // 洞口（矿工脚下）
  ctx.fillStyle = '#2b1708'
  ctx.beginPath()
  ctx.ellipse(PIVOT.x, GROUND_Y + 18, 78, 16, 0, 0, TAU)
  ctx.fill()

  // 土层
  const dirt = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H)
  dirt.addColorStop(0, '#8b5a2d')
  dirt.addColorStop(0.45, '#6d4322')
  dirt.addColorStop(1, '#3a2311')
  ctx.fillStyle = dirt
  ctx.fillRect(0, GROUND_Y + 8, VIEW_W, VIEW_H - GROUND_Y - 8)

  // 层理线
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'
  ctx.lineWidth = 2
  for (let i = 1; i <= 4; i++) {
    const y = GROUND_Y + 60 + i * 88
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= VIEW_W; x += 40) {
      ctx.lineTo(x, y + Math.sin((x + i * 90) / 90) * 6)
    }
    ctx.stroke()
  }

  // 碎石
  for (const speck of DIRT_SPECKS) {
    ctx.globalAlpha = speck.a
    ctx.fillStyle = speck.a > 0.2 ? '#c99a63' : '#2c1a0b'
    ctx.beginPath()
    ctx.arc(speck.x, speck.y, speck.r, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // 底部暗角
  const vignette = ctx.createLinearGradient(0, VIEW_H - 120, 0, VIEW_H)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, VIEW_H - 120, VIEW_W, 120)
}

function blobPath(ctx: CanvasRenderingContext2D, radius: number, shape: number[]) {
  const n = shape.length
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const index = i % n
    const angle = (index / n) * TAU
    const r = radius * shape[index]
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawGold(ctx: CanvasRenderingContext2D, item: GameObject) {
  const r = item.radius
  blobPath(ctx, r, item.shape)
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.15)
  grad.addColorStop(0, '#fff7b8')
  grad.addColorStop(0.35, '#ffd447')
  grad.addColorStop(0.75, '#e39b13')
  grad.addColorStop(1, '#9c5f04')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#8a5202'
  ctx.stroke()

  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.32, -r * 0.36, r * 0.26, r * 0.15, -0.5, 0, TAU)
  ctx.fill()
  // 内部纹路
  ctx.strokeStyle = 'rgba(140,84,0,0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-r * 0.1, r * 0.1)
  ctx.lineTo(r * 0.3, r * 0.35)
  ctx.stroke()
}

function drawRock(ctx: CanvasRenderingContext2D, item: GameObject) {
  const r = item.radius
  blobPath(ctx, r, item.shape)
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1)
  grad.addColorStop(0, '#cfc9c0')
  grad.addColorStop(0.5, '#9a938a')
  grad.addColorStop(1, '#5f5a53')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#403c37'
  ctx.stroke()

  const rnd = mulberry32(item.seed)
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  for (let i = 0; i < 6; i++) {
    const a = rnd() * TAU
    const d = rnd() * r * 0.6
    ctx.beginPath()
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1 + rnd() * 2.2, 0, TAU)
    ctx.fill()
  }
}

function drawDiamond(ctx: CanvasRenderingContext2D, item: GameObject, time: number) {
  const r = item.radius
  const top = -r * 1.15
  const mid = -r * 0.25
  const bottom = r * 1.1
  const half = r

  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.lineTo(half, mid)
  ctx.lineTo(0, bottom)
  ctx.lineTo(-half, mid)
  ctx.closePath()
  const grad = ctx.createLinearGradient(-half, top, half, bottom)
  grad.addColorStop(0, '#eafcff')
  grad.addColorStop(0.45, '#7fe3f7')
  grad.addColorStop(1, '#2ea8d8')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 1.6
  ctx.strokeStyle = '#1b7fa8'
  ctx.stroke()

  // 切面
  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.lineTo(-half, mid)
  ctx.lineTo(0, mid)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, mid)
  ctx.lineTo(-half, mid)
  ctx.lineTo(0, bottom)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fill()

  // 闪光
  const twinkle = (Math.sin(time * 4 + item.seed) + 1) / 2
  ctx.globalAlpha = 0.35 + twinkle * 0.65
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-r * 1.5, -r * 0.1)
  ctx.lineTo(r * 1.5, -r * 0.1)
  ctx.moveTo(-r * 0.1, -r * 1.5)
  ctx.lineTo(-r * 0.1, r * 1.5)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawBag(ctx: CanvasRenderingContext2D, item: GameObject) {
  const r = item.radius
  // 袋身绘制范围是 -1.05r ~ +1.35r，整体下移一点让视觉中心和碰撞圆心重合
  ctx.translate(0, -r * 0.15)
  ctx.beginPath()
  ctx.moveTo(-r * 0.45, -r * 0.7)
  ctx.quadraticCurveTo(-r * 1.15, r * 0.35, -r * 0.85, r * 0.95)
  ctx.quadraticCurveTo(0, r * 1.35, r * 0.85, r * 0.95)
  ctx.quadraticCurveTo(r * 1.15, r * 0.35, r * 0.45, -r * 0.7)
  ctx.closePath()
  const grad = ctx.createLinearGradient(-r, -r, r, r)
  grad.addColorStop(0, '#c58a4e')
  grad.addColorStop(0.6, '#9c6231')
  grad.addColorStop(1, '#6d3f1b')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#4f2c11'
  ctx.stroke()

  // 袋口
  ctx.fillStyle = '#7d4a20'
  ctx.fillRect(-r * 0.5, -r * 1.05, r, r * 0.42)
  ctx.strokeStyle = '#4f2c11'
  ctx.strokeRect(-r * 0.5, -r * 1.05, r, r * 0.42)

  ctx.fillStyle = '#ffe27a'
  ctx.font = `bold ${Math.round(r * 1.05)}px "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', 0, r * 0.28)
}

function drawTnt(ctx: CanvasRenderingContext2D, item: GameObject, time: number) {
  const r = item.radius
  const w = r * 1.5
  const h = r * 1.9

  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 4)
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  grad.addColorStop(0, '#a5201d')
  grad.addColorStop(0.45, '#e2443a')
  grad.addColorStop(1, '#8d1810')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#5e0f0b'
  ctx.stroke()

  ctx.fillStyle = '#2c2c2c'
  ctx.fillRect(-w / 2, -h * 0.22, w, h * 0.16)
  ctx.fillRect(-w / 2, h * 0.14, w, h * 0.16)

  ctx.fillStyle = '#fff4d6'
  ctx.font = `bold ${Math.round(r * 0.62)}px "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TNT', 0, h * 0.02)

  // 引线与火花
  ctx.strokeStyle = '#d8c9a3'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, -h / 2)
  ctx.quadraticCurveTo(r * 0.7, -h * 0.85, r * 0.4, -h * 1.05)
  ctx.stroke()

  const flicker = 0.6 + Math.sin(time * 18 + item.seed) * 0.4
  ctx.fillStyle = `rgba(255,${Math.round(140 + flicker * 90)},40,0.95)`
  ctx.beginPath()
  ctx.arc(r * 0.4, -h * 1.08, 3 + flicker * 2.4, 0, TAU)
  ctx.fill()
}

function drawBone(ctx: CanvasRenderingContext2D, item: GameObject) {
  const r = item.radius
  ctx.fillStyle = '#f6f1e2'
  ctx.strokeStyle = '#b9ae95'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-r * 0.85, -r * 0.22, r * 1.7, r * 0.44, r * 0.2)
  ctx.fill()
  ctx.stroke()
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(side * r * 0.85, -r * 0.3, r * 0.32, 0, TAU)
    ctx.arc(side * r * 0.85, r * 0.3, r * 0.32, 0, TAU)
    ctx.fill()
    ctx.stroke()
  }
}

function drawMouse(ctx: CanvasRenderingContext2D, item: GameObject, time: number) {
  const r = item.radius
  const dir = (item.vx ?? 1) >= 0 ? 1 : -1
  ctx.scale(dir, 1)

  // 尾巴
  ctx.strokeStyle = '#c79b98'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-r * 0.85, r * 0.2)
  ctx.quadraticCurveTo(-r * 1.7, r * 0.1, -r * 1.5, -r * 0.55)
  ctx.stroke()

  // 身体
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.72, 0, 0, TAU)
  const grad = ctx.createLinearGradient(0, -r, 0, r)
  grad.addColorStop(0, '#d8d3cf')
  grad.addColorStop(1, '#8d8683')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 1.6
  ctx.strokeStyle = '#5f5956'
  ctx.stroke()

  // 耳朵
  ctx.beginPath()
  ctx.arc(r * 0.15, -r * 0.6, r * 0.42, 0, TAU)
  ctx.fillStyle = '#b6aea9'
  ctx.fill()
  ctx.stroke()

  // 眼睛与鼻子
  ctx.fillStyle = '#22201f'
  ctx.beginPath()
  ctx.arc(r * 0.55, -r * 0.15, r * 0.13, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#f0788a'
  ctx.beginPath()
  ctx.arc(r * 0.95, r * 0.05, r * 0.16, 0, TAU)
  ctx.fill()

  // 叼着的钻石
  const bob = Math.sin(time * 6 + item.seed) * 1.5
  ctx.save()
  ctx.translate(r * 1.15, r * 0.35 + bob)
  ctx.beginPath()
  ctx.moveTo(0, -6)
  ctx.lineTo(5, -1)
  ctx.lineTo(0, 7)
  ctx.lineTo(-5, -1)
  ctx.closePath()
  ctx.fillStyle = '#7fe3f7'
  ctx.fill()
  ctx.strokeStyle = '#1b7fa8'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

export function drawItem(ctx: CanvasRenderingContext2D, item: GameObject, time: number) {
  ctx.save()
  ctx.translate(item.x, item.y)
  ctx.rotate(item.rot)
  switch (item.type) {
    case 'goldSmall':
    case 'gold':
    case 'goldBig':
    case 'goldHuge':
      drawGold(ctx, item)
      break
    case 'rockSmall':
    case 'rock':
      drawRock(ctx, item)
      break
    case 'diamond':
      drawDiamond(ctx, item, time)
      break
    case 'bag':
      drawBag(ctx, item)
      break
    case 'tnt':
      drawTnt(ctx, item, time)
      break
    case 'bone':
      drawBone(ctx, item)
      break
    case 'mouse':
      drawMouse(ctx, item, time)
      break
  }
  ctx.restore()
}

/** 矿工：身体固定，手臂随绳索角度摆动 */
export function drawMiner(ctx: CanvasRenderingContext2D, angle: number, time: number, powered: boolean) {
  const footY = GROUND_Y + 6
  const breathe = Math.sin(time * 2.2) * 1.2

  ctx.save()
  ctx.translate(PIVOT.x, 0)

  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, footY + 2, 34, 7, 0, 0, TAU)
  ctx.fill()

  // 腿
  ctx.fillStyle = '#2f4a86'
  ctx.fillRect(-16, footY - 34, 12, 34)
  ctx.fillRect(4, footY - 34, 12, 34)
  ctx.fillStyle = '#1d2f57'
  ctx.fillRect(-20, footY - 6, 20, 8)
  ctx.fillRect(2, footY - 6, 20, 8)

  // 身体
  const bodyY = footY - 34 - 40 + breathe
  ctx.beginPath()
  ctx.roundRect(-24, bodyY, 48, 44, 10)
  const bodyGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + 44)
  bodyGrad.addColorStop(0, '#4a6fc4')
  bodyGrad.addColorStop(1, '#2b4382')
  ctx.fillStyle = bodyGrad
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#1d2f57'
  ctx.stroke()

  // 腰带
  ctx.fillStyle = '#6b4a22'
  ctx.fillRect(-24, bodyY + 32, 48, 9)

  // 头
  const headY = bodyY - 22
  ctx.beginPath()
  ctx.arc(0, headY, 20, 0, TAU)
  ctx.fillStyle = '#f3c99a'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#c99a6a'
  ctx.stroke()

  // 眼睛
  ctx.fillStyle = '#2b2118'
  ctx.beginPath()
  ctx.arc(-6.5, headY - 2, 2.4, 0, TAU)
  ctx.arc(6.5, headY - 2, 2.4, 0, TAU)
  ctx.fill()

  // 胡子 + 嘴
  ctx.strokeStyle = '#8a6a45'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, headY + 5, 6, 0.25 * Math.PI, 0.75 * Math.PI)
  ctx.stroke()

  // 安全帽
  ctx.beginPath()
  ctx.arc(0, headY - 6, 21, Math.PI, TAU)
  ctx.closePath()
  ctx.fillStyle = powered ? '#ffd24a' : '#f2b32c'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#b07d12'
  ctx.stroke()
  ctx.fillStyle = powered ? '#ffe589' : '#f2b32c'
  ctx.fillRect(-24, headY - 8, 48, 6)

  // 头灯
  ctx.beginPath()
  ctx.arc(0, headY - 16, 5.5, 0, TAU)
  ctx.fillStyle = '#fff6c9'
  ctx.fill()
  ctx.strokeStyle = '#b07d12'
  ctx.stroke()

  // 手臂：随绳索角度摆动
  // angle 的约定是 θ>0 向右（见 Engine.direction），Canvas y 轴向下，
  // 所以要 rotate(-angle) 手臂才会和绳索指向同一侧
  ctx.save()
  ctx.translate(0, bodyY + 14)
  ctx.rotate(-angle)
  ctx.fillStyle = '#f3c99a'
  ctx.beginPath()
  ctx.roundRect(-6, 0, 12, 30, 6)
  ctx.fill()
  ctx.strokeStyle = '#c99a6a'
  ctx.stroke()
  ctx.restore()

  ctx.restore()

  // 支架与滑轮
  ctx.save()
  ctx.translate(PIVOT.x, PIVOT.y)
  ctx.fillStyle = '#6b4a22'
  ctx.fillRect(-4, -30, 8, 34)
  ctx.beginPath()
  ctx.arc(0, 0, 9, 0, TAU)
  ctx.fillStyle = '#4a3a2a'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#2b2118'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 3.5, 0, TAU)
  ctx.fillStyle = '#c9a97a'
  ctx.fill()
  ctx.restore()
}

/** 绳索 + 爪子，坐标系已旋转到绳索方向。closed 表示抓到了东西，两爪收拢 */
export function drawHook(ctx: CanvasRenderingContext2D, length: number, closed = false) {
  // 绳
  ctx.strokeStyle = '#e0cf9f'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, length)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(90,60,20,0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, length)
  ctx.stroke()

  ctx.save()
  ctx.translate(0, length)

  // 爪头
  ctx.beginPath()
  ctx.roundRect(-6, -8, 12, 12, 3)
  ctx.fillStyle = '#b8bcc4'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#5b6069'
  ctx.stroke()

  // 两只爪：张开时是外八，抓到东西时向内收拢夹住猎物
  const spread = closed ? 0.55 : 1
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    const ctrlX = side * (4 + 12 * spread)
    const endX = side * (2 + 11 * spread)
    ctx.strokeStyle = '#8f959e'
    ctx.beginPath()
    ctx.moveTo(side * 4, 0)
    ctx.quadraticCurveTo(ctrlX, 10 + 4 * (1 - spread), endX, 22 - 4 * (1 - spread))
    ctx.stroke()
    ctx.strokeStyle = '#c3c9d2'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.lineWidth = 5
  }
  ctx.restore()
}
