import { createHmac } from 'node:crypto';
// Atomic, shared limits and duplicate intent: independent of worker memory/email.
export function createDurableAdmission({control,storage,secret,now=()=>Date.now(),perIpHour=5,perDay=100,perMonth=200}){
 const digest=value=>createHmac('sha256',secret).update('outliners-intake-v1|'+value).digest('hex');
 function prune(state,clock){
  state.hits=Object.fromEntries(Object.entries(state.hits||{}).map(([key,times])=>[key,times.filter(t=>t>clock-3600000)]).filter(([,v])=>v.length));
  state.intents=Object.fromEntries(Object.entries(state.intents||{}).filter(([,v])=>v.at>clock-86400000));
 }
 return {async cleanup(){return control.exclusive(async(state,save)=>{prune(state,now());await save();return {cleaned:true};});},async store(input){
  if(!secret||secret==='dev-only-salt')throw Error('Admission secret required');
  return control.exclusive(async(state,save,renew)=>{
   const clock=now(),iso=new Date(clock).toISOString(),month=iso.slice(0,7),day=iso.slice(0,10);
   if(state.month!==month){state.month=month;state.monthCount=0;}
   if(state.day!==day){state.day=day;state.dayCount=0;}
   state.hits=Object.fromEntries(Object.entries(state.hits||{}).map(([key,times])=>[key,times.filter(t=>t>clock-3600000)]).filter(([,v])=>v.length));
   state.intents=Object.fromEntries(Object.entries(state.intents||{}).filter(([,v])=>v.at>clock-86400000));
   const duplicate=digest(input.form+'|'+String(input.record.fields?.email||'').toLowerCase()),ip=digest(input.admission?.ipHash || 'unknown');
   let intent=state.intents[duplicate];
   if(intent&&clock-intent.at<600000){
    // A crash after metadata commit but before the final control write is recovered.
    if(intent.committed||await storage.hasCommitted(intent.path,intent.id)){intent.committed=true;await save();return {id:intent.id,duplicate:true,path:intent.path};}
   }else intent=null;
   if(!intent){
    if((state.hits[ip]||[]).length>=perIpHour||(state.dayCount||0)>=perDay||(state.monthCount||0)>=perMonth)throw Object.assign(Error('Intake limit'),{statusCode:429});
    intent={id:input.id,at:clock,path:'submissions/'+input.form+'/'+input.record.receivedAt.slice(0,7)+'/'+input.id,receivedAt:input.record.receivedAt,deleteAfter:input.record.deleteAfter,committed:false};state.intents[duplicate]=intent;
    state.hits[ip]=[...(state.hits[ip]||[]),clock];state.dayCount=(state.dayCount||0)+1;state.monthCount=(state.monthCount||0)+1;
    await save(); // Reserve identity and quota before writing a file.
   }
   await renew();
   const record={...input.record,id:intent.id,receivedAt:intent.receivedAt,deleteAfter:intent.deleteAfter};
   const path=await storage.store({...input,id:intent.id,record,resumePending:true});
   intent.committed=true;await save();return {id:intent.id,path,duplicate:false};
  });
 }};
}
