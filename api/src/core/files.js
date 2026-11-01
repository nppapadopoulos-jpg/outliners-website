// Server-side file acceptance: size limit plus magic-byte verification.
// The client's extension and Content-Type are never trusted on their own —
// the bytes must match a known signature AND agree with the extension.

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // DOCX (OOXML) container
const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc

function startsWith(buf, sig) {
  return sig.every((b, i) => buf[i] === b);
}

export function detectType(bytes) {
  if (startsWith(bytes, PDF)) return "pdf";
  if (startsWith(bytes, ZIP)) return "docx";
  if (startsWith(bytes, OLE)) return "doc";
  return null;
}

const EXT_FOR = { pdf: [".pdf"], docx: [".docx"], doc: [".doc"] };

/**
 * @returns {{ ok: true, type: string, bytes: Uint8Array } | { ok: false, code: "too-large" | "unsupported-type" }}
 */
export async function checkFile(file, { maxFileBytes }) {
  if (file.size > maxFileBytes) return { ok: false, code: "too-large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) return { ok: false, code: "unsupported-type" };
  const type = detectType(bytes);
  if (!type) return { ok: false, code: "unsupported-type" };
  // A DOCX must additionally contain the OOXML content-types entry near the
  // start of the archive; plain ZIPs renamed to .docx are refused.
  if (type === "docx") {
    const head = Buffer.from(bytes.slice(0, 4096)).toString("latin1");
    if (!head.includes("[Content_Types].xml")) return { ok: false, code: "unsupported-type" };
  }
  const name = (file.name || "").toLowerCase();
  if (!EXT_FOR[type].some(ext => name.endsWith(ext))) return { ok: false, code: "unsupported-type" };
  return { ok: true, type, bytes };
}
