// Azure Functions v4 entry point — REFERENCE IMPLEMENTATION (untested against
// live Azure; no resources or credentials exist in this project yet).
// The Functions HttpRequest implements the fetch Request surface the core
// expects, so the shared handler is used unchanged.

import { app } from "@azure/functions";
import { loadConfig, assertProductionConfig } from "../../../src/core/config.js";
import { createFormsHandler } from "../../../src/core/handler.js";
import { createBlobStorage } from "../../../src/adapters/azure/storage-blob.js";
import { createAcsEmail } from "../../../src/adapters/azure/acs-email.js";
import { createPublicFormsEndpoint } from "../../../src/core/forms-gate.js";

const handle = createPublicFormsEndpoint(process.env, () => {
  const config = loadConfig();
  assertProductionConfig(config);
  return createFormsHandler({
    config,
    storage: createBlobStorage(process.env),
    email: createAcsEmail(process.env),
  });
});

function register(name) {
  app.http(name, {
    methods: ["POST"],
    authLevel: "anonymous",
    route: name,
    handler: async (request, context) => {
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const response = await handle(name, request, { clientIp });
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      };
    },
  });
}

register("request-talent");
register("submit-cv");
