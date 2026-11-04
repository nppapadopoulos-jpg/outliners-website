import {readFile} from 'node:fs/promises';
const groups=new Map();
for(const file of process.argv.slice(2)){
 const r=JSON.parse(await readFile(file));if(r.runtimeError)throw Error(r.runtimeError.message);
 const url=r.finalDisplayedUrl||r.finalUrl;
 const scores=Object.fromEntries(Object.entries(r.categories).map(([k,v])=>[k,Math.round(v.score*100)]));
 const sample={scores,lcp:r.audits['largest-contentful-paint'].numericValue,cls:r.audits['cumulative-layout-shift'].numericValue,tbt:r.audits['total-blocking-time'].numericValue};
 console.log('LIGHTHOUSE_LAB_RUN',url,JSON.stringify(sample));
 const list=groups.get(url)||[];list.push(sample);groups.set(url,list);
 if(scores.seo<90||scores.accessibility<90)throw Error('Lighthouse SEO/accessibility below launch threshold');
}
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
for(const [url,list] of groups){
 const result={samples:list.length,performance:median(list.map(x=>x.scores.performance)),accessibility:median(list.map(x=>x.scores.accessibility)),seo:median(list.map(x=>x.scores.seo)),lcpMs:median(list.map(x=>x.lcp)),cls:median(list.map(x=>x.cls)),tbtMs:median(list.map(x=>x.tbt))};
 console.log('LIGHTHOUSE_LAB_MEDIAN',url,JSON.stringify(result));
 // Three default mobile lab runs reduce shared-runner noise; preserve all raw reports.
 // These are never presented as Google field Core Web Vitals.
 if(list.length<3||result.performance<80||result.cls>.1)throw Error('Mobile lab median needs investigation');
}
