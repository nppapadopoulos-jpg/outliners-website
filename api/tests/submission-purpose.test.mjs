import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler,makeFormData,makeRequest} from './helpers.mjs';
import {deleteAfterMonths} from '../src/core/privacy.js';

test('specific role works without pool consent and records separate purpose with shorter retention',async()=>{
 const {handle,stored}=makeHandler({config:{retentionMonths:12}});
 const fd=makeFormData('submit-cv',{fields:{position_reference:'Synthetic role QA-01',talent_pool_consent:undefined}});
 assert.equal((await handle('submit-cv',makeRequest(fd),{clientIp:'198.51.100.80'})).status,200);
 const r=stored[0].record;
 assert.equal(r.talentPoolConsent.value,'no');assert.equal(r.processing.futureOpportunities,false);
 assert.equal(r.processing.specificBasis,'6(1)(f)');assert.equal(r.consent.purpose,'privacy-notice-acknowledgement');
 assert.equal(r.deleteAfter,deleteAfterMonths(3,Date.parse(r.receivedAt)));
});
test('general CV needs deliberate future-opportunity opt-in; cannot use notice acknowledgement as pool consent',async()=>{
 const {handle,stored}=makeHandler();
 const fd=makeFormData('submit-cv',{fields:{talent_pool_consent:undefined}});
 const response=await handle('submit-cv',makeRequest(fd),{});
 assert.equal(response.status,422);assert.equal((await response.json()).errors.position_reference,'purpose-required');assert.equal(stored.length,0);
});
test('pool consent is versioned, explicit and twelve calendar months',async()=>{
 const {handle,stored}=makeHandler({config:{retentionMonths:12}});
 assert.equal((await handle('submit-cv',makeRequest(makeFormData('submit-cv')),{})).status,200);
 const r=stored[0].record;assert.equal(r.talentPoolConsent.value,'yes');assert.equal(r.talentPoolConsent.noticeVersion,'2026-11-04');assert.equal(r.processing.futureBasis,'6(1)(a)');assert.equal(r.deleteAfter,deleteAfterMonths(12,Date.parse(r.receivedAt)));
});
