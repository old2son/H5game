import * as Phaser from 'phaser'
import { GameScene, WORLD_W, WORLD_H, DPR } from './GameScene'

/**
 * 分辨率策略：
 * - 世界坐标固定 WORLD_W×WORLD_H（竖版 540×960），游戏逻辑与画布尺寸解耦
 * - scale.mode = NONE，由 GameScene#fitCamera 自行计算显示尺寸并调用 setGameSize，
 *   使 canvas 物理像素 = CSS 显示尺寸 × DPR，做到 1:1 采样（此前用 FIT 模式会把
 *   画布拉伸到全屏，放大后双线性插值导致整体发虚）
 * - 世界内容靠 camera zoom 填满画布，故所有绘制坐标无需改动
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: WORLD_W,
  height: WORLD_H,
  backgroundColor: '#1a120b',
  scale: {
    mode: Phaser.Scale.NONE,
    // 不用 autoCenter：定位交给 #game-root 的 flex 居中，避免 setGameSize 后
    // Phaser 重算 canvas margin 造成画面整体平移（首屏跳变元凶之一）
    autoCenter: Phaser.Scale.NO_CENTER,
    autoRound: true,
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
