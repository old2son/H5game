/* =========================================================================
 * 护眼接接乐 —— Phaser 4 (ESM) H5 小游戏
 * 玩法：限时 60s，小人头顶接盘，左右滑动控制移动，
 *       接住护眼好物加分（偶尔回血），误接伤眼陷阱扣 1 生命。
 *       结束后根据得分生成「近视风险指数报告」。
 *
 * 本模块以 ESM 方式 import Phaser from 'phaser'，不依赖任何本地脚本/CDN。
 * 通过 createEyeCatchGame(container, { onReport }) 与宿主（Vue）通信。
 * ========================================================================= */
import Phaser from 'phaser'

const GAME_W = 420
const GAME_H = 720
const GAME_TIME = 60        // 秒
const MAX_LIVES = 5

// 护眼好物：接住加分
const GOOD_ITEMS = [
  { emoji: '🥕', name: '胡萝卜', points: 10 },
  { emoji: '🥬', name: '绿叶菜', points: 10 },
  { emoji: '🐟', name: '鱼肉',   points: 12 },
  { emoji: '🥚', name: '鸡蛋',   points: 8  },
  { emoji: '🫐', name: '蓝莓',   points: 15 },
  { emoji: '🍊', name: '橙子',   points: 10 },
  { emoji: '🥦', name: '西兰花', points: 11 }
]

// 伤眼陷阱：误接扣命
const BAD_ITEMS = [
  { emoji: '📱', name: '手机',   tip: '近距离盯屏幕最伤眼' },
  { emoji: '📺', name: '电视',   tip: '长时间观看增加用眼负担' },
  { emoji: '🎮', name: '游戏机', tip: '沉迷游戏忽视休息' },
  { emoji: '🍬', name: '糖果',   tip: '高糖饮食不利眼健康' },
  { emoji: '💡', name: '强光',   tip: '强光直射损伤视力' }
]

/* ----------------------------- 音效（Web Audio，无需素材） ------------- */
let audioCtx = null
function ensureAudio () {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) audioCtx = new AC()
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
  } catch (e) { /* ignore */ }
}
function beep (freq, dur, type) {
  if (!audioCtx) return
  try {
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.type = type || 'sine'
    o.frequency.value = freq
    g.gain.value = 0.06
    o.connect(g)
    g.connect(audioCtx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur)
    o.stop(audioCtx.currentTime + dur)
  } catch (e) { /* ignore */ }
}

/* ----------------------------- 游戏场景 -------------------------------- */
class GameScene extends Phaser.Scene {
  constructor () {
    super('game')
    this.onReport = null
    this.onReady = null
    this.created = false
    this._pendingStart = false
  }

  create () {
    this.makeTextures()
    this.createBackground()
    this.createPlayer()
    this.createItems()
    this.createHUD()
    this.setupInput()

    this.isOver = false
    this.running = false
    this.targetX = GAME_W / 2

    // 物理先暂停：开始前不掉落、不碰撞
    this.physics.pause()

    // 生成节奏（running 为 true 时才会掉落）
    this.time.addEvent({ delay: 780, loop: true, callback: this.spawnTick, callbackScope: this })

    this.created = true
    if (this._pendingStart) { this._pendingStart = false; this.startGame() }
    if (this.onReady) this.onReady()
  }

  /* ---- 纹理：小人 + 头顶接盘 / 粒子 ---- */
  makeTextures () {
    const g = this.make.graphics({ add: false })

    // 接盘（圆盘，位于小人头顶）
    g.fillStyle(0xffd27f, 1); g.fillEllipse(40, 18, 72, 24)
    g.fillStyle(0xffe7b3, 1); g.fillEllipse(40, 14, 60, 16)
    // 身体
    g.fillStyle(0x4fc3f7, 1); g.fillRoundedRect(20, 32, 40, 56, 12)
    // 头
    g.fillStyle(0xffe0b2, 1); g.fillCircle(40, 30, 18)
    // 眼睛
    g.fillStyle(0x33414f, 1); g.fillCircle(34, 28, 3); g.fillCircle(46, 28, 3)
    // 微笑
    g.lineStyle(2, 0x33414f, 1); g.beginPath(); g.arc(40, 33, 7, 0.15, Math.PI - 0.15); g.strokePath()
    g.generateTexture('player', 80, 96)
    g.destroy()

    const s = this.make.graphics({ add: false })
    s.fillStyle(0xffffff, 1); s.fillCircle(4, 4, 4)
    s.generateTexture('spark', 8, 8)
    s.destroy()
  }

