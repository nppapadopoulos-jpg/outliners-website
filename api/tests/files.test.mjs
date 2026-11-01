import test from "node:test";
import assert from "node:assert/strict";
import { makeHandler, makeFormData, makeRequest, body, pdfBytes, docxBytes, docBytes, zipNotDocxBytes } from "./helpers.mjs";

test("PDF, DOCX and legacy DOC uploads are accepted by magic bytes", async () => {
  for (const [name, bytes, type] of [
    ["cv.pdf", pdfBytes(), "pdf"],
    ["cv.docx", docxBytes(), "docx"],
    ["cv.doc", docBytes(), "doc"],
  ]) {
    const { handle, stored } = makeHandler();
    const fd = makeFormData("submit-cv", { file: { name, bytes } });
    const res = await handle("submit-cv", makeRequest(fd), {});
    assert.equal(res.status, 200, name);
    assert.equal(stored[0].file.type, type);
  }
});

test("spoofed extension (text bytes named .pdf) is rejected", async () => {
  const { handle, stored } = makeHandler();
  const fd = makeFormData("submit-cv", { file: { name: "cv.pdf", bytes: Buffer.from("plain text pretending") } });
  const res = await handle("submit-cv", makeRequest(fd), {});
  assert.equal(res.status, 422);
  assert.equal((await body(res)).errors.cv, "unsupported-type");
  assert.equal(stored.length, 0);
});

test("extension/magic mismatch is rejected (PDF bytes named .docx)", async () => {
  const { handle } = makeHandler();
  const fd = makeFormData("submit-cv", { file: { name: "cv.docx", bytes: pdfBytes() } });
  assert.equal((await handle("submit-cv", makeRequest(fd), {})).status, 422);
});

test("ZIP that is not an OOXML document is rejected", async () => {
  const { handle } = makeHandler();
  const fd = makeFormData("submit-cv", { file: { name: "cv.docx", bytes: zipNotDocxBytes() } });
  assert.equal((await handle("submit-cv", makeRequest(fd), {})).status, 422);
});

test("oversized file (6 MB) is rejected with 413", async () => {
  const { handle, stored } = makeHandler();
  const fd = makeFormData("submit-cv", { file: { name: "cv.pdf", bytes: pdfBytes(6 * 1024 * 1024) } });
  const res = await handle("submit-cv", makeRequest(fd), {});
  assert.equal(res.status, 413);
  assert.equal((await body(res)).errors.cv, "too-large");
  assert.equal(stored.length, 0);
});

test("declared oversized request is refused before parsing", async () => {
  const { handle } = makeHandler();
  const req = new Request("http://x/", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(50 * 1024 * 1024) },
    body: "x",
  });
  assert.equal((await handle("submit-cv", req, {})).status, 413);
});

test("CV form without a file is rejected; request-talent without attachment passes", async () => {
  const { handle } = makeHandler();
  const noFile = makeFormData("submit-cv", { file: null });
  noFile.delete("cv");
  const res = await handle("submit-cv", makeRequest(noFile), {});
  assert.equal(res.status, 422);
  assert.equal((await body(res)).errors.cv, "required");

  const rt = await handle("request-talent", makeRequest(makeFormData("request-talent")), {});
  assert.equal(rt.status, 200);
});

test("path-traversal filenames are neutralized before storage", async () => {
  const { handle, stored } = makeHandler();
  const fd = makeFormData("submit-cv", { file: { name: "../../../etc/passwd.pdf", bytes: pdfBytes() } });
  const res = await handle("submit-cv", makeRequest(fd), {});
  assert.equal(res.status, 200);
  assert.ok(!stored[0].file.storedName.includes("/") && !stored[0].file.storedName.includes(".."));
});
