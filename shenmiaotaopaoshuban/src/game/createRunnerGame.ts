import * as Phaser from 'phaser'
import { RunnerScene } from './scenes/RunnerScene'

export function createRunnerGame(parent: string) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 844,
    backgroundColor: '#c9f1fb',
    transparent: false,
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 390,
      height: 844,
    },
    input: {
      activePointers: 3,
    },
    scene: [RunnerScene],
  })

  return () => game.destroy(true)
}
