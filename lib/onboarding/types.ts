export interface OnboardingActor {
  email: string;
  role: string;
  name?: string;
}

export interface OnboardingTransactionResult {
  success: boolean;
  companyId: string | null;
  contactUserId: string | null;
  activationKey: string | null;
  setupToken: string | null;
  hierarchyViolations: string[];
  emailDispatched: boolean;
  error?: string;
  rolledBack?: boolean;
}
