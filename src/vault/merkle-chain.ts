// ============================================================
// FleetVu Forensic Vault — SHA-256 Merkle-Chain Engine
// Pure cryptographic sealing logic — zero external dependencies
// ============================================================

import type {
  VaultRawEvent,
  VaultEventBlock,
  VaultChainVerification,
} from './types';

/**
 * Hash a UTF-8 string via the crypto-agility layer (default SHA-256).
 */
export async function sha256(data: string): Promise<string> {
  const { getCryptoAlgorithm } = await import('./crypto-agility');
  return getCryptoAlgorithm().hash(data);
}

/**
 * Hash a raw byte array with the active crypto-agile algorithm and return hex digest.
 */
export async function sha256Bytes(data: Uint8Array): Promise<string> {
  const { getCryptoAlgorithm } = await import('./crypto-agility');
  return getCryptoAlgorithm().hashBytes(data);
}

/**
 * Compute the Merkle root from a list of leaf hashes.
 * If the list is empty, returns SHA-256 of empty string.
 * Pairs are hashed together level by level; odd nodes are promoted.
 */
export async function computeMerkleRoot(leafHashes: string[]): Promise<string> {
  if (leafHashes.length === 0) {
    return sha256('');
  }
  if (leafHashes.length === 1) {
    return leafHashes[0];
  }

  let currentLevel = [...leafHashes];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : currentLevel[i];
      nextLevel.push(await sha256(left + right));
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Serialize raw events into a canonical JSON string for hashing.
 * Keys are sorted to ensure deterministic output across runtimes.
 */
export function canonicalizeEvents(events: VaultRawEvent[]): string {
  return JSON.stringify(
    events.map((e) => sortKeysDeep(e)),
  );
}

function sortKeysDeep(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Build a single sealed block from a batch of raw events.
 * Links to the previous block's record_hash to form the chain.
 *
 * @param events - Raw telemetry events to seal
 * @param blockSeq - Monotonic sequence number for this block
 * @param prevHash - Record hash of the previous block (null for genesis)
 * @param companyId - Owning fleet company ID
 * @param vehicleId - Source vehicle ID (optional)
 * @returns A VaultEventBlock ready to persist
 */
export async function sealEventBlock(
  events: VaultRawEvent[],
  blockSeq: number,
  prevHash: string | null,
  companyId: string | null,
  vehicleId: string | null,
): Promise<VaultEventBlock> {
  const payload = canonicalizeEvents(events);
  const payloadHash = await sha256(payload);

  // Compute individual event hashes for Merkle tree leaves
  const leafHashes = await Promise.all(
    events.map((e) => sha256(canonicalizeEvents([e]))),
  );
  const merkleRoot = await computeMerkleRoot(leafHashes);

  // record_hash = SHA-256(prev_hash + payload_hash + block_seq)
  const recordHash = await sha256(`${prevHash ?? ''}:${payloadHash}:${blockSeq}`);

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    block_seq: blockSeq,
    company_id: companyId,
    vehicle_id: vehicleId,
    event_count: events.length,
    payload_hash: payloadHash,
    prev_hash: prevHash,
    record_hash: recordHash,
    merkle_root: merkleRoot,
    sealed_at: now,
    created_at: now,
  };
}

/**
 * Verify the integrity of a chain of blocks.
 * Checks that each block's record_hash matches the recomputed hash,
 * and that prev_hash correctly links to the prior block's record_hash.
 *
 * @param blocks - Ordered list of blocks (ascending block_seq)
 * @returns Verification result with break point if invalid
 */
export async function verifyChain(
  blocks: VaultEventBlock[],
): Promise<VaultChainVerification> {
  if (blocks.length === 0) {
    return { valid: true, broken_at_seq: null, total_blocks: 0, verified_blocks: 0, error: null };
  }

  let prevHash: string | null = null;
  let verified = 0;

  for (const block of blocks) {
    // Check chain linkage
    if (block.prev_hash !== prevHash) {
      return {
        valid: false,
        broken_at_seq: block.block_seq,
        total_blocks: blocks.length,
        verified_blocks: verified,
        error: `Chain linkage broken at block ${block.block_seq}: prev_hash mismatch`,
      };
    }

    // Recompute record hash
    const expectedHash = await sha256(
      `${block.prev_hash ?? ''}:${block.payload_hash}:${block.block_seq}`,
    );

    if (block.record_hash !== expectedHash) {
      return {
        valid: false,
        broken_at_seq: block.block_seq,
        total_blocks: blocks.length,
        verified_blocks: verified,
        error: `Record hash mismatch at block ${block.block_seq}`,
      };
    }

    prevHash = block.record_hash;
    verified++;
  }

  return {
    valid: true,
    broken_at_seq: null,
    total_blocks: blocks.length,
    verified_blocks: verified,
    error: null,
  };
}
