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
  // Keep candidate fields and CV filenames out of mailbox copies and subjects.
  lines.push("", `Consent recorded: yes (${new Date().toISOString()})`);
  if (file) {
    lines.push(
      "",
      `File: ${file.type.toUpperCase()} (${Math.round(file.bytes / 1024)} KB)`,
      `Private storage reference: ${storagePath}`,
      "The file is in private storage. It is intentionally not attached and has no public link.",
    );
  }
  lines.push("", "— OutLiners website forms backend");
  return {
    to: config.notifyEmail,
    from: config.senderEmail,
    replyTo: fields.email,
    subject: `${TITLES[form]} — ${id}`.slice(0, 150),
    text: lines.join("\n"),
  };
}

