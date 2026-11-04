import test from 'node:test';import assert from 'node:assert/strict';
import { makeHandler,makeFormData,makeRequest } from './helpers.mjs';
test('actual multipart byte cap rejects requests without Content-Length before storage',async()=>{
 const {handle,stored}=makeHandler({config:{maxRequestBytes:100}});const source=makeRequest(makeFormData('submit-cv'));const bytes=new Uint8Array(await source.arrayBuffer());const stream=new ReadableStream({start(c){c.enqueue(bytes);c.close();}});const request=new Request('https://test.invalid/api/submit-cv',{method:'POST',headers:{'content-type':source.headers.get('content-type')},body:stream,duplex:'half'});assert.equal(request.headers.has('content-length'),false);const response=await handle('submit-cv',request,{clientIp:'198.51.100.1'});assert.equal(response.status,413);assert.equal(stored.length,0);
});
