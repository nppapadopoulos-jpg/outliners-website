import {cp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const mode=process.argv[2]||'staging',dest=process.argv[3];
if(!['staging','production'].includes(mode)||!dest||!path.isAbsolute(dest))throw Error('Usage: node tools/build-static.mjs staging|production /absolute/new/output');
await mkdir(dest,{recursive:false});
for(const name of ['index.html','404.html','favicon.png','assets','about','contact','cookies','el','industries','privacy-policy','request-talent','services','submit-cv'])await cp(name,path.join(dest,name),{recursive:true});
// Optional exact Google URL-prefix verification file; never copy arbitrary root files.
for(const name of await readdir('.'))if(/^google[a-z0-9]+\.html$/.test(name)){const text=(await readFile(name,'utf8')).trim();if(text!=='google-site-verification: '+name)throw Error('Unexpected verification file content');await cp(name,path.join(dest,name));}
const host='https://func-outliners-api-8dc62205-cudka7c9c7hdajdk.northeurope-01.azurewebsites.net';
const headers={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://*.google-analytics.com; connect-src 'self' "+host+" https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; form-action 'self' "+host+"; upgrade-insecure-requests"
};
if(mode==='staging')headers['X-Robots-Tag']='noindex, nofollow, noarchive';
await writeFile(path.join(dest,'robots.txt'),mode==='staging'?'User-agent: *\nDisallow: /\n':await readFile('robots.txt'));
if(mode==='production')await cp('sitemap.xml',path.join(dest,'sitemap.xml'));
await writeFile(path.join(dest,'staticwebapp.config.json'),JSON.stringify({globalHeaders:headers,responseOverrides:{'404':{rewrite:'/404.html',statusCode:404}},routes:[{route:'/index.html',redirect:'/',statusCode:301}]},null,2));
console.log('Public-only '+mode+' package ready; no deployment performed.');
