// Form endpoint for cornerstonediscovery.com (Cloudflare Worker).
//
// Handles every form on the site (_data/forms.yml): contact, newsletter sign-up, the three service landing
// pages and NACDL. Replaces WordPress/Gravity Forms and the old web/simple-submit.php: verifies reCAPTCHA
// server-side, then emails the submission to info@ through Mailgun's HTTP API (Reply-To = the sender).
// Nothing is stored.
//
// Field names are the human labels ("Firm Name", "Needs (Check all that apply)") so the email reads exactly
// like the form. System fields: form_id, page_url, website (honeypot), g-recaptcha-response.
//
// Accepts application/x-www-form-urlencoded, multipart/form-data or JSON.
//   Accept: application/json  -> {"ok": true} / {"ok": false, "error": "..."}  (site.js uses this)
//   anything else             -> 303 redirect to THANK_YOU_URL / ERROR_URL     (no-JS fallback)
//
// Config (wrangler.toml [vars]):  MAIL_TO, MAIL_FROM, MAILGUN_DOMAIN, MAILGUN_REGION, ALLOWED_ORIGINS,
//                                 THANK_YOU_URL, NEWSLETTER_THANK_YOU_URL, ERROR_URL, DRY_RUN, ALLOW_NO_CAPTCHA
// Secrets (npm run secrets):      RECAPTCHA_SECRET, MAILGUN_API_KEY

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELDS = 60;
const MAX_VALUE = 5000;
const SYSTEM = new Set(["form_id", "page_url", "website", "g-recaptcha-response"]);
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const FORM_TITLES = {
  contact: "Website inquiry",
  newsletter: "Newsletter sign-up",
  lp_digital_forensics: "Digital Forensic Services inquiry",
  lp_e_discovery: "e-Discovery Services inquiry",
  lp_litigation_support: "Litigation & Trial Support inquiry",
  lp_nacdl: "NACDL inquiry",
};

export default {
  async fetch(request, env) {
    return handle(request, env);
  },
};

export async function handle(request, env, fetchImpl = globalThis.fetch) {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, env);
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply(false, "Method not allowed.", 405, wantsJson, env, cors);
  if (origin && !cors["Access-Control-Allow-Origin"]) return reply(false, "Origin not allowed.", 403, wantsJson, env, {});

  let sub;
  try {
    sub = await readSubmission(request);
  } catch (err) {
    return reply(false, err.message, 400, wantsJson, env, cors);
  }
  const formId = FORM_TITLES[sub.system.form_id] ? sub.system.form_id : "contact";

  // Honeypot: bots fill every field. Pretend it worked so they don't retry.
  if (sub.system.website) return reply(true, null, 200, wantsJson, env, cors, formId);

  const problem = validate(sub, formId);
  if (problem) return reply(false, problem, 400, wantsJson, env, cors, formId);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (env.RECAPTCHA_SECRET) {
    const ok = await verifyRecaptcha(env.RECAPTCHA_SECRET, sub.system["g-recaptcha-response"], ip, fetchImpl);
    if (!ok) return reply(false, "Please complete the \"I'm not a robot\" check and try again.", 400, wantsJson, env, cors, formId);
  } else if (env.ALLOW_NO_CAPTCHA !== "true") {
    return reply(false, "The form is not configured (missing reCAPTCHA secret). Please email us instead.", 500, wantsJson, env, cors, formId);
  }

  const message = buildEmail(sub, formId, env, ip, request.headers.get("User-Agent") || "");
  if (env.DRY_RUN === "true") {
    console.log("DRY_RUN — would send:", JSON.stringify(message, null, 2));
  } else {
    const sent = await sendMailgun(message, env, fetchImpl);
    if (!sent.ok) {
      console.error("Mailgun error", sent.status, sent.body);
      return reply(false, "We couldn't send your message just now. Please email or call us instead.", 502, wantsJson, env, cors, formId);
    }
  }
  return reply(true, null, 200, wantsJson, env, cors, formId);
}

