// Local filesystem storage adapter (development and tests). Mirrors the
// layout the Azure Blob adapter uses: submissions/<form>/<yyyy-mm>/<id>/.
// The target directory is private, git-ignored, and never under the web root.

import { mkdir, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export function createLocalStorage({ storageDir }) {
  return {
    async store({ id, form, record, file }) {
      const month = record.receivedAt.slice(0, 7);
      const dir = join(storageDir, form, month, id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "submission.json"), JSON.stringify(record, null, 2), { mode: 0o600 });
      if (file) await writeFile(join(dir, file.storedName), file.content, { mode: 0o600 });
      return join(form, month, id);
    },

    // Secure deletion for data-subject requests: one submission = one folder.
    async deleteSubmission(relPath) {
      await rm(join(storageDir, relPath), { recursive: true, force: true });
    },

    // Enumerate records for the retention purge tool.
    async *list() {
      let forms = [];
      try { forms = await readdir(storageDir); } catch { return; }
      for (const form of forms) {
        for (const month of await readdir(join(storageDir, form))) {
          for (const id of await readdir(join(storageDir, form, month))) {
            const rel = join(form, month, id);
            const raw = await readFile(join(storageDir, rel, "submission.json"), "utf8");
            yield { relPath: rel, record: JSON.parse(raw) };
          }
        }
      }
    },
  };
}
