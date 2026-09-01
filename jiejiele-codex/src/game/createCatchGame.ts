import * as Phaser from 'phaser'
import { CatchGameScene } from './scenes/CatchGameScene'

const LOGICAL_WIDTH = 390
const LOGICAL_HEIGHT = 844
const RENDER_SCALE = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)))

export function createCatchGame(parent: string) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: LOGICAL_WIDTH * RENDER_SCALE,
    height: LOGICAL_HEIGHT * RENDER_SCALE,
    backgroundColor: '#dff3ff',
    antialias: true,
    antialiasGL: true,
    powerPreference: 'high-performance',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LOGICAL_WIDTH * RENDER_SCALE,
      height: LOGICAL_HEIGHT * RENDER_SCALE,
    },
    input: { activePointers: 3 },
    scene: [CatchGameScene],
  })

  return () => game.destroy(true)
}
