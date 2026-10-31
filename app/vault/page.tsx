import { redirect } from 'next/navigation';

/** /vault → canonical /vault-login */
export default function VaultPortalIndex() {
  redirect('/vault-login');
}
