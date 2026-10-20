#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从单张站立立绘生成「行走 / 待机」帧贴图。

源图：public/assets/orange-eye-mascot-original.png（600x600，角色正面站立，没有腿）
输出：public/assets/orange-eye-mascot-walk.png
      —— 12 帧横向排列，每帧 320x320：帧 0-7 行走（朝右），帧 8-11 待机呼吸。

角色没有四肢，所以"走路"用挤压拉伸 + 前倾 + 上下弹跳来表达；
每帧角色都居中放，只占画面宽度 86%，留出旋转和弹跳的空间。

游戏里只加载这一张图：向右走直接播帧，向左走用 sprite.setFlipX(true) 水平翻转，
不需要再单独出一套朝左的图。

跑法： python tools/generate-walk-frames.py            # 只出贴图
       python tools/generate-walk-frames.py --preview  # 另外在 tools/preview/ 出对照图和 GIF
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "assets" / "orange-eye-mascot-original.png"
OUT_SHEET = ROOT / "public" / "assets" / "orange-eye-mascot-walk.png"
PREVIEW_DIR = ROOT / "tools" / "preview"

FRAME = 320
ART_FRACTION = 0.86  # 角色宽度占帧宽度的比例，剩下的是运动余量
WALK_COUNT = 8
IDLE_COUNT = 4

PREVIEW_BG = (233, 246, 255, 255)
PREVIEW_GROUND = (214, 240, 223, 255)

TITLE_COLOR = (70, 100, 115, 255)

# 每帧参数：(sx, sy, angle, dx, dy)
#   sx / sy : 横向 / 纵向缩放（挤压拉伸，近似保持体积）
#   angle   : 旋转角度，正数表示向右（前进方向）倾
#   dx / dy : 相对锚点的位移，单位是帧像素；dy 为正是向下
# 锚点 = 角色轮廓底边中点，"脚底"不会乱飘。
WALK_FRAMES = [
    (1.060, 0.920, 3.2, 3, 10),  # 0 落地：压扁
    (1.000, 1.030, 3.6, 5, -8),  # 1 蹬地：上升
    (0.940, 1.090, 4.2, 7, -32),  # 2 腾空最高：拉长、前倾
    (0.970, 1.045, 3.6, 5, -14),  # 3 下落
    (1.055, 0.928, 2.8, 2, 9),  # 4 落地：压扁
    (1.000, 1.026, 3.2, 4, -7),  # 5 蹬地：上升
    (0.945, 1.085, 3.8, 6, -30),  # 6 腾空最高
    (0.972, 1.042, 3.4, 4, -13),  # 7 下落
]

IDLE_FRAMES = [
    (1.000, 1.000, 0.0, 0, 0),  # 8 呼气
    (1.006, 0.993, 0.0, 0, 1),
    (1.013, 0.985, 0.0, 0, 3),  # 10 吸气
    (1.006, 0.993, 0.0, 0, 1),  # 11
]


def load_source() -> Image.Image:
    """读源图，抠到角色轮廓；源图没有 alpha 时从边缘去掉白底。"""
    img = Image.open(SRC).convert("RGBA")
    alpha = img.getchannel("A")
    if alpha.getextrema() == (255, 255):
        print("[!] 源图没有 alpha 通道，尝试从边缘抠除白底")
        img = strip_edge_white(img)
    return img.crop(content_bbox(img))


def strip_edge_white(img: Image.Image) -> Image.Image:
    rgb = img.convert("RGB")
    width, height = img.size
    mask = Image.new("L", img.size, 0)
    src_px, mask_px = rgb.load(), mask.load()
    for y in range(height):
        for x in range(width):
            r, g, b = src_px[x, y]
            if r > 240 and g > 240 and b > 240:
                mask_px[x, y] = 255
    for corner in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)):
        if mask.getpixel(corner) == 255:
            ImageDraw.floodfill(mask, corner, 128, thresh=0)
    filled = Image.new("L", img.size, 255)
    filled_px = filled.load()
    for y in range(height):
        for x in range(width):
            if mask.getpixel((x, y)) == 128:
                filled_px[x, y] = 0
    img.putalpha(filled)
    return img


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox is None:
        raise SystemExit("源图全透明，找不到角色")
    return bbox


def prepare_art(img: Image.Image) -> tuple[Image.Image, tuple[float, float]]:
    """把角色缩到 ART_FRACTION 帧宽、居中放好，返回角色图和锚点（底边中点）。"""
    art_w = round(FRAME * ART_FRACTION)
    art_h = round(art_w * img.height / img.width)
    art = img.resize((art_w, art_h), Image.Resampling.LANCZOS)
    return art, (art_w / 2, art_h)


