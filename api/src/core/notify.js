import { FORMS } from "./schema.js";

// Builds the notification email for info@outliners.gr. Plain text only (no
// HTML injection surface). The CV/attachment is referenced by its private
// storage location and submission id — never attached and never exposed
// through a public URL.

const TITLES = {
  "request-talent": "New hiring request",
  "submit-cv": "New candidate CV submission",
};

export function buildNotification({ form, id, fields, file, storagePath, config }) {
  const lines = [
    `${TITLES[form]} (${fields.lang === "el" ? "Greek" : "English"} form)`,
    `Submission id: ${id}`,
    `Received: ${new Date().toISOString()}`,
    "",
  ];
  for (const name of Object.keys(FORMS[form].fields)) {
    if (name === "consent" || name === "lang") continue;
    if (fields[name]) lines.push(`${label(name)}: ${fields[name]}`);
  }
  lines.push("", `Consent recorded: yes (${new Date().toISOString()})`);
  if (file) {
    lines.push(
      "",
      `File: ${file.storedName} (${file.type.toUpperCase()}, ${Math.round(file.bytes / 1024)} KB)`,
      `Private storage reference: ${storagePath}`,
      "The file is in private storage. It is intentionally not attached and has no public link.",
    );
  }
  lines.push("", "— OutLiners website forms backend");
  return {
    to: config.notifyEmail,
    from: config.senderEmail,
    replyTo: fields.email,
    subject: `${TITLES[form]} — ${fields.full_name}`.slice(0, 150),
    text: lines.join("\n"),
  };
}

function label(name) {
  return name.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
}
