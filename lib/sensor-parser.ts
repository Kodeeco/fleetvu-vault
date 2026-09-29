'use client';

import { sealEventBlock, sha256, canonicalizeEvents } from '@/src/vault/merkle-chain';
import type { VaultRawEvent, VaultEventBlock } from '@/src/vault/types';
import { supabase } from './supabase';

/**
 * Sensor Protocol Data Parser & Telemetry Ingestion
 *
 * Translates raw incoming manufacturer sensor data streams into the secure
 * JSON format required by the backend architecture. Uses a pluggable parser
 * interface so the real parser can be dropped in once official protocol
 * documents arrive.
 *
 * The ingestion pipeline:
 * 1. Raw bytes/string → Parser → VaultRawEvent[]
 * 2. Events → canonicalize → SHA-256 hash → Merkle chain seal
 * 3. Sealed blocks → Supabase persistence
 */

export interface ParseResult {
  events: VaultRawEvent[];
  parserName: string;
  rawByteCount: number;
  errors: string[];
}

export interface IngestionResult {
  block: VaultEventBlock | null;
  eventsIngested: number;
  hashChain: string;
  errors: string[];
}

/**
 * Pluggable parser interface. Each manufacturer's sensor protocol implements
 * this interface. The parser translates raw data into VaultRawEvent[].
 */
export interface SensorProtocolParser {
  name: string;
  protocolVersion: string;
  /** Parse raw data (bytes or string) into structured events */
  parse(raw: Uint8Array | string): VaultRawEvent[];
  /** Validate that raw data matches this parser's expected format */
  matches(raw: Uint8Array | string): boolean;
}

/**
 * Default/mock parser — handles JSON-formatted sensor data.
 * This is the placeholder until official protocol docs arrive.
 * It accepts newline-delimited JSON or a JSON array of events.
 */
export class JsonSensorParser implements SensorProtocolParser {
  name = 'FleetVu JSON (Default)';
  protocolVersion = '1.0-mock';

  matches(raw: Uint8Array | string): boolean {
    try {
      const str = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      return str.trim().startsWith('{') || str.trim().startsWith('[');
    } catch {
      return false;
    }
  }

  parse(raw: Uint8Array | string): VaultRawEvent[] {
    const str = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const trimmed = str.trim();

    // Handle newline-delimited JSON (one event per line)
    if (trimmed.includes('\n') && !trimmed.startsWith('[')) {
      const lines = trimmed.split('\n').filter((l) => l.trim());
      return lines
        .map((line) => {
          try {
            return JSON.parse(line) as VaultRawEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is VaultRawEvent => e !== null);
    }

    // Handle JSON array or single object
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as VaultRawEvent[];
      return [parsed as VaultRawEvent];
    } catch {
      return [];
    }
  }
}

/**
 * Binary frame parser placeholder — for raw manufacturer protocol frames.
 * Once official protocol docs arrive, implement the frame format here:
 * - Header parsing (magic bytes, frame type, payload length)
 * - Payload decoding (sensor channel, value, timestamp)
 * - Checksum validation
 */
export class BinaryFrameParser implements SensorProtocolParser {
  name = 'FleetVu Binary Frame (Placeholder)';
  protocolVersion = '0.0-pending';

  matches(raw: Uint8Array | string): boolean {
    if (typeof raw === 'string') return false;
    // Placeholder: check for a magic byte prefix
    // Real implementation will match the manufacturer's frame header
    return raw.length >= 4 && raw[0] === 0xf5;
  }

