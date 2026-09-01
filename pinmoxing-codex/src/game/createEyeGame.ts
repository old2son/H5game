import * as Phaser from 'phaser'
import { EyeAssemblyScene } from './scenes/EyeAssemblyScene'

export function createEyeGame(parent: string) {
  const renderScale = 4
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 390 * renderScale,
    height: 844 * renderScale,
    backgroundColor: '#e8f5ff',
    antialias: true,
    antialiasGL: true,
    powerPreference: 'high-performance',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 390 * renderScale, height: 844 * renderScale },
    input: { activePointers: 3 },
    scene: [EyeAssemblyScene],
  })
  return () => game.destroy(true)
}
