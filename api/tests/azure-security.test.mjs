import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { createOwnerAuthenticator } from '../src/core/owner-auth.js';
import { createPublicFormsEndpoint } from '../src/core/forms-gate.js';
import { createBlobStorage } from '../src/adapters/azure/storage-blob.js';
import { createAcsEmail } from '../src/adapters/azure/acs-email.js';
import { createFormsHandler } from '../src/core/handler.js';
import { createOwnerDownload } from '../src/core/owner-download.js';
import { purgeExpired } from '../src/core/retention-purge.js';
import { deleteAfterMonths } from '../src/core/privacy.js';
import { testConfig, makeFormData, makeRequest } from './helpers.mjs';

const tenant = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const client = '33333333-3333-4333-8333-333333333333';
const env = { OWNER_TENANT_ID: tenant, OWNER_OBJECT_ID: owner, OWNER_TOKEN_AUDIENCE: 'test-api', OWNER_CLIENT_ID:client };
const key = await generateKeyPair('RS256');
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
async function token(changes = {}, signingKey = key.privateKey) {
  return new SignJWT({ ver: '2.0', tid: tenant, oid: owner, azp:client, amr: ['pwd', 'mfa'], scp: 'CV.Read', ...changes })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(changes.iss || issuer).setAudience(changes.aud || 'test-api')
    .setIssuedAt().setExpirationTime(changes.exp ?? '5m').sign(signingKey);
}
const req = value => new Request('https://unit.invalid', { headers: { authorization: `Bearer ${value}` } });
test('signed owner token requires issuer, audience, tenant, delegated scope and MFA', async () => {
  const auth = createOwnerAuthenticator(env, { keys: key.publicKey });
  assert.equal(await auth(req(await token())), owner);
  for (const claims of [{ oid: 'other' }, { tid: 'other' }, { azp:'other' }, { azp: undefined, appid: client }, { ver: '1.0' }, { ver: undefined }, { amr: ['pwd'] }, { amr: undefined }, { amr: 'mfa' }, { scp: '' }, { idtyp: 'app' }, { aud: 'another-api' }, { iss: 'https://evil.invalid' }, { exp: 1 }]) {
    assert.equal(await auth(req(await token(claims))), null, JSON.stringify(claims));
  }
  const forged = await generateKeyPair('RS256');
  assert.equal(await auth(req(await token({}, forged.privateKey))), null);
  assert.equal(await auth(new Request('https://unit.invalid', { headers: { 'x-ms-client-principal': Buffer.from(JSON.stringify({oid:owner, amr:['mfa']})).toString('base64') } })), null);
  assert.equal(await createOwnerAuthenticator({}, { keys: key.publicKey })(req(await token())), null);
});

test('both public endpoints are closed without reading bodies or constructing adapters', async () => {
  for (const settings of [{}, { ENABLE_LIVE_FORMS: 'true' }, { LIVE_FORMS_APPROVAL: 'owner-approved-go-live' }]) {
    const closed = createPublicFormsEndpoint(settings, () => { throw new Error('must not initialize'); });
    for (const name of ['request-talent', 'submit-cv']) {
      const response = await closed(name, { get body() { throw new Error('must not read'); } });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'forms-not-live');
    }
  }
});

function fakeContainer() {
  const blobs = new Map(), deletes = [], uploads = [];
  let failDelete = null, failMetadata = false;
  const c = {
    blobs, deletes, uploads,
    failDelete(name) { failDelete = name; },
    failMetadata(value) { failMetadata = value; },
    async *listBlobsFlat({ prefix }) { for (const name of [...blobs.keys()].sort()) if (name.startsWith(prefix)) yield { name }; },
    getBlockBlobClient(name) { return {
      async uploadData(bytes) { uploads.push(name); blobs.set(name, Buffer.from(bytes)); },
      async upload(text) { if (failMetadata && name.endsWith('/submission.json')) throw new Error('synthetic metadata failure'); uploads.push(name); blobs.set(name, Buffer.from(text)); },
      async downloadToBuffer() { if (!blobs.has(name)) throw Object.assign(new Error('missing'), {statusCode:404}); return blobs.get(name); },
      async getProperties() { return { contentLength: blobs.get(name)?.length }; },
    }; },
    async deleteBlob(name) { if (failDelete === name) throw new Error('synthetic retry'); deletes.push(name); blobs.delete(name); },
  };
  return c;
}
const storageEnv = { STORAGE_ACCOUNT_URL: 'https://synthetic.blob.core.windows.net', STORAGE_CONTAINER: 'submissions' };

