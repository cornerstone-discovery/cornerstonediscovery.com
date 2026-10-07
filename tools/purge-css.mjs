// Remove CSS rules no built page uses (mostly unused Bootstrap 3), in place, after `jekyll build`.
//   cd tools && npm ci && node purge-css.mjs [siteDir]
// Classes added at runtime by assets/js/site.js are safelisted below; add to the list if you add new
// JS-toggled classes. Production builds run this in .github/workflows/pages.yml.
import { PurgeCSS } from 'purgecss';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const site = resolve(process.argv[2] || join(import.meta.dirname, '..', '_site'));
const cssFile = join(site, 'assets', 'css', 'main.css');
const before = readFileSync(cssFile, 'utf8');

const [result] = await new PurgeCSS().purge({
  content: [join(site, '**', '*.html'), join(site, 'assets', 'js', '*.js')].map((p) => p.split('\\').join('/')),
  css: [{ raw: before }],
  safelist: {
    standard: ['in', 'collapse', 'collapsing', 'collapsed', 'active', 'next', 'prev', 'left', 'right', 'item',
      'open', 'hidden', 'alert', 'alert-success', 'alert-danger', 'glyphicon-chevron-up', 'glyphicon-chevron-down',
      'sr-only', 'sr-only-focusable'],
    deep: [/^carousel/, /^navbar/],
    greedy: [/carousel-inner/],
  },
  variables: true,
  keyframes: true,
});

writeFileSync(cssFile, result.css);
console.log(`main.css: ${(before.length / 1024).toFixed(1)} KB -> ${(result.css.length / 1024).toFixed(1)} KB`);
