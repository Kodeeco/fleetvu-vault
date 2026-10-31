/**
 * Server-only Vault logo CID attachment for transactional emails.
 * Do not import from client components.
 */

import {
  loadWelcomeLogoAttachment,
  WELCOME_LOGO_CID,
} from '@/lib/email/welcome-roster-template';
import type { EmailAttachment } from '@/lib/email/types';

export { WELCOME_LOGO_CID };

export function vaultEmailLogoAttachment(): EmailAttachment | null {
  return loadWelcomeLogoAttachment();
}