test('synthetic EN/EL submissions use the Azure adapter, private download and calendar retention', async () => {
  const c = fakeContainer(), sent = [];
  let now = Date.now();
  const storage = createBlobStorage(storageEnv, { containerClient: c, now: () => now });
  const config = testConfig({ retentionMonths: 12 });
  const handle = createFormsHandler({ config, storage, email: { async send(message) { sent.push(message); } }, logger: { info(){}, warn(){}, error(){} } });
  for (const form of ['submit-cv', 'request-talent']) {
    for (const lang of ['en', 'el']) {
      const response = await handle(form, makeRequest(makeFormData(form, { fields: { lang, email: `${form}-${lang}@example.com` } })), { clientIp: 'test' });
      assert.equal(response.status, 200);
      const { id } = await response.json();
      const path = [...c.blobs.keys()].find(name => name.endsWith(`/${id}/submission.json`));
      const record = JSON.parse(c.blobs.get(path));
      assert.equal(record.deleteAfter, deleteAfterMonths(12, Date.parse(record.receivedAt)));
      if (form === 'submit-cv') {
        const download = createOwnerDownload({ storage, ownerPrincipalId: owner });
        assert.equal((await download({ principalId: 'other', submissionId:id })).status, 403);
        assert.equal((await download({ principalId:owner, submissionId:id })).status, 200);
        now = Date.parse(record.deleteAfter);
        assert.equal(await storage.readSubmissionFile(id), null);
        now = Date.now();
      }
    }
  }
  assert.equal(sent.length, 4);
  assert.ok(sent.every(m => m.to === 'info@outliners.gr' && !/https?:|Test Person|690/.test(m.text)));
  const result = await purgeExpired({ storage, now: Date.parse('2030-01-01'), dryRun:false });
  assert.equal(result.deleted, 4);
  assert.equal(c.blobs.size, 0);
});

test('partial retention failure preserves metadata and succeeds on retry', async () => {
  const c = fakeContainer(), storage = createBlobStorage(storageEnv, {containerClient:c});
  const id = 'b07d94a5-4d3f-432d-90a3-324980984e15';
  const base = `submissions/submit-cv/2025-01/${id}`;
  c.blobs.set(`${base}/cv.pdf`, Buffer.from('synthetic'));
  c.blobs.set(`${base}/submission.json`, Buffer.from(JSON.stringify({id, deleteAfter:'2026-01-01T00:00:00Z'})));
  c.failDelete(`${base}/cv.pdf`);
  assert.equal((await purgeExpired({storage, dryRun:false})).failed, 1);
  assert.ok(c.blobs.has(`${base}/submission.json`));
  c.failDelete(null);
  assert.equal((await purgeExpired({storage, dryRun:false})).deleted, 1);
  assert.equal(c.deletes.at(-1), `${base}/submission.json`);
  await assert.rejects(storage.deleteSubmission('submissions/../'));
});

test('invalid expiry and unsafe filename cannot be downloaded; corrupt records do not stop enumeration', async () => {
  const c = fakeContainer(), id = 'b07d94a5-4d3f-432d-90a3-324980984e15';
  const base = `submissions/submit-cv/2026-01/${id}`;
  const storage = createBlobStorage(storageEnv, {containerClient:c});
  c.blobs.set(`${base}/submission.json`, Buffer.from(JSON.stringify({id,form:'submit-cv',deleteAfter:'invalid',file:{name:'cv.pdf'}})));
  assert.equal(await storage.readSubmissionFile(id), null);
  c.blobs.set(`${base}/submission.json`, Buffer.from('{bad json'));
  const records=[];
  for await (const entry of storage.list()) records.push(entry);
  assert.deepEqual(records, []);
});

test('metadata upload failure preserves uncommitted CV for safe reconciliation', async () => {
  const c = fakeContainer(), storage = createBlobStorage(storageEnv,{containerClient:c});
  c.failMetadata(true);
  const id = 'b07d94a5-4d3f-432d-90a3-324980984e15';
  const record = {id, form:'submit-cv',receivedAt:'2026-01-01T00:00:00Z',file:{name:'cv.pdf'}};
  await assert.rejects(storage.store({id,form:'submit-cv',record,file:{storedName:'cv.pdf',content:Buffer.from('synthetic')}}));
  assert.equal(c.blobs.size, 1);
  assert.equal(c.deletes.length, 0);
});

