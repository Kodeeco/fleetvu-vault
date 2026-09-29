export type UserRole = 'driver' | 'executive' | 'super_admin' | 'global_admin' | 'auditor';
export type PlanTier = 'basic' | 'pro' | 'proplus';
export type ChassisType =
  | 'class8_tractor'
  | 'class7_box'
  | 'vocational_dump'
  | 'heavy_equipment';

export type VehicleProfileKey =
  | 'class8_tractor_trailer'
  | 'class8_tractor_sleeper'
  | 'class7_day_cab'
  | 'class6_straight_box'
  | 'fuel_tanker'
  | 'flatbed_specialty'
  | 'commercial_van';

export type HardwareProfileKey =
  | 'c55_pro_forward'
  | 'c55_pro_forward_r'
  | 'c55_pro_forward_l'
  | 'c55_pro_forward_lr'
  | 'c55_pro_forward_lr_rear'
  | 'c93_us4_gap'
  | 'c93_us4_gap_lane';

export type ProximityZone = 'green' | 'yellow' | 'red';
export type VehicleStatus = 'operational' | 'maintenance' | 'inoperable';
export type DiagnosticResult = 'PASS' | 'DEGRADED' | 'FAIL';

export interface Company {
  id: string;
  name: string;
  region: string;
  location: string;
  plan_tier: PlanTier;
  fleet_locations: string[];
  created_at: string;
  account_status?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  plan_start_date?: string | null;
  plan_end_date?: string | null;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  monthly_recurring_revenue?: number | null;
  annual_contract_value?: number | null;
  billing_cycle?: string | null;
  payment_status?: string | null;
  sales_rep?: string | null;
  industry?: string | null;
  fleet_size?: number | null;
  notes?: string | null;
  renewal_status?: string | null;
  health_score?: number | null;
  last_activity_at?: string | null;
}

export interface Driver {
  id: string;
  company_id: string | null;
  name: string;
  email: string | null;
  driver_number: string | null;
  pin_code: string | null;
  location: string | null;
  company_name: string | null;
  license_class: string | null;
  status: string;
  created_at: string;
}

export interface DriverAccessKeycode {
  id: string;
  keycode: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_number: string | null;
  company_id: string | null;
  company_name: string | null;
  issued_by: string | null;
  issued_by_name: string | null;
  lifecycle_status: 'generated' | 'dispatched' | 'burned' | 'revoked';
  dispatch_method: string | null;
  dispatch_destination: string | null;
  dispatched_at: string | null;
  burned_at: string | null;
  burned_by_device: string | null;
  biometric_bound: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  company_id: string | null;
  truck_number: string;
  chassis_type: string;
  hardware_profile: string;
  assigned_driver_id: string | null;
  company_name: string | null;
  location: string | null;
  status: string;
  plan_tier: PlanTier;
  safety_score: number;
  created_at: string;
}

export interface TelemetryEvent {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  company_id: string | null;
  truck_number: string | null;
  driver_name: string | null;
  speed_mph: number | null;
  latitude: number | null;
  longitude: number | null;
  utc_timestamp: string;
  proximity_zone: string | null;
  distance_m: number | null;
  sensor_type: string | null;
  g_force: number | null;
  created_at: string;
}

export interface Incident {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  company_id: string | null;
  case_id: string | null;
  truck_speed_mph: number | null;
  target_speed_mph: number | null;
  approach_angle: string | null;
  impact_distance_m: number | null;
  latitude: number | null;
  longitude: number | null;
  utc_timestamp: string;
  proximity_zone: string | null;
  target_type: string | null;
  target_vehicle_year: string | null;
  target_vehicle_make: string | null;
  target_vehicle_model: string | null;
  impact_angle_type: string | null;
  fleet_truck_motion: string | null;
  target_vehicle_motion: string | null;
  lane_selection: string | null;
  photos: string[];
  voice_note_transcript: string | null;
  reconstruction_data: Record<string, unknown>;
  status: string;
  severity_grade: string | null;
  triage_status: string | null;
  investigator_notes: string | null;
  created_at: string;
}

export interface Diagnostic {
  id: string;
  vehicle_id: string | null;
  company_id: string | null;
  rf_echo_result: string | null;
  ultrasonic_result: string | null;
  imu_result: string | null;
  overall_result: string | null;
  latitude: number | null;
  longitude: number | null;
  utc_timestamp: string;
  driver_acknowledged: boolean;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_role: string;
  actor_email: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  prev_hash: string | null;
  record_hash: string | null;
  utc_timestamp: string;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  requester_role: string | null;
  company_name: string | null;
  department: string | null;
  request_reason: string | null;
  region: string | null;
  location_facility: string | null;
  role_requested: string | null;
  routing_target: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  temporary_credentials: Record<string, unknown> | null;
  master_key: string | null;
  created_at: string;
}

