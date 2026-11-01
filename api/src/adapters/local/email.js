// Local email adapter: writes each notification to a JSON file instead of
// sending anything. Used for development and tests. This is explicitly a
// test double — no real email delivery happens anywhere in this repository.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function createLocalEmailSink({ emailSinkDir }) {
  let n = 0;
  return {
    async send(message) {
      await mkdir(emailSinkDir, { recursive: true });
      const name = `${Date.now()}-${String(++n).padStart(3, "0")}.json`;
      await writeFile(join(emailSinkDir, name), JSON.stringify(message, null, 2), { mode: 0o600 });
      return { delivered: false, sink: name };
    },
  };
}
