import 'dotenv/config';
import { buildOnboarding } from './app.js';
if(process.env.ONBOARDING_LOCAL_PREVIEW==='true' && !['127.0.0.1','::1'].includes(process.env.ONBOARDING_HOST||'127.0.0.1')) throw new Error('Preview must bind to loopback');
const app=await buildOnboarding();
await app.listen({host:process.env.ONBOARDING_HOST || '127.0.0.1',port:Number(process.env.ONBOARDING_PORT || 4174)});
console.log('SynapDome onboarding service listening');
