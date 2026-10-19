import 'dotenv/config';
import { buildOnboarding } from './app.js';
const app=await buildOnboarding();
await app.listen({host:process.env.ONBOARDING_HOST || '127.0.0.1',port:Number(process.env.ONBOARDING_PORT || 4174)});
console.log('SynapDome onboarding service listening');