test('a 409 or 412 on duplicate CV upload never deletes an existing committed file', async () => {
  for (const statusCode of [409, 412]) {
    const id = 'b07d94a5-4d3f-432d-90a3-324980984e15';
    let deletes = 0;
    const containerClient = {
      getBlockBlobClient() { return { async uploadData() { throw Object.assign(new Error('synthetic conflict'), { statusCode }); } }; },
      async deleteBlob() { deletes++; },
    };
    const storage = createBlobStorage(storageEnv, { containerClient });
    await assert.rejects(storage.store({ id, form: 'submit-cv', record: { id, form: 'submit-cv', receivedAt: '2026-01-01T00:00:00Z', file: { name: 'cv.pdf' } }, file: { storedName: 'cv.pdf', content: Buffer.from('synthetic') } }));
    assert.equal(deletes, 0);
  }
});

test('a metadata conflict preserves a just-created CV referenced by an existing record', async () => {
  const c = fakeContainer(), id = 'b07d94a5-4d3f-432d-90a3-324980984e15';
  const base = `submissions/submit-cv/2026-01/${id}`;
  const original = c.getBlockBlobClient;
  c.getBlockBlobClient = name => {
    const client = original(name);
    if (name.endsWith('/submission.json')) client.upload = async () => { throw Object.assign(new Error('synthetic existing metadata'), { statusCode: 409 }); };
    return client;
  };
  const storage = createBlobStorage(storageEnv, { containerClient: c });
  await assert.rejects(storage.store({ id, form: 'submit-cv', record: { id, form: 'submit-cv', receivedAt: '2026-01-01T00:00:00Z', file: { name: 'cv.pdf' } }, file: { storedName: 'cv.pdf', content: Buffer.from('synthetic') } }));
  assert.ok(c.blobs.has(`${base}/cv.pdf`));
  assert.equal(c.deletes.length, 0);
});

test('a storage failure does not suppress a genuine retry as an already-stored duplicate', async () => {
  let attempts=0;
  const handle=createFormsHandler({config:testConfig(),storage:{async store(){if (++attempts===1) throw new Error('synthetic'); return 'private';}},email:{async send(){return {delivered:false};}},logger:{info(){},warn(){},error(){}}});
  assert.equal((await handle('request-talent',makeRequest(makeFormData('request-talent')))).status,502);
  const retry=await handle('request-talent',makeRequest(makeFormData('request-talent')));
  assert.equal(retry.status,200);
  assert.equal((await retry.json()).duplicate,undefined);
  assert.equal(attempts,2);
});

test('ACS transport uses Managed Identity, fixed recipient and durable operation identity', async () => {
  let calls=0;
  const state={id:'31c5d68c-3cfa-468b-8b98-87bda4f3ba2f',form:'submit-cv',operationId:'34e06c20-f9b2-4005-8caa-36913d539b84',firstSent:Date.now()};
  const credential={async getToken(scope){assert.equal(scope,'https://communication.azure.com/.default');return {token:'synthetic-test-token'};}};
  const fetch=async (url,opts)=>{calls++;const msg=JSON.parse(opts.body);assert.equal(msg.recipients.to[0].address,'info@outliners.gr');assert.equal(msg.replyTo,undefined);assert.equal(msg.attachments,undefined);assert.equal(opts.headers['Operation-Id'],state.operationId);assert.equal(opts.headers['Repeatability-Request-Id'],state.operationId);return new Response(JSON.stringify({status:'Running'}),{status:202});};
  const env={ACS_ENDPOINT:'https://synthetic.communication.azure.com',SENDER_EMAIL:'donotreply@synthetic.azurecomm.net'};
  assert.equal((await createAcsEmail(env,{credential,fetch}).submit(state)).disabled,true);assert.equal(calls,0);
  const result=await createAcsEmail({...env,ENABLE_EMAIL_NOTIFICATIONS:'true'},{credential,fetch}).submit(state);assert.equal(result.http,202);assert.equal(result.status,'Running');assert.equal(calls,1);
});
