import { randomUUID } from 'node:crypto';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH = new RegExp(`^submissions/(submit-cv|request-talent)/\\d{4}-\\d{2}/(${UUID})$`, 'i');
export function createNotificationRepository(env, { container: supplied } = {}) {
  let c = supplied, lease;
  const controlPath = 'notifications/control.json';
  async function container() {
    if (!c) { const [{ BlobServiceClient }, { ManagedIdentityCredential }] = await Promise.all([import('@azure/storage-blob'),import('@azure/identity')]); c = new BlobServiceClient(env.STORAGE_ACCOUNT_URL, new ManagedIdentityCredential(env.AZURE_CLIENT_ID || undefined)).getContainerClient(env.STORAGE_CONTAINER || 'submissions'); }
    return c;
  }
  async function read(path) {
    const b = (await container()).getBlockBlobClient(path);
    const r = await b.download(); const chunks=[]; for await (const chunk of r.readableStreamBody) chunks.push(chunk);
    return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')), etag: r.etag };
  }
  async function upload(path,value,conditions,meta,leaseId) {
    const data=JSON.stringify(value);
    return (await container()).getBlockBlobClient(path).upload(data,Buffer.byteLength(data),{conditions:{...conditions,...(leaseId?{leaseId}:{})},metadata:meta,blobHTTPHeaders:{blobContentType:'application/json'}});
  }
  const api = {
    async exclusive(fn) {
      const cc=await container(), b=cc.getBlockBlobClient(controlPath);
      try { await upload(controlPath,{}, {ifNoneMatch:'*'}); } catch(e) { if(![409,412].includes(e.statusCode))throw new Error('Outbox control unavailable'); }
      lease=b.getBlobLeaseClient(randomUUID());
      try { await lease.acquireLease(60); } catch(e) { if([409,412].includes(e.statusCode))return {outcome:'locked'};throw new Error('Outbox lock unavailable'); }
      try { const {value}=await read(controlPath); return await fn(value); }
      finally { try {await lease.releaseLease();}catch{} lease=null; }
    },
    async assertLock() { if(!lease)throw new Error('Outbox lock required');await lease.renewLease(); },
    async saveControl(value) { await api.assertLock(); await upload(controlPath,value,{},undefined,lease.leaseId); },
    async save(state) {
      if(!PATH.test(state.path))throw new Error('Invalid outbox path');
      await api.assertLock(); const {_etag,...value}=state;
      const r=await upload(state.path+'/notification.json',value,_etag?{ifMatch:_etag}:{ifNoneMatch:'*'},{status:state.status,nextat:String(state.nextAt || 0)});state._etag=r.etag;
    },
    async discover(now) {
      const all=[]; for await(const b of (await container()).listBlobsFlat({prefix:'submissions/',includeMetadata:true}))all.push(b);
      const committed=new Set(all.filter(b=>b.name.endsWith('/submission.json')).map(b=>b.name.slice(0,-16)));
      const indexed=new Set(all.filter(b=>b.name.endsWith('/notification.json')).map(b=>b.name.slice(0,-18)));
      const due=[];
      for(const b of all.filter(b=>b.name.endsWith('/notification.json') && !['succeeded','failed','uncertain','expired'].includes(b.metadata?.status) && Number(b.metadata?.nextat || 0)<=now).slice(0,10)) {
        const path=b.name.slice(0,-18);if(!committed.has(path)||!PATH.test(path))continue;
        const {value,etag}=await read(b.name);if(value.path!==path)throw new Error('Outbox path mismatch');due.push({...value,_etag:etag});
      }
      for(const path of [...committed].filter(p=>!indexed.has(p)&&PATH.test(p)).slice(0,10)) {
        const {value:r}=await read(path+'/submission.json'),match=path.match(PATH);
        if(r.id!==match[2]||r.form!==match[1]||!Number.isFinite(Date.parse(r.deleteAfter))||Date.parse(r.deleteAfter)<=now)continue;
        const state={path,id:r.id,form:r.form,deleteAfter:r.deleteAfter,status:'pending',attempts:0,polls:0,nextAt:now};
        await api.save(state);due.push(state);
      }
      return due;
    },
  };
  return api;
}
