#!/usr/bin/env python3
"""Generate the static office map images used by the "Our Offices" band.

    pip install pillow
    python tools/static-maps.py

For each office in _data/locations.yml (latitude/longitude), downloads the few OpenStreetMap tiles around
it (a one-off fetch, well within the OSM tile policy), stitches them, draws a pin, and writes
assets/i/map-<key>.jpg and .webp at 2x the size they're shown at. No API key, and no third-party request
when someone views the page. OpenStreetMap requires the credit line the include prints under each map.
Re-run only when an address changes.
"""
import io, math, time, urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "i"
ZOOM = 16
W, H = 1040, 416          # 2x of the ~520x208 slot in the office card (5:2)
TILE = 256
UA = "cornerstonediscovery.com static map builder (info@cornerstonediscovery.com)"
NAVY, LIME = (33, 54, 69), (139, 197, 63)


def load_locations():
    """Tiny reader for the flat list-of-maps YAML in _data/locations.yml (avoids a PyYAML dependency)."""
    locs, cur = [], None
    for line in (ROOT / "_data" / "locations.yml").read_text(encoding="utf8").splitlines():
        if line.startswith("- "):
            cur = {}
            locs.append(cur)
            line = "  " + line[2:]
        if cur is None or not line.startswith("  ") or line.strip().startswith("#") or ":" not in line:
            continue
        k, v = line.strip().split(":", 1)
        cur[k.strip()] = v.strip().strip('"')
    return locs


def world_px(lat, lon, z):
    n = TILE * 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def tile(z, x, y):
    req = urllib.request.Request(f"https://tile.openstreetmap.org/{z}/{x}/{y}.png", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    time.sleep(0.2)  # be polite
    return Image.open(io.BytesIO(data)).convert("RGB")


def render(lat, lon):
    # build at 1x tile scale for a W/2 x H/2 window, then upscale-free: use zoom+1 tiles for the 2x image
    z = ZOOM + 1
    cx, cy = world_px(lat, lon, z)
    x0, y0 = int(cx - W / 2), int(cy - H / 2)
    canvas = Image.new("RGB", (W, H))
    for tx in range(x0 // TILE, (x0 + W) // TILE + 1):
        for ty in range(y0 // TILE, (y0 + H) // TILE + 1):
            canvas.paste(tile(z, tx, ty), (tx * TILE - x0, ty * TILE - y0))
    # quieter, on-brand basemap: slightly desaturated
    canvas = ImageEnhance.Color(canvas).enhance(0.55)
    canvas = ImageEnhance.Contrast(canvas).enhance(0.95)
    px, py = W / 2, H / 2
    r = 26
    # soft ground shadow under the pin tip
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse([px - 16, py - 5, px + 16, py + 5], fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(4))
    canvas = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), canvas, sh)
    d = ImageDraw.Draw(canvas)
    # pin: navy teardrop with a lime centre, tip on the building
    d.polygon([(px - r * 0.72, py - r - 22), (px + r * 0.72, py - r - 22), (px, py)], fill=NAVY)
    d.ellipse([px - r, py - 2 * r - 22, px + r, py - 22], fill=NAVY)
    d.ellipse([px - 11, py - r - 33, px + 11, py - r - 11], fill=LIME)
    return canvas


def main():
    for loc in load_locations():
        img = render(float(loc["latitude"]), float(loc["longitude"]))
        base = OUT / f"map-{loc['key']}"
        img.save(base.with_suffix(".jpg"), "JPEG", quality=82, optimize=True, progressive=True)
        img.save(base.with_suffix(".webp"), "WEBP", quality=80, method=6)
        print(base.with_suffix(".jpg").relative_to(ROOT), base.with_suffix(".jpg").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
