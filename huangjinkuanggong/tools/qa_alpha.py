"""透明底素材 QA：alpha 通道、边界洁净度、白晕残留、物体是否被画布裁切。"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'public', 'assets')
ORIG = os.path.join(ROOT, '.orig_assets')
FILES = ['miner.png', 'gold.png', 'diamond.png', 'rock.png', 'bag.png', 'tnt.png']

ok = True
for f in FILES:
    p = os.path.join(ASSETS, f)
    raw = open(p, 'rb').read(33)
    ct = raw[25]
    im = Image.open(p)
    has_alpha = im.mode == 'RGBA'
    rgba = np.asarray(im.convert('RGBA')).astype(np.float64)
    a = rgba[..., 3] / 255.0

    h, w = a.shape
    # 1) 边界 3px 圈 alpha 必须为 0
    border = np.concatenate([
        a[:3, :].ravel(), a[-3:, :].ravel(), a[:, :3].ravel(), a[:, -3:].ravel()
    ])
    border_max = border.max()

    # 2) 白晕检查：半透明边缘 vs 实体内部
    solid = a > 0.98
    edge = (a > 0.05) & (a < 0.95)
    lum = rgba[..., :3].mean(axis=2)
    sat = rgba[..., :3].max(axis=2) - rgba[..., :3].min(axis=2)
    edge_lum = lum[edge].mean() if edge.any() else 0
    core_lum = lum[solid].mean() if solid.any() else 0
    edge_sat = sat[edge].mean() if edge.any() else 0
    core_sat = sat[solid].mean() if solid.any() else 0
    # 边缘像素里仍然"接近纯白且低饱和"的比例 —— 白晕残留指标
    halo = ((lum > 235) & (sat < 20) & edge).sum() / max(edge.sum(), 1)

    # 3) 物体是否被原画布裁切（对比原图 bbox 是否触边）
    oim = Image.open(os.path.join(ORIG, f)).convert('RGB')
    o = np.asarray(oim).astype(np.int16)
    omax = o.max(axis=2); omin = o.min(axis=2)
    obj = ~((omax - omin) < 26) | (o.mean(axis=2) < 205)
    lbl, n = ndimage.label(obj)
    if n:
        sizes = ndimage.sum(obj, lbl, range(1, n + 1))
        main = (np.argmax(sizes) + 1)
        m = lbl == main
        ys, xs = np.where(m)
        touch = (xs.min() <= 1 or ys.min() <= 1 or xs.max() >= o.shape[1] - 2 or ys.max() >= o.shape[0] - 2)
    else:
        touch = False

    checks = {
        'RGBA模式': has_alpha and ct == 6,
        '边界透明': border_max < 0.02,
        '无白晕': halo < 0.10,
        # 高饱和的亮边是物体本身的高光（如钻石），只有"亮且低饱和"才算白晕
        '边缘不过亮': edge_sat >= 30 or edge_lum <= core_lum + 25,
        '物体未被裁': not touch,
    }
    bad = [k for k, v in checks.items() if not v]
    if bad:
        ok = False

    print(f'{f:12s} {im.mode} ct={ct} {w}x{h}  '
          f'borderMax={border_max:.3f}  halo={halo*100:4.1f}%  '
          f'edgeLum={edge_lum:5.1f} coreLum={core_lum:5.1f}  '
          f'edgeSat={edge_sat:4.1f} coreSat={core_sat:4.1f}  '
          f'{"OK" if not bad else "FAIL " + ",".join(bad)}')

print('\n=== 全部通过 ===' if ok else '\n=== 存在问题，见上 ===')