def render_frame(art: Image.Image, anchor: tuple[float, float], sx: float, sy: float, angle: float, dx: float, dy: float) -> Image.Image:
    """围绕锚点做缩放 + 旋转 + 平移，把角色贴到 320x320 帧里。"""
    width = max(1, round(art.width * sx))
    height = max(1, round(art.height * sy))
    scaled = art.resize((width, height), Image.Resampling.LANCZOS)

    ax, ay = anchor[0] * sx, anchor[1] * sy  # 锚点在缩放后图片里的位置
    cx, cy = width / 2, height / 2

    if abs(angle) > 1e-6:
        rad = math.radians(angle)
        cos, sin = math.cos(rad), math.sin(rad)
        vx, vy = ax - cx, ay - cy
        # Pillow 的 rotate 是逆时针，屏幕坐标 y 向下
        ax_rotated = cx + vx * cos + vy * sin
        ay_rotated = cy - vx * sin + vy * cos
        rotated = scaled.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    else:
        ax_rotated, ay_rotated = ax, ay
        rotated = scaled

    target_x = FRAME / 2 + dx
    target_y = (FRAME - art.height) / 2 + anchor[1] + dy

    canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    canvas.paste(rotated, (round(target_x - ax_rotated), round(target_y - ay_rotated)), rotated)
    return canvas


def build_frames(art: Image.Image, anchor: tuple[float, float]) -> list[Image.Image]:
    return [render_frame(art, anchor, *params) for params in WALK_FRAMES + IDLE_FRAMES]


def build_strip(frames: list[Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index * FRAME, 0), frame)
    return sheet


def load_font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def build_preview(frames: list[Image.Image]) -> Image.Image:
    columns, rows = 6, 2
    cell = FRAME // 2
    pad, label_h = 12, 22
    width = columns * (cell + pad) + pad
    height = rows * (cell + label_h + pad) + pad
    preview = Image.new("RGBA", (width, height), PREVIEW_BG)
    draw = ImageDraw.Draw(preview)
    font = load_font(15)
    for index, frame in enumerate(frames):
        col, row = index % columns, index // columns
        x = pad + col * (cell + pad)
        y = pad + row * (cell + label_h + pad)
        tile = frame.resize((cell, cell), Image.Resampling.LANCZOS)
        preview.paste(Image.new("RGBA", (cell, cell), PREVIEW_GROUND), (x, y))
        preview.paste(tile, (x, y), tile)
        label = f"#{index} walk" if index < WALK_COUNT else f"#{index} idle"
        draw.text((x + 2, y + cell + 3), label, fill=TITLE_COLOR, font=font)
    return preview


def build_direction_preview(frames: list[Image.Image]) -> Image.Image:
    """上排朝右的 4 帧，下排是把同样几帧水平翻转后的效果（就是游戏里的做法）。"""
    picked = frames[:4]
    cell = FRAME * 3 // 4
    gap, label_h, pad = 14, 28, 14
    width = pad * 2 + len(picked) * cell + (len(picked) - 1) * gap
    height = pad * 2 + label_h * 2 + cell * 2 + gap
    preview = Image.new("RGBA", (width, height), PREVIEW_BG)
    draw = ImageDraw.Draw(preview)
    font, title_font = load_font(16), load_font(18)
    draw.text((pad, pad), "walk right (frames 0-3 as authored)", fill=TITLE_COLOR, font=title_font)
    for index, frame in enumerate(picked):
        x = pad + index * (cell + gap)
        y = pad + label_h
        tile = frame.resize((cell, cell), Image.Resampling.LANCZOS)
        preview.paste(Image.new("RGBA", (cell, cell), PREVIEW_GROUND), (x, y))
        preview.paste(tile, (x, y), tile)
    second_y = pad + label_h + cell + gap
    draw.text((pad, second_y - label_h), "walk left (same frames, setFlipX true)", fill=TITLE_COLOR, font=title_font)
    for index, frame in enumerate(picked):
        x = pad + index * (cell + gap)
        tile = frame.resize((cell, cell), Image.Resampling.LANCZOS).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        preview.paste(Image.new("RGBA", (cell, cell), PREVIEW_GROUND), (x, second_y))
        preview.paste(tile, (x, second_y), tile)
    return preview


def build_gif(frames: list[Image.Image]) -> None:
    walk = frames[:WALK_COUNT]
    idle = frames[WALK_COUNT:]
    flat = [Image.alpha_composite(Image.new("RGBA", (FRAME, FRAME), PREVIEW_GROUND), f) for f in walk + idle]
    durations = [70] * len(walk) + [190] * len(idle)
    flat[0].save(
        PREVIEW_DIR / "orange-eye-walk.gif",
        save_all=True,
        append_images=flat[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=True,
    )


def main() -> None:
    source = load_source()
    print(f"source {source.size} px")
    art, anchor = prepare_art(source)
    print(f"art {art.size} px, anchor {anchor}")
    frames = build_frames(art, anchor)

    sheet = build_strip(frames)
    OUT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT_SHEET, optimize=True)
    print(f"sheet {OUT_SHEET}  {sheet.width}x{sheet.height}  {OUT_SHEET.stat().st_size / 1024:.0f} KB")

    # 预览图只是调试用，直接跑项目就能看到效果，所以默认不生成
    if "--preview" not in sys.argv[1:]:
        return

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    build_preview(frames).save(PREVIEW_DIR / "orange-eye-walk-preview.png")
    build_direction_preview(frames).save(PREVIEW_DIR / "orange-eye-walk-direction.png")
    build_gif(frames)
    print(f"previews in {PREVIEW_DIR}")


if __name__ == "__main__":
    main()
