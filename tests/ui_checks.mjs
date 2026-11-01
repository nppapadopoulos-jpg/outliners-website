// UI regression checks: accessibility (axe-core), navigation wrapping, overflow.
// Requires a static server on :8900 (python3 -m http.server 8900) and the
// playwright + axe-core packages. Run: node tests/ui_checks.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let axeSource;
if (process.env.AXE_PATH) {
  axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
} else {
  axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
}

const BASE = 'http://localhost:8900';
// Representative templates (dark hero, forms, legal, 404, Greek pages)
const AXE_PAGES = ['/', '/el/', '/services/', '/el/industries/', '/about/',
  '/request-talent/', '/el/submit-cv/', '/contact/', '/privacy-policy/', '/404.html'];

const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); else console.log('PASS:', msg); };

const browser = await chromium.launch();

// ---- 1. axe-core: no violations at all on representative pages ----
for (const path of AXE_PAGES) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => errors.push(`${path} pageerror: ${e.message}`));
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  await p.addScriptTag({ content: axeSource });
  const violations = await p.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return r.violations.map(v => `${v.id}[${v.impact}]x${v.nodes.length}`);
  });
  ok(violations.length === 0, `axe clean: ${path}${violations.length ? ' — ' + violations.join(', ') : ''}`);
  await p.close();
}

// ---- 2. Navigation never wraps at any width (both languages) ----
for (const url of [BASE + '/', BASE + '/el/']) {
  for (const w of [740, 760, 770, 780, 790, 800, 850, 900, 1000, 1440]) {
    const p = await browser.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    const r = await p.evaluate(() => {
      const burger = getComputedStyle(document.querySelector('.menu-toggle')).display !== 'none';
      if (burger) return { mode: 'burger' };
      const tops = new Set(Array.from(document.querySelectorAll('.nav-links a'))
        .map(a => Math.round(a.getBoundingClientRect().top)));
      return { mode: 'row', wrapped: tops.size > 1,
               overflow: document.scrollingElement.scrollWidth - innerWidth };
    });
    const lang = url.includes('/el/') ? 'el' : 'en';
    ok(r.mode === 'burger' || (!r.wrapped && r.overflow <= 0),
       `nav ${lang}@${w}px: ${r.mode}${r.wrapped ? ' WRAPPED' : ''}`);
    await p.close();
  }
}

// ---- 3. No horizontal overflow on key templates at all breakpoints ----
for (const path of ['/', '/el/', '/request-talent/', '/el/submit-cv/', '/404.html']) {
  for (const w of [375, 390, 430, 768, 1440]) {
    const p = await browser.newPage({ viewport: { width: w, height: w > 900 ? 900 : 844 } });
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    const o = await p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    ok(o <= 0, `overflow ${path}@${w}px: ${o}px`);
    await p.close();
  }
}

await browser.close();
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} problem(s):`);
  errors.forEach(e => console.error('  -', e));
  process.exit(1);
}
console.log('\nALL UI CHECKS PASSED');
