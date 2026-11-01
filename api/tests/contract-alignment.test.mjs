// Asserts the live bilingual pages and the backend schema never drift apart:
// every control in the real HTML forms maps to the schema (and vice versa),
// endpoints match, and the file inputs/enctype are correct. Pure static
// analysis — runs in CI without a browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FORMS, CONTROL_FIELDS } from "../src/core/schema.js";

const PAGES = {
  "request-talent": ["request-talent/index.html", "el/request-talent/index.html"],
  "submit-cv": ["submit-cv/index.html", "el/submit-cv/index.html"],
};
const ROOT = new URL("../../", import.meta.url);

function controls(formHtml) {
  const names = [...formHtml.matchAll(/<(?:input|select|textarea)[^>]*\sname="([^"]+)"/g)].map(m => m[1]);
  return new Set(names);
}

for (const [form, pages] of Object.entries(PAGES)) {
  for (const page of pages) {
    test(`${page} matches the ${form} backend contract`, async () => {
      const html = await readFile(new URL(page, ROOT), "utf8");
      const m = html.match(/<form class="intake-form"[^>]*>([\s\S]*?)<\/form>/);
      assert.ok(m, "intake form present");
      const [formTag] = m[0].match(/<form[^>]*>/);
      assert.ok(formTag.includes(`action="/api/${form}"`), "action matches endpoint");
      assert.ok(formTag.includes('enctype="multipart/form-data"'), "multipart enctype");
      assert.ok(formTag.includes('data-preview="true"'), "form remains preview-only in this phase");

      const found = controls(m[1]);
      const expected = new Set([
        ...Object.keys(FORMS[form].fields),
        FORMS[form].file.name,
        ...CONTROL_FIELDS,
      ]);
      for (const name of expected) assert.ok(found.has(name), `page missing field: ${name}`);
      for (const name of found) assert.ok(expected.has(name), `page has field unknown to backend: ${name}`);

      const fileInput = m[1].match(new RegExp(`<input[^>]*name="${FORMS[form].file.name}"[^>]*>`))[0];
      assert.ok(fileInput.includes('type="file"'), "file field is a file input");
      if (FORMS[form].file.required) assert.ok(fileInput.includes("required"), "required CV upload");
    });
  }
}
