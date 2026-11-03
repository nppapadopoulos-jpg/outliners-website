import { app } from '@azure/functions';
import { createOwnerAuthenticator } from '../../../src/core/owner-auth.js';
import { createOwnerDashboard } from '../../../src/core/owner-dashboard.js';
import { createOwnerRepository } from '../../../src/adapters/azure/owner-repository.js';
const authenticate=createOwnerAuthenticator(process.env);
const safe={'cache-control':'no-store, private','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'};
function register(name,route,action,methods){app.http(name,{methods,authLevel:'anonymous',route,handler:async request=>{
 if(process.env.ENABLE_OWNER_DOWNLOAD!=='true')return {status:503,headers:safe};
 const principalId=await authenticate(request);if(!principalId)return {status:401,headers:{...safe,'www-authenticate':'Bearer'}};
 const response=await createOwnerDashboard({storage:createOwnerRepository(process.env),ownerPrincipalId:process.env.OWNER_OBJECT_ID,cursorSecret:process.env.OWNER_CURSOR_KEY})({principalId,action,request,id:request.params.id});
 return {status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()};
}});}
register('ownerSubmissions','owner/submissions','list',['GET','POST']);
register('ownerSubmissionDetail','owner/submissions/{id}','detail',['GET']);
register('ownerSubmissionReview','owner/submissions/{id}/review','review',['POST']);

register('ownerSubmissionErasure','owner/submissions/{id}/erase','erase',['POST']);
