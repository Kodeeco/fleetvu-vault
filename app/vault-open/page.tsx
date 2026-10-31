import { redirect } from 'next/navigation';

/**
 * Bare /vault-open with no secret — intentionally useless.
 * Real escape: /vault-open/<secret>
 */
export default function VaultOpenNoSecretPage() {
  redirect('/vault-locked');
}
