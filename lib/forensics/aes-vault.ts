/**
 * FleetVu Forensic AES-256-GCM Evidentiary Encryption
 * Encrypts sealed payloads for Vault custody with authenticated encryption.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SubtleCrypto unavailable — AES-256-GCM requires a secure context');
  }
  return subtle;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Derive an AES-256 key from a passphrase + salt via PBKDF2. */
export async function deriveEvidenceKey(
  passphrase: string,
  saltHex: string,
  iterations = 100_000,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBuffer(saltHex),
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Generate a random 256-bit key for session evidentiary wrapping. */
export async function generateEvidenceKey(): Promise<CryptoKey> {
  return getSubtle().generateKey({ name: ALGORITHM, length: KEY_LENGTH }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export interface EncryptedEvidence {
  algorithm: 'AES-256-GCM';
  ivHex: string;
  ciphertextBase64: string;
  /** SHA-256 of plaintext before encryption — tamper detection */
  plaintextSha256: string;
  encryptedAt: string;
}

/** SHA-256 hex digest of a UTF-8 string. */
export async function sha256Hex(data: string): Promise<string> {
  const hash = await getSubtle().digest('SHA-256', new TextEncoder().encode(data));
  return bufferToHex(hash);
}

/**
 * Encrypt evidentiary payload with AES-256-GCM.
 * Returns IV + ciphertext + plaintext SHA-256 for dual integrity.
 */
export async function encryptEvidence(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedEvidence> {
  const subtle = getSubtle();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintextSha256 = await sha256Hex(plaintext);
  const ciphertext = await subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    algorithm: 'AES-256-GCM',
    ivHex: bufferToHex(iv.buffer),
    ciphertextBase64: bufferToBase64(ciphertext),
    plaintextSha256,
    encryptedAt: new Date().toISOString(),
  };
}

/**
 * Decrypt and verify evidentiary payload.
 * Throws if authentication tag fails (tamper detected).
 */
export async function decryptEvidence(
  envelope: EncryptedEvidence,
  key: CryptoKey,
): Promise<{ plaintext: string; integrityValid: boolean }> {
  const subtle = getSubtle();
  const iv = hexToBuffer(envelope.ivHex);
  const ciphertext = base64ToBuffer(envelope.ciphertextBase64);

  const decrypted = await subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext,
  );

  const plaintext = new TextDecoder().decode(decrypted);
  const actualHash = await sha256Hex(plaintext);
  return {
    plaintext,
    integrityValid: actualHash === envelope.plaintextSha256,
  };
}

/** Export raw key material as hex (for secure key escrow / HSM handoff). */
export async function exportKeyHex(key: CryptoKey): Promise<string> {
  const raw = await getSubtle().exportKey('raw', key);
  return bufferToHex(raw);
}

/** Import a raw hex AES-256 key. */
export async function importKeyHex(hex: string): Promise<CryptoKey> {
  return getSubtle().importKey(
    'raw',
    hexToBuffer(hex),
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** Generate a random salt for PBKDF2 (32 bytes hex). */
export function generateSaltHex(): string {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  return bufferToHex(salt.buffer);
}
