import { z } from 'zod';
const text = (max = 2000) => z.string().trim().min(1).max(max);
export const serviceNames = ['API','Mobile','Web','Cloud','Network','Code'] as const;
export const intakeSchema = z.object({
  name: text(120), email: z.string().trim().email().max(254), company: text(160),
  title: text(120), environment: z.enum(['Production','Staging','Both']),
  services: z.array(z.object({
    type: z.enum(serviceNames), count: z.number().int().min(1).max(100000),
    targets: text(5000), details: text(5000)
  }).strict()).min(1).max(6).refine(a => new Set(a.map(s=>s.type)).size === a.length, 'Duplicate service'),
  exclusions: text(), activities: text(), window: text(500), emergency: text(500),
  consent: z.literal(true), authority: z.literal(true), website: z.literal('').default('')
}).strict();
export type Intake = z.infer<typeof intakeSchema>;
export function scopeSummary(input: Intake, id: string) {
  return [`Assessment reference: ${id}`,`Company: ${input.company}`,`Signatory: ${input.name} (${input.title})`,
    `Email: ${input.email}`,`Environment: ${input.environment}`,
    ...input.services.map(s=>`\n${s.type} assessment\nQuantity: ${s.count}\nTargets:\n${s.targets}\nCoverage and access requirements:\n${s.details}`),
    `\nExclusions: ${input.exclusions}`,`Permitted activities and limits: ${input.activities}`,
    `Requested testing window and timezone: ${input.window}`,`Emergency contact: ${input.emergency}`,
    '\nThe signatory confirms authority to authorize testing of the listed assets. Signing records the agreed scope; the testing start time must be scheduled separately.'].join('\n');
}
