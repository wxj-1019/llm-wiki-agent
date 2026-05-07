#!/usr/bin/env python3
"""Generate PWA PNG icons from the logo design using Pillow."""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow not installed. Run: pip install Pillow")
    raise SystemExit(1)


def draw_gradient_bg(img: Image.Image, draw: ImageDraw.ImageDraw, size: int) -> None:
    """Draw warm paper gradient background with rounded corners."""
    BG_TOP = (250, 248, 245)
    BG_BOT = (232, 228, 222)
    radius = int(120 * size / 512)
    for y in range(size):
        t = y / size
        r = int(BG_TOP[0] * (1 - t) + BG_BOT[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOT[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOT[2] * t)
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            if dx < radius and dy < radius:
                cx = radius if x < size // 2 else size - 1 - radius
                cy = radius if y < size // 2 else size - 1 - radius
                if (x - cx) ** 2 + (y - cy) ** 2 > radius ** 2:
                    continue
            img.putpixel((x, y), (r, g, b, 255))


def draw_logo(size: int) -> Image.Image:
    """Draw the book+AI logo at the given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 512.0

    def sx(x: float) -> float:
        return x * s

    def sy(y: float) -> float:
        return y * s

    def sr(r: float) -> float:
        return r * s

    def sw(w: float) -> int:
        return max(1, int(w * s))

    # Background
    draw_gradient_bg(img, draw, size)

    BLUE = (10, 132, 255)
    BLUE_FADE = (10, 132, 255, 64)
    WHITE = (250, 248, 245)
    GREEN = (52, 199, 89)
    PURPLE = (88, 86, 214)

    # Outer subtle rings
    cx, cy = sx(256), sy(256)
    draw.ellipse([cx - sr(196), cy - sr(196), cx + sr(196), cy + sr(196)], outline=(*BLUE, 30), width=sw(3))
    draw.ellipse([cx - sr(172), cy - sr(172), cx + sr(172), cy + sr(172)], outline=(*BLUE, 20), width=sw(2))

    # Book left page
    draw.polygon(
        [(sx(108), sy(180)), (sx(256), sy(168)), (sx(256), sy(356)), (sx(108), sy(368))],
        outline=BLUE, width=sw(22)
    )
    # Book right page
    draw.polygon(
        [(sx(256), sy(168)), (sx(404), sy(180)), (sx(404), sy(368)), (sx(256), sy(356))],
        outline=BLUE, width=sw(22)
    )
    # Spine
    draw.line([(sx(256), sy(168)), (sx(256), sy(356))], fill=BLUE, width=sw(18))

    # Page lines left
    for y1, y2 in [(216, 202), (256, 242), (296, 282)]:
        draw.line([(sx(142), sy(y1)), (sx(232), sy(y2))], fill=BLUE_FADE, width=sw(12))
    # Page lines right
    for y1, y2 in [(202, 216), (242, 256), (282, 296)]:
        draw.line([(sx(280), sy(y1)), (sx(370), sy(y2))], fill=BLUE_FADE, width=sw(12))

    # AI Neural Core
    core_x, core_y = sx(256), sy(248)
    # Outer glow ring
    draw.ellipse([core_x - sr(52), core_y - sr(52), core_x + sr(52), core_y + sr(52)], outline=(*BLUE, 77), width=sw(4))
    # Main outer circle (fill + stroke)
    draw.ellipse([core_x - sr(42), core_y - sr(42), core_x + sr(42), core_y + sr(42)], fill=(*BLUE, 38))
    draw.ellipse([core_x - sr(42), core_y - sr(42), core_x + sr(42), core_y + sr(42)], outline=BLUE, width=sw(5))
    # Inner solid circle
    draw.ellipse([core_x - sr(24), core_y - sr(24), core_x + sr(24), core_y + sr(24)], fill=BLUE)
    # Center white dot
    draw.ellipse([core_x - sr(10), core_y - sr(10), core_x + sr(10), core_y + sr(10)], fill=WHITE)

    # Radiating lines
    conn = sr(42)
    draw.line([(core_x, core_y - conn), (core_x, core_y - conn - sr(38))], fill=(*BLUE, 178), width=sw(5))
    draw.line([(core_x - conn, core_y), (core_x - conn - sr(38), core_y)], fill=(*BLUE, 178), width=sw(5))
    draw.line([(core_x + conn, core_y), (core_x + conn + sr(38), core_y)], fill=(*BLUE, 178), width=sw(5))

    # Diagonal radiating lines
    d = sr(30)
    draw.line([(core_x - d, core_y - d), (core_x - d * 1.6, core_y - d * 1.6)], fill=(*BLUE, 115), width=sw(4))
    draw.line([(core_x + d, core_y - d), (core_x + d * 1.6, core_y - d * 1.6)], fill=(*BLUE, 115), width=sw(4))
    draw.line([(core_x - d, core_y + d), (core_x - d * 1.6, core_y + d * 1.6)], fill=(*BLUE, 115), width=sw(4))
    draw.line([(core_x + d, core_y + d), (core_x + d * 1.6, core_y + d * 1.6)], fill=(*BLUE, 115), width=sw(4))

    # Satellite nodes
    for nx, ny in [(162, 178), (350, 178), (162, 318), (350, 318)]:
        draw.ellipse([sx(nx) - sr(8), sy(ny) - sr(8), sx(nx) + sr(8), sy(ny) + sr(8)], fill=(*BLUE, 128))

    # Sparkle accents
    for nx, ny, col in [(188, 148, GREEN), (324, 148, GREEN), (148, 278, PURPLE), (364, 278, PURPLE)]:
        draw.ellipse([sx(nx) - sr(5), sy(ny) - sr(5), sx(nx) + sr(5), sy(ny) + sr(5)], fill=(*col, 153))

    return img


def main() -> int:
    out_dir = Path(__file__).parent.parent / "public"
    out_dir.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        img = draw_logo(size)
        path = out_dir / f"pwa-{size}x{size}.png"
        img.save(path, "PNG")
        print(f"Generated {path}")
    # Favicon
    img = draw_logo(32)
    path = out_dir / "favicon-32x32.png"
    img.save(path, "PNG")
    print(f"Generated {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