// -> { system: {form_id,...}, fields: [[label, value], ...] } with multi-value fields joined, order preserved
export async function readSubmission(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BODY_BYTES) throw new Error("Submission is too large.");
  const type = request.headers.get("Content-Type") || "";
  const pairs = [];
  if (type.includes("application/json")) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("Submission is too large.");
    for (const [k, v] of Object.entries(JSON.parse(text || "{}"))) {
      for (const x of Array.isArray(v) ? v : [v]) if (typeof x === "string") pairs.push([k, x]);
    }
  } else if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData();
    for (const [k, v] of form.entries()) if (typeof v === "string") pairs.push([k, v]);
  } else {
    throw new Error("Unsupported content type.");
  }
  const system = {}, fields = new Map();
  for (const [rawK, rawV] of pairs) {
    const k = String(rawK).trim().slice(0, 120), v = String(rawV).trim();
    if (SYSTEM.has(k)) { system[k] = v; continue; }
    if (!fields.has(k)) fields.set(k, []);
    if (v) fields.get(k).push(v);
  }
  if (fields.size > MAX_FIELDS) throw new Error("Too many fields.");
  return { system, fields: [...fields].map(([k, vs]) => [k, vs.join(", ")]) };
}

export function get(sub, ...names) {
  for (const n of names) {
    const hit = sub.fields.find(([k]) => k.toLowerCase() === n.toLowerCase());
    if (hit && hit[1]) return hit[1];
  }
  return "";
}

export function senderName(sub) {
  return get(sub, "Name") || [get(sub, "First Name"), get(sub, "Last Name")].filter(Boolean).join(" ");
}

export function validate(sub, formId) {
  const email = get(sub, "Email");
  if (!email || !EMAIL_RE.test(email)) return "Please enter a valid email address.";
  if (formId !== "newsletter" && !senderName(sub)) return "Please enter your name.";
  for (const [k, v] of sub.fields) {
    if (v.length > MAX_VALUE) return `The ${k} field is too long.`;
    if (v.length <= 300 && /[\r\n]/.test(v) && /name|email|phone|firm|company/i.test(k)) return "Invalid characters in the form.";
  }
  if (/[\r\n]/.test(email + senderName(sub))) return "Invalid characters in the form.";
  return null;
}

async function verifyRecaptcha(secret, token, ip, fetchImpl) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const r = await fetchImpl("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body });
    const data = await r.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export function buildEmail(sub, formId, env, ip, ua) {
  const when = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" });
  const name = senderName(sub);
  const email = get(sub, "Email");
  const firm = get(sub, "Company Name", "Company", "Firm Name");
  const rows = [...sub.fields.map(([k, v]) => [k, v]), ["Sent from", sub.system.page_url || ""], ["Received", `${when} (ET)`]];
  const text = rows.map(([k, v]) => `${k}: ${v || "-"}`).join("\n\n") + (ip ? `\n\nIP: ${ip}\nBrowser: ${ua}` : "");
  const html =
    `<p>The following was submitted with the <b>${esc(FORM_TITLES[formId])}</b> form on cornerstonediscovery.com:</p><table cellpadding="6">` +
    rows.map(([k, v]) => `<tr><th align="left" valign="top">${esc(k)}</th><td>${esc(v || "-").replace(/\n/g, "<br>")}</td></tr>`).join("") +
    "</table>";
  const who = name || email;
  return {
    from: env.MAIL_FROM,
    to: env.MAIL_TO,
    "h:Reply-To": name ? `${name.replace(/["<>]/g, "")} <${email}>` : email,
    subject: `${FORM_TITLES[formId]}: ${who}${firm ? ` (${firm})` : ""}`,
    text,
    html,
  };
}

async function sendMailgun(message, env, fetchImpl) {
  const host = env.MAILGUN_REGION === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
  const body = new URLSearchParams(message);
  const r = await fetchImpl(`https://${host}/v3/${env.MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`api:${env.MAILGUN_API_KEY}`) },
    body,
  });
  return { ok: r.ok, status: r.status, body: r.ok ? "" : await r.text() };
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept", Vary: "Origin" };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function reply(ok, error, status, wantsJson, env, headers, formId = "contact") {
  if (wantsJson) {
    return new Response(JSON.stringify(ok ? { ok } : { ok, error }), {
      status, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  const thanks = formId === "newsletter" && env.NEWSLETTER_THANK_YOU_URL ? env.NEWSLETTER_THANK_YOU_URL : env.THANK_YOU_URL;
  const target = ok ? thanks : `${env.ERROR_URL}?error=${encodeURIComponent(error || "")}`;
  return new Response(null, { status: 303, headers: { ...headers, Location: target } });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
