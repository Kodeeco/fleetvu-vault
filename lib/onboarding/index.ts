/** Client-safe onboarding exports (no Node SMTP / server-only deps). */

export {
  companyStepSchema,
  contactStepSchema,
  fleetStepSchema,
  unifiedOnboardingSchema,
  validateStep,
  validateField,
  type CompanyStepData,
  type ContactStepData,
  type FleetStepData,
  type UnifiedOnboardingData,
  type OnboardingStep,
} from './schema';

export {
  validateHierarchy,
  buildHierarchyTree,
  type HierarchyNode,
  type HierarchySnapshot,
} from './hierarchy';

export type {
  OnboardingActor,
  OnboardingTransactionResult,
} from './types';
