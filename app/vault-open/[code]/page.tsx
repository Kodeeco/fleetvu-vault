import { redirect } from 'next/navigation';
import { isValidPublicVaultOpenCode } from '@/lib/public-vault-gate';
import { VaultOpenBridge } from '@/components/vault/vault-open-bridge';

type Props = { params: { code: string } };

/**
 * Staff escape hatch — secret in the path, never a public bare URL.
 *   https://app.fleetvu.org/vault-open/<FLEETVU_PUBLIC_VAULT_OPEN_KEY>
 */
export default function VaultOpenWithCodePage({ params }: Props) {
  if (!isValidPublicVaultOpenCode(params.code)) {
    redirect('/vault-locked');
  }
  return <VaultOpenBridge />;
}
