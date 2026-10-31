/** Customer Fleet Account Portal (baby enterprise backend) — shared types */

export type FleetAccountCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export type ReportKind =
  | 'safety_digest'
  | 'insurance_scorecard'
  | 'post_logs'
  | 'event_logs'
  | 'sensor_fault_alerts'
  | 'incident_packages';

export interface ReportRecipient {
  email: string;
  name?: string;
  /** External (HR, broker, counsel) vs company user */
  external?: boolean;
  addedAt: string;
  addedBy?: string;
}

export interface FleetAccountSettings {
  companyId: string;
  companyName: string;
  /** Safety digest cadence (default weekly) */
  safetyDigestCadence: FleetAccountCadence;
  /** Per-report-type recipient lists */
  recipients: Partial<Record<ReportKind, ReportRecipient[]>>;
  /** Notify driver in-app on sensor fault */
  notifyDriverOnSensorFault: boolean;
  updatedAt: string;
  updatedBy?: string | null;
}

export type FleetAuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password_set'
  | 'roster_save'
  | 'roster_submit'
  | 'settings_update'
  | 'report_view'
  | 'report_download'
  | 'incident_view'
  | 'incident_share_create'
  | 'incident_share_revoke'
  | 'recipient_add'
  | 'recipient_remove';

export interface FleetAuditEntry {
  id: string;
  companyId: string;
  token?: string;
  at: string;
  action: FleetAuditAction;
  actorEmail?: string | null;
  actorName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown>;
}

export interface IncidentShareLink {
  id: string;
  companyId: string;
  incidentId: string;
  incidentLabel?: string;
  token: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  recipients: string[];
  revokedAt?: string | null;
  accessCount: number;
}

export interface FleetPortalCredential {
  companyId: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: 'super_admin' | 'admin' | 'manager';
  createdAt: string;
  updatedAt: string;
}
