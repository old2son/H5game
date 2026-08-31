import * as Phaser from 'phaser'

const GAME_WIDTH = 390
const GAME_HEIGHT = 844
const HORIZON_Y = 195
const PLAYER_Y = 665
const LANES = [-1, 0, 1] as const

type RunnerState = 'intro' | 'running' | 'gameover'
type EntityKind = 'coin' | 'rock' | 'gate' | 'barrier' | 'shield'

interface TrackEntity {
  kind: EntityKind
  lane: number
  y: number
  root: Phaser.GameObjects.Container
  checked: boolean
}

export class RunnerScene extends Phaser.Scene {
  private state: RunnerState = 'intro'
  private lane = 0
  private speed = 180
  private distance = 0
  private coins = 0
  private score = 0
  private best = Number(localStorage.getItem('bright-eyes-runner-best') ?? 0)
  private spawnClock = 0
  private runClock = 0
  private jumpClock = 0
  private slideClock = 0
  private shieldClock = 0
  private invincibleClock = 0
  private swipeStart?: Phaser.Math.Vector2
  private entities: TrackEntity[] = []
  private roadMarkers: Phaser.GameObjects.Graphics[] = []
  private scenery: Phaser.GameObjects.Container[] = []

  private player!: Phaser.GameObjects.Container
  private mascot!: Phaser.GameObjects.Image
  private playerShadow!: Phaser.GameObjects.Ellipse
  private scoreText!: Phaser.GameObjects.Text
  private coinText!: Phaser.GameObjects.Text
  private distanceText!: Phaser.GameObjects.Text
  private shieldBadge!: Phaser.GameObjects.Container
  private introPanel!: Phaser.GameObjects.Container
  private gameOverPanel!: Phaser.GameObjects.Container
  private toastText!: Phaser.GameObjects.Text
  private flash!: Phaser.GameObjects.Rectangle

  constructor() {
    super('runner')
  }

  preload() {
    this.load.image('bright-eyes-mascot', 'assets/bright-eyes-mascot.png')
  }

  create() {
    this.cameras.main.setBackgroundColor('#c9f1fb')
    this.drawWorld()
    this.createTrackMarkers()
    this.createPlayer()
    this.createHud()
    this.createControls()
    this.createIntro()
    this.createGameOver()
    this.bindInput()
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 34) / 1000
    this.updateAmbient(dt)
    this.updatePlayer(dt)
    if (this.state !== 'running') return

    this.runClock += dt
    this.distance += this.speed * dt * 0.052
    this.speed = Math.min(330, 180 + this.distance * 0.42)
    this.score = Math.floor(this.distance * 10 + this.coins * 75)
    this.spawnClock -= dt
    if (this.spawnClock <= 0) {
      this.spawnWave()
      this.spawnClock = Math.max(0.56, 1.1 - this.speed / 700)
    }

    this.updateMarkers(dt)
    this.updateEntities(dt)
    this.updateHud()

