import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Intake } from './schema.js';
export type RecordData={id:string;tokenHash:string;created:string;input:Intake;acknowledged?:boolean;status:'awaiting_review'|'sending'|'awaiting_signature'|'delivery_uncertain'|'ready_to_schedule'|'declined'|'voided';envelopeId?:string;completed?:string};
export class Store {
  constructor(readonly directory:string){}
  async init(){await mkdir(this.directory,{recursive:true,mode:0o700});}
  path(id:string){if(!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid reference');return join(this.directory,`${id}.json`);}
  async get(id:string):Promise<RecordData>{return JSON.parse(await readFile(this.path(id),'utf8'));}
  async put(record:RecordData){const file=this.path(record.id);await writeFile(file+'.tmp',JSON.stringify(record),{mode:0o600});await rename(file+'.tmp',file);}
  async findEnvelope(id:string){for(const name of await readdir(this.directory)){if(!name.endsWith('.json'))continue; const record=await this.get(name.slice(0,-5));if(record.envelopeId===id)return record;}}
  async draft(id:string,data:Buffer){this.path(id);await writeFile(join(this.directory,`${id}.draft.pdf`),data,{mode:0o600});}
  async pdf(id:string,data:Buffer){this.path(id);await writeFile(join(this.directory,`${id}.signed.pdf`),data,{mode:0o600});}
}
export const dataDirectory=()=>resolve(process.env.ONBOARDING_DATA_DIR || './private-onboarding');
