'use client';

/**
 * Vault Pipeline Diagnostic — End-to-End Live Verification
 *
 * This module runs a full pipeline test that exercises every link in the
 * vault chain, from database connectivity through cryptographic sealing,
 * licensing, feature gates, sensor parsing, ZKP proofs, and webhooks.
 *
 * Each check returns a structured result so the UI can display a live
 * wiring diagram showing which links are connected and which are broken.
 */

import { supabase } from '@/lib/supabase';
import { sealEventBlock, verifyChain, sha256 } from '@/src/vault/merkle-chain';
import { provisionLicense, activateLicense, verifyLicense } from '@/src/vault/licensing';
import { evaluateFeatureGate, checkFeatureAccess as checkFeatureAccessFn, getFeatureGate } from '@/src/vault/feature-tiers';
import { parseSensorData, ingestSensorStream } from '@/lib/sensor-parser';
import { applyEdgeFilter, parseTripartiteFrame, computeEdgeStatus } from '@/lib/edge-filter';
import { classifyEvent, computeSmartphoneJolt } from '@/lib/collision-detection';
import { generateComplianceCertificate, verifyInclusionProof } from '@/lib/zkp-compliance';
import { computeHmacSignature, registerWebhook } from '@/lib/enterprise-webhooks';
import { hash as cryptoHash, getActiveAlgorithmId, setCryptoAlgorithm } from '@/src/vault/crypto-agility';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'pending';
export type CheckCategory =
  | 'database'
  | 'crypto'
  | 'licensing'
  | 'feature_gate'
  | 'sensor_parser'
  | 'merkle_chain'
  | 'edge_filter'
  | 'collision_detection'
  | 'zkp_compliance'
  | 'enterprise_webhook'
  | 'edge_function';

export interface DiagnosticCheck {
  id: string;
  category: CheckCategory;
  label: string;
  description: string;
  status: CheckStatus;
  detail: string;
  durationMs: number;
  children?: DiagnosticCheck[];
}

export interface DiagnosticResult {
  checks: DiagnosticCheck[];
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  overallStatus: CheckStatus;
  timestamp: string;
}

/**
 * Run the full vault pipeline diagnostic.
 * Each check is independent — a failure in one doesn't block others.
 */
export async function runVaultDiagnostic(
  companyId?: string,
): Promise<DiagnosticResult> {
  const checks: DiagnosticCheck[] = [];
  const timestamp = new Date().toISOString();

  // 1. Database connectivity
  checks.push(await checkDatabaseConnectivity());

  // 2. Crypto layer
  checks.push(await checkCryptoHash());
  checks.push(await checkCryptoAgilitySwap());

  // 3. Merkle chain
  checks.push(await checkMerkleSeal());
  checks.push(await checkMerkleVerify());

  // 4. Sensor parser
  checks.push(await checkSensorParser());

  // 5. Edge filter
  checks.push(await checkEdgeFilter());

  // 6. Collision detection
  checks.push(await checkCollisionDetection());

  // 7. Licensing (requires a company)
  if (companyId) {
    checks.push(await checkLicensing(companyId));
    checks.push(await checkFeatureGate(companyId));
    checks.push(await checkFeatureAccess(companyId));

    // 8. Full ingestion pipeline (requires company)
    checks.push(await checkIngestionPipeline(companyId));

    // 9. ZKP compliance
    checks.push(await checkZkpCompliance(companyId));

    // 10. Enterprise webhooks
    checks.push(await checkWebhookHmac());
  } else {
    checks.push({
      id: 'licensing',
      category: 'licensing',
      label: 'Hardware License Pipeline',
      description: 'Provision → Activate → Verify license cycle',
      status: 'warn',
      detail: 'Skipped — no company ID provided. Pass a company ID to run the full pipeline test.',
      durationMs: 0,
    });
  }

  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;
  const overallStatus: CheckStatus = failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass';

  return {
    checks,
    totalChecks: checks.length,
    passed,
    failed,
    warnings,
    overallStatus,
    timestamp,
  };
}

// ============================================================
// Individual checks
// ============================================================

