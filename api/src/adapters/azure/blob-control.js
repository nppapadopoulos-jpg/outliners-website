import { randomUUID } from 'node:crypto';
// Shared state stays in the existing private container. No queue/database resource.
export function createBlobControl(env,path,{container:injected}={}){
 let c=injected;
 async function blob(){if(!c){const [{BlobServiceClient},{ManagedIdentityCredential}]=await Promise.all([import('@azure/storage-blob'),import('@azure/identity')]);c=new BlobServiceClient(env.STORAGE_ACCOUNT_URL,new ManagedIdentityCredential(env.AZURE_CLIENT_ID || undefined),{retryOptions:{maxTries:3,tryTimeoutInMs:15000}}).getContainerClient(env.STORAGE_CONTAINER || 'submissions');}return c.getBlockBlobClient(path);}
 return {async exclusive(fn){const b=await blob();try{await b.upload('{}',2,{conditions:{ifNoneMatch:'*'}});}catch(e){if(![409,412].includes(e.statusCode))throw Error('Admission state unavailable');}
  const lease=b.getBlobLeaseClient(randomUUID());try{await lease.acquireLease(60);}catch(e){if([409,412].includes(e.statusCode))throw Object.assign(Error('Admission busy'),{statusCode:429});throw Error('Admission lock unavailable');}
  try{const props=await b.getProperties();if(props.contentLength>262144)throw Error('Admission state limit');const state=JSON.parse((await b.downloadToBuffer()).toString());
   const save=async()=>{await lease.renewLease();const text=JSON.stringify(state);if(Buffer.byteLength(text)>262144)throw Error('Admission state limit');await b.upload(text,Buffer.byteLength(text),{conditions:{leaseId:lease.leaseId},blobHTTPHeaders:{blobContentType:'application/json'}});};
   return await fn(state,save,()=>lease.renewLease());
  }finally{try{await lease.releaseLease();}catch{}}
 }};
}
