import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/index.js";

const ENV = {
  MAIL_TO: "info@cornerstonediscovery.com",
  MAIL_FROM: "Site <noreply@mg.cornerstonediscovery.com>",
  MAILGUN_DOMAIN: "mg.cornerstonediscovery.com",
  MAILGUN_REGION: "us",
  ALLOWED_ORIGINS: "https://cornerstonediscovery.com",
  THANK_YOU_URL: "https://cornerstonediscovery.com/thank-you/",
  NEWSLETTER_THANK_YOU_URL: "https://cornerstonediscovery.com/thank-you-newsletter/",
  ERROR_URL: "https://cornerstonediscovery.com/contact/",
  RECAPTCHA_SECRET: "secret",
  MAILGUN_API_KEY: "key-123",
};
// Field names are the form labels, exactly as rendered from _data/forms.yml
const CONTACT = [["form_id", "contact"], ["Name", "Jane Lawyer"], ["Company Name", "Firm LLP"], ["Email", "jane@firm.com"],
  ["Phone", "215-555-0100"], ["Message", "Need a phone imaged <b>today</b>."], ["page_url", "https://cornerstonediscovery.com/contact/"],
  ["g-recaptcha-response", "tok"]];
const LP = [["form_id", "lp_digital_forensics"], ["First Name", "Sam"], ["Last Name", "Counsel"], ["Firm Name", "Counsel & Co"],
  ["Email", "sam@counsel.com"], ["Needs (Check all that apply)", "Computer Forensics"], ["Needs (Check all that apply)", "Cell Phone Mapping"],
  ["Notes or Specific Details", "Two laptops."], ["g-recaptcha-response", "tok"]];
const NEWS = [["form_id", "newsletter"], ["Email", "reader@example.com"], ["g-recaptcha-response", "tok"]];

function fakeFetch({ captcha = true, mailStatus = 200 } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("recaptcha")) return Response.json({ success: captcha });
    return new Response(mailStatus === 200 ? '{"id":"x"}' : "boom", { status: mailStatus });
  };
  fn.calls = calls;
  return fn;
}

function post(pairs, { json = true, origin = "https://cornerstonediscovery.com", ip = "203.0.113.9" } = {}) {
  const headers = { "Content-Type": "application/x-www-form-urlencoded", "CF-Connecting-IP": ip };
  if (json) headers.Accept = "application/json";
  if (origin) headers.Origin = origin;
  return new Request("https://worker.test/", { method: "POST", headers, body: new URLSearchParams(pairs) });
}
const without = (pairs, key) => pairs.filter(([k]) => k !== key);
const withVal = (pairs, key, v) => pairs.map(([k, x]) => [k, k === key ? v : x]);

test("contact form: verifies captcha, sends one Mailgun message with every field in order", async () => {
  const f = fakeFetch();
  const r = await handle(post(CONTACT), ENV, f);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://cornerstonediscovery.com");
  const [cap, mail] = f.calls;
  assert.match(cap.url, /recaptcha\/api\/siteverify/);
  assert.equal(cap.init.body.get("secret"), "secret");
  assert.equal(cap.init.body.get("remoteip"), "203.0.113.9");
  assert.equal(mail.url, "https://api.mailgun.net/v3/mg.cornerstonediscovery.com/messages");
  assert.equal(mail.init.headers.Authorization, "Basic " + btoa("api:key-123"));
  const m = mail.init.body;
  assert.equal(m.get("to"), "info@cornerstonediscovery.com");
  assert.equal(m.get("h:Reply-To"), "Jane Lawyer <jane@firm.com>");
  assert.equal(m.get("subject"), "Website inquiry: Jane Lawyer (Firm LLP)");
  assert.match(m.get("html"), /&lt;b&gt;today&lt;\/b&gt;/, "message HTML is escaped");
  assert.match(m.get("text"), /^Name: Jane Lawyer\n\nCompany Name: Firm LLP\n\nEmail: jane@firm.com\n\nPhone: 215-555-0100\n\nMessage: /);
  assert.match(m.get("text"), /Sent from: https:\/\/cornerstonediscovery\.com\/contact\//);
  assert.doesNotMatch(m.get("text"), /g-recaptcha|form_id/);
});

test("landing-page form: first/last name and multi-select checkboxes", async () => {
  const f = fakeFetch();
  const r = await handle(post(LP), ENV, f);
  assert.equal(r.status, 200);
  const m = f.calls[1].init.body;
  assert.equal(m.get("subject"), "Digital Forensic Services inquiry: Sam Counsel (Counsel & Co)");
  assert.equal(m.get("h:Reply-To"), "Sam Counsel <sam@counsel.com>");
  assert.match(m.get("text"), /Needs \(Check all that apply\): Computer Forensics, Cell Phone Mapping/);
});

test("newsletter: email only, no name needed; no-JS lands on the newsletter thank-you page", async () => {
  const f = fakeFetch();
  const r = await handle(post(NEWS, { json: false }), ENV, f);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("Location"), "https://cornerstonediscovery.com/thank-you-newsletter/");
  assert.equal(f.calls[1].init.body.get("subject"), "Newsletter sign-up: reader@example.com");
});

