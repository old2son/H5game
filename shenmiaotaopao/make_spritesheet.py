from PIL import Image
import os

SRC = r'G:/MyProject/game/shenmiaotaopao/public/characters'

# 帧顺序：左脚踏地 -> 双腿交错 -> 右脚踏地 -> 腾空
RUN_FRAMES = [
    ('Identical_blue_tracksuit_boy_w_2026-08-26T01-12-45.png', 'left_contact'),
    ('Identical_blue_tracksuit_boy_w_2026-08-26T01-15-30.png', 'passing'),
    ('Identical_blue_tracksuit_boy_w_2026-08-26T01-14-58.png', 'right_contact'),
    ('Identical_blue_tracksuit_boy_w_2026-08-26T01-13-58.png', 'airborne'),
]
JUMP_SRC = 'Identical_blue_tracksuit_boy_w_2026-08-26T01-18-16.png'
SLIDE_SRC = 'Identical_blue_tracksuit_boy_w_2026-08-26T01-18-17.png'


def remove_bg(img, threshold=45, feather=35):
    """以四角/边缘采样估计绿幕背景，将其替换为透明，并做边缘羽化。"""
    img = img.convert('RGBA')
    w, h = img.size
    data = list(img.getdata())

    # 采样背景色：四角 + 四边中点
    samples = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1),
    ]
    bg = [0, 0, 0]
    for x, y in samples:
        c = data[y * w + x]
        for i in range(3):
            bg[i] += c[i]
    bg = tuple(v // len(samples) for v in bg)

    new_data = []
    for r, g, b, a in data:
        dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
        if dist < threshold:
            new_data.append((0, 0, 0, 0))
        elif dist < threshold + feather:
            alpha = int(255 * (dist - threshold) / feather)
            # 简单 alpha 混合，保留前景颜色
            new_data.append((r, g, b, alpha))
        else:
            new_data.append((r, g, b, 255))
    img.putdata(new_data)
    return img


def get_bbox(img, alpha_threshold=30):
    data = list(img.getdata())
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if data[y * w + x][3] > alpha_threshold:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x <= min_x:
        return (0, 0, w, h)
    return (min_x, min_y, max_x + 1, max_y + 1)


def process_to_canvas(img, canvas_w, canvas_h, bottom_margin=8):
    """去背 -> 裁切到角色 bbox -> 等比缩放 -> 水平居中、底部对齐画布。"""
    img = remove_bg(img)

    # 剔除残留水印/绿边：alpha 较低的像素直接变透明
    data = list(img.getdata())
    cleaned = [(r, g, b, 0) if a < 70 else (r, g, b, a) for r, g, b, a in data]
    img.putdata(cleaned)

    # 强制清除右下角固定区域的水印（角色不会延伸到该角落），同时保留其他像素的原有 alpha
    w, h = img.size
    wm_w = int(w * 0.22)
    wm_h = int(h * 0.12)
    data = list(img.getdata())
    cleaned2 = []
    for idx, (r, g, b, a) in enumerate(data):
        x = idx % w
        y = idx // w
        if x >= w - wm_w and y >= h - wm_h:
            cleaned2.append((r, g, b, 0))
        else:
            cleaned2.append((r, g, b, a))
    img.putdata(cleaned2)

    bbox = get_bbox(img)
    cropped = img.crop(bbox)

    # 计算可用区域，保持宽高比缩放
    avail_w = canvas_w - bottom_margin * 2
    avail_h = canvas_h - bottom_margin * 2
    iw, ih = cropped.size
    scale = min(avail_w / iw, avail_h / ih)
    new_w = max(1, int(iw * scale))
    new_h = max(1, int(ih * scale))
    cropped = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - new_w) // 2
    y = canvas_h - new_h - bottom_margin
    canvas.paste(cropped, (x, y), cropped)
    return canvas


def main():
    frame_w, frame_h = 256, 320
    frames = []
    for fname, _ in RUN_FRAMES:
        img = Image.open(os.path.join(SRC, fname))
        canvas = process_to_canvas(img, frame_w, frame_h, bottom_margin=8)
        frames.append(canvas)

    # 合成横向精灵图
    sheet = Image.new('RGBA', (frame_w * len(frames), frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * frame_w, 0), f)
    sheet_path = os.path.join(SRC, 'run_sheet.png')
    sheet.save(sheet_path)
    print(f'run_sheet.png -> {sheet.size}')

    # 跳跃图：256x320
    jump = Image.open(os.path.join(SRC, JUMP_SRC))
    jump_canvas = process_to_canvas(jump, 256, 320, bottom_margin=8)
    jump_canvas.save(os.path.join(SRC, 'jump.png'))
    print(f'jump.png -> {jump_canvas.size}')

    # 滑铲图：320x180
    slide = Image.open(os.path.join(SRC, SLIDE_SRC))
    slide_canvas = process_to_canvas(slide, 320, 180, bottom_margin=6)
    slide_canvas.save(os.path.join(SRC, 'slide.png'))
    print(f'slide.png -> {slide_canvas.size}')


if __name__ == '__main__':
    main()
