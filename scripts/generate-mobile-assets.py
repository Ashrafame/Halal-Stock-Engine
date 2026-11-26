#!/usr/bin/env python3
"""Generate dependency-free brand assets for the Expo app (no external libs)."""

import math
import struct
import zlib
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "apps" / "mobile" / "assets"

INK = (8, 20, 15, 255)
LIME = (200, 242, 132, 255)
CLEAR = (0, 0, 0, 0)


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, size: int, pixel_fn) -> None:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel_fn(x / size, y / size))
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def circle_coverage(px: float, py: float, cx: float, cy: float, radius: float) -> float:
    distance = math.hypot(px - cx, py - cy)
    return max(0.0, min(1.0, (radius - distance) * 900))


def star_coverage(px: float, py: float, cx: float, cy: float, outer: float) -> float:
    points = []
    for index in range(10):
        angle = -math.pi / 2 + index * math.pi / 5
        radius = outer if index % 2 == 0 else outer * 0.42
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    inside = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return 1.0 if inside else 0.0


def blend(base, overlay, alpha):
    if alpha <= 0:
        return base
    if alpha >= 1:
        return overlay
    return tuple(
        round(base[i] * (1 - alpha) + overlay[i] * alpha) for i in range(4)
    )


def logo_pixel(px: float, py: float, scale: float = 1.0, ox: float = 0.0, oy: float = 0.0):
    x = (px - ox) / scale
    y = (py - oy) / scale
    outer = circle_coverage(x, y, 0.46, 0.52, 0.3)
    inner = circle_coverage(x, y, 0.56, 0.45, 0.27)
    crescent = max(0.0, outer - inner)
    star = star_coverage(x, y, 0.68, 0.3, 0.1)
    return max(crescent, star)


def make_icon(size: int, background: bool) -> None:
    def pixel(px, py):
        base = INK if background else CLEAR
        alpha = logo_pixel(px, py)
        return blend(base, LIME, alpha)

    suffix = "icon.png" if background else "adaptive-icon.png"
    write_png(ASSETS / suffix, size, pixel)


def make_splash(size: int) -> None:
    def pixel(px, py):
        alpha = logo_pixel(px, py, scale=1.25, ox=-0.11, oy=-0.1)
        return blend(INK, LIME, alpha)

    write_png(ASSETS / "splash.png", size, pixel)


def make_favicon(size: int) -> None:
    def pixel(px, py):
        return blend(INK, LIME, logo_pixel(px, py))

    write_png(ASSETS / "favicon.png", size, pixel)


def make_notification_icon(size: int) -> None:
    def pixel(px, py):
        alpha = logo_pixel(px, py, scale=1.15, ox=-0.07, oy=-0.06)
        return blend(CLEAR, (255, 255, 255, 255), alpha)

    write_png(ASSETS / "notification-icon.png", size, pixel)


if __name__ == "__main__":
    ASSETS.mkdir(parents=True, exist_ok=True)
    make_icon(1024, True)
    make_icon(1024, False)
    make_splash(1242)
    make_favicon(64)
    make_notification_icon(96)
    for asset in sorted(ASSETS.glob("*.png")):
        print(asset.name, asset.stat().st_size)
