import { UUID } from '../../core/owner-dashboard.js';
const PATH=/^submissions\/(submit-cv|request-talent)\/(\d{4}-\d{2})\/([0-9a-f-]{36})\/submission\.json$/i;
export function createOwnerRepository(env,{container:injected}={}){
 let c=injected;
 async function container(){if(!c){const [{BlobServiceClient},{ManagedIdentityCredential}]=await Promise.all([import('@azure/storage-blob'),import('@azure/identity')]);c=new BlobServiceClient(env.STORAGE_ACCOUNT_URL,new ManagedIdentityCredential(env.AZURE_CLIENT_ID || undefined),{retryOptions:{maxTries:3,tryTimeoutInMs:15000}}).getContainerClient(env.STORAGE_CONTAINER || 'submissions');}return c;}
 async function manifest(){const cc=await container(),records=[],review=new Map();let scanned=0;
  for await(const b of cc.listBlobsFlat({prefix:'submissions/',includeMetadata:true})){
   if(++scanned>25000)throw Error('Owner index needs maintenance');
   if(PATH.test(b.name))records.push(b.name);
   if(b.name.endsWith('/review.json')&&b.metadata?.reviewedat&&Number.isFinite(Date.parse(b.metadata.reviewedat)))review.set(b.name.slice(0,-12),b.metadata.reviewedat);
  }
  if(records.length>5000)throw Error('Owner index limit');return {cc,records,review};
 }
 async function read(name,cc,review){
  try{const m=name.match(PATH),blob=cc.getBlockBlobClient(name),props=await blob.getProperties();if(props.contentLength>65536)return null;
   const r=JSON.parse((await blob.downloadToBuffer()).toString('utf8'));
   if(!m||!UUID.test(r.id || '')||r.id!==m[3]||r.form!==m[1]||r.receivedAt?.slice(0,7)!==m[2])return null;
   const path=name.slice(0,-16);return {...r,_path:path,reviewedAt:review.get(path)||null};
  }catch(e){if(e.statusCode===404||e instanceof SyntaxError)return null;throw Error('Owner record unavailable');}
 }
 return {
  async ownerRecords(){const {cc,records,review}=await manifest(),out=[];for(let i=0;i<records.length;i+=8){const batch=await Promise.all(records.slice(i,i+8).map(n=>read(n,cc,review)));out.push(...batch.filter(Boolean));}return out;},
  async ownerRecord(id){if(!UUID.test(id))return null;const {cc,records,review}=await manifest();const name=records.find(n=>n.endsWith('/'+id+'/submission.json'));return name?read(name,cc,review):null;},
  async markReviewed(record,at){if(!PATH.test(record._path+'/submission.json'))throw Error('Invalid owner record');const data=JSON.stringify({reviewedAt:at});await (await container()).getBlockBlobClient(record._path+'/review.json').upload(data,Buffer.byteLength(data),{metadata:{reviewedat:at},blobHTTPHeaders:{blobContentType:'application/json'}});},
 };
}
