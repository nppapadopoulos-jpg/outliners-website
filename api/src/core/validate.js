import { FORMS } from "./schema.js";

// Strips control characters (incl. CR/LF on single-line fields) so values can
// never smuggle email-header or log-line injection, then trims and caps length.
export function sanitize(value, { multiline = false, max = 200 } = {}) {
  let v = String(value ?? "");
  v = multiline
    ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    : v.replace(/[\u0000-\u001F\u007F]/g, " ");
  v = v.trim();
  if (v.length > max) v = v.slice(0, max);
  return v;
}

// Validates and normalizes the text fields of a parsed multipart form.
// Returns { fields, errors } — errors maps field name to a short code
// ("required" | "format" | "too-long"), never echoing submitted values.
export function validateFields(formName, formData) {
  const spec = FORMS[formName];
  const fields = {};
  const errors = {};
  for (const [name, rule] of Object.entries(spec.fields)) {
    const raw = formData.get(name);
    const present = typeof raw === "string" && raw.trim() !== "";
    if (!present) {
      if (rule.required) errors[name] = "required";
      continue;
    }
    if (raw.length > (rule.max ?? 200) * 4) { errors[name] = "too-long"; continue; }
    const v = sanitize(raw, { multiline: rule.multiline, max: rule.max ?? 200 });
    if (rule.enum && !rule.enum.includes(v)) { errors[name] = "format"; continue; }
    if (rule.validate) {
      const r = rule.validate(v);
      if (r !== true) { errors[name] = r; continue; }
    }
    fields[name] = v;
  }
  return { fields, errors };
}

// Filenames: basename only (defeats path traversal), conservative charset,
// bounded length, extension preserved.
export function sanitizeFilename(name) {
  let base = String(name ?? "file").split(/[\\/]/).pop();
  base = base.replace(/[^\w.\-()Ͱ-Ͽἀ-῿ ]+/g, "_").replace(/\s+/g, " ").trim();
  if (!base || base.startsWith(".")) base = "file" + base;
  if (base.length > 80) {
    const dot = base.lastIndexOf(".");
    const ext = dot > 0 ? base.slice(dot).slice(0, 10) : "";
    base = base.slice(0, 80 - ext.length) + ext;
  }
  return base;
}
