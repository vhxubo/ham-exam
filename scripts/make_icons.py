#!/usr/bin/env python3
"""make_icons.py — 从 icon.svg 的几何参数生成 PWA 所需 PNG 图标

Chrome 安装性检查与 iOS 主屏图标都只认 PNG，SVG 图标不够。
按 icon.svg（viewBox 0 0 64 64）反推弧线圆心，4096px 超采样绘制后缩小：
  icon-192.png / icon-512.png        圆角方（purpose: any）
  icon-maskable-512.png              全出血、内容缩进安全区（purpose: maskable）
  apple-touch-icon.png               180px 全出血（iOS 主屏）

用法: python3 scripts/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SS = 4096                       # 超采样边长（viewBox 64 的 64 倍）
BG = (11, 18, 32, 255)          # #0b1220
FG = (52, 211, 153, 255)        # #34d399
FG_DIM = (52, 211, 153, 115)    # 外弧 45% 不透明


def draw_content(scale=1.0):
    """主题图形（信号点 + 两道弧），在 64 坐标系下以中心 (32,32) 缩放。"""
    img = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = SS / 64 * scale                 # 缩放系数（像素 / viewBox 单位）
    off = SS / 2 - 32 * k               # 缩放后仍居中
    x = lambda vx: vx * k + off
    y = lambda vy: vy * k + off
    w = max(1, round(5 * k))            # 描边宽（viewBox 中为 5）

    # 内弧 M18 26 a20 20 0 0 1 28 0 → 圆心 (32, 26+√(20²-14²))
    r1 = 20 * k
    c1 = y(26 + (20**2 - 14**2) ** 0.5)
    d.arc([x(32) - r1, c1 - r1, x(32) + r1, c1 + r1], 225.5, 314.4, fill=FG, width=w)

    # 外弧 M11 17 a30 30 0 0 1 42 0 → 圆心 (32, 17+√(30²-21²))，45% 不透明
    r2 = 30 * k
    c2 = y(17 + (30**2 - 21**2) ** 0.5)
    layer = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    ImageDraw.Draw(layer).arc([x(32) - r2, c2 - r2, x(32) + r2, c2 + r2], 225.5, 314.5, fill=FG_DIM, width=w)
    img.alpha_composite(layer)

    # 信号点
    r = 6 * k
    d.ellipse([x(32) - r, y(40) - r, x(32) + r, y(40) + r], fill=FG)
    return img


def master_any():
    img = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, SS, SS], radius=SS * 14 // 64, fill=BG)
    img.alpha_composite(draw_content())
    return img


def master_maskable():
    # 全出血背景；内容缩到 78%，落在 maskable 安全区（半径 ≤ 40%）内
    img = Image.new("RGBA", (SS, SS), BG)
    content = draw_content(scale=0.78).resize((round(SS * 0.78),) * 2, Image.LANCZOS)
    img.alpha_composite(content, ((SS - content.width) // 2,) * 2)
    return img


if __name__ == "__main__":
    any_m = master_any()
    mask_m = master_maskable()
    for name, m, size in [
        ("icon-512.png", any_m, 512),
        ("icon-192.png", any_m, 192),
        ("icon-maskable-512.png", mask_m, 512),
        ("apple-touch-icon.png", mask_m, 180),
    ]:
        out = ROOT / name
        m.resize((size, size), Image.LANCZOS).save(out)
        print(f"OK {out.name} ({out.stat().st_size // 1024} KB)")
