import Fastify from 'fastify';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ZodError } from 'zod';
import { intakeSchema } from './schema.js';
import { Store, dataDirectory } from './store.js';
import * as ds from './docusign.js';
import * as mail from './mail.js';
import { demoAgreement } from './agreement.js';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function buildOnboarding(options:{store?:Store;provider?:typeof ds;mailer?:typeof mail}={}) {
  const preview=process.env.ONBOARDING_LOCAL_PREVIEW==='true';
  if(preview && !['127.0.0.1','localhost','::1'].includes(new URL(process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:4174').hostname)) throw new Error('Local preview requires a loopback origin');
  const app=Fastify({bodyLimit:100000,logger:false});
  const store=options.store || new Store(dataDirectory());await store.init();
  const provider=options.provider || ds;
  const mailer=options.mailer || mail;
  const origin=process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:4174';
  const publicDir=resolve('Synap AT/public');
  // One process owns the file store; serialize mutations, including duplicate webhook deliveries.
  let chain:Promise<unknown>=Promise.resolve();
  function serial<T>(fn:()=>Promise<T>):Promise<T>{const next=chain.then(fn,fn);chain=next.catch(()=>{});return next;}
  const requests=new Map<string,{count:number;until:number}>();
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer');
    if(req.url.startsWith('/api/')) reply.header('Cache-Control','no-store');
    if(req.method==='POST' && (req.url==='/api/onboarding' || req.url==='/api/onboarding/preview' || req.url==='/api/onboarding/review')) {
      if(req.headers.origin!==origin) return reply.code(403).send({error:'Request origin not allowed.'});
      const now=Date.now();for(const [key,v] of requests)if(v.until<now)requests.delete(key);
      const entry=requests.get(req.ip)||{count:0,until:now+3600000};entry.count++;requests.set(req.ip,entry);
      if(entry.count>(preview?100:5))return reply.code(429).send({error:'Too many requests. Please contact our team.'});
    }
  });
  app.setErrorHandler((error,_req,reply)=>{if(error instanceof ZodError)return reply.code(400).send({error:'Please complete all scope fields and confirmations.',fields:error.flatten()});return reply.code(500).send({error:'Unable to process this request. Please contact our team.'});});
  app.get('/api/onboarding/config',async()=>({signingAvailable:!preview && provider.configured(),localPreview:preview,reviewAvailable:preview || mailer.configured(),reviewRecipient:mail.reviewRecipient}));
  app.post('/api/onboarding/preview',async(req,reply)=>{
    const input=intakeSchema.parse(req.body);
    return reply.header('Content-Disposition','inline; filename=dedsec-populated-agreement.pdf').type('application/pdf').send(await demoAgreement(input,preview));
  });
  app.post('/api/onboarding/review',async(req,reply)=>{
    const input=intakeSchema.parse(req.body);
    if(preview)return reply.send({status:'preview_only',recipient:mail.reviewRecipient});
    if(!mailer.configured())return reply.code(503).send({error:'Email submission is not configured yet. Please contact enterprise@synapdome.com.'});
    return serial(async()=>{
      const id=randomUUID(),accessToken=randomBytes(32).toString('base64url');
      const record={id,tokenHash:hash(accessToken),created:new Date().toISOString(),input,status:'sending' as const};
      const pdf=await demoAgreement(input,false,id);
      await store.put(record);await store.draft(id,pdf);
      try{const result=await mailer.sendReview(input,id,pdf);await store.put({...record,status:'awaiting_review',acknowledged:result.acknowledged});}
      catch{await store.put({...record,status:'delivery_uncertain'});}
      const saved=await store.get(id);
      return reply.code(202).send({reference:id,accessToken,status:saved.status,acknowledged:saved.acknowledged});
    });
  });
  app.post('/api/onboarding',async(req,reply)=>{
    if(preview)return reply.code(403).send({error:'Live sending is disabled in local preview.'});
    const input=intakeSchema.parse(req.body);
    if(!provider.configured()) return reply.code(503).send({error:'Online signing is not configured yet. Please contact enterprise@synapdome.com.'});
    return serial(async()=>{
      const id=randomUUID(),accessToken=randomBytes(32).toString('base64url');
      const record={id,tokenHash:hash(accessToken),created:new Date().toISOString(),input,status:'sending' as const};
      await store.put(record);
      try {const envelopeId=await provider.sendAgreement(input,id);await store.put({...record,envelopeId,status:'awaiting_signature'});}
      catch {await store.put({...record,status:'delivery_uncertain'});}
      const saved=await store.get(id);
      return reply.code(202).send({reference:id,accessToken,status:saved.status});
    });
  });
  app.get('/api/onboarding/:id',async(req,reply)=>{
    const {id}=req.params as {id:string};
    let record;try{record=await store.get(id);}catch{return reply.code(404).send({error:'Not found'});}
    const authorization=req.headers.authorization||'';
    if(!authorization.startsWith('Bearer ') || hash(authorization.slice(7))!==record.tokenHash)return reply.code(404).send({error:'Not found'});
    return {reference:record.id,status:record.status,created:record.created};
  });
  // Encapsulation preserves the exact signed bytes only for DocuSign Connect.
  await app.register(async hooks=>{
    hooks.removeContentTypeParser('application/json');
    hooks.addContentTypeParser('application/json',{parseAs:'buffer'},(_req,body,done)=>done(null,body));
    hooks.post('/api/docusign/connect',async(req,reply)=>{
      const raw=req.body as Buffer;
      const signatures=Object.entries(req.headers).filter(([k])=>/^x-docusign-signature-\d+$/.test(k)).flatMap(([,v])=>typeof v==='string'?[v]:v||[]);
      if(!provider.verifySignature(raw,signatures,process.env.DS_CONNECT_SECRET||''))return reply.code(401).send({error:'Invalid signature'});
      let event;try{event=JSON.parse(raw.toString());}catch{return reply.code(400).send({error:'Invalid JSON'});}
      const id=event?.data?.envelopeId;
      if(typeof id!=='string')return reply.code(400).send({error:'Missing envelope'});
      return serial(async()=>{
        const record=await store.findEnvelope(id);
        // Unknown envelopes are not accepted as authority for any engagement.
        if(!record)return reply.code(503).send({error:'Envelope not reconciled'});
        if(record.status==='ready_to_schedule')return {ok:true};
        const current=await provider.envelopeStatus(id);
        if(current.status==='completed'){
          await store.pdf(record.id,await provider.signedDocuments(id));
          await store.put({...record,status:'ready_to_schedule',completed:new Date().toISOString()});
        }else if(current.status==='declined'||current.status==='voided')await store.put({...record,status:current.status});
        return {ok:true};
      });
    });
  });
  app.get('/pdfjs/:file',async(req,reply)=>{const {file}=req.params as {file:string};if(!['pdf.mjs','pdf.worker.mjs'].includes(file))return reply.code(404).send();return reply.type('text/javascript').send(await readFile(resolve('node_modules/pdfjs-dist/build',file)));});
  app.get('/pdfjs/fonts/:file',async(req,reply)=>{const {file}=req.params as {file:string};if(!/^[A-Za-z0-9_-]+\.(pfb|ttf)$/.test(file))return reply.code(404).send();try{return reply.type('application/octet-stream').send(await readFile(resolve('node_modules/pdfjs-dist/standard_fonts',file)));}catch{return reply.code(404).send();}});
  const files:Record<string,string>={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/onboarding.html':'onboarding.html','/onboarding.js':'onboarding.js','/onboarding.css':'onboarding.css','/assets/logo.png':'assets/logo.png'};
  for(const [route,file] of Object.entries(files))app.get(route,async(_req,reply)=>{
    const ext=file.split('.').pop();const types:Record<string,string>={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png'};
    return reply.type(types[ext!]||'application/octet-stream').send(await readFile(join(publicDir,file)));
  });
  return app;
}
