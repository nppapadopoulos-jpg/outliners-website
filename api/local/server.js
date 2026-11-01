// Standalone local/alternative-hosting server for the forms backend.
// Wires the hosting-independent core to the local filesystem/email adapters.
// This same file is the reference for non-Azure deployment: run it under any
// Node 20+ process manager behind a reverse proxy (see docs/BACKEND_DEPLOYMENT.md).
//
//   node api/local/server.js        -> listens on http://localhost:8787
//
// Nothing here sends real email or touches any cloud service.

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { loadConfig, assertProductionConfig } from "../src/core/config.js";
import { createFormsHandler } from "../src/core/handler.js";
import { createLocalStorage } from "../src/adapters/local/storage.js";
import { createLocalEmailSink } from "../src/adapters/local/email.js";

const config = loadConfig();
if (config.production) assertProductionConfig(config);

const handle = createFormsHandler({
  config,
  storage: createLocalStorage(config),
  email: createLocalEmailSink(config),
});

const ROUTES = { "/api/request-talent": "request-talent", "/api/submit-cv": "submit-cv" };

export function createApiServer() {
  return createServer(async (req, res) => {
    const form = ROUTES[req.url.split("?")[0]];
    if (!form) {
      res.writeHead(404, { "content-type": "application/json" }).end('{"ok":false}');
      return;
    }
    // Lift the Node request into a Web-standard Request for the core.
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === "POST" ? Readable.toWeb(req) : undefined,
      duplex: "half",
    });
    const clientIp = req.socket.remoteAddress;
    const response = await handle(form, request, { clientIp });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8787;
  createApiServer().listen(port, () =>
    console.log(`forms backend (local adapters) on http://localhost:${port}`));
}
