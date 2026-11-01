// End-to-end over real HTTP: the standalone local server with filesystem
// storage and the email sink. Verifies the full tested-locally pipeline for
// both languages, that files land in private storage with owner-only modes,
// that the notification targets info@outliners.gr with no public file URL,
// and that the GDPR deletion tool removes a submission completely.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pdfBytes, validFields } from "./helpers.mjs";

const dataDir = await mkdtemp(join(tmpdir(), "outliners-forms-"));
process.env.STORAGE_DIR = join(dataDir, "submissions");
process.env.EMAIL_SINK_DIR = join(dataDir, "outbox");
const { createApiServer } = await import("../local/server.js");

const server = createApiServer();
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
test.after(() => server.close());

function cvForm(lang) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(validFields("submit-cv", lang))) fd.set(k, v);
  fd.set("email", `${lang}-cand@example.com`);
  fd.set("cv", new File([pdfBytes()], `cv-${lang}.pdf`, { type: "application/pdf" }));
  return fd;
}

test("English and Greek CV flows succeed over real HTTP", async () => {
  for (const lang of ["en", "el"]) {
    const res = await fetch(`${base}/api/submit-cv`, { method: "POST", body: cvForm(lang) });
    assert.equal(res.status, 200, lang);
    const b = await res.json();
    assert.equal(b.ok, true);
  }
});

test("files are stored privately with owner-only permissions", async () => {
  const forms = await readdir(join(process.env.STORAGE_DIR, "submit-cv"));
  const month = forms[0];
  const ids = await readdir(join(process.env.STORAGE_DIR, "submit-cv", month));
  assert.ok(ids.length >= 2);
  const dir = join(process.env.STORAGE_DIR, "submit-cv", month, ids[0]);
  const files = await readdir(dir);
  assert.ok(files.includes("submission.json"));
  const mode = (await stat(join(dir, "submission.json"))).mode & 0o777;
  assert.equal(mode, 0o600);
});

test("notifications target info@outliners.gr and expose no public file URL", async () => {
  const outbox = await readdir(process.env.EMAIL_SINK_DIR);
  assert.ok(outbox.length >= 2);
  const msg = JSON.parse(await readFile(join(process.env.EMAIL_SINK_DIR, outbox[0]), "utf8"));
  assert.equal(msg.to, "info@outliners.gr");
  assert.ok(msg.text.includes("private storage"));
  assert.ok(!/https?:\/\/\S*\.(pdf|docx?)/i.test(msg.text), "no file URLs in notifications");
});

test("invalid submission over HTTP gets a 422 with field codes", async () => {
  const fd = cvForm("en");
  fd.set("email", "nope");
  fd.set("form_started_at", String(Date.now() - 10_000));
  const res = await fetch(`${base}/api/submit-cv`, { method: "POST", body: fd });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).errors.email, "format");
});

test("unknown API route is 404", async () => {
  assert.equal((await fetch(`${base}/api/unknown`, { method: "POST" })).status, 404);
});

test("GDPR deletion tool removes a submission folder completely", async () => {
  const { createLocalStorage } = await import("../src/adapters/local/storage.js");
  const storage = createLocalStorage({ storageDir: process.env.STORAGE_DIR });
  const all = [];
  for await (const entry of storage.list()) all.push(entry);
  const victim = all[0];
  await storage.deleteSubmission(victim.relPath);
  const remaining = [];
  for await (const entry of storage.list()) remaining.push(entry.relPath);
  assert.ok(!remaining.includes(victim.relPath));
});
