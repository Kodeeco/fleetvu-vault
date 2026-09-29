/**
 * FleetVu Forensics — Public Barrel
 */

export {
  deriveEvidenceKey,
  generateEvidenceKey,
  encryptEvidence,
  decryptEvidence,
  sha256Hex,
  exportKeyHex,
  importKeyHex,
  generateSaltHex,
  type EncryptedEvidence,
} from './aes-vault';

export {
  sealCustodyEvent,
  verifyCustodyChain,
  type CustodyAction,
  type CustodyActor,
  type CustodyDevice,
  type CustodyEvent,
  type CustodyEventInput,
} from './chain-of-custody';

export {
  buildReconstructionSequence,
  verifyReconstructionPackage,
  type ReconstructionSample,
  type SequencedFrame,
  type ReconstructionPackage,
} from './reconstruction';

export {
  buildLegalExport,
  serializeLegalArtifact,
  verifyLegalArtifact,
  type LegalExportInput,
  type LegalExportManifest,
  type LegalExportArtifact,
} from './legal-export';
