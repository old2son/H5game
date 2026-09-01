# 项目长期记忆 (MEMORY.md)

## 验证流程偏好
- 游戏 / 前端功能验证**不再需要生成截图**验证；用户已明确删除相关截图。
- 改用无头浏览器几何 / 冒烟验证：用定时器驱动 `requestAnimationFrame`（`setTimeout` patch）+ 日志断言确认正确性（如 `angErr`、判定点 `insideClaw`、`money` 变化、`VERSION` 等），无需渲染截图。

## 项目概况（黄金矿工小游戏）
- 技术栈：Vue 3 + Vite 8 + TypeScript，零素材（Canvas 纯矢量绘制 / Phaser 运行时 `generateTexture`）。
- 三入口：`index.html`（测试首页，两张卡片跳 canvas / phaser）、`canvas.html`（原 Canvas 版）、`phaser.html`（Phaser 版）。
- 关键根因已修复：Canvas `rotate(angle)` 与 `direction()=(sin,cos)` 的 x 符号相反导致绘制 / 判定左右镜像；统一 `render` 用 `ctx.rotate(-angle)`。
- Phaser 版使用 `phaser@^4.0.0`：ESM 具名导出需 `import * as Phaser from 'phaser'`；`Phaser.Geom.Point` 已移除，改用 `Phaser.Math.Vector2`。
- 开发服务器端口 **5188**（`--strictPort`，5173/5174 被 secha / shenmiaotaopao 项目占用）。
