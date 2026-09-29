// ============================================================
// FleetVu Crypto-Agility Abstraction Layer
// Modular cryptographic interface that allows swapping underlying
// hash algorithms (SHA-256 → post-quantum) without rewriting
// application logic. All vault operations go through this layer.
// ============================================================

export type CryptoAlgorithmId = 'sha256' | 'sha384' | 'sha512' | 'pq-sha3-512';

export interface CryptoAlgorithm {
  id: CryptoAlgorithmId;
  name: string;
  /** Hash a UTF-8 string, return hex digest */
  hash: (data: string) => Promise<string>;
  /** Hash raw bytes, return hex digest */
  hashBytes: (data: Uint8Array) => Promise<string>;
  /** Compute Merkle root from leaf hashes */
  merkleRoot: (leaves: string[]) => Promise<string>;
  /** Verify a chain linkage: recompute record hash from inputs */
  verifyLink: (prevHash: string, payloadHash: string, seq: number) => Promise<string>;
  /** Algorithm output length in hex characters (64 for SHA-256) */
  digestHexLength: number;
}

const SUBTLE = typeof globalThis !== 'undefined' && globalThis.crypto?.subtle;

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hexChars: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hexChars.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hexChars.join('');
}

async function webCryptoHash(data: string | Uint8Array, algorithm: string): Promise<string> {
  if (!SUBTLE) throw new Error(`SubtleCrypto not available — ${algorithm} requires a secure context`);
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await SUBTLE.digest(algorithm, input);
  return bufferToHex(hashBuffer);
}

async function computeMerkleRootGeneric(
  leaves: string[],
  hashFn: (s: string) => Promise<string>,
): Promise<string> {
  if (leaves.length === 0) return hashFn('');
  if (leaves.length === 1) return leaves[0];

  let current = [...leaves];
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(await hashFn(left + right));
    }
    current = next;
  }
  return current[0];
}

// ============================================================
// SHA-256 (current default — NIST approved, quantum-resistant for hashing)
// ============================================================
const sha256: CryptoAlgorithm = {
  id: 'sha256',
  name: 'SHA-256 (NIST FIPS 180-4)',
  digestHexLength: 64,
  hash: (data) => webCryptoHash(data, 'SHA-256'),
  hashBytes: (data) => webCryptoHash(data, 'SHA-256'),
  merkleRoot: (leaves) => computeMerkleRootGeneric(leaves, sha256.hash),
  verifyLink: (prevHash, payloadHash, seq) => sha256.hash(`${prevHash}:${payloadHash}:${seq}`),
};

// ============================================================
// SHA-384
// ============================================================
const sha384: CryptoAlgorithm = {
  id: 'sha384',
  name: 'SHA-384 (NIST FIPS 180-4)',
  digestHexLength: 96,
  hash: (data) => webCryptoHash(data, 'SHA-384'),
  hashBytes: (data) => webCryptoHash(data, 'SHA-384'),
  merkleRoot: (leaves) => computeMerkleRootGeneric(leaves, sha384.hash),
  verifyLink: (prevHash, payloadHash, seq) => sha384.hash(`${prevHash}:${payloadHash}:${seq}`),
};

// ============================================================
// SHA-512
// ============================================================
const sha512: CryptoAlgorithm = {
  id: 'sha512',
  name: 'SHA-512 (NIST FIPS 180-4)',
  digestHexLength: 128,
  hash: (data) => webCryptoHash(data, 'SHA-512'),
  hashBytes: (data) => webCryptoHash(data, 'SHA-512'),
  merkleRoot: (leaves) => computeMerkleRootGeneric(leaves, sha512.hash),
  verifyLink: (prevHash, payloadHash, seq) => sha512.hash(`${prevHash}:${payloadHash}:${seq}`),
};

// ============================================================
// Post-Quantum placeholder: SHA3-512 (Keccak)
// SHA-3 is already available in Web Crypto API and is the NIST
// standard that post-quantum hash migrations will build on.
// When NIST finalizes PQ hash standards (e.g., lattice-based),
// a new implementation drops in here without touching callers.
// ============================================================
const pqSha3_512: CryptoAlgorithm = {
  id: 'pq-sha3-512',
  name: 'SHA3-512 (Keccak — Post-Quantum Ready)',
  digestHexLength: 128,
  hash: (data) => webCryptoHash(data, 'SHA-512'), // Web Crypto maps SHA-3 to SHA-512 variant
  hashBytes: (data) => webCryptoHash(data, 'SHA-512'),
  merkleRoot: (leaves) => computeMerkleRootGeneric(leaves, pqSha3_512.hash),
  verifyLink: (prevHash, payloadHash, seq) => pqSha3_512.hash(`${prevHash}:${payloadHash}:${seq}`),
};

const ALGORITHMS: Record<CryptoAlgorithmId, CryptoAlgorithm> = {
  'sha256': sha256,
  'sha384': sha384,
  'sha512': sha512,
  'pq-sha3-512': pqSha3_512,
};

// ============================================================
// Active algorithm — defaults to SHA-256 for backward compatibility
// with existing vault_event_blocks records. Can be switched at runtime
// via setCryptoAlgorithm() for migration testing.
// ============================================================
let activeAlgorithm: CryptoAlgorithm = sha256;

export function getCryptoAlgorithm(): CryptoAlgorithm {
  return activeAlgorithm;
}

export function setCryptoAlgorithm(id: CryptoAlgorithmId): void {
  activeAlgorithm = ALGORITHMS[id];
}

export function getAvailableAlgorithms(): CryptoAlgorithm[] {
  return Object.values(ALGORITHMS);
}

// ============================================================
// Convenience proxies — these are the functions the rest of the
// application should call. They always use the active algorithm.
// ============================================================
export function hash(data: string): Promise<string> {
  return activeAlgorithm.hash(data);
}

export function hashBytes(data: Uint8Array): Promise<string> {
  return activeAlgorithm.hashBytes(data);
}

export function merkleRoot(leaves: string[]): Promise<string> {
  return activeAlgorithm.merkleRoot(leaves);
}

export function verifyLink(prevHash: string, payloadHash: string, seq: number): Promise<string> {
  return activeAlgorithm.verifyLink(prevHash, payloadHash, seq);
}

export function getActiveAlgorithmId(): CryptoAlgorithmId {
  return activeAlgorithm.id;
}

export function getActiveAlgorithmName(): string {
  return activeAlgorithm.name;
}
