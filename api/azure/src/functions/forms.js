// Azure Functions v4 entry point. Deployed with both public intake gates closed.
// See docs/AZURE_BACKEND_STATUS.md for actual Azure verification and open gates.
// The Functions HttpRequest implements the fetch Request surface the core
// expects, so the shared handler is used unchanged.

import { app } from "@azure/functions";
import { loadConfig, assertProductionConfig } from "../../../src/core/config.js";
import { createFormsHandler } from "../../../src/core/handler.js";
import { createBlobStorage } from "../../../src/adapters/azure/storage-blob.js";

import { createPublicFormsEndpoint } from "../../../src/core/forms-gate.js";

import { createBlobControl } from '../../../src/adapters/azure/blob-control.js';
import { createDurableAdmission } from '../../../src/core/durable-admission.js';
const handle = createPublicFormsEndpoint(process.env, () => {
  const config = loadConfig();
  assertProductionConfig(config);
  const base=createBlobStorage(process.env);
  const storage=createDurableAdmission({control:createBlobControl(process.env,'security/intake-control.json'),storage:base,secret:config.ipHashSalt});
  return createFormsHandler({
    config,
    storage,
    // Committed metadata is the durable discovery marker. The timer creates
    // notification state even after a crash between intake and dispatch.
    email: { send: async () => ({ delivered: false, queued: true }) },
  });
});

function register(name) {
  app.http(name, {
    methods: ["POST"],
    authLevel: "anonymous",
    route: name,
    handler: async (request, context) => {
      const origin=request.headers.get('origin');
      const allowed=(process.env.PUBLIC_FORM_ORIGINS || 'https://outliners.gr,https://www.outliners.gr').split(',');
      if(process.env.ENABLE_LIVE_FORMS==='true' && (!origin || !allowed.includes(origin)))return {status:403,headers:{'cache-control':'no-store'}};
      // App Service appends its observed peer; never trust an injected first XFF value.
      const clientIp = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
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
