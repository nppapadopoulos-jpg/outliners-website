import test from "node:test";
import assert from "node:assert/strict";
import { ownerFromPlatformPrincipal } from "../src/core/owner-identity.js";

const encode = x => Buffer.from(JSON.stringify(x)).toString("base64");
test("missing or invalid identity fails closed", () => {
  assert.equal(ownerFromPlatformPrincipal("", "owner"), null);
  assert.equal(ownerFromPlatformPrincipal("not-base64", "owner"), null);
  assert.equal(ownerFromPlatformPrincipal(encode({claims: []}), "owner"), null);
});
test("only exact Entra object ID is recognized", () => {
  const claim = id => ({typ:"http://schemas.microsoft.com/identity/claims/objectidentifier",val:id});
  assert.equal(ownerFromPlatformPrincipal(encode({claims:[claim("other")]}), "owner"), null);
  assert.equal(ownerFromPlatformPrincipal(encode({claims:[claim("owner")]}), "owner"), "owner");
  assert.equal(ownerFromPlatformPrincipal(encode({claims:[claim("owner"),claim("owner")]}), "owner"), null);
});