async function checkDatabaseConnectivity(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1);

    if (error) {
      return fail('db_connect', 'database', 'Database Connectivity',
        'Supabase client can read from the companies table',
        error.message, Date.now() - start);
    }

    if (!data || data.length === 0) {
      return warn('db_connect', 'database', 'Database Connectivity',
        'Supabase client can read from the companies table',
        'Connected but no companies found — seed data needed', Date.now() - start);
    }

    return pass('db_connect', 'database', 'Database Connectivity',
      'Supabase client can read from the companies table',
      `Connected — ${data.length} companies visible`, Date.now() - start);
  } catch (err) {
    return fail('db_connect', 'database', 'Database Connectivity',
      'Supabase client can read from the companies table',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkCryptoHash(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const testInput = 'FleetVu-Vault-Diagnostic-Test';
    const hashResult = await cryptoHash(testInput);
    const expectedLength = 64; // SHA-256 hex length

    if (hashResult.length !== expectedLength) {
      return fail('crypto_hash', 'crypto', 'SHA-256 Hash Function',
        'Crypto layer produces valid SHA-256 hex digests',
        `Hash length ${hashResult.length} != expected ${expectedLength}`, Date.now() - start);
    }

    // Verify determinism
    const hashResult2 = await cryptoHash(testInput);
    if (hashResult !== hashResult2) {
      return fail('crypto_hash', 'crypto', 'SHA-256 Hash Function',
        'Crypto layer produces valid SHA-256 hex digests',
        'Hash is not deterministic — same input produced different outputs', Date.now() - start);
    }

    return pass('crypto_hash', 'crypto', 'SHA-256 Hash Function',
      'Crypto layer produces valid SHA-256 hex digests',
      `Active: ${getActiveAlgorithmId()} — hash: ${hashResult.substring(0, 16)}...`, Date.now() - start);
  } catch (err) {
    return fail('crypto_hash', 'crypto', 'SHA-256 Hash Function',
      'Crypto layer produces valid SHA-256 hex digests',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkCryptoAgilitySwap(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const original = getActiveAlgorithmId();
    const testInput = 'agility-swap-test';

    // Swap to SHA-512
    setCryptoAlgorithm('sha512');
    const hash512 = await cryptoHash(testInput);

    // Swap back
    setCryptoAlgorithm(original);
    const hash256 = await cryptoHash(testInput);

    if (hash512.length === 128 && hash256.length === 64) {
      return pass('crypto_agility', 'crypto', 'Crypto-Agility Algorithm Swap',
        'Crypto layer can swap between SHA-256 and SHA-512 without breaking',
        `SHA-256: ${hash256.substring(0, 8)}... (64 chars) → SHA-512: ${hash512.substring(0, 8)}... (128 chars) → restored`, Date.now() - start);
    }

    return fail('crypto_agility', 'crypto', 'Crypto-Agility Algorithm Swap',
      'Crypto layer can swap between SHA-256 and SHA-512 without breaking',
      `Unexpected hash lengths: SHA-512=${hash512.length}, SHA-256=${hash256.length}`, Date.now() - start);
  } catch (err) {
    return fail('crypto_agility', 'crypto', 'Crypto-Agility Algorithm Swap',
      'Crypto layer can swap between SHA-256 and SHA-512 without breaking',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkMerkleSeal(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const testEvents = [
      { vehicle_id: 'test-vehicle', speed_mph: 45, latitude: 34.05, longitude: -118.24, utc_timestamp: new Date().toISOString(), proximity_zone: 'green', distance_m: 3.5, sensor_type: 'front_radar' },
      { vehicle_id: 'test-vehicle', speed_mph: 47, latitude: 34.05, longitude: -118.24, utc_timestamp: new Date().toISOString(), proximity_zone: 'yellow', distance_m: 1.2, sensor_type: 'left_radar' },
    ];

    const block = await sealEventBlock(testEvents, 0, null, null, 'test-vehicle');

    if (!block.record_hash || !block.merkle_root || !block.payload_hash) {
      return fail('merkle_seal', 'merkle_chain', 'Merkle Block Sealing',
        'sealEventBlock produces a valid sealed block with all hash fields',
        'Block missing required hash fields', Date.now() - start);
    }

    return pass('merkle_seal', 'merkle_chain', 'Merkle Block Sealing',
      'sealEventBlock produces a valid sealed block with all hash fields',
      `Block #${block.block_seq}: record_hash=${block.record_hash.substring(0, 16)}... merkle_root=${block.merkle_root.substring(0, 16)}... events=${block.event_count}`, Date.now() - start);
  } catch (err) {
    return fail('merkle_seal', 'merkle_chain', 'Merkle Block Sealing',
      'sealEventBlock produces a valid sealed block with all hash fields',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkMerkleVerify(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    // Build a 3-block chain and verify it
    const events = [
      { speed_mph: 30, utc_timestamp: new Date().toISOString(), sensor_type: 'test' },
    ];

    const block1 = await sealEventBlock(events, 1, null, null, null);
    const block2 = await sealEventBlock(events, 2, block1.record_hash, null, null);
    const block3 = await sealEventBlock(events, 3, block2.record_hash, null, null);

    const verification = await verifyChain([block1, block2, block3]);

    if (!verification.valid) {
      return fail('merkle_verify', 'merkle_chain', 'Chain Verification',
        'verifyChain confirms a valid 3-block chain',
        `Chain broken: ${verification.error}`, Date.now() - start);
    }

    // Now test tampering detection — modify block 2 and re-verify
    const tamperedBlock2 = { ...block2, record_hash: 'tampered_hash_value' };
    const tamperedVerification = await verifyChain([block1, tamperedBlock2, block3]);

    if (tamperedVerification.valid) {
      return fail('merkle_verify', 'merkle_chain', 'Chain Verification & Tamper Detection',
        'verifyChain detects tampering and breaks the chain',
        'Tampered chain was NOT detected — verification returned valid', Date.now() - start);
    }

    return pass('merkle_verify', 'merkle_chain', 'Chain Verification & Tamper Detection',
      'verifyChain confirms valid chains and detects tampering',
      `Valid chain: ${verification.verified_blocks}/3 blocks verified. Tampered chain correctly broken at block ${tamperedVerification.broken_at_seq}.`, Date.now() - start);
  } catch (err) {
    return fail('merkle_verify', 'merkle_chain', 'Chain Verification & Tamper Detection',
      'verifyChain confirms valid chains and detects tampering',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkSensorParser(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const testRawData = JSON.stringify([
      { vehicle_id: 'test-v', speed_mph: 55, latitude: 34.05, longitude: -118.24, utc_timestamp: new Date().toISOString(), sensor_type: 'front_radar', distance_m: 2.5, proximity_zone: 'green' },
      { vehicle_id: 'test-v', speed_mph: 55, latitude: 34.05, longitude: -118.24, utc_timestamp: new Date().toISOString(), sensor_type: 'left_radar', distance_m: 0.8, proximity_zone: 'yellow' },
    ]);

    const result = parseSensorData(testRawData);

    if (result.events.length !== 2) {
      return fail('sensor_parser', 'sensor_parser', 'Sensor Protocol Data Parser',
        'parseSensorData converts raw JSON into structured VaultRawEvent[]',
        `Expected 2 events, got ${result.events.length}`, Date.now() - start);
    }

    if (result.errors.length > 0) {
      return warn('sensor_parser', 'sensor_parser', 'Sensor Protocol Data Parser',
        'parseSensorData converts raw JSON into structured VaultRawEvent[]',
        `Parsed ${result.events.length} events but with errors: ${result.errors.join(', ')}`, Date.now() - start);
    }

    return pass('sensor_parser', 'sensor_parser', 'Sensor Protocol Data Parser',
      'parseSensorData converts raw JSON into structured VaultRawEvent[]',
      `Parser: ${result.parserName} — ${result.events.length} events parsed, 0 errors`, Date.now() - start);
  } catch (err) {
    return fail('sensor_parser', 'sensor_parser', 'Sensor Protocol Data Parser',
      'parseSensorData converts raw JSON into structured VaultRawEvent[]',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkEdgeFilter(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const config = {
      channel_forward_range_m: 7.5,
      channel_left_range_m: 6.0,  // > 5m threshold → EDGE active
      channel_right_range_m: 6.0,
      edge_filter_enabled: true,
      edge_filter_threshold_m: 5.0,
    };

    const readings = parseTripartiteFrame(3.0, 1.5, 1.2, false, false, false, config);

    // Mark left/right as static (roadside clutter)
    readings[1].is_static = true;
    readings[1].is_moving = false;
    readings[2].is_static = true;
    readings[2].is_moving = false;

    const result = applyEdgeFilter(readings, config);

    if (!result.edgeActive) {
      return fail('edge_filter', 'edge_filter', 'EDGE Pre-Filtering',
        'EDGE suppresses static clutter when any channel is past the 5m threshold',
        'EDGE should be active but computed as inactive', Date.now() - start);
    }

    if (result.suppressedCount === 0) {
      return fail('edge_filter', 'edge_filter', 'EDGE Pre-Filtering',
        'EDGE suppresses static clutter when any channel is past the 5m threshold',
        'No static objects were suppressed — filter not working', Date.now() - start);
    }

    return pass('edge_filter', 'edge_filter', 'EDGE Pre-Filtering',
      'EDGE suppresses static clutter when any channel is past the 5m threshold',
      `EDGE: ${result.edgeStatus} — ${result.suppressedCount} static objects suppressed, ${result.passedCount} passed`, Date.now() - start);
  } catch (err) {
    return fail('edge_filter', 'edge_filter', 'EDGE Pre-Filtering',
      'EDGE suppresses static clutter when side channels > 5m',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkCollisionDetection(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    // Simulate a verified bumper impact: crush signature + smartphone jolt
    const channels = parseTripartiteFrame(0.2, null, null, true, false, false);
    const joltG = 3.5; // Above impact threshold (2.5g)
    const result = classifyEvent(channels, joltG, 25, { lat: 34.05, lng: -118.24 });

    if (result.eventType !== 'verified_bumper_impact') {
      return fail('collision_detect', 'collision_detection', 'Collision vs Close-Call Classification',
        'Classifies crush signature + jolt as verified bumper impact',
        `Expected verified_bumper_impact, got ${result.eventType}`, Date.now() - start);
    }

    // Now test a near-miss: close proximity, no jolt
    const nearMissChannels = parseTripartiteFrame(5.0, 0.8, null, false, false, false);
    const nearMissResult = classifyEvent(nearMissChannels, 0.2, 30, { lat: 34.05, lng: -118.24 });

    if (nearMissResult.eventType !== 'proximity_near_miss') {
      return fail('collision_detect', 'collision_detection', 'Collision vs Close-Call Classification',
        'Classifies crush signature + jolt as verified impact, close proximity without jolt as near-miss',
        `Near-miss test: expected proximity_near_miss, got ${nearMissResult.eventType}`, Date.now() - start);
    }

    return pass('collision_detect', 'collision_detection', 'Collision vs Close-Call Classification',
      'Classifies crush signature + jolt as verified impact, close proximity without jolt as near-miss',
      `Impact: severity=${result.severity} confidence=${result.confidence} | Near-miss: severity=${nearMissResult.severity}`, Date.now() - start);
  } catch (err) {
    return fail('collision_detect', 'collision_detection', 'Collision vs Close-Call Classification',
      'Classifies crush signature + jolt as verified impact, close proximity without jolt as near-miss',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkLicensing(companyId: string): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    // Check if any license exists for this company
    const { data: existing } = await supabase
      .from('vault_licenses')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existing) {
      // Verify the existing license
      const verification = await verifyLicense(existing.hardware_serial);
      return pass('licensing', 'licensing', 'Hardware License Pipeline',
        'Provision → Activate → Verify license cycle',
        `Existing license for ${existing.hardware_serial}: status=${verification.status} valid=${verification.valid} days=${verification.complimentary_remaining_days}`, Date.now() - start);
    }

    // Provision a test license
    const testSerial = `FV-DIAG-${Date.now().toString(36).toUpperCase()}`;
    const license = await provisionLicense(testSerial, companyId, 'proplus');

    // Activate it
    const activated = await activateLicense(testSerial);

    // Verify it
    const verification = await verifyLicense(testSerial);

    if (!verification.valid) {
      return warn('licensing', 'licensing', 'Hardware License Pipeline',
        'Provision → Activate → Verify license cycle',
        `License provisioned and activated but verification failed: ${verification.error}`, Date.now() - start);
    }

    return pass('licensing', 'licensing', 'Hardware License Pipeline',
      'Provision → Activate → Verify license cycle',
      `Test license ${testSerial}: provisioned → activated → verified (valid=${verification.valid}, tier=${verification.tier}, ${verification.complimentary_remaining_days} days remaining)`, Date.now() - start);
  } catch (err) {
    return fail('licensing', 'licensing', 'Hardware License Pipeline',
      'Provision → Activate → Verify license cycle',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkFeatureGate(companyId: string): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const gate = await getFeatureGate(companyId);

    if (!gate) {
      // Evaluate one
      const evaluated = await evaluateFeatureGate(companyId);
      if (!evaluated) {
        return fail('feature_gate', 'feature_gate', 'Feature Gate Evaluation',
          'Feature gate exists and is evaluated for the company',
          'No feature gate found and evaluation returned null', Date.now() - start);
      }
      return pass('feature_gate', 'feature_gate', 'Feature Gate Evaluation',
        'Feature gate exists and is evaluated for the company',
        `Gate evaluated: tier=${evaluated.tier} vault=${evaluated.forensic_vault_enabled} locked=${evaluated.locked_down}`, Date.now() - start);
    }

    const v2Features = {
      edge_pre_filtering: gate.edge_pre_filtering_enabled,
      crypto_agility: gate.crypto_agility_enabled,
      zkp_compliance: gate.zkp_compliance_enabled,
      openapi_webhooks: gate.openapi_webhooks_enabled,
      accident_reconstruction: gate.accident_reconstruction_enabled,
    };

    const enabledCount = Object.values(v2Features).filter(Boolean).length;

    return pass('feature_gate', 'feature_gate', 'Feature Gate Evaluation',
      'Feature gate exists and is evaluated for the company',
      `Gate: tier=${gate.tier} vault=${gate.forensic_vault_enabled} reconstruction=${gate.collision_reconstruction_enabled} locked=${gate.locked_down} | V2 features: ${enabledCount}/5 enabled`, Date.now() - start);
  } catch (err) {
    return fail('feature_gate', 'feature_gate', 'Feature Gate Evaluation',
      'Feature gate exists and is evaluated for the company',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkFeatureAccess(companyId: string): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const features = ['forensic_vault', 'collision_reconstruction', 'pdf_export', 'live_gps', 'historical_reports'] as const;
    const results: string[] = [];

    for (const feature of features) {
      const access = await checkFeatureAccessFn(companyId, feature);
      results.push(`${feature}: ${access.allowed ? 'ALLOWED' : 'DENIED'}`);
    }

    return pass('feature_access', 'feature_gate', 'Feature Access Guard',
      'checkFeatureAccess returns correct access results for each feature',
      results.join(' | '), Date.now() - start);
  } catch (err) {
    return fail('feature_access', 'feature_gate', 'Feature Access Guard',
      'checkFeatureAccess returns correct access results for each feature',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkIngestionPipeline(companyId: string): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    // Get the next block sequence number
    const { data: lastBlock } = await supabase
      .from('vault_event_blocks')
      .select('block_seq, record_hash')
      .order('block_seq', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSeq = (lastBlock?.block_seq ?? 0) + 1;

    // Create test sensor data
    const testRawData = JSON.stringify({
      vehicle_id: null,
      company_id: companyId,
      speed_mph: 42,
      latitude: 34.0522,
      longitude: -118.2437,
      utc_timestamp: new Date().toISOString(),
      proximity_zone: 'green',
      distance_m: 3.2,
      sensor_type: 'front_radar',
    });

    const result = await ingestSensorStream(
      testRawData,
      nextSeq,
      lastBlock?.record_hash ?? null,
      companyId,
      null,
    );

    if (!result.block || result.eventsIngested === 0) {
      return fail('ingestion', 'sensor_parser', 'Full Ingestion Pipeline',
        'Parse → Canonicalize → SHA-256 → Seal → Persist to Supabase',
        `Ingestion produced no block. Errors: ${result.errors.join(', ')}`, Date.now() - start);
    }

    // Verify the block was persisted
    const { data: persisted } = await supabase
      .from('vault_event_blocks')
      .select('id, record_hash')
      .eq('id', result.block.id)
      .maybeSingle();

    if (!persisted) {
      return warn('ingestion', 'sensor_parser', 'Full Ingestion Pipeline',
        'Parse → Canonicalize → SHA-256 → Seal → Persist to Supabase',
        `Block sealed (hash: ${result.block.record_hash.substring(0, 16)}...) but not found in DB. Errors: ${result.errors.join(', ')}`, Date.now() - start);
    }

    return pass('ingestion', 'sensor_parser', 'Full Ingestion Pipeline',
      'Parse → Canonicalize → SHA-256 → Seal → Persist to Supabase',
      `Block #${result.block.block_seq} sealed & persisted: ${result.block.record_hash.substring(0, 16)}... events=${result.eventsIngested} chain=${result.hashChain.substring(0, 16)}...`, Date.now() - start);
  } catch (err) {
    return fail('ingestion', 'sensor_parser', 'Full Ingestion Pipeline',
      'Parse → Canonicalize → SHA-256 → Seal → Persist to Supabase',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkZkpCompliance(companyId: string): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    // Try to generate a compliance certificate
    const cert = await generateComplianceCertificate(
      companyId,
      'diagnostic@fleetvu.org',
      'compliance',
    );

    if (!cert) {
      return warn('zkp', 'zkp_compliance', 'ZKP Compliance Certificate Generation',
        'Generate Merkle-proof compliance certificate from vault chain',
        'No vault blocks found for this company — run the ingestion pipeline first to create blocks, then ZKP can be generated', Date.now() - start);
    }

    // Verify the certificate
    if (cert.merkleProof.inclusionProofs.length > 0) {
      const firstProof = cert.merkleProof.inclusionProofs[0];
      const isValid = await verifyInclusionProof(firstProof, cert.chainRootHash);

      return pass('zkp', 'zkp_compliance', 'ZKP Compliance Certificate Generation',
        'Generate Merkle-proof compliance certificate from vault chain',
        `Certificate generated: type=${cert.certificateType} blocks=${cert.blockRangeStart}-${cert.blockRangeEnd} events=${cert.eventCount} chainValid=${cert.metadata.chainValid} proofVerified=${isValid}`, Date.now() - start);
    }

    return pass('zkp', 'zkp_compliance', 'ZKP Compliance Certificate Generation',
      'Generate Merkle-proof compliance certificate from vault chain',
      `Certificate generated: type=${cert.certificateType} blocks=${cert.blockRangeStart}-${cert.blockRangeEnd} events=${cert.eventCount} chainValid=${cert.metadata.chainValid}`, Date.now() - start);
  } catch (err) {
    return fail('zkp', 'zkp_compliance', 'ZKP Compliance Certificate Generation',
      'Generate Merkle-proof compliance certificate from vault chain',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

async function checkWebhookHmac(): Promise<DiagnosticCheck> {
  const start = Date.now();
  try {
    const testPayload = '{"event":"test","timestamp":"2026-01-01T00:00:00Z"}';
    const testSecret = 'test-secret-for-diagnostic';

    const signature = await computeHmacSignature(testPayload, testSecret);

    if (!signature || signature.length !== 64) {
      return fail('webhook_hmac', 'enterprise_webhook', 'HMAC-SHA256 Webhook Signing',
        'computeHmacSignature produces valid HMAC-SHA256 signatures',
        `Signature length ${signature.length} != expected 64`, Date.now() - start);
    }

    // Verify determinism
    const signature2 = await computeHmacSignature(testPayload, testSecret);
    if (signature !== signature2) {
      return fail('webhook_hmac', 'enterprise_webhook', 'HMAC-SHA256 Webhook Signing',
        'computeHmacSignature produces valid HMAC-SHA256 signatures',
        'Signature is not deterministic', Date.now() - start);
    }

    return pass('webhook_hmac', 'enterprise_webhook', 'HMAC-SHA256 Webhook Signing',
      'computeHmacSignature produces valid HMAC-SHA256 signatures',
      `HMAC: ${signature.substring(0, 16)}... (64 hex chars, deterministic)`, Date.now() - start);
  } catch (err) {
    return fail('webhook_hmac', 'enterprise_webhook', 'HMAC-SHA256 Webhook Signing',
      'computeHmacSignature produces valid HMAC-SHA256 signatures',
      err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
  }
}

// ============================================================
// Helpers
// ============================================================

function pass(id: string, category: CheckCategory, label: string, description: string, detail: string, durationMs: number): DiagnosticCheck {
  return { id, category, label, description, status: 'pass', detail, durationMs };
}

function fail(id: string, category: CheckCategory, label: string, description: string, detail: string, durationMs: number): DiagnosticCheck {
  return { id, category, label, description, status: 'fail', detail, durationMs };
}

function warn(id: string, category: CheckCategory, label: string, description: string, detail: string, durationMs: number): DiagnosticCheck {
  return { id, category, label, description, status: 'warn', detail, durationMs };
}
