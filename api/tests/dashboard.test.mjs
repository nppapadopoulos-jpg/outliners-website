import test from 'node:test';import assert from 'node:assert/strict';
import { createOwnerDashboard } from '../src/core/owner-dashboard.js';
import { createOwnerRepository } from '../src/adapters/azure/owner-repository.js';
import { createBlobStorage } from '../src/adapters/azure/storage-blob.js';
import { createDurableAdmission } from '../src/core/durable-admission.js';
import { createBlobControl } from '../src/adapters/azure/blob-control.js';
import { memoryContainer } from './blob-memory.mjs';
const clock=Date.parse('2026-11-03T00:00:00Z'),secret='synthetic-secret-that-is-at-least-32-characters',owner='owner',env={STORAGE_ACCOUNT_URL:'https://synthetic.invalid'};
const ids=Array.from({length:30},(_,i)=>'ab000000-0000-4000-8000-'+String(i).padStart(12,'0'));
const record=(id=ids[0],form='submit-cv')=>({id,form,receivedAt:'2026-11-02T12:00:00Z',deleteAfter:'2027-11-02T12:00:00Z',consent:{value:'yes'},fields:{full_name:'Synthetic Person',email:'synthetic@example.invalid',phone:'0000000000',specialization:'Engineer',company:form==='request-talent'?'Synthetic Company':'',job_title:'Developer',job_description:'Synthetic only',introduction:'<script>unsafe()</script>'},file:{name:'synthetic.pdf',type:'pdf',bytes:8}});
const req=(body={},method='POST')=>new Request('https://owner.invalid/api/owner/submissions',{method,headers:method==='POST'?{'content-type':'application/json'}:{},body:method==='POST'?JSON.stringify(body):undefined});
async function seed(c,r){const s=createBlobStorage(env,{containerClient:c});await s.store({id:r.id,form:r.form,record:r,file:{storedName:'synthetic.pdf',content:Buffer.from('%PDF-1.4')}});return s;}
test('owner list is paginated, signed, minimized and rejects cursor tampering or filter reuse',async()=>{
 const c=memoryContainer();for(let i=0;i<30;i++)await seed(c,record(ids[i],i%2?'request-talent':'submit-cv'));
 const api=createOwnerDashboard({storage:createOwnerRepository(env,{container:c}),ownerPrincipalId:owner,cursorSecret:secret,now:()=>clock});
 const first=await api({principalId:owner,request:req({limit:'12'})});assert.equal(first.headers.get('cache-control'),'no-store, private');const a=await first.json();assert.equal(a.items.length,12);assert.equal(a.stats.cv,15);assert.equal(a.stats.clients,15);assert.equal(a.stats.new,30);assert.ok(a.nextCursor);assert.equal(a.items[0].fields,undefined);assert.equal(a.items[0]._path,undefined);
 const b=await(await api({principalId:owner,request:req({limit:'12',cursor:a.nextCursor})})).json();assert.equal(b.items.length,12);assert.equal(a.items.some(x=>b.items.some(y=>x.id===y.id)),false);
 for(const body of [{limit:'12',cursor:a.nextCursor+'X'},{limit:'12',type:'submit-cv',cursor:a.nextCursor},{limit:'99'},{q:'a'.repeat(121)}])assert.equal((await api({principalId:owner,request:req(body)})).status,400);
});
test('non-owner is rejected before any storage access; missing cursor secret fails closed',async()=>{
 const api=createOwnerDashboard({storage:{ownerRecords(){throw Error('must not read');}},ownerPrincipalId:owner,cursorSecret:secret});for(const p of [null,'other'])assert.equal((await api({principalId:p,request:req()})).status,403);
 assert.equal((await createOwnerDashboard({storage:{},ownerPrincipalId:owner})({principalId:owner,request:req()})).status,503);
});
test('search in POST body, exact form filters, durable review state, expired/path-mismatched records excluded',async()=>{
 const c=memoryContainer();await seed(c,record());await seed(c,record(ids[1],'request-talent'));const expired=record(ids[2]);expired.deleteAfter='2025-01-01';await seed(c,expired);
 const repository=createOwnerRepository(env,{container:c}),api=()=>createOwnerDashboard({storage:repository,ownerPrincipalId:owner,cursorSecret:secret,now:()=>clock});
 let data=await(await api()({principalId:owner,request:req({q:'Company',type:'request-talent'})})).json();assert.equal(data.total,1);assert.equal(data.stats.total,2);
 const detail=await(await api()({principalId:owner,action:'detail',id:ids[0],request:req({},'GET')})).json();assert.equal(detail.fields.introduction,'<script>unsafe()</script>');assert.equal(detail._path,undefined);assert.equal(detail.consentRecorded,true);
 assert.equal((await api()({principalId:owner,action:'review',id:ids[0],request:req()})).status,200);
 data=await(await api()({principalId:owner,request:req({state:'new'})})).json();assert.equal(data.total,1);assert.equal(data.stats.new,1);
 assert.equal((await api()({principalId:owner,action:'detail',id:ids[2],request:req({},'GET')})).status,404);
 assert.equal((await api()({principalId:owner,action:'detail',id:'../secret',request:req({},'GET')})).status,400);
 const cross=new Request('https://owner.invalid/api/owner/submissions',{method:'POST',headers:{origin:'https://evil.invalid'},body:'{}'});assert.equal((await api()({principalId:owner,request:cross})).status,403);
 const get=new Request('https://owner.invalid/api/owner/submissions?q=private');assert.equal((await api()({principalId:owner,request:get})).status,400);
 const path='submissions/submit-cv/2026-11/'+ids[3]+'/submission.json';await c.getBlockBlobClient(path).upload(JSON.stringify(record(ids[4])),0);assert.equal((await repository.ownerRecords()).some(x=>x.id===ids[4]),false);
});
test('cursor expires and snapshot excludes later additions',async()=>{
 let at=clock;const list=Array.from({length:3},(_,i)=>record(ids[i]));const api=createOwnerDashboard({storage:{async ownerRecords(){return list;}},ownerPrincipalId:owner,cursorSecret:secret,now:()=>at});
 const first=await(await api({principalId:owner,request:req({limit:'1'})})).json();const newer=record(ids[4]);newer.receivedAt=new Date(clock+1).toISOString();list.push(newer);at++;
 const second=await(await api({principalId:owner,request:req({limit:'1',cursor:first.nextCursor})})).json();assert.equal(second.total,3);at=clock+900001;assert.equal((await api({principalId:owner,request:req({limit:'1',cursor:first.nextCursor})})).status,400);
});
test('two independent admission instances share quota and deduplicate after restart',async()=>{
 const c=memoryContainer(),base=createBlobStorage(env,{containerClient:c}),control=()=>createBlobControl(env,'security/intake-control.json',{container:c});
 const guard=()=>createDurableAdmission({storage:base,control:control(),secret,now:()=>clock,perIpHour:1});
 const input={id:ids[0],form:'submit-cv',record:record(),file:{storedName:'synthetic.pdf',content:Buffer.from('%PDF-1.4')},admission:{ipHash:'synthetic-ip'}};
 assert.equal((await guard().store(input)).duplicate,false);const duplicate=await guard().store({...input,id:ids[1],record:{...input.record,id:ids[1]}});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.id,ids[0]);
 await assert.rejects(guard().store({...input,id:ids[2],record:{...record(ids[2]),fields:{email:'another@example.invalid'}}}),e=>e.statusCode===429);
 assert.equal([...c.files.keys()].filter(n=>n.endsWith('/submission.json')).length,1);
 const raw=c.files.get('security/intake-control.json').bytes.toString();assert.doesNotMatch(raw,/synthetic@example|synthetic-ip|Synthetic Person/);
});
test('metadata commit with lost response preserves CV; retry does not overwrite or delete it',async()=>{
 const c=memoryContainer(),base=createBlobStorage(env,{containerClient:c});c.fail.afterCommit=1;
 const result=await base.store({id:ids[0],form:'submit-cv',record:record(),file:{storedName:'synthetic.pdf',content:Buffer.from('%PDF-1.4')}});assert.match(result,/submissions/);assert.equal((await base.readSubmissionFile(ids[0])).bytes.toString(),'%PDF-1.4');assert.equal(c.deletes.length,0);
});
test('pending metadata failure resumes with identical bytes without deleting the CV',async()=>{
 const c=memoryContainer(),base=createBlobStorage(env,{containerClient:c}),guard=()=>createDurableAdmission({storage:base,control:createBlobControl(env,'security/intake-control.json',{container:c}),secret,now:()=>clock});c.fail.metadata=1;
 const input={id:ids[0],form:'submit-cv',record:record(),file:{storedName:'synthetic.pdf',content:Buffer.from('%PDF-1.4')},admission:{ipHash:'synthetic'}};
 await assert.rejects(guard().store(input));assert.equal([...c.files.keys()].some(n=>n.endsWith('/synthetic.pdf')),true);
 await guard().store(input);assert.equal((await base.readSubmissionFile(ids[0])).bytes.toString(),'%PDF-1.4');assert.equal(c.deletes.length,0);
});
test('orphan sweep only removes aged uncommitted files; failure is retryable',async()=>{
 const c=memoryContainer(),base=await seed(c,record()),orphan='submissions/submit-cv/2026-11/'+ids[1]+'/cv.pdf';await c.getBlockBlobClient(orphan).uploadData(Buffer.from('synthetic'));
 for(const v of c.files.values())v.modified=new Date(clock-90000000);
 c.fail.delete=1;assert.equal((await base.reconcileOrphans({now:clock})).failed,1);assert.equal((await base.reconcileOrphans({now:clock})).removed,1);assert.equal(c.files.has(orphan),false);assert.equal((await base.readSubmissionFile(ids[0])).bytes.length,8);
});
test('review sidecar is deleted with the record; admission security state prunes after 24h',async()=>{
 const c=memoryContainer(),base=await seed(c,record()),repo=createOwnerRepository(env,{container:c});const r=await repo.ownerRecord(ids[0]);await repo.markReviewed(r,new Date(clock).toISOString());await base.deleteSubmission(r._path);assert.equal([...c.files.keys()].some(n=>n.includes(ids[0])),false);
 const control=createBlobControl(env,'security/intake-control.json',{container:c});await control.exclusive(async(s,save)=>{s.hits={a:[clock-4000000]};s.intents={a:{at:clock-90000000}};s.monthCount=3;await save();});
 await createDurableAdmission({control,storage:base,secret,now:()=>clock}).cleanup();await control.exclusive(async s=>{assert.deepEqual(s.hits,{});assert.deepEqual(s.intents,{});assert.equal(s.monthCount,3);});
});
test('global monthly admission cap is shared across IPs and form types',async()=>{
 const c=memoryContainer(),base=createBlobStorage(env,{containerClient:c}),make=()=>createDurableAdmission({storage:base,control:createBlobControl(env,'security/cap.json',{container:c}),secret,now:()=>clock,perMonth:1});
 await make().store({id:ids[0],form:'submit-cv',record:record(),file:{storedName:'synthetic.pdf',content:Buffer.from('%PDF-1.4')},admission:{ipHash:'ip1'}});
 await assert.rejects(make().store({id:ids[1],form:'request-talent',record:{...record(ids[1],'request-talent'),fields:{email:'other@example.invalid'}},file:{storedName:'synthetic.pdf',content:Buffer.from('%PDF-1.4')},admission:{ipHash:'ip2'}}),e=>e.statusCode===429);
});

