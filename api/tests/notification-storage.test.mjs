import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createNotificationRepository } from '../src/adapters/azure/notification-outbox.js';
import { runNotificationCycle } from '../src/core/notification-outbox.js';
function blobs() {
 const disk=new Map();let sequence=0,lock=null;
 return {disk,async *listBlobsFlat({prefix}){for(const [name,v] of disk)if(name.startsWith(prefix))yield {name,metadata:v.metadata};},getBlockBlobClient(name){return {
  async upload(data,len,opts={}){const old=disk.get(name),cond=opts.conditions||{};if(cond.ifNoneMatch==='*'&&old)throw {statusCode:412};if(cond.ifMatch&&cond.ifMatch!==old?.etag)throw {statusCode:412};if(name==='notifications/control.json'&&old&&lock&&cond.leaseId!==lock)throw {statusCode:412};const etag=String(++sequence);disk.set(name,{data,etag,metadata:opts.metadata||{}});return {etag};},
  async download(){const v=disk.get(name);if(!v)throw {statusCode:404};return {etag:v.etag,readableStreamBody:Readable.from([Buffer.from(v.data)])};},
  getBlobLeaseClient(id){return {leaseId:id,async acquireLease(){if(lock)throw {statusCode:409};lock=id;},async renewLease(){assert.equal(lock,id);},async releaseLease(){assert.equal(lock,id);lock=null;}};},
 };}};
}
test('Blob repository discovers both committed forms, persists states and resumes after re-creation',async()=>{
 const c=blobs(),now=Date.parse('2026-11-03'),env={ENABLE_EMAIL_NOTIFICATIONS:'true'};
 for(const [form,id] of [['submit-cv','b07d94a5-4d3f-432d-90a3-324980984e15'],['request-talent','2dd854ab-f246-4e35-bf8f-cc4b3e1740e1']]){
  const path=`submissions/${form}/2026-11/${id}`;await c.getBlockBlobClient(path+'/submission.json').upload(JSON.stringify({id,form,deleteAfter:'2027-11-03'}),0);
 }
 let sends=0,polls=0;const transport={async submit(){sends++;return {http:202,status:'Running'};},async status(){polls++;return {http:200,status:'Succeeded'};}};
 const repo=()=>createNotificationRepository({}, {container:c});
 await runNotificationCycle({repository:repo(),transport,env,now});
 // Each invocation obtains a new repository (no state in instance memory).
 for(let step=1;step<=4;step++)await runNotificationCycle({repository:repo(),transport,env,now:now+step*1200000});
 assert.equal(sends,2);assert.equal(polls,2);
 const records=[...c.disk].filter(([p])=>p.endsWith('/notification.json'));assert.equal(records.length,2);
 for(const [,v]of records){assert.equal(JSON.parse(v.data).status,'succeeded');assert.equal(v.metadata.status,'succeeded');}
 assert.equal(JSON.parse(c.disk.get('notifications/control.json').data).sends,2);
});
test('Blob sidecar ETag rejects stale writes, and mismatched record paths do not enqueue',async()=>{
 const c=blobs(),repo=createNotificationRepository({}, {container:c}),path='submissions/submit-cv/2026-11/b07d94a5-4d3f-432d-90a3-324980984e15';
 await c.getBlockBlobClient(path+'/submission.json').upload(JSON.stringify({id:'wrong',form:'submit-cv',deleteAfter:'2027-11-03'}),0);
 await repo.exclusive(async()=>{assert.deepEqual(await repo.discover(Date.parse('2026-11-03')),[]);const state={path,status:'pending'};await repo.save(state);const stale={...state};await repo.save(state);await assert.rejects(repo.save(stale),e=>e.statusCode===412);});
});