  /* ---- 背景：天空 + 太阳 + 云 + 地面 ---- */
  createBackground () {
    const g = this.add.graphics()
    g.fillGradientStyle(0xbfe9ff, 0xbfe9ff, 0xeaf7ff, 0xeaf7ff, 1)
    g.fillRect(0, 0, GAME_W, GAME_H)
    g.fillStyle(0xfff3b0, 1); g.fillCircle(GAME_W - 56, 64, 32)
    g.fillStyle(0xffffff, 0.9)
    g.fillEllipse(80, 130, 96, 34); g.fillEllipse(124, 140, 70, 28)
    g.fillEllipse(310, 210, 110, 38)
    g.fillStyle(0xcdeac0, 1); g.fillRect(0, GAME_H - 64, GAME_W, 64)
    g.fillStyle(0xa8d89a, 1); g.fillRect(0, GAME_H - 64, GAME_W, 10)
  }

  /* ---- 玩家 ---- */
  createPlayer () {
    this.player = this.physics.add.sprite(GAME_W / 2, GAME_H - 120, 'player').setDepth(10)
    // 碰撞体主要覆盖“接盘 + 头部”，让接住更贴近头顶托盘
    this.player.body.setSize(72, 48)
    this.player.body.setOffset(4, 0)
    this.player.setCollideWorldBounds(true)

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 70, max: 180 },
      lifespan: 420,
      scale: { start: 0.7, end: 0 },
      tint: 0x43d17a,
      emitting: false
    }).setDepth(12)
  }

  /* ---- 掉落物容器 ---- */
  createItems () {
    this.items = this.add.group()
    this.physics.add.overlap(this.player, this.items, this.onCatch, null, this)
  }

  /* ---- 顶部 HUD ---- */
  createHUD () {
    const style = (size, color) => ({
      fontSize: size, color, fontStyle: 'bold',
      fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif'
    })
    this.livesText = this.add.text(14, 14, '', style('20px', '#fff')).setDepth(50)
    this.livesText.setStroke('#1b3a5b', 4)
    this.scoreText = this.add.text(GAME_W - 14, 14, '', style('20px', '#fff')).setOrigin(1, 0).setDepth(50)
    this.scoreText.setStroke('#1b3a5b', 4)
    this.timerText = this.add.text(GAME_W / 2, 12, '', style('28px', '#fff')).setOrigin(0.5, 0).setDepth(50)
    this.timerText.setStroke('#1b3a5b', 4)
    this.updateHUD()
  }

  /* ---- 输入：滑动 / 拖动 / 键盘 ---- */
  setupInput () {
    this.input.on('pointerdown', (p) => { if (this.running) this.targetX = p.x })
    this.input.on('pointermove', (p) => { if (this.running && p.isDown) this.targetX = p.x })
    this.cursors = this.input.keyboard.createCursorKeys()
  }

  /* ---- 开始 / 重置 ---- */
  startGame () {
    if (!this.created) { this._pendingStart = true; return }
    this.reset()
    this.running = true
    this.physics.resume()
  }
  reset () {
    this.items.clear(true, true)
    this.score = 0; this.lives = MAX_LIVES; this.timeLeft = GAME_TIME
    this.caughtGood = 0; this.caughtBad = 0; this.missedGood = 0
    this.isOver = false
    this.player.x = GAME_W / 2; this.player.rotation = 0
    this.targetX = GAME_W / 2
    this.updateHUD()
  }

  /* ---- 掉落节奏（随时间加快） ---- */
  spawnTick () {
    if (!this.running) return
    this.spawnOne()
    const elapsed = GAME_TIME - this.timeLeft
    if (elapsed > 20 && Math.random() < 0.35) this.spawnOne()
    if (elapsed > 40 && Math.random() < 0.30) this.spawnOne()
  }
  spawnOne () {
    const elapsed = GAME_TIME - this.timeLeft
    const bad = Math.random() < 0.34
    const pool = bad ? BAD_ITEMS : GOOD_ITEMS
    const d = Phaser.Utils.Array.GetRandom(pool)
    const x = Phaser.Math.Between(40, GAME_W - 40)
    const t = this.add.text(x, -30, d.emoji, { fontSize: '40px' }).setOrigin(0.5).setDepth(5)
    this.physics.add.existing(t)
    t.body.setVelocityY(165 + elapsed * 2.4)
    t.itemData = { ...d, bad }
    this.items.add(t)
  }

  /* ---- 接住 ---- */
  onCatch (player, item) {
    if (!this.running) return
    const d = item.itemData
    if (d.bad) {
      this.caughtBad++
      this.lives--
      this.score = Math.max(0, this.score - 15)
      this.floatText(item.x, item.y, '-1 ❤', '#ff5252')
      this.cameras.main.shake(160, 0.012)
      this.flashRed()
      beep(120, 0.18, 'sawtooth')
    } else {
      this.caughtGood++
      this.score += d.points
      this.floatText(item.x, item.y, '+' + d.points, '#43d17a')
      this.sparks.explode(10, item.x, item.y)
      beep(660, 0.08, 'sine')
      if (this.lives < MAX_LIVES && Math.random() < 0.1) {
        this.lives++
        this.floatText(item.x, item.y - 22, '+1 ❤', '#ff7aa2')
      }
    }
    this.updateHUD()
    item.destroy()
    if (this.lives <= 0) this.endGame()
  }

  /* ---- 漏接 ---- */
  onMiss (item) {
    const d = item.itemData
    if (!d.bad) this.missedGood++
    item.destroy()
  }

  /* ---- 主循环 ---- */
  update (time, delta) {
    if (!this.running) return

    // 角色移动（平滑跟随）
    if (this.targetX !== undefined) {
      this.player.x = Phaser.Math.Linear(this.player.x, this.targetX, 0.35)
      this.player.x = Phaser.Math.Clamp(this.player.x, 30, GAME_W - 30)
      this.player.rotation = Phaser.Math.Clamp((this.targetX - this.player.x) / 220, -0.18, 0.18)
    }
    if (this.cursors.left.isDown)  this.player.x = Math.max(30, this.player.x - 7)
    if (this.cursors.right.isDown) this.player.x = Math.min(GAME_W - 30, this.player.x + 7)

    // 倒计时
    this.timeLeft -= delta / 1000
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.endGame() }
    this.timerText.setText(Math.ceil(this.timeLeft))

    // 漏接检测
    this.items.getChildren().forEach((it) => {
      if (it.y > GAME_H + 50) this.onMiss(it)
    })
  }

  updateHUD () {
    const filled = '❤️'.repeat(Math.max(0, this.lives))
    const empty = '🤍'.repeat(Math.max(0, MAX_LIVES - this.lives))
    this.livesText.setText(filled + empty)
    this.scoreText.setText('得分 ' + this.score)
    this.timerText.setText(Math.ceil(this.timeLeft))
  }

  floatText (x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontSize: '22px', color, fontStyle: 'bold',
      fontFamily: '-apple-system,"PingFang SC",sans-serif'
    }).setOrigin(0.5).setDepth(60)
    t.setStroke('#ffffff', 4)
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 800, onComplete: () => t.destroy() })
  }
  flashRed () {
    const r = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xff0000, 0.22).setDepth(58)
    this.tweens.add({ targets: r, alpha: 0, duration: 320, onComplete: () => r.destroy() })
  }

  /* ---- 结束并生成报告 ---- */
  endGame () {
    if (this.isOver) return
    this.isOver = true
    this.running = false
    this.physics.pause()
    const report = computeReport({
      score: this.score, caughtGood: this.caughtGood, caughtBad: this.caughtBad,
      lives: this.lives, missedGood: this.missedGood
    })
    if (this.onReport) this.onReport(report)
  }
}

