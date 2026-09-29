// ============================================================
// FleetVu Forensic Vault — Core Type Definitions
// Isolated namespace: /src/vault — zero CRM crossover
// ============================================================

export type VaultTier = 'basic' | 'pro' | 'proplus';

export type VaultLicenseStatus =
  | 'pending_activation'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'revoked';

export type VaultFeature =
  | 'forensic_vault'
  | 'collision_reconstruction'
  | 'insurance_modeling'
  | 'pdf_export'
  | 'live_gps'
  | 'historical_reports';

/** A single sealed event block in the Merkle chain. */
export interface VaultEventBlock {
  id: string;
  block_seq: number;
  company_id: string | null;
  vehicle_id: string | null;
  event_count: number;
  payload_hash: string;
  prev_hash: string | null;
  record_hash: string;
  merkle_root: string;
  sealed_at: string;
  created_at: string;
}

/** Raw telemetry event to be sealed into a block. */
export interface VaultRawEvent {
  vehicle_id?: string | null;
  driver_id?: string | null;
  company_id?: string | null;
  truck_number?: string | null;
  speed_mph?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  utc_timestamp?: string | null;
  proximity_zone?: string | null;
  distance_m?: number | null;
  sensor_type?: string | null;
  g_force?: number | null;
}

/** Hardware-bound license record. */
export interface VaultLicense {
  id: string;
  company_id: string | null;
  hardware_serial: string;
  license_key: string;
  tier: VaultTier;
  status: VaultLicenseStatus;
  activated_at: string | null;
  complimentary_until: string | null;
  subscription_until: string | null;
  last_verification_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Per-company feature gate state. */
export interface VaultFeatureGate {
  id: string;
  company_id: string;
  tier: VaultTier;
  forensic_vault_enabled: boolean;
  collision_reconstruction_enabled: boolean;
  insurance_modeling_enabled: boolean;
  pdf_export_enabled: boolean;
  live_gps_enabled: boolean;
  historical_reports_enabled: boolean;
  edge_pre_filtering_enabled: boolean;
  crypto_agility_enabled: boolean;
  zkp_compliance_enabled: boolean;
  openapi_webhooks_enabled: boolean;
  accident_reconstruction_enabled: boolean;
  grace_period_until: string | null;
  locked_down: boolean;
  last_evaluated_at: string;
  created_at: string;
  updated_at: string;
}

/** Result of a chain verification check. */
export interface VaultChainVerification {
  valid: boolean;
  broken_at_seq: number | null;
  total_blocks: number;
  verified_blocks: number;
  error: string | null;
}

/** Result of a license verification check. */
export interface VaultLicenseVerification {
  valid: boolean;
  status: VaultLicenseStatus;
  tier: VaultTier;
  complimentary_remaining_days: number;
  error: string | null;
}

/** Result of a feature-gate access check. */
export interface VaultFeatureAccessResult {
  allowed: boolean;
  feature: VaultFeature;
  tier: VaultTier;
  locked_down: boolean;
  in_grace_period: boolean;
  reason: string | null;
}
