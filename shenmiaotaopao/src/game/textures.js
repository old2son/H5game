// 使用 Phaser Graphics 程序化生成玩法对象纹理
// 障碍已改用外部图片 /boss/obs.png；背景（天空/云/地面）由 background.js 处理
export function generateTextures(scene) {
	makeRect(scene, 'pixel', 8, 8, (g) => {
		g.fillStyle(0xffffff, 1);
		g.fillRect(0, 0, 8, 8);
	});
	makeRect(scene, 'coin', 28, 28, (g, w, h) => {
		g.fillStyle(0xffb300, 1);
		g.fillCircle(w / 2, h / 2, 13);
		g.fillStyle(0xffd54f, 1);
		g.fillCircle(w / 2, h / 2, 9);
		g.fillStyle(0xfff8e1, 1);
		g.fillCircle(w / 2 - 3, h / 2 - 3, 3);
	});
}

function makeRect(scene, key, w, h, drawFn) {
	if (scene.textures.exists(key)) return;
	const g = scene.make.graphics({ x: 0, y: 0, add: false });
	drawFn(g, w, h);
	g.generateTexture(key, w, h);
	g.destroy();
}
