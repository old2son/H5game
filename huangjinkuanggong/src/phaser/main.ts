import * as Phaser from 'phaser'
import { GameScene } from './GameScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 960,
  height: 600,
  backgroundColor: '#1a120b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, pixelArt: false },
  scene: [GameScene],
}

// eslint-disable-next-line no-new
const game = new Phaser.Game(config)

// 仅在开发模式暴露，便于自动化冒烟测试；生产构建会被摇树移除
if (import.meta.env.DEV) {
  ;(window as unknown as { __phaser?: Phaser.Game }).__phaser = game
}
