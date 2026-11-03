import { Readable } from 'node:stream';
export function memoryContainer(){const files=new Map(),leases=new Map(),deletes=[];let sequence=0;const fail={metadata:0,afterCommit:0,delete:0};
 const missing=()=>Object.assign(Error('synthetic missing'),{statusCode:404,code:'BlobNotFound'});
 return {files,deletes,fail,async *listBlobsFlat({prefix}){for(const [name,v]of [...files].sort())if(name.startsWith(prefix))yield {name,metadata:v.metadata,properties:{lastModified:v.modified}};},
 getBlockBlobClient(name){const save=async(bytes,options={})=>{const old=files.get(name),cond=options.conditions||{};if(cond.ifNoneMatch==='*'&&old)throw {statusCode:409};if(cond.ifMatch&&old?.etag!==cond.ifMatch)throw {statusCode:412};if(leases.has(name)&&cond.leaseId!==leases.get(name))throw {statusCode:412};if(name.endsWith('/submission.json')&&fail.metadata>0){fail.metadata--;throw {statusCode:503};}const etag=String(++sequence);files.set(name,{bytes:Buffer.from(bytes),etag,metadata:options.metadata||{},modified:new Date()});if(name.endsWith('/submission.json')&&fail.afterCommit>0){fail.afterCommit--;throw {statusCode:503};}return {etag};};return {
 async uploadData(bytes,options){return save(bytes,options);},async upload(text,length,options){return save(Buffer.from(text),options);},
 async downloadToBuffer(){if(!files.has(name))throw missing();return files.get(name).bytes;},async getProperties(){if(!files.has(name))throw missing();const v=files.get(name);return {contentLength:v.bytes.length,etag:v.etag};},
 async download(){if(!files.has(name))throw missing();const v=files.get(name);return {etag:v.etag,readableStreamBody:Readable.from([v.bytes])};},
 getBlobLeaseClient(id){return {leaseId:id,async acquireLease(){if(leases.has(name))throw {statusCode:409};leases.set(name,id);},async renewLease(){if(leases.get(name)!==id)throw {statusCode:412};},async releaseLease(){if(leases.get(name)!==id)throw {statusCode:412};leases.delete(name);}};},
 };},async deleteBlob(name){if(fail.delete>0){fail.delete--;throw {statusCode:503};}if(!files.has(name))throw missing();files.delete(name);deletes.push(name);}};
}
