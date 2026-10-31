import { redirect } from 'next/navigation';
import { verifyVaultResumeToken } from '@/lib/vault-unlock-resume';
import { VaultOpenBridge } from '@/components/vault/vault-open-bridge';

type Props = { params: { token: string } };

/**
 * Thank-you email CTA — re-opens public Vault after mobile mail opens a fresh browser.
 * Token minted at unlock-request time (7-day HMAC).
 */
export default function VaultResumePage({ params }: Props) {
  const raw = decodeURIComponent(params.token || '');
  if (!verifyVaultResumeToken(raw).ok) {
    redirect('/vault-locked');
  }
  return <VaultOpenBridge />;
}
