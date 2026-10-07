#!/usr/bin/env python3
"""Build assets/fonts/fontawesome-4.2.0-subset.woff2: the site's icon font.

    pip install fonttools brotli skia-pathops
    python tools/build-icons.py

Font Awesome 4.2.0 (the version the live site used, so icon metrics match) subset to the glyphs the site
uses, plus one glyph FA 4 never had: the X logo in the same rounded square as the Facebook/LinkedIn icons
(U+E61A, class .fa-x-square). The square matches FA 4's *-square glyphs exactly (1536-unit box, 288-unit
corners); the X mark is X Corp's published logo, knocked out of the square.

Font Awesome 4.2.0 font: SIL OFL 1.1. To add an icon: add its FA 4 codepoint to KEEP and a CSS rule in
_sass/_icons.scss.
"""
import io, urllib.request
from pathlib import Path

import pathops
from fontTools import subset
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts" / "fontawesome-4.2.0-subset.woff2"
SRC = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.2.0/fonts/fontawesome-webfont.ttf"
KEEP = [0xF095, 0xF0E0, 0xF1B9, 0xF105, 0xF107, 0xF082, 0xF08C, 0xF0C9, 0xF10E, 0xF10D]  # phone, envelope, car, angles, facebook-sq, linkedin-sq, bars, quotes
X_SQUARE = 0xE61A
X_LOGO = ("M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866"
          "L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944"
          "H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z")  # 1200 x 1227


class _Xform:
    """Pen filter: SVG (y down) -> font units (y up), scaled and centred in the square."""
    def __init__(self, pen, s, dx, dy):
        self.pen, self.s, self.dx, self.dy = pen, s, dx, dy
    def _p(self, pt):
        return (pt[0] * self.s + self.dx, -pt[1] * self.s + self.dy)
    def moveTo(self, p): self.pen.moveTo(self._p(p))
    def lineTo(self, p): self.pen.lineTo(self._p(p))
    def curveTo(self, *ps): self.pen.curveTo(*map(self._p, ps))
    def qCurveTo(self, *ps): self.pen.qCurveTo(*map(self._p, ps))
    def closePath(self): self.pen.closePath()
    def endPath(self): self.pen.endPath()


def x_square_glyph(glyphset):
    # the rounded square: FA 4's own facebook-square outline is the reference box (0..1536, -128..1408, r=288)
    x0, y0, x1, y1, r = 0, -128, 1536, 1408, 288
    square = pathops.Path()
    sp = square.getPen()
    sp.moveTo((x0 + r, y0)); sp.lineTo((x1 - r, y0)); sp.qCurveTo((x1, y0), (x1, y0 + r))
    sp.lineTo((x1, y1 - r)); sp.qCurveTo((x1, y1), (x1 - r, y1)); sp.lineTo((x0 + r, y1))
    sp.qCurveTo((x0, y1), (x0, y1 - r)); sp.lineTo((x0, y0 + r)); sp.qCurveTo((x0, y0), (x0 + r, y0)); sp.closePath()
    # the X: ~58% of the square's width, centred
    s = 0.58 * (x1 - x0) / 1200
    logo = pathops.Path()
    parse_path(X_LOGO, _Xform(logo.getPen(), s, (x0 + x1) / 2 - 600 * s, (y0 + y1) / 2 + 1227 * s / 2))
    knocked = pathops.op(square, logo, pathops.PathOp.DIFFERENCE, fix_winding=True)
    tt = TTGlyphPen(glyphset)
    knocked.draw(Cu2QuPen(tt, max_err=1.0, reverse_direction=True))
    return tt.glyph()


def main():
    raw = urllib.request.urlopen(SRC, timeout=60).read()
    font = TTFont(io.BytesIO(raw))
    opts = subset.Options()
    opts.flavor = None
    opts.hinting = False
    opts.drop_tables += ["FFTM"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=KEEP)
    sub.subset(font)

    name = "x_square"
    glyph = x_square_glyph(font.getGlyphSet())
    order = font.getGlyphOrder() + [name]
    font.setGlyphOrder(order)
    font["glyf"].glyphOrder = order
    font["glyf"].glyphs[name] = glyph
    font["hmtx"][name] = (1536, 0)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[X_SQUARE] = name
    font["maxp"].numGlyphs = len(font.getGlyphOrder())
    font.flavor = "woff2"
    font.save(OUT)
    print(OUT.relative_to(ROOT), OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
