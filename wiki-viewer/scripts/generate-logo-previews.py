#!/usr/bin/env python3
"""Generate PNG previews for all 5 logo concepts."""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent.parent / "public"
BLUE = (10, 132, 255)
WHITE = (250, 248, 245)
GREEN = (52, 199, 89)
PURPLE = (88, 86, 214)
ORANGE = (255, 149, 0)
RED = (255, 59, 48)


def bg(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    r = int(120 * size / 512)
    c1, c2 = (250, 248, 245), (232, 228, 222)
    for y in range(size):
        t = y / size
        px = (int(c1[0] * (1 - t) + c2[0] * t), int(c1[1] * (1 - t) + c2[1] * t), int(c1[2] * (1 - t) + c2[2] * t), 255)
        for x in range(size):
            dx, dy = min(x, size - 1 - x), min(y, size - 1 - y)
            if dx < r and dy < r:
                cx = r if x < size // 2 else size - 1 - r
                cy = r if y < size // 2 else size - 1 - r
                if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                    continue
            img.putpixel((x, y), px)
    return img


def sx(v: float, s: float) -> float:
    return v * s


def sy(v: float, s: float) -> float:
    return v * s


def sr(v: float, s: float) -> float:
    return v * s


def sw(v: float, s: float) -> int:
    return max(1, int(v * s))


def draw_a(size: int) -> Image.Image:
    img = bg(size)
    d = ImageDraw.Draw(img)
    s = size / 512.0
    d.polygon([(sx(120, s), sy(200, s)), (sx(256, s), sy(150, s)), (sx(256, s), sy(370, s)), (sx(120, s), sy(370, s))], outline=BLUE, width=sw(28, s))
    d.polygon([(sx(392, s), sy(200, s)), (sx(256, s), sy(150, s)), (sx(256, s), sy(370, s)), (sx(392, s), sy(370, s))], outline=BLUE, width=sw(28, s))
    d.line([(sx(256, s), sy(200, s)), (sx(256, s), sy(370, s))], fill=BLUE, width=sw(22, s))
    cx, cy = sx(256, s), sy(285, s)
    d.ellipse([cx - sr(32, s), cy - sr(32, s), cx + sr(32, s), cy + sr(32, s)], fill=BLUE)
    d.ellipse([cx - sr(13, s), cy - sr(13, s), cx + sr(13, s), cy + sr(13, s)], fill=WHITE)
    return img


def draw_b(size: int) -> Image.Image:
    img = bg(size)
    d = ImageDraw.Draw(img)
    s = size / 512.0
    d.polygon([(sx(140, s), sy(320, s)), (sx(256, s), sy(270, s)), (sx(372, s), sy(320, s)), (sx(256, s), sy(370, s))], fill=(*BLUE, 38))
    d.polygon([(sx(140, s), sy(320, s)), (sx(256, s), sy(270, s)), (sx(256, s), sy(190, s)), (sx(140, s), sy(240, s))], outline=BLUE, width=sw(22, s))
    d.polygon([(sx(372, s), sy(320, s)), (sx(256, s), sy(270, s)), (sx(256, s), sy(190, s)), (sx(372, s), sy(240, s))], outline=BLUE, width=sw(22, s))
    d.line([(sx(140, s), sy(320, s)), (sx(256, s), sy(370, s)), (sx(372, s), sy(320, s))], fill=BLUE, width=sw(22, s))
    cx, cy = sx(256, s), sy(145, s)
    d.ellipse([cx - sr(55, s), cy - sr(55, s), cx + sr(55, s), cy + sr(55, s)], fill=(*BLUE, 30))
    d.ellipse([cx - sr(40, s), cy - sr(40, s), cx + sr(40, s), cy + sr(40, s)], fill=BLUE)
    d.ellipse([cx - sr(16, s), cy - sr(16, s), cx + sr(16, s), cy + sr(16, s)], fill=WHITE)
    d.line([(cx, cy - sr(40, s)), (cx, cy - sr(65, s))], fill=BLUE, width=sw(7, s))
    d.line([(cx - sr(40, s), cy), (cx - sr(65, s), cy)], fill=BLUE, width=sw(7, s))
    d.line([(cx + sr(40, s), cy), (cx + sr(65, s), cy)], fill=BLUE, width=sw(7, s))
    return img


def draw_c(size: int) -> Image.Image:
    img = bg(size)
    d = ImageDraw.Draw(img)
    s = size / 512.0
    cx, cy = sx(256, s), sy(256, s)
    d.ellipse([cx - sr(185, s), cy - sr(185, s), cx + sr(185, s), cy + sr(185, s)], outline=BLUE, width=sw(14, s))
    d.ellipse([cx - sr(168, s), cy - sr(168, s), cx + sr(168, s), cy + sr(168, s)], outline=(*BLUE, 64), width=sw(5, s))
    d.polygon([(sx(170, s), sy(235, s)), (sx(256, s), sy(210, s)), (sx(256, s), sy(330, s)), (sx(170, s), sy(330, s))], fill=(*BLUE, 30))
    d.polygon([(sx(342, s), sy(235, s)), (sx(256, s), sy(210, s)), (sx(256, s), sy(330, s)), (sx(342, s), sy(330, s))], fill=(*BLUE, 30))
    d.polygon([(sx(170, s), sy(235, s)), (sx(256, s), sy(210, s)), (sx(256, s), sy(330, s)), (sx(170, s), sy(330, s))], outline=BLUE, width=sw(18, s))
    d.polygon([(sx(342, s), sy(235, s)), (sx(256, s), sy(210, s)), (sx(256, s), sy(330, s)), (sx(342, s), sy(330, s))], outline=BLUE, width=sw(18, s))
    d.polygon([(sx(195, s), sy(190, s)), (sx(256, s), sy(145, s)), (sx(317, s), sy(190, s)), (sx(317, s), sy(218, s)), (sx(256, s), sy(218, s)), (sx(195, s), sy(218, s))], fill=BLUE)
    for dx, dy in [(0, -185), (0, 185), (-185, 0), (185, 0)]:
        d.ellipse([cx + dx - sr(9, s), cy + dy - sr(9, s), cx + dx + sr(9, s), cy + dy + sr(9, s)], fill=(*BLUE, 115))
    return img


def draw_d(size: int) -> Image.Image:
    img = bg(size)
    d = ImageDraw.Draw(img)
    s = size / 512.0
    cx = sx(256, s)
    cy = sy(256, s)
    pts = [(cx, cy - sr(196, s)), (cx + sr(24, s), cy - sr(36, s)), (cx + sr(184, s), cy - sr(60, s)),
           (cx + sr(44, s), cy), (cx + sr(184, s), cy + sr(60, s)), (cx + sr(24, s), cy + sr(36, s)),
           (cx, cy + sr(196, s)), (cx - sr(24, s), cy + sr(36, s)), (cx - sr(184, s), cy + sr(60, s)),
           (cx - sr(44, s), cy), (cx - sr(184, s), cy - sr(60, s)), (cx - sr(24, s), cy - sr(36, s))]
    d.polygon(pts, fill=(*BLUE, 15))
    d.polygon([(sx(180, s), sy(180, s)), (sx(256, s), sy(256, s)), (sx(332, s), sy(180, s)), (sx(332, s), sy(332, s)),
               (sx(256, s), sy(256, s)), (sx(180, s), sy(332, s))], outline=BLUE, width=sw(26, s))
    d.ellipse([cx - sr(36, s), cy - sr(36, s), cx + sr(36, s), cy + sr(36, s)], fill=BLUE)
    d.ellipse([cx - sr(15, s), cy - sr(15, s), cx + sr(15, s), cy + sr(15, s)], fill=WHITE)
    for dx, dy, col in [(0, -146, GREEN), (-146, 0, PURPLE), (146, 0, ORANGE), (0, 146, RED)]:
        d.ellipse([cx + dx - sr(12, s), cy + dy - sr(12, s), cx + dx + sr(12, s), cy + dy + sr(12, s)], fill=(*col, 204))
    return img


def draw_e(size: int) -> Image.Image:
    img = bg(size)
    d = ImageDraw.Draw(img)
    s = size / 512.0
    cx, cy = sx(256, s), sy(256, s)
    # Approximate infinity with two ellipses
    d.ellipse([cx - sr(96, s), cy - sr(86, s), cx, cy + sr(86, s)], outline=BLUE, width=sw(26, s))
    d.ellipse([cx, cy - sr(86, s), cx + sr(96, s), cy + sr(86, s)], outline=BLUE, width=sw(26, s))
    d.line([(cx, sy(180, s)), (cx, sy(332, s))], fill=BLUE, width=sw(18, s))
    d.ellipse([cx - sr(32, s), cy - sr(32, s), cx + sr(32, s), cy + sr(32, s)], fill=BLUE)
    d.ellipse([cx - sr(13, s), cy - sr(13, s), cx + sr(13, s), cy + sr(13, s)], fill=WHITE)
    for dx in [-sr(96, s), sr(96, s)]:
        d.ellipse([cx + dx - sr(11, s), cy - sr(11, s), cx + dx + sr(11, s), cy + sr(11, s)], fill=(*BLUE, 115))
    return img


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    variants = [
        ("logo-a", draw_a, "极简几何 — 曲线书页 + 中央AI核心"),
        ("logo-b", draw_b, "立体等距 — 3D书本 + 悬浮发光球"),
        ("logo-c", draw_c, "徽章印章 — 圆形知识封印 + 大脑轮廓"),
        ("logo-d", draw_d, "现代星形 — 交叉书本 + 彩色轨道点"),
        ("logo-e", draw_e, "抽象无限 — ∞书页回路 + 电路节点"),
    ]
    for name, drawer, desc in variants:
        for sz in (192, 32):
            img = drawer(sz)
            suffix = "-preview" if sz == 192 else ""
            path = OUT / f"{name}{suffix}.png"
            img.save(path, "PNG")
        print(f"Generated {name}: {desc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
