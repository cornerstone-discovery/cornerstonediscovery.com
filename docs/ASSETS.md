# Front-end assets: where they came from and how to regenerate them

## Stylesheet (`assets/css/main.scss` → `main.css`)

Layered so the site renders exactly like the live WordPress site, then our additions on top:

| Partial | Source |
|---|---|
| `_sass/_fonts.scss` | Self-hosted Google Fonts, latin subset: Roboto Condensed (variable, 300–700, + italic) and Lato 300/400/700/900 (+ italics) — the families/weights the live theme `@import`ed from fonts.googleapis.com. |
| `_sass/_icons.scss` | Font Awesome **4.2.0** (the version live loads, so icon metrics match to the pixel), subset to the 11 glyphs the site uses. |
| `_sass/_bootstrap.scss` | Bootstrap **3.3.1** CSS, the exact version live loads. No Bootstrap JS. Glyphicons subset to 4 chevrons (from 3.3.1's font). |
| `_sass/_theme.scss` | Live theme `wp-content/themes/cornerstonediscovery/style.css` v7.0.5, verbatim except the font `@import`s and image URLs. |
| `_sass/_theme-custom.scss` | Live WordPress Customizer "Additional CSS" (`#wp-custom-css`), verbatim. Header phone size, CTA button, `.h1`/`.h2` classes, etc. |
| `_sass/_site.scss` | Everything we added: forms, offices band, blog (merged into the site look), FAQ accordions, accessibility. |

CI runs `tools/purge-css.mjs` after the build (139 KB → 59 KB). If you add a class only from JavaScript, add it
to the safelist there.

**Header parity check (2026-10-06):** header/nav/hero geometry measured on 14 page types × 4 widths
(1440/1024/800/375) against live — 1,058 measurements, all within ±0.6 px. The only difference is the Media, PA
banner, whose wrong "Philadelphia" headline was corrected.

### Regenerating the icon subsets

```bash
pip install fonttools brotli
# Font Awesome 4.2.0 TTF from cdnjs.cloudflare.com/ajax/libs/font-awesome/4.2.0/fonts/fontawesome-webfont.ttf
pyftsubset fontawesome-webfont.ttf --flavor=woff2 --no-hinting \
  --unicodes=U+f095,U+f0e0,U+f1b9,U+f105,U+f107,U+f081,U+f08c,U+f082,U+f0c9,U+f10e,U+f10d \
  --output-file=assets/fonts/fontawesome-4.2.0-subset.woff2
# Glyphicons from Bootstrap 3.3.1 (chevron down/left/right/up)
pyftsubset glyphicons-halflings-regular.ttf --flavor=woff2 --no-hinting \
  --unicodes=U+e114,U+e079,U+e080,U+e113 --output-file=assets/fonts/glyphicons-3.3.1-subset.woff2
```

Add a codepoint (FA 4 cheatsheet) and a `.fa-name:before` rule in `_icons.scss` to use a new icon.

## Favicon and logo

1SEO replaced the favicon with an upscaled 32 px PNG padded with white (`cropped-logo32-*.png`), which is the
white border in browser tabs. Restored:

* `favicon.ico` — the original 2015 icon (16 + 32 px, transparent), unchanged from git history.
* `assets/icons/favicon.svg` — redrawn from the original vector `Graphic Design/CD Web/FAVICON.ai` on the shared
  drive (exact paths and colours), for crisp tabs on high-DPI screens.
* `assets/icons/apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` — rendered from that SVG
  (the Apple icon has a white field because iOS requires an opaque square).
* `assets/i/cornerstonediscoveryREV@2x.png` — 2× header logo rendered from
  `CD Logo/CDlogoNoTagHorizontal_RGB.ai` in the brand guide's reverse palette (white type, putty document,
  charcoal fold), aligned to the original 1× file.

## Images (`tools/images.py`)

Re-encodes JPEG/PNG/WebP in place (same URL) at the smallest quality whose SSIM ≥ 0.985 vs. the original (only
when it saves ≥ 10%), caps photos at 1920 px (backgrounds keep their size: they're drawn at natural size like
live), writes WebP variants (`.w480.webp`, `.w960.webp`, `.webp`) and `_data/images.json`.
`_plugins/responsive_images.rb` uses the manifest to add width/height, lazy loading and a WebP `<picture>` with
`srcset` to every `<img>`. First run: originals 7.5 MB smaller.
