import test from 'node:test';
import assert from 'node:assert/strict';
import { runNotificationCycle } from '../src/core/notification-outbox.js';
import { buildNotification } from '../src/core/notify.js';
const t=Date.parse('2026-11-03T00:00:00Z'),env={ENABLE_EMAIL_NOTIFICATIONS:'true'};
function setup() {
 const disk={control:{},state:{id:'31c5d68c-3cfa-468b-8b98-87bda4f3ba2f',form:'submit-cv',deleteAfter:'2027-11-03T00:00:00Z',status:'pending',nextAt:0,attempts:0,polls:0}};
 let locked=false;
 const repo=()=>({async exclusive(fn){if(locked)return {outcome:'locked'};locked=true;try{return await fn(structuredClone(disk.control));}finally{locked=false;}},async discover(){return [structuredClone(disk.state)];},async save(s){disk.state=structuredClone(s);},async saveControl(c){disk.control=structuredClone(c);},async assertLock(){assert.equal(locked,true);}});
 return {disk,repo};
}
test('prepared state survives lost response; fresh worker polls without duplicate send',async()=>{
 const {disk,repo}=setup();let sent=0,polled=0;
 const transport={async submit(s){sent++;assert.equal(disk.state.operationId,s.operationId);assert.equal(disk.control.sends,1);throw Error('lost response');},async status(s){polled++;assert.equal(s.operationId,disk.state.operationId);return {http:200,status:'Succeeded'};}};
 await runNotificationCycle({repository:repo(),transport,env,now:t});const op=disk.state.operationId;
 assert.equal((await runNotificationCycle({repository:repo(),transport,env,now:t+60000})).outcome,'rate-wait');
 await runNotificationCycle({repository:repo(),transport,env,now:t+1200000});assert.equal(disk.state.status,'succeeded');assert.equal(disk.state.operationId,op);assert.equal(sent,1);assert.equal(polled,1);
 await runNotificationCycle({repository:repo(),transport,env,now:t+2400000});assert.equal(sent,1);
});
test('429 honors durable Retry-After and recovers',async()=>{
 const {disk,repo}=setup();let sent=0;
 const transport={async submit(){return ++sent===1?{http:429,retryAfterMs:3600000}:{http:202,status:'Running'};},async status(){return {http:200,status:'Succeeded'};}};
 await runNotificationCycle({repository:repo(),transport,env,now:t});assert.equal(disk.state.nextAt,t+3600000);
 assert.equal((await runNotificationCycle({repository:repo(),transport,env,now:t+1200000})).outcome,'idle');
 await runNotificationCycle({repository:repo(),transport,env,now:t+3600000});assert.equal(sent,2);
 await runNotificationCycle({repository:repo(),transport,env,now:t+7200000});assert.equal(disk.state.status,'succeeded');
});
test('ambiguous missing operation quarantined instead of unsafe resend',async()=>{
 const {disk,repo}=setup();let sent=0;const transport={async submit(){sent++;return {http:503};},async status(){return {http:404};}};
 await runNotificationCycle({repository:repo(),transport,env,now:t});await runNotificationCycle({repository:repo(),transport,env,now:t+1200000});assert.equal(disk.state.status,'uncertain');
 await runNotificationCycle({repository:repo(),transport,env,now:t+2400000});assert.equal(sent,1);
});
test('monthly durable cap and disabled gate prevent sending',async()=>{
 const {disk,repo}=setup();disk.control={month:'2026-11',sends:500};const transport={async submit(){throw Error('must not send');}};
 assert.equal((await runNotificationCycle({repository:repo(),transport,env,now:t})).outcome,'monthly-budget-stop');assert.equal((await runNotificationCycle({repository:repo(),transport,env:{},now:t})).outcome,'disabled');
});
test('expired records and definitive failures do not retry',async()=>{
 for(const failure of [400,401,403,413,422]){const {disk,repo}=setup();await runNotificationCycle({repository:repo(),transport:{async submit(){return {http:failure};}},env,now:t});assert.equal(disk.state.status,'failed');}
 const {disk,repo}=setup();disk.state.deleteAfter='2026-01-01';await runNotificationCycle({repository:repo(),transport:{},env,now:t});assert.equal(disk.state.status,'expired');
});
test('global lease excludes concurrent workers',async()=>{
 const {repo}=setup();let release;const pending=new Promise(r=>release=r);let calls=0;const transport={async submit(){calls++;await pending;return {http:202,status:'Running'};}};
 const first=runNotificationCycle({repository:repo(),transport,env,now:t});await new Promise(r=>setImmediate(r));assert.equal((await runNotificationCycle({repository:repo(),transport,env,now:t})).outcome,'locked');release();await first;assert.equal(calls,1);
});
test('email has no PII, storage paths, attachments, reply-to or links',()=>{
 const msg=buildNotification({form:'submit-cv',id:'31c5d68c-3cfa-468b-8b98-87bda4f3ba2f',fields:{email:'private@example.com'},file:{storedName:'private.pdf'},storagePath:'secret-path',config:{notifyEmail:'info@outliners.gr',senderEmail:'sender'}});
 assert.equal(msg.replyTo,undefined);assert.equal(msg.attachments,undefined);assert.doesNotMatch(JSON.stringify(msg),/private@example|private.pdf|secret-path|https?:/);
});