export interface FeatureSuggestion {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  company_name: string | null;
  location: string | null;
  title: string;
  category: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

export interface PricingConfig {
  id: string;
  tier: PlanTier;
  name: string;
  price_monthly: number;
  description: string | null;
  features: string[];
  is_active: boolean;
  updated_at: string;
  created_at: string;
}

export interface HardwareProfile {
  id: string;
  profile_key: string;
  name: string;
  description: string | null;
  sensor_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface LegalAcknowledgment {
  id: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_number: string | null;
  company_name: string | null;
  acknowledgment_text: string | null;
  training_completed: boolean;
  hardware_verified: boolean;
  utc_timestamp: string;
  created_at: string;
}

export interface ProvisionedUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  corporate_title: string | null;
  company_id: string | null;
  company_name: string | null;
  role: 'super_admin' | 'location_admin' | 'admin' | 'manager' | 'standard_user' | 'auditor';
  assigned_locations: string[];
  scoped_company_ids: string[];
  assigned_vehicle_count: number;
  deployment_hardware: 'c55_pro' | 'c93_dual';
  plan_tier: PlanTier;
  feature_permissions: {
    driver_management: boolean;
    incident_playback: boolean;
    historical_reports: boolean;
    insurance_scorecards: boolean;
    pdf_downloads: boolean;
    live_gps: boolean;
  };
  temp_password: string | null;
  status: 'active' | 'suspended' | 'revoked' | 'pending_invitation';
  provisioned_by: string | null;
  provisioned_by_role: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface InviteToken {
  id: string;
  token: string;
  user_email: string;
  user_id: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  status: 'active' | 'used' | 'expired';
}

export interface AccessAuditLog {
  id: string;
  seq: number;
  actor_email: string | null;
  actor_role: string | null;
  action_type: string;
  target_user_email: string | null;
  target_user_role: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  record_hash: string | null;
  prev_hash: string | null;
  metadata: Record<string, unknown> | null;
  utc_timestamp: string;
  created_at: string;
}

export interface DocumentAudit {
  id: string;
  case_id: string | null;
  document_type: string | null;
  action: string;
  actor_role: string | null;
  actor_email: string | null;
  recipient_email: string | null;
  hash_fingerprint: string | null;
  qr_code_data: string | null;
  utc_timestamp: string;
  created_at: string;
}

export interface SubscriptionRequest {
  id: string;
  company_id: string | null;
  company_name: string | null;
  location: string | null;
  poc_name: string | null;
  poc_email: string | null;
  affected_unit_count: number;
  hardware_serials: string[];
  status: 'pending' | 'submitted' | 'invoiced' | 'paid' | 'active';
  annual_total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostCheckRecord {
  id: string;
  vehicle_id: string | null;
  company_id: string | null;
  hardware_serial: string | null;
  sensors_checked: number;
  passed: boolean;
  failures: string[];
  duration_ms: number;
  triggered_by: string;
  utc_timestamp: string;
  created_at: string;
}

export interface SensorChannelConfig {
  id: string;
  vehicle_id: string | null;
  company_id: string | null;
  hardware_serial: string | null;
  channel_forward_range_m: number;
  channel_left_range_m: number;
  channel_right_range_m: number;
  edge_filter_enabled: boolean;
  edge_filter_threshold_m: number;
}

export interface CollisionEvent {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  company_id: string | null;
  event_type: 'proximity_near_miss' | 'verified_bumper_impact';
  severity: 'low' | 'medium' | 'high' | 'critical';
  channel_forward_reading: number | null;
  channel_left_reading: number | null;
  channel_right_reading: number | null;
  smartphone_jolt_g: number | null;
  impact_speed_mph: number | null;
  latitude: number | null;
  longitude: number | null;
  utc_timestamp: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ZkpComplianceCertificate {
  id: string;
  company_id: string;
  generated_by: string | null;
  certificate_type: 'compliance' | 'incident_package';
  chain_root_hash: string;
  block_range_start: number;
  block_range_end: number;
  event_count: number;
  merkle_proof: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: 'generated' | 'exported' | 'revoked';
  utc_timestamp: string;
  created_at: string;
}

export interface EnterpriseWebhook {
  id: string;
  company_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_delivery_status: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface DriverOnboardingState {
  id: string;
  driver_id: string | null;
  company_id: string | null;
  driver_email: string;
  auth_method: 'biometric' | 'keycode' | 'pin_fallback' | null;
  webauthn_credential_id: string | null;
  keycode_id: string | null;
  pin_expires_at: string | null;
  status: 'pending' | 'method_selected' | 'completed' | 'expired';
  created_at: string;
  updated_at: string;
}
