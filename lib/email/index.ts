/**
 * FleetVu Email Public API
 * Centralized corporate dispatch — all system mail flows through here.
 */

import { emailDispatchQueue } from './dispatch-queue';
import { CORPORATE_IDENTITIES, identityForEmailType, resolveIdentity } from './identities';
import { getActiveProvider, getTransportStats } from './transport';
import type {
  EmailDispatchResult,
  EmailIdentity,
  EmailMessage,
  EmailPriority,
} from './types';

export {
  CORPORATE_IDENTITIES,
  identityForEmailType,
  resolveIdentity,
  emailDispatchQueue,
  getActiveProvider,
  getTransportStats,
};

export type {
  EmailDispatchResult,
  EmailIdentity,
  EmailMessage,
  EmailPriority,
  EmailAttachment,
  DispatchQueueEntry,
} from './types';

export interface DispatchOptions {
  /** Wait for terminal send/fail (default true for API routes) */
  awaitDelivery?: boolean;
  priority?: EmailPriority;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
}

/**
 * Dispatch an email through the resilient corporate identity pipeline.
 */
export async function dispatchCorporateEmail(
  message: EmailMessage,
  options: DispatchOptions = {},
): Promise<EmailDispatchResult> {
  const enriched: EmailMessage = {
    ...message,
    priority: options.priority ?? message.priority ?? 'normal',
    correlationId: options.correlationId ?? message.correlationId,
    metadata: { ...message.metadata, ...options.metadata },
    maxAttempts: options.maxAttempts ?? message.maxAttempts,
  };

  if (options.awaitDelivery === false) {
    return emailDispatchQueue.enqueue(enriched);
  }
  return emailDispatchQueue.enqueueAndWait(enriched);
}

/** Convenience: welcome@fleetvu.org */
export function dispatchWelcome(
  partial: Omit<EmailMessage, 'identity'>,
  options?: DispatchOptions,
): Promise<EmailDispatchResult> {
  return dispatchCorporateEmail({ ...partial, identity: 'welcome' }, { priority: 'high', ...options });
}

/** Convenience: safetyreport@fleetvu.org */
export function dispatchSafetyReport(
  partial: Omit<EmailMessage, 'identity'>,
  options?: DispatchOptions,
): Promise<EmailDispatchResult> {
  return dispatchCorporateEmail({ ...partial, identity: 'safetyreport' }, { priority: 'high', ...options });
}

/** Convenience: notice@fleetvu.org */
export function dispatchNotice(
  partial: Omit<EmailMessage, 'identity'>,
  options?: DispatchOptions,
): Promise<EmailDispatchResult> {
  return dispatchCorporateEmail({ ...partial, identity: 'notice' }, { priority: 'normal', ...options });
}

/** Convenience: support@fleetvu.org */
export function dispatchSupport(
  partial: Omit<EmailMessage, 'identity'>,
  options?: DispatchOptions,
): Promise<EmailDispatchResult> {
  return dispatchCorporateEmail({ ...partial, identity: 'support' }, { priority: 'normal', ...options });
}
