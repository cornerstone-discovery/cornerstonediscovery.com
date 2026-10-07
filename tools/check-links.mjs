// Fail the build if any page links to an internal URL that doesn't exist in the built site.
//   node tools/check-links.mjs [siteDir] [baseurl]
// Checks href/src/srcset/action and CSS url() on every built HTML page, plus url() in the stylesheet.
// External links are not fetched (they'd make CI flaky); mailto:/tel:/#fragments are ignored.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, posix } from 'node:path';

const site = resolve(process.argv[2] || join(import.meta.dirname, '..', '_site'));
const base = (process.argv[3] || '').replace(/\/$/, '');

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function exists(urlPath) {
  let p = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  if (base && p.startsWith(base + '/')) p = p.slice(base.length);
  else if (base && p === base) p = '/';
  const f = join(site, p);
  if (existsSync(f) && statSync(f).isFile()) return true;
  if (existsSync(join(f, 'index.html'))) return true;
  return existsSync(f + '.html');
}

const broken = new Map();
let checked = 0;
const ATTR = /\s(?:href|src|action|poster)\s*=\s*["']([^"']+)["']|\ssrcset\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/gi;

for (const file of walk(site)) {
  if (!/\.(html|css)$/.test(file)) continue;
  const rel = '/' + file.slice(site.length + 1).split('\\').join('/');
  const html = readFileSync(file, 'utf8');
  if (rel.endsWith('.html') && /http-equiv="refresh"/i.test(html.slice(0, 1500))) continue; // redirect stubs
  for (const m of html.matchAll(ATTR)) {
    const urls = m[2] ? m[2].split(',').map((s) => s.trim().split(/\s+/)[0]) : [m[1] || m[3]];
    for (let u of urls) {
      if (!u || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:|\{)/i.test(u)) continue;
      if (!u.startsWith('/')) u = posix.join(dirname(rel), u); // relative (CSS url(), rare in HTML)
      checked++;
      if (!exists(u)) {
        if (!broken.has(u)) broken.set(u, new Set());
        broken.get(u).add(rel);
      }
    }
  }
}

if (broken.size) {
  console.error(`Broken internal links: ${broken.size} (of ${checked} checked)`);
  for (const [u, pages] of broken) console.error(`  ${u}  <-  ${[...pages].slice(0, 3).join(', ')}${pages.size > 3 ? ` (+${pages.size - 3})` : ''}`);
  process.exit(1);
}
console.log(`Internal links OK (${checked} checked)`);