test('Owner erasure requires confirmation and exact identity, blocks file/list immediately and retries physical deletion',async()=>{
 const c=memoryContainer(),r=record();const storage=await seed(c,r),repo=createOwnerRepository(env,{container:c});
 const api=createOwnerDashboard({storage:repo,ownerPrincipalId:owner,cursorSecret:secret,now:()=>clock});
 assert.equal((await api({principalId:'wrong',action:'erase',id:r.id,request:req({confirm:true})})).status,403);
 assert.equal((await api({principalId:owner,action:'erase',id:r.id,request:req()})).status,400);
 assert.equal((await api({principalId:owner,action:'erase',id:r.id,request:new Request('https://owner.invalid/api/owner/submissions',{method:'POST',headers:{origin:'https://wrong.invalid'},body:'{"confirm":true}'})})).status,403);
 const stale=await repo.ownerRecord(r.id);
 assert.equal((await api({principalId:owner,action:'erase',id:r.id,request:req({confirm:true})})).status,200);
 const list=await(await api({principalId:owner,request:req()})).json();assert.equal(list.total,0);
 assert.equal((await api({principalId:owner,action:'detail',id:r.id,request:req({},'GET')})).status,404);
 await assert.rejects(()=>repo.requestErasure(stale,new Date(clock).toISOString()),e=>e.statusCode===412);
 const current=await repo.ownerRecord(r.id);assert.equal(current.deleteAfter,new Date(clock).toISOString());
 assert.equal(await storage.readSubmissionFile(r.id),null,'expired tombstone blocks download before physical deletion');
 c.fail.delete=1;await assert.rejects(()=>storage.deleteSubmission(current._path));assert.ok(c.files.has(current._path+'/submission.json'));
 await storage.deleteSubmission(current._path);assert.equal(c.files.has(current._path+'/submission.json'),false);
});
