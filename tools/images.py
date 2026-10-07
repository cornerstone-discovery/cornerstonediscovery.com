#!/usr/bin/env python3
"""Image pipeline for the static site.

Run after adding or replacing images (needs Python 3.10+ and Pillow, scikit-image, numpy):

    pip install pillow scikit-image numpy
    python tools/images.py            # optimize + regenerate variants + manifest
    python tools/images.py --dry-run  # report only

What it does, for every JPEG/PNG/WebP under uploads/ and assets/i/ (skipping icons/logos < 20 KB):

1. Caps width at MAX_W px (1920; nothing on the site renders wider) and re-encodes the file in place, same
   format and URL, at the smallest quality whose SSIM against the original is >= SSIM_MIN. Files are
   only rewritten when that saves >= 10%, so re-running is a no-op.
2. Writes WebP variants next to the original (`name.w480.webp`, `name.w960.webp`, and `name.webp` for
   JPEG/PNG), also SSIM-checked.
3. Writes _data/images.json: {"/uploads/x.jpg": {"w":1568,"h":1047,"webp":[[480,"/uploads/x.w480.webp"],…]}}.
   _plugins/responsive_images.rb reads it to add width/height, lazy loading and a WebP <picture>/srcset
   to every <img> at build time. Pages never reference the variants directly.
"""
import argparse, io, json, re, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from skimage.metrics import structural_similarity

ROOT = Path(__file__).resolve().parent.parent
DIRS = [ROOT / "uploads", ROOT / "assets" / "i"]
MANIFEST = ROOT / "_data" / "images.json"
MAX_W = 1920
VARIANT_WIDTHS = (480, 960)
SSIM_MIN = 0.985
MIN_BYTES = 20 * 1024
SKIP_NAMES = ("logo", "icon", "favicon", "cornerstonediscovery")
# Hero/section backgrounds are drawn at their natural size (background-size: auto, like live): never resize.
KEEP_SIZE = re.compile(r"(bg|^bg_.*|^hero|blog-bg)$", re.I)
VARIANT = re.compile(r"\.w\d+$")


def gray(im):
    return np.asarray(im.convert("L"), dtype=np.float32)


def ssim(a, b):
    return structural_similarity(a, b, data_range=255)


def encode(im, fmt, q):
    buf = io.BytesIO()
    if fmt == "JPEG":
        im.convert("RGB").save(buf, "JPEG", quality=q, optimize=True, progressive=True)
    elif fmt == "WEBP":
        im.save(buf, "WEBP", quality=q, method=6)
    elif fmt == "PNG":
        im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def best(im, fmt, ref):
    """Smallest encoding with SSIM >= SSIM_MIN (binary search on quality)."""
    if fmt == "PNG":
        data = encode(im, "PNG", 0)
        return data, 100
    lo, hi, found = 60, 92, None  # floor of 60 keeps colour edges clean (SSIM is computed on luma)
    while lo <= hi:
        q = (lo + hi) // 2
        data = encode(im, fmt, q)
        if ssim(ref, gray(Image.open(io.BytesIO(data)))) >= SSIM_MIN:
            found, hi = (data, q), q - 1
        else:
            lo = q + 1
    return found or (encode(im, fmt, 92), 92)


def url_of(p):
    return "/" + p.relative_to(ROOT).as_posix()


def process(p, dry):
    raw = p.read_bytes()
    im = Image.open(io.BytesIO(raw))
    fmt = im.format
    if fmt not in ("JPEG", "PNG", "WEBP") or getattr(im, "is_animated", False):
        return None
    im = ImageOps.exif_transpose(im)
    rgba = im.convert("RGBA")
    has_alpha = rgba.getextrema()[3][0] < 255
    im = rgba if has_alpha else im.convert("RGB")
    note = []
    if im.width > MAX_W and not KEEP_SIZE.search(p.stem):
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        note.append(f"resized to {MAX_W}w")
    ref = gray(im)
    data, q = best(im, fmt, ref)
    if len(data) < len(raw) * 0.9 or note:
        note.append(f"{len(raw)//1024}->{len(data)//1024}KB q{q}")
        if not dry:
            p.write_bytes(data)
    w, h = im.size
    entry = {"w": w, "h": h, "webp": []}
    for vw in VARIANT_WIDTHS:
        if vw >= w * 0.9 or KEEP_SIZE.search(p.stem):  # backgrounds are CSS, not <img>: no srcset
            continue
        out = p.with_name(f"{p.stem}.w{vw}.webp")
        if not out.exists() and not dry:
            v = im.resize((vw, round(h * vw / w)), Image.LANCZOS)
            vd, _ = best(v, "WEBP", gray(v))
            out.write_bytes(vd)
        entry["webp"].append([vw, url_of(out)])
    if fmt != "WEBP":
        out = p.with_suffix(".webp")
        if not out.exists() and not dry:
            vd, _ = best(im, "WEBP", ref)
            if len(vd) < len(data):
                out.write_bytes(vd)
        if out.exists():
            entry["webp"].append([w, url_of(out)])
    return entry, note


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    manifest = {}
    saved = 0
    for d in DIRS:
        for p in sorted(d.rglob("*")):
            if p.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp") or VARIANT.search(p.stem):
                continue
            if p.suffix.lower() == ".webp" and any(p.with_suffix(s).exists() for s in (".jpg", ".jpeg", ".png")):
                continue  # generated full-size sibling
            if p.stat().st_size < MIN_BYTES or any(s in p.name.lower() for s in SKIP_NAMES):
                continue
            before = p.stat().st_size
            try:
                r = process(p, args.dry_run)
            except Exception as e:  # corrupt or unsupported file: leave it alone
                print(f"skip {p.relative_to(ROOT)}: {e}", file=sys.stderr)
                continue
            if not r:
                continue
            entry, note = r
            manifest[url_of(p)] = entry
            saved += before - p.stat().st_size
            if note:
                print(f"{p.relative_to(ROOT)}: {', '.join(note)}")
    if not args.dry_run:
        lines = [f"{json.dumps(k)}: {json.dumps(manifest[k], separators=(',', ':'))}" for k in sorted(manifest)]
        MANIFEST.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf8")
    print(f"{len(manifest)} images in manifest; originals {saved // 1024} KB smaller")


if __name__ == "__main__":
    main()
