import * as Phaser from 'phaser'

type GameState = 'intro' | 'scatter' | 'assemble' | 'quiz' | 'result'
type PartId = 'cornea' | 'iris' | 'lens' | 'retina' | 'optic'

interface EyePart {
  id: PartId
  name: string
  color: number
  asset: string
  iconSize: [number, number]
  target: Phaser.Math.Vector2
  fact: string
  clue: string
}

const PARTS: EyePart[] = [
  { id: 'cornea', name: '角膜', color: 0x5ed9ef, asset: 'part-cornea', iconSize: [46, 52], target: new Phaser.Math.Vector2(70, 326), clue: '透明小圆顶', fact: '角膜像透明小窗，是光线进入眼睛的第一站，还能帮助光线聚焦。' },
  { id: 'iris', name: '虹膜', color: 0x32b58c, asset: 'part-iris', iconSize: [52, 52], target: new Phaser.Math.Vector2(111, 326), clue: '彩色光圈', fact: '虹膜是眼睛有颜色的部分，像相机光圈一样调节进入眼内的光量。' },
  { id: 'lens', name: '晶状体', color: 0xffc94d, asset: 'part-lens', iconSize: [36, 54], target: new Phaser.Math.Vector2(151, 326), clue: '透明小镜片', fact: '晶状体像一块会变形的小镜片，帮助远近不同的物体清晰成像。' },
  { id: 'retina', name: '视网膜', color: 0xff7185, asset: 'part-retina', iconSize: [54, 42], target: new Phaser.Math.Vector2(273, 326), clue: '感光屏幕', fact: '视网膜像相机的感光屏幕，把光转换成大脑能读懂的电信号。' },
  { id: 'optic', name: '视神经', color: 0x9b78e7, asset: 'part-optic', iconSize: [58, 38], target: new Phaser.Math.Vector2(332, 326), clue: '信号电缆', fact: '视神经像信号电缆，把视网膜产生的视觉信号送往大脑。' },
]

const QUIZ = [
  { question: '哪一部分像相机光圈一样，\n控制进入眼睛的光量？', options: ['视网膜', '虹膜', '视神经'], answer: 1 },
  { question: '光线最后到达哪里，\n才会被转换成电信号？', options: ['视网膜', '角膜', '巩膜'], answer: 0 },
  { question: '谁像“信号电缆”，\n把视觉信号送往大脑？', options: ['晶状体', '虹膜', '视神经'], answer: 2 },
]

const RENDER_SCALE = 4
const VIEW_WIDTH = 390
const VIEW_HEIGHT = 844

export class EyeAssemblyScene extends Phaser.Scene {
  private state: GameState = 'intro'
  private score = 500
  private placed = 0
  private wrong = 0
  private quizIndex = 0
  private quizCorrect = 0
  private best = Number(localStorage.getItem('eye-anatomy-best') ?? 0)
  private partTokens: Phaser.GameObjects.Container[] = []
  private placedLabels: Phaser.GameObjects.Container[] = []
  private targetMarkers = new Map<PartId, Phaser.GameObjects.Container>()
  private placedGraphics!: Phaser.GameObjects.Graphics
  private targetLayer!: Phaser.GameObjects.Container
  private eyeModel!: Phaser.GameObjects.Image
  private hudProgress!: Phaser.GameObjects.Text
  private hudScore!: Phaser.GameObjects.Text
  private infoCard!: Phaser.GameObjects.Container
  private infoImage!: Phaser.GameObjects.Image
  private infoTitle!: Phaser.GameObjects.Text
  private infoBody!: Phaser.GameObjects.Text
  private introPanel!: Phaser.GameObjects.Container
  private quizPanel?: Phaser.GameObjects.Container
  private resultPanel?: Phaser.GameObjects.Container

  constructor() {
    super('eye-assembly')
  }

  preload() {
    this.load.image('mascot', 'assets/bright-eyes-mascot.png')
    this.load.image('eye3d', 'assets/eye-3d-cutaway.png')
    this.load.image('part-cornea', 'assets/part-cornea-3d.png')
    this.load.image('part-iris', 'assets/part-iris-3d.png')
    this.load.image('part-lens', 'assets/part-lens-3d.png')
    this.load.image('part-retina', 'assets/part-retina-3d.png')
    this.load.image('part-optic', 'assets/part-optic-3d-v2.png')
  }

