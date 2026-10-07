// Local test server for the worker — no Cloudflare account needed.
//   npm run dev                         -> http://localhost:8787, DRY_RUN (emails are printed, not sent)
// Point the site at it with contact_form.endpoint: http://localhost:8787 in a local config override.
// Uses Google's public reCAPTCHA *test* keys unless RECAPTCHA_SECRET is set in the environment, so the
// "I'm not a robot" box always passes locally.
import http from "node:http";
import { handle } from "./src/index.js";

const env = {
  MAIL_TO: "info@cornerstonediscovery.com",
  MAIL_FROM: "Cornerstone Discovery Website <noreply@mg.cornerstonediscovery.com>",
  MAILGUN_DOMAIN: "mg.cornerstonediscovery.com",
  ALLOWED_ORIGINS: "http://localhost:4000,http://127.0.0.1:4000",
  THANK_YOU_URL: "http://localhost:4000/thank-you/",
  NEWSLETTER_THANK_YOU_URL: "http://localhost:4000/thank-you-newsletter/",
  ERROR_URL: "http://localhost:4000/contact/",
  DRY_RUN: process.env.DRY_RUN ?? "true",
  RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET ?? "6LeIxAcTAAAAAGG-vFi1TnRWxMZNFuojJ4WifJWe",
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY ?? "",
  ALLOW_NO_CAPTCHA: process.env.ALLOW_NO_CAPTCHA ?? "false",
};

const port = Number(process.env.PORT || 8787);
http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await handle(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`contact worker (DRY_RUN=${env.DRY_RUN}) on http://localhost:${port}`));
