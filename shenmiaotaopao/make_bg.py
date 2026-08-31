from PIL import Image
import glob, os, re, shutil

OUT = r'G:/MyProject/game/shenmiaotaopao/public/backgrounds'

def newest(prefix):
    """按文件名前缀找刚生成的图片（按修改时间）。"""
    files = glob.glob(os.path.join(OUT, prefix + '*.png'))
    files = [f for f in files if not f.endswith(('_sky.png','_cloud.png','_hill.png','_ground.png'))]
    return max(files, key=os.path.getmtime)

def avg_color(rgb_list):
    if not rgb_list:
        return (0,0,0)
    r = sum(c[0] for c in rgb_list) // len(rgb_list)
    g = sum(c[1] for c in rgb_list) // len(rgb_list)
    b = sum(c[2] for c in rgb_list) // len(rgb_list)
    return (r,g,b)

def remove_bg(img, target_bg, threshold=90):
    """按已知的纯色幕布（如绿幕 #00ff00、蓝幕 #0000ff）精确抠图。"""
    img = img.convert('RGBA')
    bg = target_bg
    data = list(img.getdata())
    out = []
    for r,g,b,a in data:
        dist = abs(r-bg[0]) + abs(g-bg[1]) + abs(b-bg[2])
        if dist < threshold:
            out.append((r,g,b,0))
        else:
            # 边缘软化：在阈值附近渐变 alpha
            if dist < threshold + 50:
                alpha = int(a * (dist - threshold) / 50)
                out.append((r,g,b,alpha))
            else:
                out.append((r,g,b,a))
    img.putdata(out)
    return img

def mask_watermark(img, fill_mode='transparent'):
    """右下角 AI 水印区域处理：透明或填色。"""
    w, h = img.size
    region_w = min(140, w // 4)
    region_h = min(70, h // 8)
    left = w - region_w
    top = h - region_h
    if fill_mode == 'transparent':
        mask = img.split()[-1]
        mask.paste(0, (left, top, w, h))
        img.putalpha(mask)
    else:
        # 用底部非水印区域均值颜色填充（适用于天空等不透明图）
        sample = img.crop((0, h - region_h, left, h))
        c = avg_color([p[:3] for p in sample.getdata()])
        patch = Image.new('RGBA', (region_w, region_h), c + (255,))
        img.paste(patch, (left, top))
    return img

def make_seamless(img, b=40):
    """让左右边缘可无缝拼接（水平方向）。"""
    w, h = img.size
    if b >= w:
        return img
    px = img.load()
    # 取左边缘 b 列作为右边缘的过渡目标
    for x in range(w - b, w):
        k = x - (w - b)           # 0..b-1
        alpha = k / (b - 1)       # 0 -> 1
        for y in range(h):
            lc = px[k, y]         # 左边缘对应列
            rc = px[x, y]
            # 越靠右，越接近左侧对应列的颜色（alpha 通道也做混合）
            r = int(rc[0] * (1 - alpha) + lc[0] * alpha)
            g = int(rc[1] * (1 - alpha) + lc[1] * alpha)
            b_ = int(rc[2] * (1 - alpha) + lc[2] * alpha)
            a = int(rc[3] * (1 - alpha) + lc[3] * alpha)
            px[x, y] = (r, g, b_, a)
    return img

def save_sky():
    src = newest('Mobile_game_vertical_sky_backg')
    img = Image.open(src).convert('RGBA')
    img = mask_watermark(img, fill_mode='fill')
    img = img.resize((540, 960), Image.LANCZOS)
    img.save(os.path.join(OUT, 'sky.png'))
    print('sky.png', img.size)

def save_cloud():
    src = newest('Several_white_fluffy_cartoon_c')
    img = Image.open(src).convert('RGBA')
    img = remove_bg(img, target_bg=(0, 255, 0), threshold=120)
    img = mask_watermark(img, 'transparent')
    img = img.resize((540, 540), Image.LANCZOS)
    img = make_seamless(img, 50)
    # 取上半部分作为云带
    cloud = img.crop((0, 0, 540, 140))
    cloud.save(os.path.join(OUT, 'cloud.png'))
    print('cloud.png', cloud.size)

def save_hill():
    src = newest('Smooth_rolling_hills_silhouett')
    img = Image.open(src).convert('RGBA')
    img = remove_bg(img, target_bg=(0, 0, 255), threshold=120)
    img = mask_watermark(img, 'transparent')
    img = img.resize((540, 540), Image.LANCZOS)
    img = make_seamless(img, 50)
    # 取底部 240 行（山丘在底部）
    hill = img.crop((0, 540-240, 540, 540))
    hill.save(os.path.join(OUT, 'hill.png'))
    print('hill.png', hill.size)

def save_ground():
    src = newest('A_horizontal_strip_of_ground___')
    img = Image.open(src).convert('RGBA')
    img = remove_bg(img, target_bg=(0, 0, 255), threshold=120)
    img = mask_watermark(img, 'transparent')
    img = img.resize((540, 540), Image.LANCZOS)
    img = make_seamless(img, 50)
    # 取底部 160 行
    ground = img.crop((0, 540-160, 540, 540))
    ground.save(os.path.join(OUT, 'ground.png'))
    print('ground.png', ground.size)

if __name__ == '__main__':
    save_sky()
    save_cloud()
    save_hill()
    save_ground()
    # 清理临时源图
    for f in glob.glob(os.path.join(OUT, '*.png')):
        if os.path.basename(f) not in ('sky.png','cloud.png','hill.png','ground.png'):
            os.remove(f)
    print('done')
