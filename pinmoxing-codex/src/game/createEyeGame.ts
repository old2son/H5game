import * as Phaser from 'phaser';
import { EyeAssemblyScene } from './scenes/EyeAssemblyScene';
import { RENDER_SCALE, VIEW_HEIGHT, VIEW_WIDTH } from './constants';

export function createEyeGame(parent: string) {
	const game = new Phaser.Game({
		type: Phaser.AUTO,
		parent,
		width: VIEW_WIDTH * RENDER_SCALE,
		height: VIEW_HEIGHT * RENDER_SCALE,
		backgroundColor: '#e8f5ff',
		antialias: true,
		antialiasGL: true,
		powerPreference: 'high-performance',
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
			width: VIEW_WIDTH * RENDER_SCALE,
			height: VIEW_HEIGHT * RENDER_SCALE
		},
		input: { activePointers: 3 },
		scene: [EyeAssemblyScene]
	});
	return () => game.destroy(true);
}
