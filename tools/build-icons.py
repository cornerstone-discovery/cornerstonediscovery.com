#!/usr/bin/env python3
"""Build the site's icon fonts: Font Awesome Free 7, subset to the icons the site uses.

    pip install fonttools brotli
    python tools/build-icons.py

Writes assets/fonts/fa7-solid-subset.woff2 and fa7-brands-subset.woff2 (a few KB instead of ~235 KB).
Every icon on the site comes from this one set (Font Awesome Free 7.3.1: icons CC BY 4.0, fonts SIL OFL 1.1).

To add an icon: add its name and codepoint below (look it up at fontawesome.com/icons, Free set), re-run,
and add a `.fa-name { --fa: "\\xxxx"; }` rule in _sass/_icons.scss.
"""
import io, urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
VERSION = "7.3.1"
CDN = f"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/{VERSION}/webfonts/"

SOLID = {  # fa-solid
    "phone": 0xF095, "envelope": 0xF0E0, "car": 0xF1B9, "bars": 0xF0C9,
    "quote-left": 0xF10D, "quote-right": 0xF10E,
    "angle-right": 0xF105, "angle-down": 0xF107,
    "chevron-left": 0xF053, "chevron-right": 0xF054, "chevron-up": 0xF077, "chevron-down": 0xF078,
}
BRANDS = {  # fa-brands
    "square-x-twitter": 0xE61A, "square-facebook": 0xF082, "linkedin": 0xF08C,
}


def build(src, codepoints, out):
    font = TTFont(io.BytesIO(urllib.request.urlopen(CDN + src, timeout=60).read()))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.hinting = False
    opts.layout_features = []
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=list(codepoints.values()))
    sub.subset(font)
    font.flavor = "woff2"
    path = ROOT / "assets" / "fonts" / out
    font.save(path)
    print(path.relative_to(ROOT), path.stat().st_size, "bytes")


if __name__ == "__main__":
    build("fa-solid-900.woff2", SOLID, "fa7-solid-subset.woff2")
    build("fa-brands-400.woff2", BRANDS, "fa7-brands-subset.woff2")
