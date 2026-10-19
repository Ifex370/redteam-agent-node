const catalog={
 API:['API endpoints','Base URLs and endpoint paths with HTTP methods','Swagger or OpenAPI documentation URL, authentication methods, roles and workflows'],
 Mobile:['Mobile applications','App names, Android or iOS package identifiers and versions','Platforms, build availability, backend APIs included and key workflows'],
 Web:['Web applications','Exact URLs and included subdomains','Authentication, roles, key workflows and business logic to review'],
 Cloud:['Cloud accounts or environments','Provider, account or subscription IDs, projects and regions','Included resources, identity, storage, network layers and access requirements'],
 Network:['Hosts or IP addresses','IP addresses or CIDR ranges','Internal or external scope, included services, connectivity and exclusions'],
 Code:['Repositories or pipelines','Repository and pipeline identifiers','Branches, components, dependency review and delivery workflow coverage']
};
const form=document.querySelector('#onboarding-form'),status=document.querySelector('#form-status');
let step=0, submitted=null, localPreview=false, previewUrl=null;
for(const [type,[count,targets,details]] of Object.entries(catalog)){
 const label=document.createElement('label');const choice=document.createElement('input');choice.type='checkbox';choice.value=type;choice.name='services';label.append(choice,document.createTextNode(type));document.querySelector('#service-choices').append(label);
 const card=document.createElement('fieldset');card.className='scope-card';card.hidden=true;card.disabled=true;card.dataset.type=type;
 const heading=document.createElement('legend');heading.textContent=type+' assessment';card.append(heading);
 for(const [name,title,placeholder] of [['count','Number of '+count.toLowerCase(),''],['targets','Exact targets',targets],['details','Scope and access requirements',details]]){
  const l=document.createElement('label');l.textContent=title;const input=document.createElement(name==='count'?'input':'textarea');input.name=type+'_'+name;input.required=true;if(name==='count'){input.type='number';input.min='1';input.max='100000';input.step='1';}else{input.maxLength=5000;input.placeholder=placeholder;}l.append(input);card.append(l);
 }
 document.querySelector('#scope-fields').append(card);choice.addEventListener('change',()=>{card.hidden=!choice.checked;card.disabled=!choice.checked;});
}
function payload(){const d=new FormData(form);return {name:d.get('name'),email:d.get('email'),company:d.get('company'),title:d.get('title'),environment:d.get('environment'),services:d.getAll('services').map(type=>({type,count:Number(d.get(type+'_count')),targets:d.get(type+'_targets'),details:d.get(type+'_details')})),exclusions:d.get('exclusions'),activities:d.get('activities'),window:d.get('window'),emergency:d.get('emergency'),authority:d.get('authority')==='on',consent:d.get('consent')==='on',website:d.get('website')};}
function valid(){const current=form.querySelector(`[data-step="${step}"]`);for(const input of current.querySelectorAll('input,select,textarea')){if(!input.disabled && !input.checkValidity()){input.reportValidity();return false;}}if(step===1&&!form.querySelector('[name=services]:checked')){status.textContent='Choose at least one service.';return false;}return true;}
function display(){form.querySelectorAll('.step').forEach((e,i)=>e.hidden=i!==step);document.querySelectorAll('.steps li').forEach((e,i)=>{if(i===step)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});document.querySelector('#previous').hidden=step===0;document.querySelector('#next').hidden=step===2;document.querySelector('#send').hidden=step!==2;status.textContent='';if(step===2){const p=payload();document.querySelector('#review').textContent=`${p.company}\n${p.name} · ${p.title}\n${p.email}\nEnvironment: ${p.environment}\n\n`+p.services.map(s=>`${s.type}: ${s.count}\nTargets: ${s.targets}\nScope: ${s.details}`).join('\n\n')+`\n\nExclusions: ${p.exclusions}\nActivities and limits: ${p.activities}\nWindow: ${p.window}\nEmergency contact: ${p.emergency}`;}const h=form.querySelector(`[data-step="${step}"] h2`);h.tabIndex=-1;h.focus();}
document.querySelector('#next').onclick=()=>{if(valid()){step++;display();}};document.querySelector('#previous').onclick=()=>{step--;display();};
// Validate the active step ourselves so hidden required fields do not trap focus.
form.noValidate=true;
form.addEventListener('submit',async e=>{e.preventDefault();if(step!==2){if(valid()){step++;display();}return;}if(!valid())return;const button=document.querySelector('#send');button.disabled=true;status.textContent='Preparing your agreement…';try{const response=await fetch('/api/onboarding/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});if(response.ok){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(await response.blob());await renderPDF(previewUrl);document.querySelector('#download-preview').href=previewUrl;form.hidden=true;document.querySelector('#pdf-result').hidden=false;document.querySelector('#pdf-result').scrollIntoView({behavior:'smooth'});return;}const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to send. Please contact our team.');submitted=result;form.hidden=true;document.querySelector('#receipt').hidden=false;document.querySelector('#receipt-reference').textContent='Reference: '+result.reference;renderStatus(result.status);}catch(err){status.textContent=err.message||'Unable to connect. Please contact our team.';}finally{button.disabled=false;}});
function renderStatus(state){document.querySelector('#receipt-status').textContent=({awaiting_signature:'Your agreement has been sent. Check your email for the DocuSign invitation.',delivery_uncertain:'Your scope has been saved, but delivery could not be confirmed. Please contact our team with this reference. Do not submit again.',ready_to_schedule:'Your agreement is complete and the signed documents are saved. Your assessment is ready to schedule.',declined:'The signing request was declined. Contact our team to discuss changes.',voided:'This signing request is no longer active. Contact our team for a replacement.'})[state]||'Your agreement is being prepared.';}
document.querySelector('#check-status').onclick=async()=>{if(!submitted)return;const b=document.querySelector('#check-status');b.disabled=true;try{const r=await fetch('/api/onboarding/'+submitted.reference,{headers:{Authorization:'Bearer '+submitted.accessToken}});if(!r.ok)throw new Error();renderStatus((await r.json()).status);}catch{document.querySelector('#receipt-status').textContent='Unable to refresh status. Please try again.';}finally{b.disabled=false;}};
fetch('/api/onboarding/config').then(r=>r.json()).then(c=>{
 localPreview=c.localPreview===true;
 document.querySelector('#demo-tools').hidden=!localPreview;
 document.querySelector('#send').textContent='Generate my agreement';
 document.querySelector('.intro').textContent='Complete your details and scope, review your populated agreement, then submit it to our team for pricing.';
 document.querySelector('.steps li:last-child').textContent='3 · Review and submit';
 document.querySelector('[data-step="2"] > p').textContent='Review the information below. It will automatically populate your draft PDF agreement.';
 document.querySelector('#availability').textContent=localPreview?'Local test mode. Preview the full process without sending emails.':c.reviewAvailable?'Your draft will be sent to enterprise@synapdome.com for scope review and pricing.':'Email submission is not connected yet. You can preview and download your draft.';
 document.querySelector('[name=consent]').parentElement.lastChild.textContent='I agree to share these details with the assessment team to prepare and review my agreement.';
 document.querySelector('#proceed-preview').disabled=!c.reviewAvailable;
}).catch(()=>{status.textContent='Unable to check submission availability. Please refresh.';document.querySelector('#proceed-preview').disabled=true;});

document.querySelector('#edit-preview').onclick=()=>{
 document.querySelector('#proceed-preview').disabled=false;document.querySelector('#pdf-result').hidden=true;form.hidden=false;step=0;display();};
document.querySelector('#sample').onclick=()=>{
 document.querySelector('#signature-preview').hidden=true;
 const fields={name:'Alex Morgan',email:'alex@example.com',company:'Example Commerce Ltd',title:'Engineering Director',environment:'Production',exclusions:'Payment processor infrastructure and all third party hosts',activities:'Authentication, authorization and business logic checks. Maximum two requests per second. No availability or destructive testing.',window:'12 November 2026, 09:00 to 17:00 UTC, subject to confirmation',emergency:'Alex Morgan, alex@example.com, +1 202 555 0142'};
 for(const [name,value] of Object.entries(fields))form.elements.namedItem(name).value=value;
 for(const choice of form.querySelectorAll('[name=services]')){choice.checked=['API','Web'].includes(choice.value);choice.dispatchEvent(new Event('change'));}
 const services={API_count:'12',API_targets:'https://api.example.com/v1: 12 operations in OpenAPI reference v1.0',API_details:'Review customer and administrator roles, sessions, access control and checkout endpoints.',Web_count:'1',Web_targets:'https://shop.example.com',Web_details:'Customer login, basket, checkout and order history. Two designated assessment accounts.'};
 for(const [name,value] of Object.entries(services))form.elements.namedItem(name).value=value;
 document.querySelector('#pdf-result').hidden=true;form.hidden=false;step=0;display();
};

async function renderPDF(url){
 const progress=document.querySelector('#pdf-progress'),pages=document.querySelector('#pdf-pages');pages.replaceChildren();progress.textContent='Rendering your agreement…';
 try{const pdfjs=await import('/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.mjs';const pdf=await pdfjs.getDocument({url,standardFontDataUrl:'/pdfjs/fonts/'}).promise;
 for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const viewport=page.getViewport({scale:1.5});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.setAttribute('aria-label','Agreement page '+n);pages.append(canvas);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;}progress.textContent=pdf.numPages+' pages generated from your form. Download the PDF for selectable text.';
 }catch{progress.textContent='Your PDF is ready. Use Download PDF to view it.';}
}

document.querySelector('#proceed-preview').onclick=async()=>{
 const button=document.querySelector('#proceed-preview'),message=document.querySelector('#submission-status');button.disabled=true;message.textContent='Submitting your scope…';
 try{const response=await fetch('/api/onboarding/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to submit.');
 document.querySelector('#pdf-result').hidden=true;const panel=document.querySelector('#signature-preview');panel.hidden=false;
 document.querySelector('#review-outcome').textContent=result.status==='preview_only'?'Local demonstration complete. In the live service, your PDF would be emailed to enterprise@synapdome.com and an acknowledgement sent to your email. Nothing was emailed, signed or booked.':result.status==='awaiting_review'?`Your draft has been submitted for review. Reference: ${result.reference}. `+(result.acknowledged?'An acknowledgement has been sent to your email.':'Your submission is saved, but we could not send your acknowledgement email.'):`Your scope is saved, but email delivery could not be confirmed. Reference: ${result.reference}. Please contact enterprise@synapdome.com with this reference rather than resubmitting.`;
 panel.focus();panel.scrollIntoView({behavior:'smooth'});message.textContent='';
 }catch(err){message.textContent=err.message||'Unable to connect. Please try again.';button.disabled=false;}
};
document.querySelector('#back-to-agreement').onclick=()=>{document.querySelector('#signature-preview').hidden=true;document.querySelector('#pdf-result').hidden=false;document.querySelector('#download-preview').focus();};
