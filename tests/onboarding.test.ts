import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { buildOnboarding } from '../src/onboarding/app.js';
import { Store } from '../src/onboarding/store.js';
import * as ds from '../src/onboarding/docusign.js';
import { intakeSchema } from '../src/onboarding/schema.js';
const input={name:'Example Owner',email:'owner@example.com',company:'Example',title:'Director',environment:'Production',services:[{type:'API',count:2,targets:'https://example.com/api GET /items POST /items',details:'Two documented operations, two user roles'}],exclusions:'Other hosts',activities:'Read only checks',window:'2026 11 01, 10:00 UTC',emergency:'owner@example.com',consent:true,authority:true,website:''};
test('rejects missing targets, fractional counts and unchecked authority',()=>{
 assert.throws(()=>intakeSchema.parse({...input,authority:false}));
 assert.throws(()=>intakeSchema.parse({...input,services:[{...input.services[0],count:1.5}]}));
 assert.throws(()=>intakeSchema.parse({...input,services:[{...input.services[0],targets:''}]}));
 assert.equal(intakeSchema.parse(input).environment,'Production');
});
test('HMAC requires exact bytes',()=>{const raw=Buffer.from('{"event":"completed"}');const signature=createHmac('sha256','secret').update(raw).digest('base64');assert.ok(ds.verifySignature(raw,[signature],'secret'));assert.equal(ds.verifySignature(Buffer.from('{}'),[signature],'secret'),false);assert.equal(ds.verifySignature(raw,['bad'],'secret'),false);});
test('intake, private status and verified completion archive; replay cannot regress',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'synap-onboarding-'));process.env.DS_CONNECT_SECRET='test-secret';process.env.PUBLIC_ORIGIN='https://at.example.com';let sends=0,downloads=0;
 const app=await buildOnboarding({store:new Store(dir),provider:{...ds,configured:()=>true,sendAgreement:async()=>{sends++;return 'env-123';},envelopeStatus:async()=>({status:'completed'}),signedDocuments:async()=>{downloads++;return Buffer.from('%PDF-test');}}});
 try {
 const blocked=await app.inject({method:'POST',url:'/api/onboarding',payload:input});assert.equal(blocked.statusCode,403);
 const r=await app.inject({method:'POST',url:'/api/onboarding',headers:{origin:'https://at.example.com'},payload:input});assert.equal(r.statusCode,202);const record=r.json();assert.equal(sends,1);
 assert.equal((await app.inject({url:'/api/onboarding/'+record.reference})).statusCode,404);
 const raw=JSON.stringify({event:'envelope-completed',data:{envelopeId:'env-123'}});
 assert.equal((await app.inject({method:'POST',url:'/api/docusign/connect',headers:{'content-type':'application/json'},payload:raw})).statusCode,401);
 const signature=createHmac('sha256','test-secret').update(raw).digest('base64');
 for(let i=0;i<2;i++)assert.equal((await app.inject({method:'POST',url:'/api/docusign/connect',headers:{'content-type':'application/json','x-docusign-signature-1':signature},payload:raw})).statusCode,200);
 assert.equal(downloads,1);assert.equal((await readFile(join(dir,record.reference+'.signed.pdf'))).toString(),'%PDF-test');
 const status=await app.inject({url:'/api/onboarding/'+record.reference,headers:{authorization:'Bearer '+record.accessToken}});assert.equal(status.json().status,'ready_to_schedule');assert.equal(status.json().input,undefined);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
test('unconfigured signing does not claim success or send',async()=>{const dir=await mkdtemp(join(tmpdir(),'synap-onboarding-'));const app=await buildOnboarding({store:new Store(dir),provider:{...ds,configured:()=>false}});try{const r=await app.inject({method:'POST',url:'/api/onboarding',headers:{origin:'https://at.example.com'},payload:input});assert.equal(r.statusCode,503);}finally{await app.close();await rm(dir,{recursive:true,force:true});}});
test('ambiguous send is saved without falsely reporting email delivery',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'synap-onboarding-'));
 const app=await buildOnboarding({store:new Store(dir),provider:{...ds,configured:()=>true,sendAgreement:async()=>{throw new Error('timeout');}}});
 try{const r=await app.inject({method:'POST',url:'/api/onboarding',headers:{origin:'https://at.example.com'},payload:input});assert.equal(r.statusCode,202);assert.equal(r.json().status,'delivery_uncertain');const saved=await new Store(dir).get(r.json().reference);assert.equal(saved.input.environment,'Production');assert.equal(saved.envelopeId,undefined);}finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
