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
    // 显示尺寸与居中完全交给 styles.css 处理（svh/svw 在移动端更稳）。
    // 这里必须用 NONE + NO_CENTER：FIT 模式下 Phaser 会额外写 canvas 的 marginLeft/marginTop 做居中，
    // 与 CSS 的 place-items:center 叠加后会偏移 1.25 倍，PC 宽屏上表现为明显的「没居中」。
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: LOGICAL_WIDTH * RENDER_SCALE,
      height: LOGICAL_HEIGHT * RENDER_SCALE,
    },
    input: { activePointers: 3 },
    scene: [CatchGameScene],
  })

  return () => game.destroy(true)
}
