# Contact-form worker

The only dynamic piece of cornerstonediscovery.com. A Cloudflare Worker that takes the contact form POST,
verifies Google reCAPTCHA server-side, and emails the inquiry to **info@cornerstonediscovery.com** through
Mailgun (Reply-To = the sender). It stores nothing. Same job as the old `web/simple-submit.php`.

## Where the keys go

| Value | Public? | Lives in |
|---|---|---|
| reCAPTCHA v2 **site** key | yes | `_config.yml` → `contact_form.recaptcha_site_key` |
| Worker URL | yes | `_config.yml` → `contact_form.endpoint` |
| reCAPTCHA **secret** key | **no** | `form-worker/secrets.json` → pushed to Cloudflare |
| Mailgun sending API key | **no** | `form-worker/secrets.json` → pushed to Cloudflare |
| To/From address, Mailgun domain, allowed origins | yes | `form-worker/wrangler.toml` `[vars]` |

`secrets.json` is git-ignored. Never commit it — the old site's Mailgun password and reCAPTCHA secret were
committed and must be treated as burned.

## First deploy

Needs Node 20+ and a login to the Cloudflare account that hosts cornerstonediscovery.com.

```bash
cd form-worker
npm install
npm run login            # opens a browser to authorize wrangler
cp secrets.example.json secrets.json   # then paste the real values in
npm run deploy           # prints https://cornerstone-contact.<account>.workers.dev
npm run secrets          # uploads secrets.json to the worker
```

Then in `_config.yml`:

```yaml
contact_form:
  endpoint: https://cornerstone-contact.<account>.workers.dev
  recaptcha_site_key: <site key>
```

In the reCAPTCHA admin console the key's allowed domains must include `cornerstonediscovery.com`,
`cornerstone-discovery.github.io` (preview) and `localhost`.

**After the DNS cut-over** uncomment the `routes` block in `wrangler.toml`, `npm run deploy` again, and set
`contact_form.endpoint: /api/contact` — the form then posts same-origin.

## Mailgun

Old site used the `mg.cornerstonediscovery.com` Mailgun domain. Create a new **sending API key** for it
(Mailgun → Sending → Domain settings → Sending API keys) and delete the old SMTP credential. If the account is
in Mailgun's EU region set `MAILGUN_REGION = "eu"`. `MAIL_FROM` must be an address on the Mailgun domain.

## Local testing

```bash
npm test        # unit tests (captcha, honeypot, validation, CORS, Mailgun errors)
npm run dev     # http://localhost:8787 in DRY_RUN mode: prints the email instead of sending
```

`npm run dev` uses Google's public reCAPTCHA *test* secret. Build the site against it with
`contact_form.endpoint: http://localhost:8787` and the test site key `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
in a local config override (`bundle exec jekyll serve --config _config.yml,_config.local.yml`).

`npm run tail` streams the live worker's logs (Mailgun failures are logged there).

## Spam handling

reCAPTCHA v2 checkbox, a hidden honeypot field, origin allow-list, field length limits and header-injection
checks. If spam still gets through, add a Cloudflare rate-limiting rule on the worker route.
