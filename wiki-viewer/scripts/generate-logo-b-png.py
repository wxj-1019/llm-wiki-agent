#!/usr/bin/env python3
"""Generate PNG icons for Logo B (Isometric Book + Floating Orb)."""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

BLUE = (10, 132, 255)
WHITE = (250, 248, 245)
GREEN = (52, 199, 89)
PURPLE = (88, 86, 214)


def draw_bg(img: Image.Image, size: int) -> None:
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


def draw_logo_b(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 512.0
    sx = lambda v: v * s
    sy = lambda v: v * s
    sr = lambda v: v * s
    sw = lambda v: max(1, int(v * s))

    draw_bg(img, size)

    # Isometric book: left face
    draw.polygon([(sx(130), sy(310)), (sx(256), sy(250)), (sx(256), sy(160)), (sx(130), sy(220))], fill=(*BLUE, 30))
    draw.polygon([(sx(130), sy(310)), (sx(256), sy(250)), (sx(256), sy(160)), (sx(130), sy(220))], outline=BLUE, width=sw(20))

    # Isometric book: right face
    draw.polygon([(sx(382), sy(310)), (sx(256), sy(250)), (sx(256), sy(160)), (sx(382), sy(220))], fill=(*BLUE, 20))
    draw.polygon([(sx(382), sy(310)), (sx(256), sy(250)), (sx(256), sy(160)), (sx(382), sy(220))], outline=BLUE, width=sw(20))

    # Book base
    draw.line([(sx(130), sy(310)), (sx(256), sy(370)), (sx(382), sy(310))], fill=BLUE, width=sw(20))

    # Spine
    draw.line([(sx(256), sy(160)), (sx(256), sy(370))], fill=BLUE, width=sw(16))

    # Page lines left
    for x1, y1, x2, y2 in [(155, 265, 236, 228), (155, 290, 236, 253), (155, 315, 236, 278)]:
        draw.line([(sx(x1), sy(y1)), (sx(x2), sy(y2))], fill=(*BLUE, 76), width=sw(8))
    # Page lines right
    for x1, y1, x2, y2 in [(357, 265, 276, 228), (357, 290, 276, 253), (357, 315, 276, 278)]:
        draw.line([(sx(x1), sy(y1)), (sx(x2), sy(y2))], fill=(*BLUE, 76), width=sw(8))

    # Glow ring behind orb
    cx, cy = sx(256), sy(120)
    draw.ellipse([cx - sr(70), cy - sr(70), cx + sr(70), cy + sr(70)], fill=(*BLUE, 64))

    # Orb outer ring
    draw.ellipse([cx - sr(48), cy - sr(48), cx + sr(48), cy + sr(48)], outline=(*BLUE, 102), width=sw(4))

    # Main orb
    draw.ellipse([cx - sr(36), cy - sr(36), cx + sr(36), cy + sr(36)], fill=BLUE)

    # Orb inner highlight
    draw.ellipse([cx - sr(14), cy - sr(14), cx + sr(14), cy + sr(14)], fill=WHITE)

    # Neural rays
    draw.line([(cx, cy - sr(36)), (cx, cy - sr(60))], fill=BLUE, width=sw(7))
    draw.line([(cx - sr(36), cy), (cx - sr(60), cy)], fill=BLUE, width=sw(7))
    draw.line([(cx + sr(36), cy), (cx + sr(60), cy)], fill=BLUE, width=sw(7))

    # Satellite dots
    draw.ellipse([sx(170) - sr(7), sy(90) - sr(7), sx(170) + sr(7), sy(90) + sr(7)], fill=(*GREEN, 140))
    draw.ellipse([sx(342) - sr(7), sy(90) - sr(7), sx(342) + sr(7), sy(90) + sr(7)], fill=(*PURPLE, 140))

    return img


def main() -> int:
    out = Path(__file__).parent.parent / "public"
    out.mkdir(parents=True, exist_ok=True)
    for size in (32, 192, 512):
        img = draw_logo_b(size)
        name = "favicon-32x32.png" if size == 32 else f"pwa-{size}x{size}.png"
        img.save(out / name, "PNG")
        print(f"Generated {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
