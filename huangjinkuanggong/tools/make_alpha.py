"""
把白底 RGB 素材转成透明底 RGBA 游戏素材。

流程：
1. 多阈值扫描 + 连通域：只吞并「与画布边界相连」的近白区域作为背景，
   避免误删物体内部高光（钻石闪光、金块高光）。
2. 形态学清理：填充物体内部孔洞、去掉孤立噪点。
3. 边缘软化：alpha 做 1px 高斯模糊，得到抗锯齿软边。
4. 去白边（defringe）：premultiplied 均值滤波，消除白色光晕。
5. 紧致裁切到内容 bbox + 少量 padding，输出到 public/assets/。

用法：python tools/make_alpha.py [--dry]
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.orig_assets')
DST = os.path.join(ROOT, 'public', 'assets')

FILES = ['miner.png', 'gold.png', 'diamond.png', 'rock.png', 'bag.png', 'tnt.png']

DRY = '--dry' in sys.argv
# 背景被允许占据的最大面积比例；超过说明阈值太松，开始吞并物体
MAX_BG_RATIO = 0.82
# 低饱和判定：max-min 通道差
SAT_TOL = 26
# 裁切时四周留白比例（相对内容尺寸）
PAD_RATIO = 0.02
# 输出长边上限：画布已改为 1:1 物理像素采样（见 src/phaser/main.ts），
# 素材分辨率即清晰度上限。矿工/大金块全屏时可达 84 × 4(4K 屏) ≈ 336px，
# 512 保证 2K/4K 下仍是降采样；源图 1024，取 512 不会产生二次插值
MAX_EDGE = 512


def build_alpha(rgb: np.ndarray):
    """返回 (alpha 0-1 float, 选用的阈值)。"""
    h, w, _ = rgb.shape
    mn = rgb.min(axis=2).astype(np.int16)
    mx = rgb.max(axis=2).astype(np.int16)
    lum = rgb.mean(axis=2)
    low_sat = (mx - mn) < SAT_TOL

    best = None
    # 阈值从高到低扫描，逐步放宽
    for t in range(250, 174, -3):
        mask = (lum > t) & low_sat
        lbl, n = ndimage.label(mask)
        if n == 0:
            continue
        # 与画布边界相连的连通域 = 背景
        border = set(lbl[0, :].tolist()) | set(lbl[-1, :].tolist()) \
            | set(lbl[:, 0].tolist()) | set(lbl[:, -1].tolist())
        border.discard(0)
        if not border:
            continue
        bg = np.isin(lbl, list(border))
        ratio = bg.mean()
        if ratio > MAX_BG_RATIO:
            break  # 再松就吞并物体了，用上一轮结果
        best = (bg, t, ratio)

    if best is None:
        raise RuntimeError('未能确定背景区域')

    bg, t, ratio = best

    # 兜底：极端情况下（整图近白）也要有物体
    if ratio > 0.98:
        raise RuntimeError(f'背景判定失控 ratio={ratio:.3f}')

    alpha = 1.0 - bg.astype(np.float64)

    # --- 形态学清理 ---
    solid = alpha > 0.5
    solid = ndimage.binary_fill_holes(solid)          # 填物体内部孔洞
    lbl, n = ndimage.label(solid)
    if n > 0:
        sizes = ndimage.sum(solid, lbl, range(1, n + 1))
        keep = np.where(sizes > solid.size * 0.001)[0] + 1  # 去掉 <0.1% 的噪点
        solid = np.isin(lbl, keep)
    alpha = solid.astype(np.float64)

    return alpha, t, ratio


def soften_defringe(rgb: np.ndarray, alpha: np.ndarray, radius: float = 1.0):
    """软化边缘 + 去白边。

    去白边用「距离变换颜色外推」：先侵蚀出确定实体核心，再把核心之外的所有像素
    （含半透明边缘）的颜色替换为最近的实体像素颜色。相比均值滤波，它能彻底
    消除物体外围辉光/背景混色造成的白色描边。
    """
    f = rgb.astype(np.float64)

    # 1) 软边 alpha
    a = ndimage.gaussian_filter(alpha, radius, mode='nearest')
    a = np.clip(a, 0.0, 1.0)
    a[alpha <= 0.0] = 0.0  # 原本完全透明的保持完全透明，避免全图蒙一层雾

    # 2) 去白边：颜色外推
    solid = alpha > 0.5
    # 侵蚀一圈得到"确定实体"核心，避免取样到与背景混合的边缘像素
    core = ndimage.binary_erosion(solid, structure=np.ones((3, 3), bool), iterations=1)
    if not core.any():  # 极端细长物体退化保护
        core = solid
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    nearest = f[iy, ix]

    # 细结构保护：引线、火花这类只有 1~3px 宽的部分会被侵蚀抹掉，
    # 若对它们也做外推会把颜色污染成邻近主体色，因此保留原色。
    nb = ndimage.uniform_filter(solid.astype(np.float64), size=3, mode='nearest') * 9.0
    thin = solid & ~core & (nb < 6)
    replace = (~solid) | (solid & ~core & ~thin)

    out = np.where(replace[..., None], nearest, f)
    return np.clip(out, 0, 255).astype(np.uint8), a


def main():
    for f in FILES:
        src = os.path.join(SRC, f)
        im = Image.open(src).convert('RGB')
        rgb = np.asarray(im)

        alpha, t, ratio = build_alpha(rgb)
        rgb2, a = soften_defringe(rgb, alpha)

        # 裁到内容 bbox
        ys, xs = np.where(a > 0.02)
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        pad = int(max(x1 - x0, y1 - y0) * PAD_RATIO)
        x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
        x1 = min(rgb.shape[1], x1 + pad); y1 = min(rgb.shape[0], y1 + pad)

        rgb2 = rgb2[y0:y1, x0:x1]
        a = a[y0:y1, x0:x1]
        alpha_u8 = (a * 255).astype(np.uint8)

        rgba = np.dstack([rgb2, alpha_u8])
        out = Image.fromarray(rgba, mode='RGBA')

        # 降采样到 MAX_EDGE。透明区颜色已外推为物体色，
        # 因此非预乘缩放也不会在边缘混入背景白。
        if max(out.size) > MAX_EDGE:
            s = MAX_EDGE / max(out.size)
            out = out.resize(
                (max(1, round(out.size[0] * s)), max(1, round(out.size[1] * s))),
                Image.LANCZOS,
            )

        edge_px = int(((alpha_u8 > 8) & (alpha_u8 < 247)).sum())
        opaque = int((alpha_u8 > 247).sum())
        total = alpha_u8.size

        info = (f'{f:12s} thr={t}  bgRatio={ratio*100:5.1f}%  '
                f'out={out.size[0]}x{out.size[1]}  '
                f'content={100*opaque/total:4.1f}%  softEdge={100*edge_px/total:.2f}%')
        print(info)
        if not DRY:
            out.save(os.path.join(DST, f), optimize=True)

    print('\nDRY RUN - 未写入' if DRY else '\n已写入 public/assets/')


if __name__ == '__main__':
    main()
