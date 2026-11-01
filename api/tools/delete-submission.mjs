#!/usr/bin/env node
// Secure deletion for a data-subject request (local adapter):
//   node api/tools/delete-submission.mjs <form>/<yyyy-mm>/<id>
// One submission = one folder; deleting it removes the record and the file.

import { loadConfig } from "../src/core/config.js";
import { createLocalStorage } from "../src/adapters/local/storage.js";

const relPath = process.argv[2];
if (!relPath || !/^[a-z-]+\/\d{4}-\d{2}\/[0-9a-f-]{36}$/.test(relPath)) {
  console.error("usage: delete-submission.mjs <form>/<yyyy-mm>/<uuid>");
  process.exit(2);
}
await createLocalStorage(loadConfig()).deleteSubmission(relPath);
console.log(JSON.stringify({ deleted: relPath }));
