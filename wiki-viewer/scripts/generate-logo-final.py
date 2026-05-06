#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw

BLUE = (10, 132, 255)
WHITE = (250, 248, 245)

def draw_bg(img: Image.Image, size: int) -> None:
    r = int(120 * size / 512)
    c1, c2 = (250, 248, 245), (232, 228, 222)
    for y in range(size):
        t = y / size
        px = (int(c1[0]*(1-t)+c2[0]*t), int(c1[1]*(1-t)+c2[1]*t), int(c1[2]*(1-t)+c2[2]*t), 255)
        for x in range(size):
            dx, dy = min(x, size-1-x), min(y, size-1-y)
            if dx < r and dy < r:
                cx = r if x < size//2 else size-1-r
                cy = r if y < size//2 else size-1-r
                if (x-cx)**2 + (y-cy)**2 > r*r:
                    continue
            img.putpixel((x, y), px)

def draw(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    d = ImageDraw.Draw(img)
    s = size/512.0
    sx = lambda v: v*s
    sy = lambda v: v*s
    sr = lambda v: v*s
    sw = lambda v: max(1, int(v*s))
    draw_bg(img, size)

    # Left page
    d.polygon([(sx(120), sy(210)), (sx(256), sy(165)), (sx(256), sy(370)), (sx(120), sy(370))], outline=BLUE, width=sw(36))
    # Right page
    d.polygon([(sx(392), sy(210)), (sx(256), sy(165)), (sx(256), sy(370)), (sx(392), sy(370))], outline=BLUE, width=sw(36))
    # Spine
    d.line([(sx(256), sy(210)), (sx(256), sy(370))], fill=BLUE, width=sw(28))
    # AI core
    cx, cy = sx(256), sy(290)
    d.ellipse([cx-sr(32), cy-sr(32), cx+sr(32), cy+sr(32)], fill=BLUE)
    d.ellipse([cx-sr(13), cy-sr(13), cx+sr(13), cy+sr(13)], fill=WHITE)
    return img

def main() -> int:
    out = Path(__file__).parent.parent / "public"
    for sz, name in ((32, "favicon-32x32.png"), (192, "pwa-192x192.png"), (512, "pwa-512x512.png")):
        draw(sz).save(out / name, "PNG")
        print(f"Generated {name}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
