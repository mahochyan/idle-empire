#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成资产清理器（UI 分支）：alpha 噪声清理 + 内容 bbox 裁剪 + 尺寸统一
用法：python clean_asset.py <in.png> <out.png> [targetHeight] [alphaThresh]
说明：Qwen-Image-2.1 输出会带 alpha=1~7 的近透明噪点带（getbbox 会被它骗到），
      本脚本先把 alpha<8 归零，再按 alpha>=8 求内容边界，裁剪+留边，等比缩放到目标高。
"""
import sys


def clean(in_path, out_path, target_h=352, alpha_min=8, pad=8):
    from PIL import Image
    im = Image.open(in_path).convert("RGBA")
    w, h = im.size
    px = im.load()
    # ① 清噪：alpha < alpha_min 归零（含背景噪点带）
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < alpha_min:
                px[x, y] = (0, 0, 0, 0)
    # ② 内容边界（alpha>=alpha_min）
    mask = im.split()[3].point(lambda v: 255 if v >= alpha_min else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise SystemExit("no content")
    l, t, r, b = bbox
    im2 = im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
    # ③ 等比缩放到目标高
    if im2.height > target_h:
        w2 = round(im2.width * target_h / im2.height)
        im2 = im2.resize((w2, target_h), Image.LANCZOS)
    im2.save(out_path)
    return im2.size


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    th = int(sys.argv[3]) if len(sys.argv) > 3 else 352
    size = clean(sys.argv[1], sys.argv[2], th)
    print("OK", size)