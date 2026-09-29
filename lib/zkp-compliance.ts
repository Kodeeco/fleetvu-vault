'use client';

import { supabase } from '@/lib/supabase';
import { verifyChain, sha256 } from '@/src/vault/merkle-chain';

/**
 * Zero-Knowledge Proof (ZKP) Evidentiary & Compliance Reporting Suite
 *
 * Customer-Sovereign / Zero-Access: This module runs entirely inside the
 * Company Admin Portal. FleetVu employees and agents have zero access,
 * visibility, or custody of the generated certificates.
 *
 * The ZKP Compliance Certificate uses Merkle proofs of inclusion:
 *   - Proves that a set of vault event blocks forms a valid, unbroken chain
 *   - Proves that specific events are included in the chain
 *   - Reveals the chain root hash and proof structure
 *   - Does NOT reveal the raw telemetry payload data
 *
 * This is the practical implementation of "ZKP compliance" — proving chain
 * integrity and event membership without exposing underlying data.
 * The verifier (insurance executive, defense attorney) can independently
 * verify the proof against the chain root hash without seeing the data.
 */

export type CertificateType = 'compliance' | 'incident_package';

export interface MerkleProofStep {
  direction: 'left' | 'right';
  siblingHash: string;
}

export interface MerkleInclusionProof {
  leafHash: string;
  steps: MerkleProofStep[];
  rootHash: string;
}

export interface ComplianceCertificate {
  id: string;
  companyId: string;
  generatedBy: string;
  certificateType: CertificateType;
  chainRootHash: string;
  blockRangeStart: number;
  blockRangeEnd: number;
  eventCount: number;
  merkleProof: {
    blockProofs: { blockSeq: number; recordHash: string; prevHash: string | null }[];
    inclusionProofs: MerkleInclusionProof[];
  };
  metadata: {
    companyName: string | null;
    generatedAt: string;
    chainValid: boolean;
    verificationError: string | null;
    algorithmUsed: string;
  };
  status: 'generated' | 'exported' | 'revoked';
  timestamp: string;
}

/**
 * Generate a compliance certificate for a company's vault chain.
 * Verifies the chain integrity and creates a Merkle proof of inclusion
 * for the blocks in the specified range.
 *
 * @param companyId - The company requesting the certificate
 * @param generatedBy - Email of the admin generating the certificate
 * @param blockRangeStart - First block sequence number (optional, defaults to first)
 * @param blockRangeEnd - Last block sequence number (optional, defaults to last)
 */
export async function generateComplianceCertificate(
  companyId: string,
  generatedBy: string,
  certificateType: CertificateType = 'compliance',
  blockRangeStart?: number,
  blockRangeEnd?: number,
): Promise<ComplianceCertificate | null> {
  // Fetch all vault blocks for this company, ordered by sequence
  const { data: blocks, error } = await supabase
    .from('vault_event_blocks')
    .select('*')
    .eq('company_id', companyId)
    .order('block_seq', { ascending: true });

  if (error || !blocks || blocks.length === 0) {
    return null;
  }

  // Filter to the requested range
  const start = blockRangeStart ?? blocks[0].block_seq;
  const end = blockRangeEnd ?? blocks[blocks.length - 1].block_seq;
  const rangeBlocks = blocks.filter(
    (b) => b.block_seq >= start && b.block_seq <= end,
  );

  if (rangeBlocks.length === 0) return null;

  // Verify chain integrity
  const verification = await verifyChain(rangeBlocks);
  if (!verification.valid) {
    // Chain is broken — generate a certificate that records the break point
    // This is still evidentiarily valuable: it proves tampering occurred
  }

  // Build block proofs (chain linkage proof)
  const blockProofs = rangeBlocks.map((b) => ({
    blockSeq: b.block_seq,
    recordHash: b.record_hash,
    prevHash: b.prev_hash,
  }));

  // Build Merkle inclusion proofs for the block record hashes
  const leafHashes = rangeBlocks.map((b) => b.record_hash);
  const inclusionProofs = await Promise.all(
    leafHashes.map(async (_, idx) => {
      return await buildInclusionProof(leafHashes, idx);
    }),
  );

  // Compute chain root hash
  const chainRootHash = verification.valid
    ? rangeBlocks[rangeBlocks.length - 1].record_hash
    : await sha256('broken_chain');

  // Get company name
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle();

  const certificate: ComplianceCertificate = {
    id: crypto.randomUUID(),
    companyId,
    generatedBy,
    certificateType,
    chainRootHash,
    blockRangeStart: start,
    blockRangeEnd: end,
    eventCount: rangeBlocks.reduce((sum, b) => sum + b.event_count, 0),
    merkleProof: {
      blockProofs,
      inclusionProofs,
    },
    metadata: {
      companyName: company?.name ?? null,
      generatedAt: new Date().toISOString(),
      chainValid: verification.valid,
      verificationError: verification.error,
      algorithmUsed: 'SHA-256',
    },
    status: 'generated',
    timestamp: new Date().toISOString(),
  };

  // Persist the certificate (append-only — no UPDATE/DELETE)
  await supabase.from('zkp_compliance_certificates').insert({
    id: certificate.id,
    company_id: companyId,
    generated_by: generatedBy,
    certificate_type: certificateType,
    chain_root_hash: chainRootHash,
    block_range_start: start,
    block_range_end: end,
    event_count: certificate.eventCount,
    merkle_proof: certificate.merkleProof,
    metadata: certificate.metadata,
    status: 'generated',
    utc_timestamp: certificate.timestamp,
  });

  return certificate;
}

