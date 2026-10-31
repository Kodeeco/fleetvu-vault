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
  /** True when company was saved to local CRM because Supabase blocked writes. */
  localFallback?: boolean;
  /** Roster Portal URL included in the welcome email (when created). */
  rosterPortalUrl?: string | null;
  error?: string;
  rolledBack?: boolean;
}
