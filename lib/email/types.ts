/**
 * FleetVu Corporate Email Dispatch — Shared Types
 * Identity-routed, fault-tolerant SMTP/HTTP transport contracts.
 */

export type EmailIdentity =
  | 'support'
  | 'welcome'
  | 'safetyreport'
  | 'notice';

export type EmailDispatchStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'retrying'
  | 'failed'
  | 'dead_letter';

export type EmailPriority = 'critical' | 'high' | 'normal' | 'low';

export interface EmailAttachment {
  filename: string;
  contentBase64: string;
  contentType: string;
  /** Without angle brackets — e.g. vault-logo → cid:vault-logo in HTML */
  contentId?: string;
  disposition?: 'inline' | 'attachment';
}

export interface EmailMessage {
  /** Corporate sending identity — maps to @fleetvu.org mailbox */
  identity: EmailIdentity;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  priority?: EmailPriority;
  /** Correlation id for forensic / audit linkage */
  correlationId?: string;
  /** Arbitrary metadata persisted with the dispatch log */
  metadata?: Record<string, unknown>;
  /** Max delivery attempts before dead-letter (default 5) */
  maxAttempts?: number;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId: string;
  identity: EmailIdentity;
  from: string;
  to: string[];
  status: EmailDispatchStatus;
  attempts: number;
  provider: 'smtp' | 'resend' | 'dry_run';
  error?: string;
  queuedAt: string;
  sentAt?: string;
}

export interface TransportSendRequest {
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface TransportSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  latencyMs: number;
}

export interface DispatchQueueEntry {
  id: string;
  message: EmailMessage;
  status: EmailDispatchStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
  result?: EmailDispatchResult;
}
