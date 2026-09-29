// ============================================================
// FleetVu Forensic Vault — Public API Barrel
// All exports from /src/vault are funneled through this index.
// Consumers import from '@/src/vault' — never from individual modules.
// ============================================================

// Types
export type {
  VaultTier,
  VaultLicenseStatus,
  VaultFeature,
  VaultEventBlock,
  VaultRawEvent,
  VaultLicense,
  VaultFeatureGate,
  VaultChainVerification,
  VaultLicenseVerification,
  VaultFeatureAccessResult,
} from './types';

// Merkle-chain engine
export {
  sha256,
  sha256Bytes,
  computeMerkleRoot,
  canonicalizeEvents,
  sealEventBlock,
  verifyChain,
} from './merkle-chain';

// Hardware licensing middleware
export {
  generateLicenseKey,
  provisionLicense,
  activateLicense,
  verifyLicense,
  extendSubscription,
} from './licensing';

// Feature-tiering middleware
export {
  getFeatureGate,
  evaluateFeatureGate,
  checkFeatureAccess,
  getFeatureFlags,
} from './feature-tiers';

// Crypto-agility abstraction layer
export {
  getCryptoAlgorithm,
  setCryptoAlgorithm,
  getAvailableAlgorithms,
  hash as cryptoHash,
  hashBytes as cryptoHashBytes,
  merkleRoot as cryptoMerkleRoot,
  verifyLink as cryptoVerifyLink,
  getActiveAlgorithmId,
  getActiveAlgorithmName,
  type CryptoAlgorithmId,
  type CryptoAlgorithm,
} from './crypto-agility';
