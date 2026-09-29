/**
 * Exportable Legal Artifacts
 *
 * Packages logs, cryptographic verification hashes, and metadata into
 * tamper-evident formats ready for expert witness review and legal discovery.
 */

import { sha256Hex, encryptEvidence, generateEvidenceKey, exportKeyHex, type EncryptedEvidence } from './aes-vault';
import { verifyCustodyChain, type CustodyEvent } from './chain-of-custody';
import {
  verifyReconstructionPackage,
  type ReconstructionPackage,
} from './reconstruction';

export interface LegalExportInput {
  caseId: string;
  companyId: string | null;
  companyName: string | null;
  incidentId: string | null;
  exportedBy: {
    email: string;
    role: string;
    accountId?: string | null;
  };
  custodyEvents: CustodyEvent[];
  reconstruction?: ReconstructionPackage | null;
  eventLogs: Array<Record<string, unknown>>;
  vaultBlockHashes?: string[];
  notes?: string;
  /** Encrypt the artifact body with AES-256-GCM */
  encrypt?: boolean;
}

export interface LegalExportManifest {
  format: 'fleetvu-legal-artifact-v1';
  exportId: string;
  caseId: string;
  companyId: string | null;
  companyName: string | null;
  incidentId: string | null;
  exportedAt: string;
  exportedBy: LegalExportInput['exportedBy'];
  counts: {
    custodyEvents: number;
    eventLogs: number;
    reconstructionFrames: number;
    vaultBlocks: number;
  };
  integrity: {
    custodyChainValid: boolean;
    reconstructionValid: boolean | null;
    manifestHash: string;
    contentHash: string;
    custodyTipHash: string | null;
    reconstructionPackageHash: string | null;
  };
  notes: string | null;
}

export interface LegalExportArtifact {
  manifest: LegalExportManifest;
  /** Cleartext payload when encrypt=false */
  payload?: {
    custodyEvents: CustodyEvent[];
    eventLogs: Array<Record<string, unknown>>;
    reconstruction: ReconstructionPackage | null;
    vaultBlockHashes: string[];
  };
  /** Present when encrypt=true */
  encryptedPayload?: EncryptedEvidence;
  /** Hex key — caller must escrow securely; never log */
  encryptionKeyHex?: string;
  /** Dual verification seal over manifest + content */
  sealHash: string;
}

/**
 * Build a tamper-evident legal discovery package.
 */
export async function buildLegalExport(input: LegalExportInput): Promise<LegalExportArtifact> {
  const exportId = crypto.randomUUID();
  const exportedAt = new Date().toISOString();

  const custodyVerification = await verifyCustodyChain(input.custodyEvents);
  let reconstructionValid: boolean | null = null;
  if (input.reconstruction) {
    const rv = await verifyReconstructionPackage(input.reconstruction);
    reconstructionValid = rv.valid;
  }

  const contentBody = {
    custodyEvents: input.custodyEvents,
    eventLogs: input.eventLogs,
    reconstruction: input.reconstruction ?? null,
    vaultBlockHashes: input.vaultBlockHashes ?? [],
  };

  const contentHash = await sha256Hex(JSON.stringify(contentBody));

  const manifestWithoutHash: Omit<LegalExportManifest, 'integrity'> & {
    integrity: Omit<LegalExportManifest['integrity'], 'manifestHash'>;
  } = {
    format: 'fleetvu-legal-artifact-v1',
    exportId,
    caseId: input.caseId,
    companyId: input.companyId,
    companyName: input.companyName,
    incidentId: input.incidentId,
    exportedAt,
    exportedBy: input.exportedBy,
    counts: {
      custodyEvents: input.custodyEvents.length,
      eventLogs: input.eventLogs.length,
      reconstructionFrames: input.reconstruction?.frameCount ?? 0,
      vaultBlocks: input.vaultBlockHashes?.length ?? 0,
    },
    integrity: {
      custodyChainValid: custodyVerification.valid,
      reconstructionValid,
      contentHash,
      custodyTipHash: input.custodyEvents.length
        ? input.custodyEvents[input.custodyEvents.length - 1].record_hash
        : null,
      reconstructionPackageHash: input.reconstruction?.packageHash ?? null,
    },
    notes: input.notes ?? null,
  };

  const manifestHash = await sha256Hex(JSON.stringify(manifestWithoutHash));
  const manifest: LegalExportManifest = {
    ...manifestWithoutHash,
    integrity: {
      ...manifestWithoutHash.integrity,
      manifestHash,
    },
  };

  const sealHash = await sha256Hex(`${manifestHash}:${contentHash}`);

  if (input.encrypt) {
    const key = await generateEvidenceKey();
    const encryptedPayload = await encryptEvidence(JSON.stringify(contentBody), key);
    const encryptionKeyHex = await exportKeyHex(key);
    return {
      manifest,
      encryptedPayload,
      encryptionKeyHex,
      sealHash,
    };
  }

  return {
    manifest,
    payload: contentBody,
    sealHash,
  };
}

/**
 * Serialize artifact for download (JSON). Caller downloads as .fvlegal.json
 */
export function serializeLegalArtifact(artifact: LegalExportArtifact): string {
  return JSON.stringify(
    {
      ...artifact,
      // Never embed encryption key in the downloadable file — returned separately
      encryptionKeyHex: undefined,
    },
    null,
    2,
  );
}

/**
 * Verify a previously exported artifact's seal.
 */
export async function verifyLegalArtifact(
  artifact: LegalExportArtifact,
): Promise<{ valid: boolean; error: string | null }> {
  if (artifact.manifest.format !== 'fleetvu-legal-artifact-v1') {
    return { valid: false, error: 'Unsupported artifact format' };
  }

  if (!artifact.payload && !artifact.encryptedPayload) {
    return { valid: false, error: 'Artifact has no payload' };
  }

  if (artifact.payload) {
    const contentHash = await sha256Hex(JSON.stringify(artifact.payload));
    if (contentHash !== artifact.manifest.integrity.contentHash) {
      return { valid: false, error: 'Content hash mismatch — possible tampering' };
    }
  }

  const { manifestHash: _mh, ...integrityRest } = artifact.manifest.integrity;
  const manifestWithoutHash = {
    ...artifact.manifest,
    integrity: integrityRest,
  };
  const expectedManifestHash = await sha256Hex(JSON.stringify(manifestWithoutHash));
  if (expectedManifestHash !== artifact.manifest.integrity.manifestHash) {
    return { valid: false, error: 'Manifest hash mismatch — possible tampering' };
  }

  const expectedSeal = await sha256Hex(
    `${artifact.manifest.integrity.manifestHash}:${artifact.manifest.integrity.contentHash}`,
  );
  if (expectedSeal !== artifact.sealHash) {
    return { valid: false, error: 'Seal hash mismatch — possible tampering' };
  }

  return { valid: true, error: null };
}
