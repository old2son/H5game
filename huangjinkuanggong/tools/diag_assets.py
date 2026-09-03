"""诊断素材：背景色、近白占比、物体 bbox。"""
import numpy as np
from PIL import Image
import os

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'assets')
FILES = ['miner.png', 'gold.png', 'diamond.png', 'rock.png', 'bag.png', 'tnt.png']

for f in FILES:
    im = Image.open(os.path.join(D, f)).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape
    corners = [tuple(a[0, 0]), tuple(a[0, w - 1]), tuple(a[h - 1, 0]), tuple(a[h - 1, w - 1])]
    # 近白：三通道都高且低饱和
    mn = a.min(axis=2)
    mx = a.max(axis=2)
    near_white = (mn > 235) & ((mx - mn) < 22)
    ratio = near_white.mean()
    # 物体 bbox（非近白）
    ys, xs = np.where(~near_white)
    if len(xs):
        bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    else:
        bbox, bw, bh = None, 0, 0
    print(f'{f:12s} corners={corners[0]},{corners[1]},{corners[2]},{corners[3]}')
    print(f'{"":12s} nearWhite={ratio*100:.1f}%  objBBox={bbox}  objSize={bw}x{bh} ({(bw/w)*100:.0f}%x{(bh/h)*100:.0f}%)')
