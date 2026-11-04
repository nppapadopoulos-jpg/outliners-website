import { createHmac, timingSafeEqual } from 'node:crypto';
import { FORMS } from './schema.js';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store, private', 'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer', 'x-robots-tag':'noindex, nofollow' };
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
const text=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
function validRecord(r,now){return r && UUID.test(r.id || '') && FORMS[r.form] && Number.isFinite(Date.parse(r.receivedAt)) && Number.isFinite(Date.parse(r.deleteAfter)) && Date.parse(r.deleteAfter)>now;}
function summary(r){const f=r.fields || {};return {id:r.id,form:r.form,receivedAt:r.receivedAt,name:text(f.full_name),email:text(f.email,254),role:text(f.specialization || f.job_title),company:text(f.company),location:text(f.preferred_location || f.location),isNew:!r.reviewedAt,hasFile:!!r.file,fileType:['pdf','doc','docx'].includes(r.file?.type)?r.file.type:null};}
export function createOwnerDashboard({storage,ownerPrincipalId,cursorSecret,now=()=>Date.now()}){
 const sign=value=>createHmac('sha256',cursorSecret).update(value).digest('base64url');
 function encode(data){const value=Buffer.from(JSON.stringify(data)).toString('base64url');return value+'.'+sign(value);}
 function decode(token){
  if(typeof token!=='string'||token.length>2000||!/^[\w-]+\.[\w-]+$/.test(token))throw Error('cursor');
  const [value,sig]=token.split('.'),expected=sign(value),a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('cursor');
  return JSON.parse(Buffer.from(value,'base64url').toString());
 }
 return async function handle({principalId,action='list',request,id}){
  if(!ownerPrincipalId||principalId!==ownerPrincipalId)return json(403,{code:'forbidden'});
  if(!cursorSecret||cursorSecret.length<32)return json(503,{code:'unavailable'});
  const clock=now();
  if(action!=='list'&&!UUID.test(id || ''))return json(400,{code:'invalid-id'});
  try{
   if(action==='review'||action==='erase'){
    if(request.method!=='POST')return json(405,{code:'method'});
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json(403,{code:'origin'});
    if(action==='erase'){const raw=await request.text();if(raw.length>100)return json(400,{code:'confirmation-required'});let body;try{body=JSON.parse(raw);}catch{return json(400,{code:'confirmation-required'});}if(body?.confirm!==true||Object.keys(body).length!==1)return json(400,{code:'confirmation-required'});}
    const r=await storage.ownerRecord(id);if(!validRecord(r,clock))return json(404,{code:'not-found'});
    if(action==='erase'){await storage.requestErasure(r,new Date(clock).toISOString());return json(200,{ok:true,erasurePending:true});}
    await storage.markReviewed(r,new Date(clock).toISOString());return json(200,{ok:true});
   }
   if(request.method!=='GET' && !(action==='list'&&request.method==='POST'))return json(405,{code:'method'});
   if(action==='detail'){
    const r=await storage.ownerRecord(id);if(!validRecord(r,clock))return json(404,{code:'not-found'});
    const fields={};for(const [key,spec] of Object.entries(FORMS[r.form].fields))if(key!=='consent')fields[key]=text(r.fields?.[key],spec.max || 300);
    return json(200,{...summary(r),fields,deleteAfter:r.deleteAfter,consentRecorded: r.consent?.value==='yes',reviewedAt:r.reviewedAt || null,fileBytes:Number.isInteger(r.file?.bytes)?r.file.bytes:null});
   }
   let p=new URL(request.url).searchParams;
   if(request.method==='POST'){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json(403,{code:'origin'});const raw=await request.text();if(raw.length>4096)return json(413,{code:'too-large'});let body;try{body=JSON.parse(raw);}catch{return json(400,{code:'invalid-filter'});}if(!body||typeof body!=='object'||Array.isArray(body)||Object.entries(body).some(([k,v])=>!['q','type','state','limit','cursor'].includes(k)||typeof v!=='string'))return json(400,{code:'invalid-filter'});p=new URLSearchParams(body);}
   else if(p.has('q'))return json(400,{code:'use-private-search'});
   const q=(p.get('q')||'').trim(),type=p.get('type')||'all',state=p.get('state')||'all',size=p.get('limit')||'12';
   if(q.length>120||!['all','submit-cv','request-talent'].includes(type)||!['all','new','read'].includes(state)||!/^\d{1,2}$/.test(size)||Number(size)<1||Number(size)>25)return json(400,{code:'invalid-filter'});
   const limit=Number(size),fingerprint=sign(JSON.stringify({q,type,state,limit}));let offset=0,snapshot=clock;
   if(p.has('cursor')){
    let c;try{c=decode(p.get('cursor'));}catch{return json(400,{code:'invalid-cursor'});}
    if(c.f!==fingerprint||!Number.isInteger(c.o)||c.o<0||c.o>5000||!Number.isFinite(c.s)||c.s>clock||clock-c.s>900000)return json(400,{code:'invalid-cursor'});
    offset=c.o;snapshot=c.s;
   }
   const records=(await storage.ownerRecords()).filter(r=>validRecord(r,clock)&&Date.parse(r.receivedAt)<=snapshot);
   const stats={total:records.length,new:records.filter(r=>!r.reviewedAt).length,cv:records.filter(r=>r.form==='submit-cv').length,clients:records.filter(r=>r.form==='request-talent').length};
   const needle=q.normalize('NFKC').toLocaleLowerCase('el');
   const filtered=records.map(summary).filter(r=>(type==='all'||r.form===type)&&(state==='all'||(state==='new'?r.isNew:!r.isNew))&&(!needle||[r.name,r.email,r.role,r.company,r.location,r.id].join(' ').normalize('NFKC').toLocaleLowerCase('el').includes(needle))).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)||a.id.localeCompare(b.id));
   return json(200,{items:filtered.slice(offset,offset+limit),total:filtered.length,stats,nextCursor:offset+limit<filtered.length?encode({f:fingerprint,o:offset+limit,s:snapshot}):null});
  }catch{return json(503,{code:'temporarily-unavailable'});}
 };
}
