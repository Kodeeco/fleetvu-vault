/**
 * FleetVu Chain of Custody — Litigation-Grade Audit Trail
 *
 * Every data touchpoint (device ID, network timestamp, user account, system
 * action) is recorded as an append-only, SHA-256-chained custody event.
 */

import { sha256Hex } from './aes-vault';

export type CustodyAction =
  | 'created'
  | 'ingested'
  | 'sealed'
  | 'viewed'
  | 'exported'
  | 'transferred'
  | 'verified'
  | 'signed_off'
  | 'sensor_trigger'
  | 'alert_issued'
  | 'sync_received'
  | 'sync_acknowledged'
  | 'modified_attempt' // recorded when mutation is blocked
  | 'legal_hold';

export interface CustodyActor {
  accountId: string | null;
  email: string | null;
  role: string | null;
  displayName?: string | null;
}

export interface CustodyDevice {
  deviceId: string | null;
  platform: string | null;
  appVersion: string | null;
  userAgent?: string | null;
}

export interface CustodyEventInput {
  artifactType: string;
  artifactId: string;
  companyId: string | null;
  action: CustodyAction;
  actor: CustodyActor;
  device: CustodyDevice;
  /** Millisecond-precision ISO or epoch ms */
  networkTimestamp?: string | number;
  previousHash?: string | null;
  metadata?: Record<string, unknown>;
  /** Optional payload hash of the artifact at this touchpoint */
  artifactHash?: string | null;
}

export interface CustodyEvent {
  id: string;
  seq: number;
  artifact_type: string;
  artifact_id: string;
  company_id: string | null;
  action: CustodyAction;
  actor_account_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  device_id: string | null;
  device_platform: string | null;
  app_version: string | null;
  network_timestamp: string;
  server_timestamp: string;
  artifact_hash: string | null;
  prev_hash: string | null;
  record_hash: string;
  metadata: Record<string, unknown>;
}

function toIsoMs(value?: string | number): string {
  if (value === undefined || value === null) return new Date().toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function canonicalize(event: Omit<CustodyEvent, 'record_hash'>): string {
  const ordered: Record<string, unknown> = {
    id: event.id,
    seq: event.seq,
    artifact_type: event.artifact_type,
    artifact_id: event.artifact_id,
    company_id: event.company_id,
    action: event.action,
    actor_account_id: event.actor_account_id,
    actor_email: event.actor_email,
    actor_role: event.actor_role,
    device_id: event.device_id,
    device_platform: event.device_platform,
    app_version: event.app_version,
    network_timestamp: event.network_timestamp,
    server_timestamp: event.server_timestamp,
    artifact_hash: event.artifact_hash,
    prev_hash: event.prev_hash,
    metadata: event.metadata,
  };
  return JSON.stringify(ordered);
}

let seqCounter = 0;

/**
 * Seal a chain-of-custody event with SHA-256 linkage.
 */
export async function sealCustodyEvent(
  input: CustodyEventInput,
  seq?: number,
): Promise<CustodyEvent> {
  const id = crypto.randomUUID();
  const eventSeq = seq ?? ++seqCounter;
  const serverTimestamp = new Date().toISOString();

  const unsigned: Omit<CustodyEvent, 'record_hash'> = {
    id,
    seq: eventSeq,
    artifact_type: input.artifactType,
    artifact_id: input.artifactId,
    company_id: input.companyId,
    action: input.action,
    actor_account_id: input.actor.accountId,
    actor_email: input.actor.email,
    actor_role: input.actor.role,
    device_id: input.device.deviceId,
    device_platform: input.device.platform,
    app_version: input.device.appVersion,
    network_timestamp: toIsoMs(input.networkTimestamp),
    server_timestamp: serverTimestamp,
    artifact_hash: input.artifactHash ?? null,
    prev_hash: input.previousHash ?? null,
    metadata: {
      ...(input.metadata || {}),
      user_agent: input.device.userAgent ?? null,
      actor_display_name: input.actor.displayName ?? null,
    },
  };

  const recordHash = await sha256Hex(
    `${unsigned.prev_hash ?? ''}:${await sha256Hex(canonicalize(unsigned))}:${unsigned.seq}`,
  );

  return { ...unsigned, record_hash: recordHash };
}

/**
 * Verify an ordered custody chain for court presentation.
 */
export async function verifyCustodyChain(
  events: CustodyEvent[],
): Promise<{ valid: boolean; brokenAtSeq: number | null; verified: number; error: string | null }> {
  let prev: string | null = null;
  let verified = 0;

  for (const event of events) {
    if (event.prev_hash !== prev) {
      return {
        valid: false,
        brokenAtSeq: event.seq,
        verified,
        error: `Chain linkage broken at seq ${event.seq}`,
      };
    }

    const { record_hash: _rh, ...rest } = event;
    const expected = await sha256Hex(
      `${event.prev_hash ?? ''}:${await sha256Hex(canonicalize(rest))}:${event.seq}`,
    );

    if (expected !== event.record_hash) {
      return {
        valid: false,
        brokenAtSeq: event.seq,
        verified,
        error: `Record hash mismatch at seq ${event.seq}`,
      };
    }

    prev = event.record_hash;
    verified++;
  }

  return { valid: true, brokenAtSeq: null, verified, error: null };
}
