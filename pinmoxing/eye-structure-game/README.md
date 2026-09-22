# 认识眼球结构 H5 小游戏

纯 HTML + CSS + JavaScript，无框架、无第三方依赖。

## 运行

直接双击 `index.html` 即可运行。

如果浏览器限制本地文件的部分行为，也可以用任意静态服务器：

```bash
npx serve .
```

## 游戏流程

开始页
→ 眼球拼装
→ 每个部件正确后显示科普卡片
→ 全部完成
→ 眼球功能问答
→ 最终评分

## 当前结构

- 角膜
- 虹膜
- 晶状体
- 视网膜
- 视神经

## 后续替换医学插画

目前眼球和结构使用 CSS 绘制，方便直接运行。

正式项目中可以将：

- `.sclera`
- `.vitreous`
- `.target-cornea`
- `.target-iris`
- `.target-lens`
- `.target-retina`
- `.optic-nerve-base`

替换为真实的 PNG/WebP/SVG 医学科普素材。

拖拽逻辑使用 Pointer Events，因此同时支持：

- PC 鼠标
- 手机触摸
- 平板触摸

不依赖 HTML5 Drag & Drop。