test("failed captcha is rejected and nothing is sent", async () => {
  const f = fakeFetch({ captcha: false });
  const r = await handle(post(CONTACT), ENV, f);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).ok, false);
  assert.equal(f.calls.length, 1);
});

test("missing captcha token never reaches Mailgun", async () => {
  const f = fakeFetch();
  const r = await handle(post(without(CONTACT, "g-recaptcha-response")), ENV, f);
  assert.equal(r.status, 400);
  assert.equal(f.calls.length, 0);
});

test("honeypot submissions get a fake success and send nothing", async () => {
  const f = fakeFetch();
  const r = await handle(post([...CONTACT, ["website", "http://spam"]]), ENV, f);
  assert.equal(r.status, 200);
  assert.equal(f.calls.length, 0);
});

test("validation: name and a real email required; header injection blocked", async () => {
  for (const bad of [withVal(CONTACT, "Name", ""), withVal(CONTACT, "Email", "nope"),
                     withVal(CONTACT, "Email", "a@b.com\r\nBcc: x@y.com"), withVal(CONTACT, "Name", "Jane\r\nBcc: x@y.com"),
                     withVal(CONTACT, "Message", "x".repeat(5001))]) {
    const f = fakeFetch();
    const r = await handle(post(bad), ENV, f);
    assert.equal(r.status, 400);
    assert.equal(f.calls.length, 0);
  }
});

test("unknown browser origin is refused", async () => {
  const f = fakeFetch();
  const r = await handle(post(CONTACT, { origin: "https://evil.example" }), ENV, f);
  assert.equal(r.status, 403);
  assert.equal(f.calls.length, 0);
});

test("no-JS post redirects to the thank-you page; errors go back to contact", async () => {
  const ok = await handle(post(CONTACT, { json: false }), ENV, fakeFetch());
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("Location"), "https://cornerstonediscovery.com/thank-you/");
  const bad = await handle(post(withVal(CONTACT, "Email", "bad"), { json: false }), ENV, fakeFetch());
  assert.match(bad.headers.get("Location"), /^https:\/\/cornerstonediscovery\.com\/contact\/\?error=/);
});

test("Mailgun failure is reported, not swallowed", async () => {
  const r = await handle(post(CONTACT), ENV, fakeFetch({ mailStatus: 401 }));
  assert.equal(r.status, 502);
  assert.equal((await r.json()).ok, false);
});

test("refuses to run without a captcha secret unless explicitly allowed", async () => {
  const { RECAPTCHA_SECRET, ...noSecret } = ENV;
  assert.equal((await handle(post(CONTACT), noSecret, fakeFetch())).status, 500);
  assert.equal((await handle(post(CONTACT), { ...noSecret, ALLOW_NO_CAPTCHA: "true" }, fakeFetch())).status, 200);
});

test("CORS preflight and non-POST", async () => {
  const pre = await handle(new Request("https://worker.test/", { method: "OPTIONS", headers: { Origin: "https://cornerstonediscovery.com" } }), ENV);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), "https://cornerstonediscovery.com");
  const get = await handle(new Request("https://worker.test/", { headers: { Accept: "application/json" } }), ENV);
  assert.equal(get.status, 405);
});

test("JSON bodies (with arrays) work, and EU region uses the EU API host", async () => {
  const f = fakeFetch();
  const body = { form_id: "lp_digital_forensics", "First Name": "Sam", "Last Name": "C", Email: "s@c.com",
    "Needs (Check all that apply)": ["A", "B"], "g-recaptcha-response": "t" };
  const req = new Request("https://worker.test/", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  const r = await handle(req, { ...ENV, MAILGUN_REGION: "eu" }, f);
  assert.equal(r.status, 200);
  assert.equal(f.calls[1].url, "https://api.eu.mailgun.net/v3/mg.cornerstonediscovery.com/messages");
  assert.match(f.calls[1].init.body.get("text"), /Needs \(Check all that apply\): A, B/);
});
