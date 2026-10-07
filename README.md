# cornerstonediscovery.com

Static site for Cornerstone Discovery: [Jekyll](https://jekyllrb.com) on GitHub Pages, plus one small
Cloudflare Worker for the contact form. The blog carries the original 2015 **Tech Gazette** forward: every
post from the Jekyll era, the Wix era and the WordPress era, with its real publish date and author.

**Launching / changing keys → [DEPLOY.md](DEPLOY.md).**

## Layout

| Path | What |
| --- | --- |
| `_config.yml` | Site settings and **every public integration ID** (GA4, Google Ads, Search Console, reCAPTCHA site key, form endpoint). |
| `index.html`, `about-us/`, `digital-forensics/`, … | Pages. One folder per URL; front matter drives the hero (`heading`, `header_image`) and sidebar (`service`). |
| `_posts/` | Blog posts (`YYYY-MM-DD-slug.md`), root permalinks (`/post-slug/`) as on WordPress. |
| `blog/`, `tag/`, `category/` | Paginated index (`/blog/page/N/`) and tag/category archives (noindex). |
| `_layouts/`, `_includes/` | `default`, `home`, `page`, `about`, `contact`, `post`, `blog`; nav, footer, hero, analytics, schema, `components/` (forms, offices, testimonials…). |
| `_data/` | `locations.yml` (**both offices**: address, phone, email, map pin), `forms.yml` (every form, field for field), `nav.yml`, `services.yml`, `team.yml`, `testimonials.yml`, `images.json` (generated). |
| `_sass/` → `assets/css/main.scss` | The one stylesheet: self-hosted fonts, Font Awesome 7 icon subset, Bootstrap 3.3.1 CSS, the live theme CSS and the live "Additional CSS" (verbatim, so the site renders like the WordPress one), then `_site.scss` (our additions). Compiled + minified by Jekyll, unused rules purged in CI. |
| `assets/js/site.js` | All behaviour, no dependencies: mobile nav, team accordion, testimonial carousel, click-to-load maps, lazy reCAPTCHA, forms, GA4 events. |
| `assets/fonts/`, `assets/icons/` | Lato + Roboto Condensed (woff2), Font Awesome 7 subsets, favicon set (from the original `FAVICON.ai`). |
| `_plugins/` | `baseurl_links.rb` (github.io sub-path), `responsive_images.rb` (width/height, lazy loading, WebP `<picture>`/srcset from `_data/images.json`). |
| `tools/` | `images.py` (optimize images, make WebP variants, write the manifest), `purge-css.mjs`, `check-links.mjs`. See [docs/ASSETS.md](docs/ASSETS.md). |
| `uploads/YYYY/MM/` | Content images carried over from WordPress (+ generated `.w480.webp` / `.w960.webp` / `.webp` variants). |
| `_public/` | Externally referenced images (email signatures). **Keep these paths stable.** |
| `form-worker/` | Contact-form endpoint (reCAPTCHA + Mailgun). Own README. Not part of the Jekyll build. |
| `docs/` | Asset notes and the Cloudflare redirect list. Migration notes (parity report, SEO audit/plan) and the old WordPress/PHP code are archived in the private `OLD-cornerstonediscovery.com` repo. |

## Local development

Ruby 3.x with Bundler (and Node 20+ for the checks):

```bash
bundle install
bundle exec jekyll serve --livereload
```

Before pushing, the same checks CI runs:

```bash
bundle exec jekyll build && (cd tools && npm ci) && node tools/purge-css.mjs && node tools/check-links.mjs
```

After adding or replacing images: `pip install pillow scikit-image numpy && python tools/images.py`.

Analytics only load in a production build whose `url` is the real domain (`JEKYLL_ENV=production`), so local
builds and the github.io preview never pollute GA4.

## Deploying

`.github/workflows/pages.yml` (GitHub's standard Jekyll workflow, Jekyll 4) builds every PR as a check and
builds + deploys every push to `main`. Every run also tests the form worker, purges unused CSS and fails on
any broken internal link; it refuses to publish to the real domain while the contact form isn't connected. Before the custom domain is attached the site lives at
`https://cornerstone-discovery.github.io/cornerstonediscovery.com/` — noindex, robots `Disallow: /`, no
analytics. Full checklist in [DEPLOY.md](DEPLOY.md).

## Editing content

* **Pages**: edit the page's `index.html`. Sub-pages (`/e-discovery/early-case-assessment/`) are listed
  automatically at the bottom of their parent.
* **Posts**: add `_posts/YYYY-MM-DD-slug.md` with `title`, `author`, `categories`, `tags`, `image`, `description`.
* **Team**: `_data/team.yml`. **Nav**: `_data/nav.yml`.
* **Offices**: `_data/locations.yml` feeds the footer, contact page, "Our Offices" band and structured data.
* Titles: `seo_title` overrides the `<title>` verbatim; otherwise "Page title - Cornerstone Discovery". `description` is the meta description.
* Front matter is strict: a YAML mistake fails the build instead of silently dropping the page's layout.
  Quote values that contain `: ` (e.g. `description: "Foo: bar"`).