    this.jumpClock = Math.max(0, this.jumpClock - dt)
    this.slideClock = Math.max(0, this.slideClock - dt)
    this.shieldClock = Math.max(0, this.shieldClock - dt)
    this.invincibleClock = Math.max(0, this.invincibleClock - dt)
    this.shieldBadge.setVisible(this.shieldClock > 0)
  }

  private drawWorld() {
    const g = this.add.graphics()
    const skyBands = [0x63cbea, 0x78d8ef, 0x9be5f3, 0xc8f2f5]
    skyBands.forEach((color, i) => g.fillStyle(color).fillRect(0, i * 55, GAME_WIDTH, 75))

    g.fillStyle(0xffd666, 0.96).fillCircle(313, 80, 34)
    g.fillStyle(0xffffff, 0.8).fillCircle(55, 80, 18).fillCircle(76, 75, 25).fillCircle(101, 83, 16)
    g.fillStyle(0xffffff, 0.68).fillCircle(250, 128, 13).fillCircle(267, 122, 19).fillCircle(286, 130, 12)

    g.fillStyle(0x72c787).fillTriangle(0, 214, 93, 135, 176, 214)
    g.fillStyle(0x5eb77a).fillTriangle(78, 214, 193, 144, 286, 214)
    g.fillStyle(0x81cf8d).fillTriangle(208, 214, 320, 124, 390, 214)

    this.drawEyeClinic(g, 195, 184)
    g.fillStyle(0x91d98e).fillRect(0, 198, GAME_WIDTH, GAME_HEIGHT - 198)
    g.fillStyle(0xf6d47e).fillTriangle(130, HORIZON_Y, 260, HORIZON_Y, 382, GAME_HEIGHT)
    g.fillStyle(0xf9e7a9).fillTriangle(130, HORIZON_Y, 382, GAME_HEIGHT, 8, GAME_HEIGHT)
    g.lineStyle(5, 0xffffff, 0.82).strokeLineShape(new Phaser.Geom.Line(130, HORIZON_Y, 8, GAME_HEIGHT))
    g.lineStyle(5, 0xffffff, 0.82).strokeLineShape(new Phaser.Geom.Line(260, HORIZON_Y, 382, GAME_HEIGHT))

    for (let i = 0; i < 13; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const tree = this.makeTree(side)
      tree.setPosition(side < 0 ? 55 - (i % 3) * 21 : 335 + (i % 3) * 19, 225 + i * 58)
      tree.setScale(0.45 + i * 0.025)
      tree.setAlpha(0.82)
      this.scenery.push(tree)
    }
  }

  private drawEyeClinic(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0xfafcff).fillRoundedRect(x - 48, y - 42, 96, 44, 7)
    g.fillStyle(0x42a9c4).fillRect(x - 48, y - 42, 96, 11)
    g.fillStyle(0xffffff).fillCircle(x, y - 44, 17)
    g.lineStyle(3, 0x2497b5).strokeEllipse(x - 10, y - 48, 20, 10)
    g.fillStyle(0x2497b5).fillCircle(x, y - 43, 4)
    g.fillStyle(0x86d7e8).fillRect(x - 31, y - 24, 18, 19).fillRect(x + 13, y - 24, 18, 19)
    g.fillStyle(0xffcb62).fillRect(x - 6, y - 25, 12, 25)
  }

  private makeTree(side: number) {
    const c = this.add.container()
    const g = this.add.graphics()
    g.fillStyle(0x79563a).fillRect(-3, -18, 6, 35)
    g.fillStyle(side < 0 ? 0x4eb86c : 0x63c47c).fillTriangle(-20, -3, 0, -42, 20, -3)
    g.fillTriangle(-17, -17, 0, -55, 17, -17)
    c.add(g)
    return c
  }

  private createTrackMarkers() {
    for (let i = 0; i < 10; i++) {
      const marker = this.add.graphics()
      marker.setData('y', HORIZON_Y + i * 72)
      this.roadMarkers.push(marker)
    }
    this.redrawMarkers()
  }

  private redrawMarkers() {
    this.roadMarkers.forEach((marker) => {
      const y = marker.getData('y') as number
      const p = Phaser.Math.Clamp((y - HORIZON_Y) / (GAME_HEIGHT - HORIZON_Y), 0, 1)
      const halfRoad = Phaser.Math.Linear(65, 187, p)
      const markerHalf = Phaser.Math.Linear(2, 9, p)
      const h = Phaser.Math.Linear(5, 24, p)
      marker.clear().fillStyle(0xffffff, 0.72)
      for (const laneEdge of [-1 / 3, 1 / 3]) {
        const x = GAME_WIDTH / 2 + halfRoad * laneEdge
        marker.fillTriangle(x - markerHalf, y + h, x + markerHalf, y + h, x, y)
      }
    })
  }

  private updateMarkers(dt: number) {
    for (const marker of this.roadMarkers) {
      let y = marker.getData('y') as number
      const p = Phaser.Math.Clamp((y - HORIZON_Y) / (GAME_HEIGHT - HORIZON_Y), 0, 1)
      y += this.speed * dt * (0.34 + p * 1.15)
      if (y > GAME_HEIGHT + 20) y = HORIZON_Y
      marker.setData('y', y)
    }
    this.redrawMarkers()
  }

  private createPlayer() {
    this.playerShadow = this.add.ellipse(this.laneX(0, PLAYER_Y), PLAYER_Y + 43, 72, 18, 0x315c50, 0.28)
    this.player = this.add.container(this.laneX(0, PLAYER_Y), PLAYER_Y)
    this.mascot = this.add.image(0, 0, 'bright-eyes-mascot').setDisplaySize(104, 104)
    this.player.add(this.mascot)
    this.player.setDepth(30)
    this.playerShadow.setDepth(29)
  }

  private createHud() {
    const plate = this.add.graphics().setDepth(50)
    plate.fillStyle(0xffffff, 0.88).fillRoundedRect(17, 18, 356, 74, 20)
    plate.lineStyle(2, 0x4bb8d2, 0.48).strokeRoundedRect(17, 18, 356, 74, 20)

    this.add.text(32, 30, '护眼里程', this.smallLabel()).setDepth(51)
    this.distanceText = this.add.text(32, 49, '0 m', this.hudValue()).setDepth(51)
    this.add.text(157, 30, '护眼分', this.smallLabel()).setDepth(51)
    this.scoreText = this.add.text(157, 49, '000000', this.hudValue()).setDepth(51)
    this.add.circle(301, 59, 9, 0xffc94f).setStrokeStyle(2, 0xffffff).setDepth(51)
    this.coinText = this.add.text(317, 49, '0', this.hudValue()).setDepth(51)

    this.shieldBadge = this.add.container(195, 111).setDepth(51).setVisible(false)
    const shieldBg = this.add.rectangle(0, 0, 130, 26, 0xffffff, 0.94).setStrokeStyle(2, 0x41b9d0)
    const shieldTxt = this.add.text(0, 0, '户外阳光护盾生效', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#17627a' }).setOrigin(0.5)
    this.shieldBadge.add([shieldBg, shieldTxt])

    this.toastText = this.add.text(195, 145, '', {
      fontFamily: 'Microsoft YaHei', fontSize: '16px', fontStyle: 'bold', color: '#fff0c1',
      stroke: '#17627a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(70).setAlpha(0)

    this.flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setOrigin(0).setDepth(90)
  }

  private createControls() {
    this.makeControl(54, 777, '‹', () => this.changeLane(-1), '向左')
    this.makeControl(336, 777, '›', () => this.changeLane(1), '向右')
    this.makeControl(282, 714, '↑', () => this.jump(), '跳跃', 23)
    this.makeControl(108, 714, '↓', () => this.slide(), '下滑', 23)
  }

  private makeControl(x: number, y: number, symbol: string, action: () => void, label: string, radius = 29) {
    const circle = this.add.circle(x, y, radius, 0xffffff, 0.82).setStrokeStyle(2, 0x269dbb, 0.72).setDepth(55)
    const text = this.add.text(x, y - 3, symbol, { fontFamily: 'Arial', fontSize: `${radius}px`, color: '#17627a' }).setOrigin(0.5).setDepth(56)
    this.add.text(x, y + radius + 4, label, { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: '#17627a' }).setOrigin(0.5).setDepth(56)
    circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      circle.setFillStyle(0xffd565, 0.92)
      action()
    }).on('pointerup', () => circle.setFillStyle(0xffffff, 0.82))
    text.setInteractive({ useHandCursor: true }).on('pointerdown', action)
  }

  private createIntro() {
    this.introPanel = this.add.container(195, 430).setDepth(80)
    const shade = this.add.rectangle(0, 0, 342, 405, 0xffffff, 0.95).setStrokeStyle(3, 0x4bb8d2, 0.72)
    const seal = this.add.circle(0, -142, 44, 0xffd25f).setStrokeStyle(3, 0xffffff)
    const eyeWhite = this.add.ellipse(0, -142, 48, 27, 0xffffff).setStrokeStyle(2, 0x17627a)
    const pupil = this.add.circle(0, -142, 9, 0x269dbb).setStrokeStyle(3, 0x17627a)
    const title = this.add.text(0, -70, '明 眸 守 护 队', { fontFamily: 'Microsoft YaHei', fontSize: '29px', color: '#17627a', fontStyle: 'bold' }).setOrigin(0.5)
    const subtitle = this.add.text(0, -27, '穿越护眼知识岛 · 收集明亮能量', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: '#2888a0' }).setOrigin(0.5)
    const rules = this.add.text(0, 20, '左右换道   ·   上滑跳跃   ·   下滑闪避', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: '#385c68' }).setOrigin(0.5)
    const best = this.add.text(0, 59, `最高护眼分  ${this.best.toString().padStart(6, '0')}`, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#718992' }).setOrigin(0.5)
    const source = this.add.text(0, 164, '科普依据：国家卫生健康委', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: '#8ca0a6' }).setOrigin(0.5)
    const button = this.add.rectangle(0, 116, 218, 54, 0xffae45).setStrokeStyle(2, 0xffd782).setInteractive({ useHandCursor: true })
    const buttonText = this.add.text(0, 116, '开 始 护 眼 挑 战', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    button.on('pointerdown', () => this.startRun())
    buttonText.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.startRun())
    this.introPanel.add([shade, seal, eyeWhite, pupil, title, subtitle, rules, best, button, buttonText, source])
  }

  private createGameOver() {
    this.gameOverPanel = this.add.container(195, 426).setDepth(81).setVisible(false)
    const shade = this.add.rectangle(0, 0, 336, 390, 0xffffff, 0.97).setStrokeStyle(3, 0x4bb8d2, 0.7)
    const over = this.add.text(0, -154, '护 眼 闯 关 完 成', { fontFamily: 'Microsoft YaHei', fontSize: '25px', color: '#17627a', fontStyle: 'bold' }).setOrigin(0.5)
    const summary = this.add.text(0, -68, '', { fontFamily: 'Microsoft YaHei', fontSize: '15px', color: '#385c68', align: 'center', lineSpacing: 11 }).setOrigin(0.5).setName('summary')
    const tip = this.add.text(0, 53, '', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: '#17627a', align: 'center', lineSpacing: 5, wordWrap: { width: 276 } }).setOrigin(0.5).setName('tip')
    const button = this.add.rectangle(0, 137, 196, 52, 0xffae45).setStrokeStyle(2, 0xffd782).setInteractive({ useHandCursor: true })
    const buttonText = this.add.text(0, 137, '再 挑 战 一 次', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    button.on('pointerdown', () => this.startRun())
    buttonText.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.startRun())
    this.gameOverPanel.add([shade, over, summary, tip, button, buttonText])
  }

  private bindInput() {
    const keys = this.input.keyboard?.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>
    keys?.LEFT.on('down', () => this.changeLane(-1))
    keys?.A.on('down', () => this.changeLane(-1))
    keys?.RIGHT.on('down', () => this.changeLane(1))
    keys?.D.on('down', () => this.changeLane(1))
    keys?.UP.on('down', () => this.jump())
    keys?.W.on('down', () => this.jump())
    keys?.DOWN.on('down', () => this.slide())
    keys?.S.on('down', () => this.slide())

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStart = new Phaser.Math.Vector2(pointer.x, pointer.y)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.swipeStart || this.state !== 'running') return
      const dx = pointer.x - this.swipeStart.x
      const dy = pointer.y - this.swipeStart.y
      this.swipeStart = undefined
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return
      if (Math.abs(dx) > Math.abs(dy)) this.changeLane(dx > 0 ? 1 : -1)
      else if (dy < 0) this.jump()
      else this.slide()
    })
  }

  private startRun() {
    this.clearEntities()
    this.state = 'running'
    this.lane = 0
    this.speed = 180
    this.distance = 0
    this.coins = 0
    this.score = 0
    this.spawnClock = 0.65
    this.runClock = 0
    this.jumpClock = 0
    this.slideClock = 0
    this.shieldClock = 0
    this.invincibleClock = 0
    this.player.setPosition(this.laneX(0, PLAYER_Y), PLAYER_Y).setScale(1).setAlpha(1)
    this.playerShadow.setPosition(this.laneX(0, PLAYER_Y), PLAYER_Y + 31).setAlpha(0.52)
    this.introPanel.setVisible(false)
    this.gameOverPanel.setVisible(false)
    this.updateHud()
    this.showToast('护眼挑战开始！')
  }

  private endRun() {
    if (this.state !== 'running') return
    this.state = 'gameover'
    this.best = Math.max(this.best, this.score)
    localStorage.setItem('bright-eyes-runner-best', String(this.best))
    const summary = this.gameOverPanel.getByName('summary') as Phaser.GameObjects.Text
    summary.setText(`本次护眼分  ${this.score.toString().padStart(6, '0')}\n护眼里程  ${Math.floor(this.distance)} 米\n明亮能量  ${this.coins} 枚\n最高护眼分  ${this.best.toString().padStart(6, '0')}`)
    const tip = this.gameOverPanel.getByName('tip') as Phaser.GameObjects.Text
    tip.setText(`护眼小课堂\n${this.randomEyeTip()}`)
    this.gameOverPanel.setVisible(true).setAlpha(0)
    this.tweens.add({ targets: this.gameOverPanel, alpha: 1, y: 414, duration: 320, ease: 'Back.Out' })
    this.cameras.main.shake(180, 0.012)
  }

  private changeLane(direction: number) {
    if (this.state !== 'running') return
    const next = Phaser.Math.Clamp(this.lane + direction, -1, 1)
    if (next === this.lane) return
    this.lane = next
    const x = this.laneX(this.lane, PLAYER_Y)
    this.tweens.killTweensOf([this.player, this.playerShadow])
    this.tweens.add({ targets: this.player, x, duration: 150, ease: 'Sine.Out' })
    this.tweens.add({ targets: this.playerShadow, x, duration: 150, ease: 'Sine.Out' })
  }

  private jump() {
    if (this.state !== 'running' || this.jumpClock > 0 || this.slideClock > 0) return
    this.jumpClock = 0.78
    this.showToast('跳过不良用眼习惯')
  }

  private slide() {
    if (this.state !== 'running' || this.slideClock > 0 || this.jumpClock > 0) return
    this.slideClock = 0.66
    this.showToast('躲开不良用眼习惯')
  }

  private updatePlayer(_dt: number) {
    const running = this.state === 'running'
    const stride = Math.sin(this.runClock * 16)
    this.mascot.y = running && this.jumpClock <= 0 && this.slideClock <= 0 ? stride * 3 : 0
    this.mascot.rotation = running ? stride * 0.035 : 0

    if (this.jumpClock > 0) {
      const progress = 1 - this.jumpClock / 0.78
      const lift = Math.sin(progress * Math.PI) * 116
      this.player.y = PLAYER_Y - lift
      this.player.rotation = Math.sin(progress * Math.PI) * 0.08
      this.playerShadow.setScale(1 - lift / 280).setAlpha(0.2 + (1 - lift / 116) * 0.32)
    } else {
      this.player.y = Phaser.Math.Linear(this.player.y, PLAYER_Y, 0.35)
      this.player.rotation *= 0.7
      this.playerShadow.setScale(1).setAlpha(0.52)
    }

    if (this.slideClock > 0) {
      this.player.setScale(1.08, 0.52)
      this.player.y = PLAYER_Y + 18
      this.player.rotation = -0.18
    } else if (this.jumpClock <= 0) {
      this.player.setScale(1)
    }
    this.player.setAlpha(this.invincibleClock > 0 && Math.floor(this.invincibleClock * 12) % 2 === 0 ? 0.35 : 1)
  }

  private spawnWave() {
    const obstacleLane = Phaser.Math.RND.pick([...LANES])
    const roll = Math.random()
    const kind: EntityKind = roll < 0.38 ? 'rock' : roll < 0.68 ? 'barrier' : 'gate'
    this.spawnEntity(kind, obstacleLane, HORIZON_Y)

    const safeLanes = LANES.filter((lane) => lane !== obstacleLane)
    const coinLane = Phaser.Math.RND.pick(safeLanes)
    for (let i = 0; i < 3; i++) this.spawnEntity('coin', coinLane, HORIZON_Y - i * 58)
    if (this.distance > 80 && Math.random() < 0.075 && this.shieldClock <= 0) {
      this.spawnEntity('shield', Phaser.Math.RND.pick(safeLanes), HORIZON_Y - 90)
    }
  }

  private spawnEntity(kind: EntityKind, lane: number, y: number) {
    const root = this.add.container(this.laneX(lane, y), y).setDepth(20)
    if (kind === 'coin') {
      const glow = this.add.circle(0, 0, 16, 0xffd85d, 0.25)
      const energy = this.add.star(0, 0, 5, 7, 14, 0xffc94f).setStrokeStyle(2, 0xffffff)
      const eye = this.add.ellipse(0, 0, 12, 7, 0xffffff)
      const pupil = this.add.circle(0, 0, 2.5, 0x238cab)
      root.add([glow, energy, eye, pupil])
    } else if (kind === 'shield') {
      const glow = this.add.circle(0, 0, 23, 0xffd85d, 0.28)
      const sun = this.add.circle(0, 0, 15, 0xffc94f).setStrokeStyle(2, 0xffffff)
      const mark = this.add.text(0, 0, '户外', { fontFamily: 'Microsoft YaHei', fontSize: '8px', color: '#17627a', fontStyle: 'bold' }).setOrigin(0.5)
      root.add([glow, sun, mark])
    } else if (kind === 'rock') {
      const phone = this.add.rectangle(0, 0, 42, 61, 0x34485c).setStrokeStyle(3, 0x183348)
      const screen = this.add.rectangle(0, -3, 32, 43, 0x8ee8f4)
      const mark = this.add.text(0, -4, '久看', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#e05d5d', fontStyle: 'bold' }).setOrigin(0.5)
      const home = this.add.circle(0, 25, 2.5, 0xffffff)
      root.add([phone, screen, mark, home])
    } else if (kind === 'barrier') {
      const desk = this.add.rectangle(0, 11, 66, 13, 0xd39458).setStrokeStyle(2, 0x8b603d)
      const book = this.add.rectangle(0, -2, 48, 28, 0xf16c67).setStrokeStyle(2, 0xffffff)
      const head = this.add.circle(0, -26, 16, 0xe3a678)
      const label = this.add.text(0, 10, '趴读', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      root.add([desk, book, head, label])
    } else {
      const left = this.add.rectangle(-30, -17, 10, 76, 0x506070)
      const right = this.add.rectangle(30, -17, 10, 76, 0x506070)
      const dark = this.add.rectangle(0, -47, 72, 20, 0x34485c).setStrokeStyle(2, 0x182a3b)
      const label = this.add.text(0, -47, '暗光', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      const lamp = this.add.circle(0, -31, 7, 0xffd05c, 0.45)
      root.add([left, right, dark, label, lamp])
    }
    root.setScale(0.2)
    this.entities.push({ kind, lane, y, root, checked: false })
  }

  private updateEntities(dt: number) {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i]
      const progress = Phaser.Math.Clamp((entity.y - HORIZON_Y) / (GAME_HEIGHT - HORIZON_Y), 0, 1)
      entity.y += this.speed * dt * (0.36 + progress * 1.18)
      const scale = Phaser.Math.Linear(0.2, 1.24, progress)
      entity.root.setPosition(this.laneX(entity.lane, entity.y), entity.y).setScale(scale)
      if (entity.kind === 'coin' || entity.kind === 'shield') entity.root.rotation += dt * 2.6
      entity.root.setDepth(18 + Math.floor(progress * 20))

      if (!entity.checked && entity.y >= PLAYER_Y - 22) {
        entity.checked = true
        this.resolveEntity(entity)
      }
      if (entity.y > GAME_HEIGHT + 90) {
        entity.root.destroy(true)
        this.entities.splice(i, 1)
      }
    }
  }

  private resolveEntity(entity: TrackEntity) {
    if (entity.lane !== this.lane) return
    if (entity.kind === 'coin') {
      this.coins += 1
      this.collectEffect(entity, 0xf7c94c)
      if (this.coins % 5 === 0) this.showToast(this.randomEyeTip())
      return
    }
    if (entity.kind === 'shield') {
      this.shieldClock = 8
      this.collectEffect(entity, 0x64ead7)
      this.showToast('户外阳光能量 · 护盾8秒')
      return
    }
    const avoided = (entity.kind === 'gate' && this.slideClock > 0.12) || (entity.kind !== 'gate' && this.jumpClock > 0.12)
    if (avoided) {
      this.score += 25
      const obstacleTips: Record<'rock' | 'barrier' | 'gate', string> = {
        rock: '连续近距离用眼20分钟，要远眺20秒',
        barrier: '读写坐姿记住：一尺、一拳、一寸',
        gate: '读写时光线要充足、柔和',
      }
      this.showToast(obstacleTips[entity.kind])
      return
    }
    if (this.shieldClock > 0) {
      this.shieldClock = 0
      this.invincibleClock = 1.2
      entity.root.destroy(true)
      this.showToast('户外护盾抵挡了一次不良习惯')
      this.flash.setFillStyle(0x72e8d8, 0.32)
      this.tweens.add({ targets: this.flash, alpha: { from: 1, to: 0 }, duration: 320 })
      return
    }
    if (this.invincibleClock <= 0) this.endRun()
  }

  private collectEffect(entity: TrackEntity, color: number) {
    entity.root.setVisible(false)
    for (let i = 0; i < 7; i++) {
      const dot = this.add.circle(entity.root.x, entity.root.y, 3, color).setDepth(60)
      const angle = (Math.PI * 2 * i) / 7
      this.tweens.add({
        targets: dot,
        x: dot.x + Math.cos(angle) * 42,
        y: dot.y + Math.sin(angle) * 42,
        alpha: 0,
        scale: 0.2,
        duration: 360,
        onComplete: () => dot.destroy(),
      })
    }
  }

  private updateAmbient(dt: number) {
    for (const item of this.scenery) {
      const drift = this.state === 'running' ? this.speed * dt * 0.1 : 4 * dt
      item.y += drift
      if (item.y > 900) item.y = 210
    }
  }

  private updateHud() {
    this.distanceText.setText(`${Math.floor(this.distance)} m`)
    this.scoreText.setText(this.score.toString().padStart(6, '0'))
    this.coinText.setText(String(this.coins))
  }

  private laneX(lane: number, y: number) {
    const progress = Phaser.Math.Clamp((y - HORIZON_Y) / (GAME_HEIGHT - HORIZON_Y), 0, 1)
    return GAME_WIDTH / 2 + lane * Phaser.Math.Linear(33, 88, progress)
  }

  private showToast(message: string) {
    this.toastText.setText(message).setAlpha(0).setY(148).setFontSize(message.length > 15 ? 12 : 16)
    this.tweens.killTweensOf(this.toastText)
    this.tweens.add({ targets: this.toastText, alpha: 1, y: 138, duration: 150, yoyo: true, hold: 420 })
  }

  private clearEntities() {
    this.entities.forEach((entity) => entity.root.destroy(true))
    this.entities = []
  }

  private randomEyeTip() {
    return Phaser.Math.RND.pick([
      '每天日间户外活动至少2小时',
      '近距离用眼20分钟，远眺6米外20秒',
      '读写做到一尺、一拳、一寸',
      '不躺着、走路时或在晃动车厢里看书',
      '定期检查视力，发现异常及时告诉家长',
    ])
  }

  private smallLabel(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: '#4f7885', letterSpacing: 1 }
  }

  private hudValue(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'Arial', fontSize: '18px', color: '#17627a', fontStyle: 'bold' }
  }
}
