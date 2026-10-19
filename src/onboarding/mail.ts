import nodemailer from 'nodemailer';
import type { Intake } from './schema.js';
export const reviewRecipient='enterprise@synapdome.com';
export function configured(){return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);}
export async function sendReview(input:Intake,id:string,pdf:Buffer){
 if(!configured())throw new Error('SMTP not configured');
 const port=Number(process.env.SMTP_PORT||587);
 if(![465,587].includes(port))throw new Error('Use TLS SMTP port 465 or 587');
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:true,auth:{user:process.env.SMTP_USER!,pass:process.env.SMTP_PASSWORD!},connectionTimeout:15000,socketTimeout:30000});
 try{
 const sent=await transport.sendMail({from:process.env.SMTP_FROM,to:reviewRecipient,headers:{'Resend-Idempotency-Key':`review/${id}`},replyTo:input.email,subject:`Assessment scope for review | ${id}`,text:`A customer submitted an assessment scope.\n\nReference: ${id}\nCompany: ${input.company}\nContact: ${input.name} (${input.title})\nEmail: ${input.email}\n\nThe attached PDF is an unsigned draft for internal review. Add the agreed assessment fee and hourly remediation rate, finalize the terms and send the approved document for customer signature. No assessment has been booked.\n\nPreliminary remediation guidance: within 48 hours of kickoff. Final report: within one week. No advance payment. Payment unlocks the full finalized report and detailed findings.`,attachments:[{filename:`assessment-${id}.pdf`,content:pdf,contentType:'application/pdf'}]});
 if(!sent.accepted.length)throw new Error('Message not accepted');
 // A failed acknowledgement must not cause a second staff notification.
 try{await transport.sendMail({from:process.env.SMTP_FROM,to:input.email,replyTo:reviewRecipient,headers:{'Resend-Idempotency-Key':`ack/${id}`},subject:'Your assessment scope has been received',text:`Thank you for submitting your assessment scope.\n\nReference: ${id}\n\nOur team will review your requirements, add the proposed fee and send the completed agreement for your review and signature. No payment is due before kickoff. Nothing has been signed or scheduled by this submission.\n\nAfter the agreed kickoff, preliminary remediation guidance is due within 48 hours and the finalized report within one week. Payment unlocks the full finalized report and detailed findings.\n\nContact enterprise@synapdome.com with this reference if you need to update your scope.`});return {acknowledged:true};}catch{return {acknowledged:false};}
 }finally{transport.close();}
}
