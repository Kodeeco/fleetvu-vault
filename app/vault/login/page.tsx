import { redirect } from 'next/navigation';

/** Legacy path → canonical /vault-login */
export default function VaultLoginRedirect() {
  redirect('/vault-login');
}
