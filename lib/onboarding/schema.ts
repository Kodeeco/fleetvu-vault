/**
 * Unified Onboarding Validation Schema
 * Company → Contact (Fleet Director) → Fleet hierarchy with realtime field rules.
 */

import { z } from 'zod';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[\d\s()+.-]{7,20}$/;

export const companyStepSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(120, 'Organization name is too long'),
  primaryLocation: z
    .string()
    .trim()
    .min(2, 'Primary location is required')
    .max(120),
  region: z.enum(['West Coast', 'Midwest', 'East Coast', 'South', 'Unspecified']),
  planTier: z.enum(['basic', 'pro', 'proplus']),
  industry: z.string().trim().max(80).optional().or(z.literal('')),
  fleetSizeEstimate: z
    .number({ invalid_type_error: 'Fleet size must be a number' })
    .int()
    .min(0)
    .max(100_000)
    .optional(),
});

export const contactStepSchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, 'Contact name is required')
    .max(100),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .regex(emailRegex, 'Enter a valid email address'),
  contactPhone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  contactRole: z.enum(['super_admin', 'location_admin']),
  corporateTitle: z.string().trim().max(120).optional().or(z.literal('')),
});

export const fleetStepSchema = z.object({
  fleetLocations: z
    .array(z.string().trim().min(1).max(120))
    .min(1, 'At least one fleet location is required')
    .max(50),
  entitlements: z.object({
    radar: z.boolean(),
    gps: z.boolean(),
    vault: z.boolean(),
    risk_scoring: z.boolean(),
  }),
  welcomeMessage: z.string().trim().max(2000).optional().or(z.literal('')),
  initialVehicleCount: z.number().int().min(0).max(10_000).optional(),
});

export const unifiedOnboardingSchema = companyStepSchema
  .merge(contactStepSchema)
  .merge(fleetStepSchema);

export type CompanyStepData = z.infer<typeof companyStepSchema>;
export type ContactStepData = z.infer<typeof contactStepSchema>;
export type FleetStepData = z.infer<typeof fleetStepSchema>;
export type UnifiedOnboardingData = z.infer<typeof unifiedOnboardingSchema>;

export type OnboardingStep = 'company' | 'contact' | 'fleet' | 'review';

export function validateStep(
  step: OnboardingStep,
  data: Partial<UnifiedOnboardingData>,
): { valid: boolean; errors: Record<string, string> } {
  const schema =
    step === 'company'
      ? companyStepSchema
      : step === 'contact'
        ? contactStepSchema
        : step === 'fleet'
          ? fleetStepSchema
          : unifiedOnboardingSchema;

  const result = schema.safeParse(data);
  if (result.success) return { valid: true, errors: {} };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { valid: false, errors };
}

/** Field-level realtime validator for controlled inputs. */
export function validateField(
  field: keyof UnifiedOnboardingData | string,
  value: unknown,
  step: OnboardingStep,
): string | null {
  const probe: Record<string, unknown> = { [field]: value };

  // Provide minimal sibling defaults so zod partial checks work for single fields
  if (step === 'company') {
    const partial = companyStepSchema.partial().safeParse(probe);
    if (!partial.success) {
      const issue = partial.error.issues.find((i) => i.path[0] === field);
      return issue?.message ?? null;
    }
  } else if (step === 'contact') {
    const partial = contactStepSchema.partial().safeParse(probe);
    if (!partial.success) {
      const issue = partial.error.issues.find((i) => i.path[0] === field);
      return issue?.message ?? null;
    }
  } else if (step === 'fleet') {
    const partial = fleetStepSchema.partial().safeParse(probe);
    if (!partial.success) {
      const issue = partial.error.issues.find((i) => i.path[0] === field);
      return issue?.message ?? null;
    }
  }
  return null;
}
