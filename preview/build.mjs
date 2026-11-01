// Builds the GitHub Pages PREVIEW of the OutLiners website into _preview/.
//
// - Copies ONLY the public site: the 25 HTML pages, assets/ and favicon.png.
//   Internal material (api/, docs/, tests/, workflows, README) is never
//   published.
// - Rewrites root-relative URLs (href/src/action, CSS url(), JS asset paths)
//   to the Pages subpath given in BASE_PATH (e.g. /outliners-website).
// - Strips canonical/hreflang/og:url (they point at the real domain) and
//   injects <meta name="robots" content="noindex, nofollow"> on every page,
//   plus a robots.txt that disallows everything. The preview must never be
//   indexed or mistaken for the production site.
// - Forms stay exactly as committed: preview-only (data-preview="true").
//
// Usage: BASE_PATH=/outliners-website node preview/build.mjs

import { cp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const BASE = (process.env.BASE_PATH || "").replace(/\/$/, "");
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "_preview");

const PAGE_DIRS = ["", "services", "services/recruitment-executive-search",
  "services/embedded-talent-partner", "services/talent-advisory", "industries",
  "about", "contact", "request-talent", "submit-cv", "privacy-policy", "cookies"];
const HTML_FILES = [
  ...PAGE_DIRS.map(d => join(d, "index.html")),
  ...PAGE_DIRS.map(d => join("el", d, "index.html")),
  "404.html",
];

function rewriteHtml(html) {
  // Root-relative attribute URLs -> subpath
  html = html.replace(/\b(href|src|action)="\/(?!\/)/g, `$1="${BASE}/`);
  // Remove production canonical/hreflang/og:url signals
  html = html.replace(/<link rel="(canonical|alternate)"[^>]*>\n?/g, "");
  html = html.replace(/<meta property="og:url"[^>]*>\n?/g, "");
  // Inject noindex (404 already carries one; avoid duplicates)
  if (!html.includes('name="robots"')) {
    html = html.replace("<meta charset=\"utf-8\">",
      "<meta charset=\"utf-8\">\n<meta name=\"robots\" content=\"noindex, nofollow\">");
  }
  return html;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let pages = 0;
for (const rel of HTML_FILES) {
  const html = await readFile(join(ROOT, rel), "utf8");
  const outPath = join(OUT, rel);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, rewriteHtml(html));
  pages++;
}

// Assets: copy, rewriting the text ones that carry root-relative URLs.
await cp(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
for (const rel of ["assets/css/styles.css", "assets/js/main.js", "assets/js/stories.js", "assets/js/intake.js"]) {
  const text = await readFile(join(ROOT, rel), "utf8");
  await writeFile(join(OUT, rel),
    text.replaceAll('url("/', `url("${BASE}/`).replaceAll("'/assets/", `'${BASE}/assets/`).replaceAll('"/assets/', `"${BASE}/assets/`));
}
await cp(join(ROOT, "favicon.png"), join(OUT, "favicon.png"));
await writeFile(join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n");

// Safety: fail the build if anything internal leaked into the artifact.
const top = await readdir(OUT);
const allowed = new Set(["assets", "el", "404.html", "favicon.png", "index.html", "robots.txt", ...PAGE_DIRS.filter(Boolean).map(d => d.split("/")[0])]);
for (const entry of top) {
  if (!allowed.has(entry)) throw new Error("unexpected file in preview artifact: " + entry);
}
console.log(`preview built: ${pages} pages, BASE_PATH="${BASE}" -> ${OUT}`);
