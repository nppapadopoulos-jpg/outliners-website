#!/usr/bin/env node
// GDPR retention purge for the LOCAL storage adapter: deletes submissions
// whose deleteAfter has passed. Refuses to run while the retention period is
// still an open owner/legal decision (RETENTION_DAYS unset), so nothing is
// ever silently kept or deleted outside an approved policy.
// (On Azure, retention is a Blob lifecycle rule instead — see deployment doc.)

import { loadConfig } from "../src/core/config.js";
import { createLocalStorage } from "../src/adapters/local/storage.js";

const config = loadConfig();
if (config.retentionDays === null) {
  console.error("RETENTION_DAYS is not set. The retention period is an owner/legal decision; refusing to purge.");
  process.exit(2);
}
const storage = createLocalStorage(config);
let purged = 0, kept = 0;
for await (const { relPath, record } of storage.list()) {
  if (record.deleteAfter && new Date(record.deleteAfter) < new Date()) {
    await storage.deleteSubmission(relPath);
    purged++;
  } else kept++;
}
console.log(JSON.stringify({ purged, kept }));