/* ----------------------------- 报告逻辑 -------------------------------- */
function computeReport ({ score, caughtGood, caughtBad, lives, missedGood }) {
  let risk = Math.round(100 - score * 0.17 + caughtBad * 5)
  risk = Phaser.Math.Clamp(risk, 5, 99)

  let level, color, title
  if (risk < 34)       { level = '低风险'; color = '#43d17a'; title = '护眼达人 👓✨' }
  else if (risk <= 66) { level = '中风险'; color = '#ffa726'; title = '屏幕平衡者 🤔' }
  else                 { level = '高风险'; color = '#ff5252'; title = '近视高危人群 ⚠️' }

  const tips = []
  tips.push('遵循 20-20-20 法则：每用眼 20 分钟，远眺 20 英尺（约 6 米）外至少 20 秒。')
  if (caughtBad >= 3) tips.push('你误接了 ' + caughtBad + ' 个伤眼物品，请减少手机 / 平板近距离、暗光下使用。')
  if (caughtGood < 10) tips.push('护眼好物接得偏少，日常多吃胡萝卜、蓝莓、深绿色蔬菜与鱼类。')
  if (lives <= 1) tips.push('生命点几乎耗尽，伤眼行为较多，建议每天增加 1–2 小时户外活动。')
  if (caughtGood >= 20 && caughtBad <= 1) tips.push('表现优秀！继续保持良好用眼与饮食习惯。')
  if (tips.length < 2) tips.push('保持充足睡眠与均衡饮食，对维持视力健康同样重要。')

  return { risk, level, color, title, score, caughtGood, caughtBad, lives, missedGood, tips }
}

/* ----------------------------- 工厂：挂载到容器 ------------------------- */
export function createEyeCatchGame (container, callbacks = {}) {
  const scene = new GameScene()
  scene.onReport = callbacks.onReport || null
  scene.onReady = callbacks.onReady || null

  const config = {
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: container,
    backgroundColor: '#bfe9ff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: scene
  }

  const game = new Phaser.Game(config)

  return {
    start () {
      ensureAudio()
      scene.startGame()
    },
    destroy () {
      try { game.destroy(true) } catch (e) { /* ignore */ }
    }
  }
}
