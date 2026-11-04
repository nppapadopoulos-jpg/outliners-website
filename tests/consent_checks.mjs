// Isolated browser integration: synthetic origins, GA loader and intake responses.
// No request reaches Google or the actual Azure storage/Function App.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch();
const root=process.cwd(),ID='G-TESTONLY01';
const pdf=Buffer.from('%PDF-1.4\nSynthetic consent integration fixture\n');
async function fixture({lang='en',form='submit-cv',live=false,duplicate=false,status=200,id=ID,viewport={width:390,height:844}}={}){
 const context=await browser.newContext({viewport});let google=0,posts=0;
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='www.googletagmanager.com'){google++;return route.fulfill({contentType:'text/javascript',body:"document.cookie='_ga=synthetic; Path=/; Secure; SameSite=Lax';"});}
  if(u.hostname.endsWith('azurewebsites.net')){posts++;return route.fulfill({status,headers:{'access-control-allow-origin':'https://outliners.gr'},contentType:'application/json',body:JSON.stringify({ok:status===200,id:'11111111-1111-4111-8111-111111111111',duplicate})});}
  if(u.hostname!=='outliners.gr')throw Error('Unexpected external request blocked: '+u.hostname);
  const relative=decodeURIComponent(u.pathname).replace(/^\//,'')+(u.pathname.endsWith('/')?'index.html':'');
  const file=path.resolve(root,relative);assert.ok(file.startsWith(root+path.sep));
  try{
   let bytes=await readFile(file);const ext=path.extname(file);
   if(u.pathname==='/assets/js/site-config.js')bytes=Buffer.from('window.OUTLINERS_SITE_CONFIG='+JSON.stringify({ga4MeasurementId:id})+';');
   if(ext==='.html'&&live)bytes=Buffer.from(bytes.toString().replace('data-preview="true"','data-preview="false"'));
   return route.fulfill({status:200,body:bytes,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png'})[ext]||'application/octet-stream'});
  }catch{return route.fulfill({status:404,body:''});}
 });
 const page=await context.newPage();await page.goto('https://outliners.gr/'+(lang==='el'?'el/':'')+form+'/?email=never-send@example.invalid&utm_source=linkedin&utm_medium=social&utm_campaign=never-send@example.invalid#secret');
 await page.locator('#cookie-consent').waitFor({state:'visible'});
 return {context,page,google:()=>google,posts:()=>posts};
}
async function submit(p){
 await p.locator('[name=full_name]').fill('Synthetic Consent Person');await p.locator('[name=email]').fill('synthetic-person@example.invalid');await p.locator('[name=phone]').fill('0000000000');await p.locator('[name=specialization]').fill('Synthetic QA');await p.locator('[name=preferred_location]').fill('Synthetic location');await p.locator('[name=position_reference]').fill('SYNTHETIC-ROLE');await p.locator('[name=consent]').check();
 await p.locator('[name=cv]').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf});
 await p.locator('button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('form.intake-form').dataset.submitting!=='true');await p.locator('.form-status').waitFor({state:'visible'});
}
const f=await fixture({live:true});
assert.equal(f.google(),0);assert.equal((await f.context.cookies()).some(x=>x.name.startsWith('_ga')),false);
await f.page.locator('#cookie-consent').getByRole('button',{name:'Reject non-essential',exact:true}).click();
await submit(f.page);assert.equal(f.posts(),1);assert.equal(f.google(),0,'rejection must not block intake');
await f.page.locator('[data-cookie-settings]').click();await f.page.getByRole('dialog').getByRole('button',{name:'Accept all',exact:true}).click();
await f.page.waitForFunction(()=>document.cookie.includes('_ga='));assert.equal(f.google(),1);assert.equal(new URL(f.page.url()).search,'');assert.equal(new URL(f.page.url()).hash,'');let queue=await f.page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));
assert.equal(queue.filter(x=>x[0]==='event'&&x[1]==='submit_cv_success').length,0,'no retroactive conversion after consent');
const gaConfig=queue.find(x=>x[0]==='config')[2];assert.equal(gaConfig.campaign_name,'not-set');assert.equal(gaConfig.campaign_source,'linkedin');assert.equal(gaConfig.campaign_medium,'social');
await submit(f.page);queue=await f.page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));
assert.equal(queue.filter(x=>x[0]==='event'&&x[1]==='submit_cv_success').length,1);
assert.ok(!JSON.stringify(queue).includes('example.invalid'));assert.ok(!JSON.stringify(queue).includes('11111111-1111'));assert.ok(!JSON.stringify(queue).includes('Synthetic Consent Person'));assert.ok(!JSON.stringify(queue).includes('#secret'));
assert.equal(queue.filter(x=>x[0]==='event'&&x[1]==='page_view').length,1);
await submit(f.page);queue=await f.page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));assert.equal(queue.filter(x=>x[0]==='event'&&x[1]==='submit_cv_success').length,1,'repeated same ID not counted twice');
await f.page.locator('[data-cookie-settings]').click();await f.page.getByRole('dialog').getByRole('button',{name:'Reject non-essential',exact:true}).click();await f.page.waitForLoadState('networkidle');
assert.equal(f.google(),1,'withdrawal must unload and not reload tag');assert.equal((await f.context.cookies()).some(x=>x.name.startsWith('_ga')),false);await f.context.close();
for(const options of [{lang:'el',live:false},{live:true,duplicate:true},{live:true,status:502},{live:true,id:''}]){
 const x=await fixture(options);const accept=options.lang==='el'?'Αποδοχή όλων':'Accept all';await x.page.locator('#cookie-consent').getByRole('button',{name:accept,exact:true}).click();await submit(x.page);
 const events=await x.page.evaluate(()=>window.dataLayer?.map(x=>Array.from(x))||[]);assert.equal(events.filter(x=>x[0]==='event'&&x[1]==='submit_cv_success').length,0);
 if(!options.live)assert.equal(x.posts(),0);if(options.id==='')assert.equal(x.google(),0);
 assert.equal(await x.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile consent/form has no horizontal overflow');await x.context.close();
}
const rt=await fixture({form:'request-talent',lang:'el',live:true});
await rt.page.locator('#cookie-consent').getByRole('button',{name:'Αποδοχή όλων',exact:true}).click();
await rt.page.waitForFunction(()=>document.cookie.includes('_ga='));
for(const [name,value] of Object.entries({full_name:'Synthetic Client',email:'synthetic-client@example.invalid',company:'Synthetic Company',job_title:'Synthetic Role',location:'Synthetic location',job_description:'Synthetic description only'}))await rt.page.locator('[name='+name+']').fill(value);
await rt.page.locator('[name=employment_type]').selectOption('full-time');await rt.page.locator('[name=timeline]').selectOption('asap');await rt.page.locator('[name=consent]').check();await rt.page.locator('button[type=submit]').click();await rt.page.waitForFunction(()=>document.querySelector('form').dataset.submitting!=='true');
const rtEvents=await rt.page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));assert.equal(rtEvents.filter(x=>x[0]==='event'&&x[1]==='request_talent_success').length,1);assert.equal(rtEvents.filter(x=>x[0]==='event'&&x[1]==='submit_cv_success').length,0);assert.ok(!JSON.stringify(rtEvents).includes('synthetic-client'));assert.equal(rt.posts(),1);await rt.context.close();
await browser.close();console.log('PASS consent: no pre-consent traffic, reject, settings, revoke, mobile EL/EN, no PII, no duplicate/failed/preview conversions; GA loader and Azure are mocked.');