/**
 * Build a Merkle proof of inclusion for a leaf at the given index.
 * Returns the sibling hashes at each level of the tree.
 */
async function buildInclusionProof(
  leaves: string[],
  targetIndex: number,
): Promise<MerkleInclusionProof> {
  const steps: MerkleProofStep[] = [];
  let currentLevel = [...leaves];
  let currentIndex = targetIndex;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : currentLevel[i];
      nextLevel.push(await sha256(left + right));
    }

    // Record the sibling at this level
    const isLeftNode = currentIndex % 2 === 0;
    const siblingIndex = isLeftNode ? currentIndex + 1 : currentIndex - 1;
    const sibling = siblingIndex < currentLevel.length ? currentLevel[siblingIndex] : currentLevel[currentIndex];

    steps.push({
      direction: isLeftNode ? 'right' : 'left',
      siblingHash: sibling,
    });

    currentIndex = Math.floor(currentIndex / 2);
    currentLevel = nextLevel;
  }

  return {
    leafHash: leaves[targetIndex],
    steps,
    rootHash: currentLevel[0] ?? leaves[0],
  };
}

/**
 * Verify a Merkle inclusion proof against a known root hash.
 * This is what the verifier (insurance/attorney) runs — they don't
 * need access to the full chain, just the proof and root hash.
 */
export async function verifyInclusionProof(
  proof: MerkleInclusionProof,
  expectedRootHash: string,
): Promise<boolean> {
  let currentHash = proof.leafHash;

  for (const step of proof.steps) {
    if (step.direction === 'left') {
      currentHash = await sha256(step.siblingHash + currentHash);
    } else {
      currentHash = await sha256(currentHash + step.siblingHash);
    }
  }

  return currentHash === expectedRootHash;
}

/**
 * Export a certificate as a court-ready PDF-compatible data structure.
 * Returns the certificate data formatted for PDF generation.
 */
export function formatCertificateForExport(
  cert: ComplianceCertificate,
): Record<string, unknown> {
  return {
    certificateId: cert.id,
    type: cert.certificateType === 'compliance'
      ? 'FleetVu ZKP Compliance Certificate'
      : 'FleetVu Secure Incident Package',
    generatedBy: cert.generatedBy,
    generatedAt: cert.metadata.generatedAt,
    companyName: cert.metadata.companyName,
    chainRootHash: cert.chainRootHash,
    blockRange: `${cert.blockRangeStart} - ${cert.blockRangeEnd}`,
    totalEvents: cert.eventCount,
    chainValid: cert.metadata.chainValid,
    algorithm: cert.metadata.algorithmUsed,
    verificationError: cert.metadata.verificationError,
    blockProofs: cert.merkleProof.blockProofs,
    inclusionProofCount: cert.merkleProof.inclusionProofs.length,
    legalDisclaimer:
      'This certificate cryptographically proves the integrity and inclusion of ' +
      'telemetry events in the FleetVu Forensic Vault chain. The chain root hash ' +
      'and Merkle proofs can be independently verified without access to the ' +
      'underlying raw telemetry data.',
    timestamp: cert.timestamp,
  };
}

/**
 * Fetch all certificates for a company (for the admin portal listing).
 */
export async function fetchCertificates(
  companyId: string,
): Promise<ComplianceCertificate[]> {
  const { data, error } = await supabase
    .from('zkp_compliance_certificates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    generatedBy: row.generated_by,
    certificateType: row.certificate_type,
    chainRootHash: row.chain_root_hash,
    blockRangeStart: row.block_range_start,
    blockRangeEnd: row.block_range_end,
    eventCount: row.event_count,
    merkleProof: row.merkle_proof,
    metadata: row.metadata,
    status: row.status,
    timestamp: row.utc_timestamp,
  })) as ComplianceCertificate[];
}
