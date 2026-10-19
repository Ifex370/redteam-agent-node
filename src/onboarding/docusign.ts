import { createHmac, createSign, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Intake } from './schema.js';
import { scopeSummary } from './schema.js';
export function verifySignature(raw: Buffer, signatures: string[], secret: string) {
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return signatures.some(s=>{const actual=Buffer.from(s,'base64'); return actual.length===expected.length && timingSafeEqual(actual,expected);});
}
export function configured() {return ['DS_CLIENT_ID','DS_USER_ID','DS_ACCOUNT_ID','DS_TEMPLATE_ID','DS_PRIVATE_KEY_PATH','DS_CONNECT_SECRET'].every(k=>!!process.env[k]);}
let cached: {token:string, until:number}|undefined;
async function token() {
  if(cached && cached.until > Date.now()) return cached.token;
  const host=process.env.DS_AUTH_HOST || 'account-d.docusign.com';
  if(!['account-d.docusign.com','account.docusign.com'].includes(host)) throw new Error('Invalid OAuth host');
  const now=Math.floor(Date.now()/1000);
  const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
  const body=Buffer.from(JSON.stringify({iss:process.env.DS_CLIENT_ID,sub:process.env.DS_USER_ID,aud:host,iat:now,exp:now+3600,scope:'signature impersonation'})).toString('base64url');
  const signer=createSign('RSA-SHA256'); signer.update(`${head}.${body}`);
  const signature=signer.sign(await readFile(process.env.DS_PRIVATE_KEY_PATH!), 'base64url');
  const response=await fetch(`https://${host}/oauth/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${head}.${body}.${signature}`}),signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error('DocuSign authentication failed');
  const result=await response.json() as {access_token:string;expires_in:number};
  cached={token:result.access_token,until:Date.now()+Math.max(0,result.expires_in-120)*1000};return cached.token;
}
async function api(path:string, init:RequestInit={}) {
  const base=process.env.DS_BASE_URL || 'https://demo.docusign.net/restapi';
  const url=new URL(base);
  if(url.protocol!=='https:' || !url.hostname.endsWith('.docusign.net')) throw new Error('Invalid DocuSign API URL');
  const response=await fetch(`${base}/v2.1/accounts/${encodeURIComponent(process.env.DS_ACCOUNT_ID!)}/${path}`,{...init,headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`DocuSign request failed (${response.status})`);
  return response;
}
export async function sendAgreement(input:Intake,id:string) {
  const response=await api('envelopes',{method:'POST',body:JSON.stringify({
    emailSubject:`SynapDome assessment agreement ${id}`,
    transactionId:id, status:'sent',
    compositeTemplates:[{
      compositeTemplateId:'1',serverTemplates:[{sequence:'1',templateId:process.env.DS_TEMPLATE_ID}],
      inlineTemplates:[{sequence:'2',recipients:{signers:[{recipientId:'1',roleName:process.env.DS_SIGNER_ROLE || 'Customer',name:input.name,email:input.email,
        tabs:{textTabs:[{tabLabel:'scope_summary',value:`See attached Assessment Scope, reference ${id}.`,locked:'true'},{tabLabel:'company_name',value:input.company,locked:'true'}]}}]}}]
    },{
      compositeTemplateId:'2',document:{documentId:'2',name:'Assessment Scope',fileExtension:'html',documentBase64:Buffer.from('<html><body><h1>SynapDome Assessment Scope</h1><pre style="white-space:pre-wrap;font:12pt sans-serif">'+scopeSummary(input,id).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre></body></html>').toString('base64')},
      inlineTemplates:[{sequence:'1',recipients:{signers:[{recipientId:'1',name:input.name,email:input.email}]}}]
    }],
    customFields:{textCustomFields:[{name:'synapdome_reference',value:id,show:'false'}]}
  })});
  return (await response.json() as {envelopeId:string}).envelopeId;
}
export async function envelopeStatus(id:string) {return await (await api(`envelopes/${encodeURIComponent(id)}`)).json() as {status:string};}
export async function signedDocuments(id:string) {return Buffer.from(await (await api(`envelopes/${encodeURIComponent(id)}/documents/combined?certificate=true`)).arrayBuffer());}