  create() {
    const camera = this.cameras.main
    camera.setZoom(RENDER_SCALE)
    camera.setScroll((VIEW_WIDTH - camera.width) / 2, (VIEW_HEIGHT - camera.height) / 2)
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (gameObject: Phaser.GameObjects.GameObject) => {
      if (gameObject instanceof Phaser.GameObjects.Text) gameObject.setResolution(RENDER_SCALE)
    })
    this.drawBackground()
    this.createHeader()
    this.createEyeDiagram()
    this.createInfoCard()
    this.createIntro()
  }

  private drawBackground() {
    const g = this.add.graphics()
    g.fillStyle(0x5848ca).fillRect(0, 0, 390, 126)
    g.fillStyle(0x786be3).fillCircle(38, 52, 58).fillCircle(352, 28, 70)
    g.fillStyle(0xeaf8ff).fillRect(0, 126, 390, 718)
    g.fillStyle(0xcfefff, 0.8).fillCircle(46, 250, 82).fillCircle(360, 492, 96)
    g.fillStyle(0xffffff, 0.97).fillRoundedRect(18, 144, 354, 420, 24)
    g.lineStyle(2, 0xbfc9f4, 0.8).strokeRoundedRect(18, 144, 354, 420, 24)
    g.fillStyle(0xffffff, 0.9).fillRoundedRect(18, 578, 354, 224, 22)
    g.lineStyle(2, 0xc9d7f2, 0.7).strokeRoundedRect(18, 578, 354, 224, 22)
    for (let i = 0; i < 10; i++) {
      g.fillStyle(i % 2 ? 0x8bd8ec : 0xb5a2ee, 0.32).fillCircle(20 + (i * 47) % 370, 566 + (i % 3) * 96, 5 + (i % 3) * 2)
    }
  }

  private createHeader() {
    this.add.text(22, 21, '眼球拆解大作战', { fontFamily: 'Microsoft YaHei', fontSize: '24px', fontStyle: 'bold', color: '#ffffff' })
    this.add.text(23, 55, '认识眼睛里会合作的“视觉小队”', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#e9e5ff' })
    this.add.image(338, 66, 'mascot').setDisplaySize(78, 78)
    this.add.text(24, 96, '拼装进度', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: '#d9d4ff' })
    this.hudProgress = this.add.text(82, 91, '0 / 5', { fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffffff' })
    this.add.text(180, 96, '当前得分', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: '#d9d4ff' })
    this.hudScore = this.add.text(242, 91, '0500', { fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffe28d' })
  }

  private createEyeDiagram() {
    this.add.text(195, 163, '3D 眼球剖面模型', { fontFamily: 'Microsoft YaHei', fontSize: '15px', fontStyle: 'bold', color: '#5148a6' }).setOrigin(0.5)
    const direction = this.add.container(195, 190)
    const directionBg = this.add.rectangle(0, 0, 302, 28, 0xeef4ff).setStrokeStyle(1, 0xcbd6f3)
    const directionText = this.add.text(0, 0, '光线从左边进入  →  视神经从右边连接大脑', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: '#65708a' }).setOrigin(0.5)
    direction.add([directionBg, directionText])

    const shadow = this.add.ellipse(199, 430, 286, 30, 0x52607a, 0.18).setDepth(1)
    this.eyeModel = this.add.image(195, 326, 'eye3d').setDisplaySize(330, 220).setAlpha(0.48).setDepth(2)
    this.tweens.add({ targets: shadow, scaleX: 0.94, alpha: 0.1, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    const rays = this.add.graphics().setDepth(3)
    rays.lineStyle(2, 0xffcf45, 0.38)
    rays.lineBetween(28, 300, 151, 326)
    rays.lineBetween(28, 326, 286, 326)
    rays.lineBetween(28, 352, 151, 326)
    this.add.text(30, 276, '光', { fontFamily: 'Microsoft YaHei', fontSize: '11px', fontStyle: 'bold', color: '#d69a13' }).setDepth(4)
    ;[0, 1, 2].forEach((index) => {
      const dot = this.add.circle(28, 300 + index * 26, 4, 0xffd44f, 0.75).setDepth(4)
      this.tweens.add({
        targets: dot,
        x: index === 1 ? 286 : 151,
        y: 326,
        alpha: { from: 0.18, to: 0.9 },
        duration: 1450 + index * 170,
        delay: index * 260,
        repeat: -1,
        repeatDelay: 260,
        ease: 'Sine.InOut',
      })
    })

    this.targetLayer = this.add.container(0, 0).setDepth(8)
    PARTS.forEach((part, index) => {
      const marker = this.add.container(part.target.x, part.target.y)
      const ring = this.add.circle(0, 0, part.id === 'optic' ? 25 : 22, 0xf8fbff, 0.78).setStrokeStyle(2, part.color, 0.9)
      const pulse = this.add.circle(0, 0, part.id === 'optic' ? 30 : 27, part.color, 0).setStrokeStyle(1, part.color, 0.35)
      const number = this.add.text(0, 0, String(index + 1), { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', stroke: '#4b5571', strokeThickness: 3 }).setOrigin(0.5)
      marker.add([pulse, ring, number])
      this.tweens.add({ targets: pulse, scale: 1.18, alpha: 0.2, duration: 900 + index * 90, yoyo: true, repeat: -1 })
      this.targetLayer.add(marker)
      this.targetMarkers.set(part.id, marker)
    })
    this.placedGraphics = this.add.graphics().setDepth(7)
    this.add.text(195, 536, '把下方部件拖到眼球中对应的数字位置', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#68738d' }).setOrigin(0.5).setDepth(9)
    this.add.text(38, 590, '等待归位的眼球部件', { fontFamily: 'Microsoft YaHei', fontSize: '12px', fontStyle: 'bold', color: '#5a6380' })
  }

  private createInfoCard() {
    this.infoCard = this.add.container(195, 503).setDepth(35).setAlpha(0)
    const shadow = this.add.rectangle(3, 5, 338, 118, 0x26335a, 0.18)
    const bg = this.add.rectangle(0, 0, 338, 118, 0x5045ad, 0.98).setStrokeStyle(2, 0xdcd7ff)
    const imageBg = this.add.circle(-128, 4, 39, 0xffffff, 0.95).setStrokeStyle(2, 0xbdb4f5)
    this.infoImage = this.add.image(-128, 4, 'mascot').setDisplaySize(58, 58)
    this.infoTitle = this.add.text(-80, -43, '', { fontFamily: 'Microsoft YaHei', fontSize: '14px', fontStyle: 'bold', color: '#ffe28d' })
    this.infoBody = this.add.text(-80, -15, '', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#ffffff', wordWrap: { width: 228, useAdvancedWrap: true }, lineSpacing: 5 })
    this.infoCard.add([shadow, bg, imageBg, this.infoImage, this.infoTitle, this.infoBody])
  }

  private createIntro() {
    this.introPanel = this.add.container(195, 438).setDepth(80)
    const shade = this.add.rectangle(0, 0, 350, 574, 0xffffff, 0.99).setStrokeStyle(3, 0x7564df)
    const title = this.add.text(0, -247, '先认识一下眼球吧！', { fontFamily: 'Microsoft YaHei', fontSize: '24px', fontStyle: 'bold', color: '#4f46a5' }).setOrigin(0.5)
    const sub = this.add.text(0, -214, '它不是一个空心球，而是一台立体的“视觉小相机”', { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#68718a' }).setOrigin(0.5)
    const modelShadow = this.add.ellipse(4, -38, 274, 26, 0x49536c, 0.18)
    const model = this.add.image(0, -120, 'eye3d').setDisplaySize(310, 207)
    this.tweens.add({ targets: model, angle: { from: -1.2, to: 1.2 }, y: { from: -123, to: -117 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    this.tweens.add({ targets: modelShadow, scaleX: 0.93, alpha: 0.1, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    const guideBg = this.add.rectangle(0, 3, 314, 50, 0xeef7ff).setStrokeStyle(1, 0xc7def0)
    const guide = this.add.text(0, 3, '左边：光线进入眼睛   →   右边：信号传给大脑', { fontFamily: 'Microsoft YaHei', fontSize: '11px', fontStyle: 'bold', color: '#49657c' }).setOrigin(0.5)
    const intro = this.add.text(0, 60, '先记住完整眼球的样子。点击开始后，\n5 个部件会散落，再把它们拖回空缺位置！', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: '#4b5563', align: 'center', lineSpacing: 7 }).setOrigin(0.5)
    const scoreRules = this.add.text(0, 108, '拼对 +100 ｜ 答对 +150 ｜ 放错 -20', { fontFamily: 'Microsoft YaHei', fontSize: '10px', fontStyle: 'bold', color: '#ef9d2e' }).setOrigin(0.5)
    const best = this.add.text(0, 134, `最高分  ${this.best.toString().padStart(4, '0')}`, { fontFamily: 'Microsoft YaHei', fontSize: '11px', color: '#8b82b8' }).setOrigin(0.5)
    const start = this.makeButton(0, 180, 218, 50, '开始 · 拆散部件', () => this.startAssembly())
    const source = this.add.text(0, 222, '趣味结构示意 · 不替代医学检查或诊断', { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: '#9aa2b1' }).setOrigin(0.5)
    this.introPanel.add([shade, title, sub, modelShadow, model, guideBg, guide, intro, scoreRules, best, start, source])
  }

  private startAssembly() {
    this.state = 'scatter'
    this.score = 500
    this.placed = 0
    this.wrong = 0
    this.placedGraphics.clear()
    this.eyeModel.setAlpha(0.2)
    this.targetLayer.setAlpha(0)
    this.targetMarkers.forEach((marker) => marker.setVisible(true))
    this.tweens.add({ targets: this.introPanel, alpha: 0, duration: 240, onComplete: () => this.introPanel.setVisible(false) })
    this.quizPanel?.destroy(true)
    this.resultPanel?.destroy(true)
    this.partTokens.filter((token) => token.active).forEach((token) => token.destroy(true))
    this.placedLabels.filter((label) => label.active).forEach((label) => label.destroy(true))
    this.partTokens = []
    this.placedLabels = []
    const homes = [
      new Phaser.Math.Vector2(78, 640), new Phaser.Math.Vector2(195, 640), new Phaser.Math.Vector2(312, 640),
      new Phaser.Math.Vector2(136, 729), new Phaser.Math.Vector2(254, 729),
    ]
    Phaser.Utils.Array.Shuffle(homes)
    this.time.delayedCall(280, () => {
      PARTS.forEach((part, i) => this.createPartToken(part, homes[i], true, i))
    })
    this.tweens.add({ targets: this.targetLayer, alpha: 1, duration: 320, delay: 220 })
    this.time.delayedCall(1450, () => {
      this.state = 'assemble'
      this.showMessage('部件已经散开啦！观察形状，把它们拖回眼球的空缺位置。')
    })
    this.updateHud()
  }

  private createPartToken(part: EyePart, home: Phaser.Math.Vector2, scatter = false, order = 0) {
    const root = this.add.container(scatter ? part.target.x : home.x, scatter ? part.target.y : home.y).setSize(108, 76).setDepth(20)
    const shadow = this.add.rectangle(3, 5, 108, 76, 0x74809d, 0.25)
    const card = this.add.rectangle(0, 0, 108, 76, 0xffffff).setStrokeStyle(2, part.color)
    const iconBg = this.add.circle(-28, 0, 26, part.color, 0.12)
    const icon = this.add.image(-28, 0, part.asset).setDisplaySize(part.iconSize[0], part.iconSize[1])
    const label = this.add.text(22, -13, part.name, { fontFamily: 'Microsoft YaHei', fontSize: '14px', fontStyle: 'bold', color: '#3d4660' }).setOrigin(0.5)
    const clue = this.add.text(22, 13, part.clue, { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: '#7a849b' }).setOrigin(0.5)
    root.add([shadow, card, iconBg, icon, label, clue])
    root.setData('part', part).setData('homeX', home.x).setData('homeY', home.y)
    const enableDrag = () => {
      if (!root.active) return
      root.setInteractive({ useHandCursor: true, draggable: true })
      this.input.setDraggable(root)
    }
    root.on('dragstart', () => {
      if (this.state === 'assemble') {
        root.setDepth(50).setScale(1.08)
        this.targetMarkers.get(part.id)?.setScale(1.16)
      }
    })
    root.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.state === 'assemble') root.setPosition(dragX, dragY)
    })
    root.on('dragend', () => {
      this.targetMarkers.get(part.id)?.setScale(1)
      this.checkPlacement(root)
    })
    if (scatter) {
      root.setAlpha(0.3).setScale(0.42).setDepth(28)
      this.tweens.add({
        targets: root,
        x: home.x,
        y: home.y,
        alpha: 1,
        scale: 1,
        duration: 620,
        delay: order * 105,
        ease: 'Back.Out',
        onComplete: () => { root.setDepth(20); enableDrag() },
      })
    } else {
      enableDrag()
    }
    this.partTokens.push(root)
  }

  private checkPlacement(token: Phaser.GameObjects.Container) {
    if (this.state !== 'assemble' || !token.active) return
    const part = token.getData('part') as EyePart
    const distance = Phaser.Math.Distance.Between(token.x, token.y, part.target.x, part.target.y)
    if (distance <= 68) {
      token.disableInteractive()
      this.tweens.add({ targets: token, x: part.target.x, y: part.target.y, alpha: 0, scale: 0.5, duration: 240, onComplete: () => token.destroy(true) })
      this.targetMarkers.get(part.id)?.setVisible(false)
      this.drawPlacedPart(part)
      this.placed += 1
      this.score += 100
      this.showFact(part)
      this.updateHud()
      if (this.placed === PARTS.length) this.time.delayedCall(1500, () => this.showAssemblyComplete())
    } else {
      this.wrong += 1
      this.score = Math.max(0, this.score - 20)
      this.cameras.main.shake(110, 0.006)
      this.tweens.add({ targets: token, x: token.getData('homeX'), y: token.getData('homeY'), scale: 1, duration: 280, ease: 'Back.Out', onComplete: () => token.setDepth(20) })
      this.showMessage(`提示：${part.name}是“${part.clue}”，再观察它的形状吧！`)
      this.updateHud()
    }
  }

  private drawPlacedPart(part: EyePart) {
    const g = this.placedGraphics
    if (part.id === 'cornea') {
      g.fillStyle(part.color, 0.42).fillEllipse(70, 326, 38, 108)
      g.lineStyle(7, 0x5de3f4, 0.18).strokeEllipse(70, 326, 42, 112)
      g.lineStyle(3, 0x209fbe, 0.95).strokeEllipse(70, 326, 38, 108)
      g.lineStyle(2, 0xffffff, 0.9).beginPath().arc(68, 319, 14, 3.8, 5.1).strokePath()
    } else if (part.id === 'iris') {
      g.fillStyle(part.color, 0.95).fillEllipse(111, 326, 27, 92)
      g.lineStyle(4, 0x8de4c7, 0.9).strokeEllipse(111, 326, 21, 80)
      g.fillStyle(0x24364d).fillEllipse(111, 326, 9, 40)
    } else if (part.id === 'lens') {
      g.fillStyle(part.color, 0.78).fillEllipse(151, 326, 42, 80)
      g.lineStyle(7, 0xffe393, 0.25).strokeEllipse(151, 326, 47, 85)
      g.lineStyle(3, 0xd79717, 0.95).strokeEllipse(151, 326, 42, 80)
      g.lineStyle(2, 0xffffff, 0.8).beginPath().arc(149, 317, 13, 3.7, 5.1).strokePath()
    } else if (part.id === 'retina') {
      g.lineStyle(15, part.color, 0.18).beginPath().arc(194, 326, 108, -1.08, 1.08).strokePath()
      g.lineStyle(8, part.color, 0.93).beginPath().arc(194, 326, 106, -1.08, 1.08).strokePath()
      g.lineStyle(2, 0xffe2e7, 0.9).beginPath().arc(194, 326, 101, -1.04, 1.04).strokePath()
    } else {
      g.fillStyle(part.color, 0.9).fillRoundedRect(298, 310, 72, 32, 14)
      g.lineStyle(8, 0xbda8ef, 0.25).strokeRoundedRect(295, 307, 77, 38, 16)
      g.lineStyle(3, 0x7250b3, 0.95).strokeRoundedRect(298, 310, 72, 32, 14)
      g.lineStyle(2, 0xe7ddff, 0.85).lineBetween(310, 318, 357, 318)
    }

    const above = part.id === 'iris' || part.id === 'retina'
    const labelY = part.target.y + (above ? 63 : -63)
    const label = this.add.container(part.target.x, labelY).setDepth(12)
    const bg = this.add.rectangle(0, 0, 67, 24, 0xffffff, 0.96).setStrokeStyle(2, part.color)
    const text = this.add.text(0, 0, `✓ ${part.name}`, { fontFamily: 'Microsoft YaHei', fontSize: '10px', fontStyle: 'bold', color: '#465169' }).setOrigin(0.5)
    label.add([bg, text]).setScale(0.2).setAlpha(0)
    this.tweens.add({ targets: label, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' })
    this.placedLabels.push(label)
  }

  private showFact(part: EyePart) {
    this.infoImage.setTexture(part.asset).setDisplaySize(part.iconSize[0] * 1.15, part.iconSize[1] * 1.15)
    this.infoTitle.setText(`科普卡解锁 · ${part.name}`)
    this.infoBody.setText(part.fact)
    this.tweens.killTweensOf(this.infoCard)
    this.infoCard.setAlpha(0).setY(516)
    this.tweens.add({ targets: this.infoCard, alpha: 1, y: 503, duration: 180, yoyo: true, hold: 1450 })
  }

  private showMessage(text: string) {
    this.infoImage.setTexture('mascot').setDisplaySize(58, 58)
    this.infoTitle.setText('小瞳提示')
    this.infoBody.setText(text)
    this.tweens.killTweensOf(this.infoCard)
    this.infoCard.setAlpha(1)
    this.tweens.add({ targets: this.infoCard, alpha: 0, duration: 180, delay: 900 })
  }

  private showAssemblyComplete() {
    if (this.state !== 'assemble') return
    this.state = 'quiz'
    this.eyeModel.setAlpha(1)
    this.targetLayer.setAlpha(0)
    this.tweens.add({ targets: this.eyeModel, scale: { from: 0.96, to: 1 }, duration: 420, ease: 'Back.Out' })
    const panel = this.add.container(195, 469).setDepth(75)
    const bg = this.add.rectangle(0, 0, 344, 358, 0xffffff, 0.99).setStrokeStyle(3, 0x6d5bd7)
    const miniEye = this.add.image(0, -105, 'eye3d').setDisplaySize(188, 125)
    const title = this.add.text(0, -27, '3D 眼球组装完成！', { fontFamily: 'Microsoft YaHei', fontSize: '23px', fontStyle: 'bold', color: '#4f46a5' }).setOrigin(0.5)
    const body = this.add.text(0, 29, '光线经过角膜、虹膜和晶状体，\n到达视网膜，再由视神经把信号送给大脑。', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#596174', align: 'center', lineSpacing: 7 }).setOrigin(0.5)
    const button = this.makeButton(0, 111, 210, 52, '进入功能问答', () => { panel.destroy(true); this.startQuiz() })
    const helper = this.add.text(0, 157, '记住：眼睛和大脑要一起工作，我们才能看见', { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: '#8a92a8' }).setOrigin(0.5)
    panel.add([bg, miniEye, title, body, button, helper])
  }

  private startQuiz() {
    this.quizIndex = 0
    this.quizCorrect = 0
    this.showQuizQuestion()
  }

  private showQuizQuestion() {
    this.quizPanel?.destroy(true)
    if (this.quizIndex >= QUIZ.length) {
      this.showResult()
      return
    }
    const item = QUIZ[this.quizIndex]
    const panel = this.add.container(195, 440).setDepth(76)
    const bg = this.add.rectangle(0, 0, 346, 440, 0xffffff, 0.99).setStrokeStyle(3, 0x6d5bd7)
    const eye = this.add.image(0, -157, 'eye3d').setDisplaySize(128, 85)
    const progress = this.add.text(0, -100, `功能问答  ${this.quizIndex + 1} / ${QUIZ.length}`, { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: '#7569b1' }).setOrigin(0.5)
    const question = this.add.text(0, -44, item.question, { fontFamily: 'Microsoft YaHei', fontSize: '17px', fontStyle: 'bold', color: '#39415c', align: 'center', wordWrap: { width: 292, useAdvancedWrap: true }, lineSpacing: 6 }).setOrigin(0.5)
    panel.add([bg, eye, progress, question])
    item.options.forEach((option, i) => {
      const answer = this.makeButton(0, 34 + i * 62, 272, 48, `${String.fromCharCode(65 + i)}. ${option}`, () => this.answerQuiz(i))
      panel.add(answer)
    })
    const helper = this.add.text(0, 200, '回想刚才的 3D 模型，选出正确答案', { fontFamily: 'Microsoft YaHei', fontSize: '10px', color: '#9aa2b1' }).setOrigin(0.5)
    panel.add(helper)
    this.quizPanel = panel
  }

  private answerQuiz(index: number) {
    const item = QUIZ[this.quizIndex]
    if (index === item.answer) {
      this.quizCorrect += 1
      this.score += 150
      this.showMessage('回答正确！眼球各部分需要一起合作，才能让我们看见。')
    } else {
      this.showMessage(`正确答案是“${item.options[item.answer]}”，记住它的功能哦！`)
    }
    this.updateHud()
    this.quizIndex += 1
    this.time.delayedCall(700, () => this.showQuizQuestion())
  }

  private showResult() {
    this.state = 'result'
    this.quizPanel?.destroy(true)
    this.best = Math.max(this.best, this.score)
    localStorage.setItem('eye-anatomy-best', String(this.best))
    const panel = this.add.container(195, 444).setDepth(78)
    const bg = this.add.rectangle(0, 0, 344, 502, 0xffffff, 0.99).setStrokeStyle(3, 0x6d5bd7)
    const eye = this.add.image(0, -178, 'eye3d').setDisplaySize(185, 123)
    const mascot = this.add.image(118, -186, 'mascot').setDisplaySize(67, 67)
    const title = this.add.text(0, -93, '眼球结构小专家', { fontFamily: 'Microsoft YaHei', fontSize: '25px', fontStyle: 'bold', color: '#4f46a5' }).setOrigin(0.5)
    const score = this.add.text(0, -38, `${this.score} 分`, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ef9d2e' }).setOrigin(0.5)
    const stats = this.add.text(0, 29, `成功拼装  ${this.placed} / 5\n问答正确  ${this.quizCorrect} / 3\n最高纪录  ${this.best}`, { fontFamily: 'Microsoft YaHei', fontSize: '14px', color: '#596174', align: 'center', lineSpacing: 8 }).setOrigin(0.5)
    const fact = this.add.text(0, 116, '眼睛负责接收光线，大脑负责读懂信号。\n保护眼睛，也要记得每天增加户外活动！', { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#4f46a5', align: 'center', lineSpacing: 5 }).setOrigin(0.5)
    const restart = this.makeButton(0, 190, 210, 52, '再看一次 3D 眼球', () => {
      panel.destroy(true)
      this.introPanel.setVisible(true).setAlpha(1)
      this.state = 'intro'
    })
    const note = this.add.text(0, 234, '趣味结构示意 · 不替代医学检查或诊断', { fontFamily: 'Microsoft YaHei', fontSize: '9px', color: '#a0a6b4' }).setOrigin(0.5)
    panel.add([bg, eye, mascot, title, score, stats, fact, restart, note])
    this.resultPanel = panel
  }

  private updateHud() {
    this.hudProgress.setText(`${this.placed} / 5`)
    this.hudScore.setText(this.score.toString().padStart(4, '0'))
  }

  private makeButton(x: number, y: number, width: number, height: number, text: string, onClick: () => void) {
    const button = this.add.container(x, y).setSize(width, height)
    const shadow = this.add.rectangle(2, 4, width, height, 0x3c347c, 0.24)
    const bg = this.add.rectangle(0, 0, width, height, 0x6d5bd7).setStrokeStyle(2, 0xc8c0ff)
    const shine = this.add.rectangle(0, -height * 0.26, width - 8, 2, 0xffffff, 0.2)
    const label = this.add.text(0, 0, text, { fontFamily: 'Microsoft YaHei', fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5)
    button.add([shadow, bg, shine, label]).setInteractive({ useHandCursor: true })
    button.on('pointerdown', () => button.setScale(0.97))
    button.on('pointerup', () => { button.setScale(1); onClick() })
    button.on('pointerout', () => button.setScale(1))
    return button
  }
}
