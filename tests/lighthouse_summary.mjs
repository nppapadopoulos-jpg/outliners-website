import {readFile} from 'node:fs/promises';
for(const file of process.argv.slice(2)){
 const r=JSON.parse(await readFile(file));if(r.runtimeError)throw Error(r.runtimeError.message);
 const scores=Object.fromEntries(Object.entries(r.categories).map(([k,v])=>[k,Math.round(v.score*100)]));
 console.log('LIGHTHOUSE_LAB',r.finalDisplayedUrl||r.finalUrl,JSON.stringify(scores));
 for(const id of ['largest-contentful-paint','cumulative-layout-shift','total-blocking-time'])console.log(id,r.audits[id]?.displayValue);
 // Lab metrics are evidence, not a claim about Google field Core Web Vitals.
 if(scores.seo<90||scores.accessibility<90)throw Error('Lighthouse SEO/accessibility below launch threshold');
}
