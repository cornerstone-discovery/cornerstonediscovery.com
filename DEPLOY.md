# Launch checklist

Everything needed to take cornerstonediscovery.com off WordPress/WP Engine and onto GitHub Pages, in order.
Public IDs go in `_config.yml`; secrets go in `form-worker/secrets.json` (git-ignored). Nothing secret is
ever committed.

## 0. Internal testing while the 1SEO site stays live

Nothing here touches the live site or DNS until step 4. For the test weeks:

1. Do step 3 (enable Pages). The site goes up at
   **https://cornerstone-discovery.github.io/cornerstonediscovery.com/**: same pages and URLs, `noindex`,
   robots-blocked, no analytics. Share that link internally.
2. Forms show a "not switched on yet, please call/email" notice until the worker is deployed (step 2). Deploy
   it early with `DRY_RUN = "true"` in `wrangler.toml` to test every form without sending mail, then flip it.
3. Every push to `main` redeploys the preview; pull requests get the same checks without deploying.
4. Compare against the live site side by side. The parity report listing every intended difference is in the
   private `OLD-cornerstonediscovery.com` repo (`migration/PARITY.md`), with the rest of the migration notes.

## 1. Keys and accounts (one config file each)

**`_config.yml` (public — commit these):**

| Key | Where to get it |
|---|---|
| `analytics.ga4_measurement_id` | GA4 → Admin → Data streams → Web → Measurement ID (`G-…`). Use a property **you** own, not 1SEO's. |
| `analytics.google_ads_id` / `google_ads_lead_label` | Optional. Google Ads → Goals → Conversions → your "Contact form" conversion → Tag setup. |
| `webmaster_verifications.google` / `.bing` | Search Console / Bing Webmaster → add property → HTML tag → the `content` value. |
| `contact_form.recaptcha_site_key` | reCAPTCHA admin → v2 "I'm not a robot" → site key. Domains: `cornerstonediscovery.com`, `cornerstone-discovery.github.io`, `localhost`. |
| `contact_form.endpoint` | Printed by `npm run deploy` in `form-worker/` (step 2). |

**`form-worker/secrets.json` (secret — never commit):** `RECAPTCHA_SECRET`, `MAILGUN_API_KEY`. Template:
`form-worker/secrets.example.json`.

In GA4 → Admin → Events, mark **`generate_lead`** (and optionally `click_to_call`, `click_to_email`) as key events.

## 2. Contact-form worker

```bash
cd form-worker
npm install
npm run login
npm run deploy
npm run secrets
```

Details: [form-worker/README.md](form-worker/README.md).

## 3. GitHub Pages (repo admin)

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Re-run the latest "Deploy to GitHub Pages" run (Actions tab), or push to `main`. It deploys the preview to
   `https://cornerstone-discovery.github.io/cornerstonediscovery.com/`. Check it, including a test form submission.

This repo is public. Secrets never go in it: they live in `form-worker/secrets.json` (git-ignored) and in
Cloudflare. The history of the old WordPress/PHP site stays private in `OLD-cornerstonediscovery.com`.

## 4. DNS cut-over (Cloudflare)

1. GitHub → Settings → Pages → Custom domain: `cornerstonediscovery.com` (also verify the domain under the
   org's Settings → Pages to block takeovers).
2. Cloudflare DNS for `cornerstonediscovery.com`:
   * apex: four `A` records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (+ `AAAA` `2606:50c0:8000::153` … `8003::153`)
   * `www`: `CNAME cornerstone-discovery.github.io`
   * Start **DNS only** (grey cloud) until GitHub issues the certificate, then tick *Enforce HTTPS* and switch the
     proxy on, with SSL mode **Full**.
3. Re-run the Pages workflow (Actions → Deploy to GitHub Pages → Run workflow) so it builds for the real
   domain — analytics and indexing switch on automatically. The workflow **refuses** this deploy while
   `contact_form.endpoint` is blank, so the forms can't go live disconnected.
4. Uncomment `routes` in `form-worker/wrangler.toml`, `npm run deploy`, set `contact_form.endpoint: /api/contact`.

## 5. Redirects (Cloudflare → Rules)

GitHub Pages can't do server redirects, so these live in Cloudflare:

| Rule | Type |
|---|---|
| `^/wp-content/uploads/(.*)` → `/uploads/${1}` (301) | Redirect Rule, dynamic |
| `/feed/` → `/feed.xml` (301) | Redirect Rule, static |
| `^/(.*?)\.php$` → `/${1}/` (301), with `/index.php` → `/` | Redirect Rule, dynamic (the in-site HTML redirects cover browsers, this covers crawlers) |
| Old blog URLs → current posts | Bulk Redirects: import `docs/cloudflare-bulk-redirects-legacy-blog.csv` (180 rows) |
| `blog.cornerstonediscovery.com/*` and `thetechgazette.com/*` (anything not in the list) → `https://cornerstonediscovery.com/blog/` (301) | Redirect Rule, after the bulk list |

For `blog.cornerstonediscovery.com` add a proxied DNS record (`AAAA blog 100::`). For `thetechgazette.com`
(Network Solutions, currently parked on Wix) add it as a Cloudflare zone and switch its nameservers, then add
the same placeholder records.


## 5b. Cloudflare speed + security settings (optional, recommended)

GitHub Pages caches files for 10 minutes and can't set headers; Cloudflare can, in front of it:

* **Cache Rules:** `/assets/*` and `/uploads/*` → Edge TTL 1 month, Browser TTL 1 year (CSS/JS URLs carry a
  `?v=` build stamp, images never change in place except via `tools/images.py`).
* **Transform Rules → Response headers:** `Strict-Transport-Security: max-age=31536000`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: SAMEORIGIN`.
* Speed → Brotli on; Auto Minify off (already minified); Rocket Loader **off** (breaks deferred scripts).

## 6. Search Console

1. Verify the domain (DNS TXT via Cloudflare is simplest) or use the HTML tag from step 1.
2. Submit `https://cornerstonediscovery.com/sitemap.xml`.
3. Remove the Yoast sitemaps if they're listed (`sitemap_index.xml`, `post-sitemap.xml`, …).

## 7. Shut down the 1SEO stack

Do these after the site is live on Pages and the form has delivered a real test inquiry:

- [ ] Rotate the credentials that were committed in the old site's code (Mailgun SMTP password, reCAPTCHA
      secret, WordPress database password) and remove any leftover WordPress server/database. Specifics are in
      the private `OLD-cornerstonediscovery.com` repo (`DEPLOY.md` §7 there).
- [ ] Cancel CallRail (tracking numbers 866-304-8494 and 866-644-1596). Both offices use (267) 639-6900 and
      info@; update any directory / Google Business Profile listing that still shows an 866 number.
- [ ] Remove 1SEO's access from Google Business Profile, Search Console, Google Ads, Meta Business, Cloudflare
      and GitHub.
- [ ] Cancel WP Engine once traffic has been on Pages for a couple of weeks.
- [ ] 1SEO's Tag Manager container and GA4 property: export any history you want, then stop using them.