  parse(raw: Uint8Array | string): VaultRawEvent[] {
    // Placeholder — will be implemented once protocol docs arrive
    // The interface is stable; only the parsing logic changes
    return [];
  }
}

// Registry of available parsers — tried in order
const PARSERS: SensorProtocolParser[] = [
  new BinaryFrameParser(),
  new JsonSensorParser(),
];

/**
 * Auto-detect the correct parser for incoming raw data.
 * Tries each parser's matches() method in order.
 */
export function detectParser(raw: Uint8Array | string): SensorProtocolParser {
  for (const parser of PARSERS) {
    if (parser.matches(raw)) return parser;
  }
  // Fallback to JSON parser (most permissive)
  return new JsonSensorParser();
}

/**
 * Parse raw sensor data using the detected parser.
 */
export function parseSensorData(
  raw: Uint8Array | string,
  preferredParser?: SensorProtocolParser,
): ParseResult {
  const parser = preferredParser ?? detectParser(raw);
  const rawByteCount = typeof raw === 'string' ? raw.length : raw.length;
  const errors: string[] = [];

  let events: VaultRawEvent[] = [];
  try {
    events = parser.parse(raw);
    if (events.length === 0) {
      errors.push('Parser produced zero events');
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Parse error');
  }

  return { events, parserName: parser.name, rawByteCount, errors };
}

/**
 * Full ingestion pipeline: parse → canonicalize → hash → seal → persist.
 * Returns the sealed block and ingestion metadata.
 */
export async function ingestSensorStream(
  raw: Uint8Array | string,
  blockSeq: number,
  prevHash: string | null,
  companyId: string | null,
  vehicleId: string | null,
  preferredParser?: SensorProtocolParser,
): Promise<IngestionResult> {
  const errors: string[] = [];

  // Step 1: Parse raw data into structured events
  const parseResult = parseSensorData(raw, preferredParser);
  errors.push(...parseResult.errors);

  if (parseResult.events.length === 0) {
    return {
      block: null,
      eventsIngested: 0,
      hashChain: prevHash || '',
      errors,
    };
  }

  // Step 2: Seal events into a Merkle chain block
  let block: VaultEventBlock;
  try {
    block = await sealEventBlock(
      parseResult.events,
      blockSeq,
      prevHash,
      companyId,
      vehicleId,
    );
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Seal error');
    return {
      block: null,
      eventsIngested: 0,
      hashChain: prevHash || '',
      errors,
    };
  }

  // Step 3: Persist the sealed block to Supabase
  try {
    const { error: insertError } = await supabase
      .from('vault_event_blocks')
      .insert({
        id: block.id,
        block_seq: block.block_seq,
        company_id: block.company_id,
        vehicle_id: block.vehicle_id,
        event_count: block.event_count,
        payload_hash: block.payload_hash,
        prev_hash: block.prev_hash,
        record_hash: block.record_hash,
        merkle_root: block.merkle_root,
        sealed_at: block.sealed_at,
        created_at: block.created_at,
      });

    if (insertError) {
      errors.push(`Persist error: ${insertError.message}`);
    } else {
      // Litigation-grade custody touchpoint at seal time (best-effort)
      try {
        const { sealCustodyEvent } = await import('@/lib/forensics/chain-of-custody');
        const custody = await sealCustodyEvent({
          artifactType: 'vault_event_block',
          artifactId: block.id,
          companyId: companyId,
          action: 'sealed',
          actor: {
            accountId: null,
            email: 'ingestion-pipeline@fleetvu.org',
            role: 'system',
          },
          device: {
            deviceId: vehicleId || 'ingestion',
            platform: 'sensor-parser',
            appVersion: '1.0.0',
          },
          artifactHash: block.record_hash,
          previousHash: block.prev_hash,
          metadata: { block_seq: block.block_seq, event_count: block.event_count },
        });
        await supabase.from('chain_of_custody_events').insert({
          id: custody.id,
          seq: custody.seq,
          artifact_type: custody.artifact_type,
          artifact_id: custody.artifact_id,
          company_id: custody.company_id,
          action: custody.action,
          actor_account_id: custody.actor_account_id,
          actor_email: custody.actor_email,
          actor_role: custody.actor_role,
          device_id: custody.device_id,
          device_platform: custody.device_platform,
          app_version: custody.app_version,
          network_timestamp: custody.network_timestamp,
          server_timestamp: custody.server_timestamp,
          artifact_hash: custody.artifact_hash,
          prev_hash: custody.prev_hash,
          record_hash: custody.record_hash,
          metadata: custody.metadata,
        });
      } catch {
        /* custody table may be pending migration */
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Persist error');
  }

  // Step 4: Also persist individual telemetry events
  try {
    const telemetryRows = parseResult.events.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    }));

    const { error: telemetryError } = await supabase
      .from('telemetry_events')
      .insert(telemetryRows);

    if (telemetryError) {
      errors.push(`Telemetry persist error: ${telemetryError.message}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Telemetry persist error');
  }

  return {
    block,
    eventsIngested: parseResult.events.length,
    hashChain: block.record_hash,
    errors,
  };
}

/**
 * Verify the integrity of an ingestion by re-hashing the canonical form.
 */
export async function verifyIngestion(
  events: VaultRawEvent[],
  expectedHash: string,
): Promise<boolean> {
  const canonical = canonicalizeEvents(events);
  const actualHash = await sha256(canonical);
  return actualHash === expectedHash;
}
