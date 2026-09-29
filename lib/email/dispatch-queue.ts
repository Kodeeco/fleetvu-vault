/**
 * FleetVu Email Dispatch Queue
 *
 * In-memory priority queue with exponential backoff retries, persistent
 * logging to email_dispatch_log (when available), and dead-letter handling.
 * Guarantees zero silent drops — every message is either sent, retried, or
 * explicitly recorded as dead_letter with a forensic reason.
 */

import { resolveIdentity } from './identities';
import { transportSend, getTransportStats } from './transport';
import type {
  DispatchQueueEntry,
  EmailDispatchResult,
  EmailMessage,
  EmailDispatchStatus,
  EmailPriority,
} from './types';

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const PROCESSOR_INTERVAL_MS = 750;

const PRIORITY_WEIGHT: Record<EmailPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function normalizeRecipients(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function computeBackoff(attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
}

function createId(): string {
  return `emd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

class EmailDispatchQueue {
  private readonly entries = new Map<string, DispatchQueueEntry>();
  private processing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private persistFn: ((entry: DispatchQueueEntry) => Promise<void>) | null = null;

  /** Optional durable persistence hook (wired to Supabase from the API route). */
  setPersistence(fn: (entry: DispatchQueueEntry) => Promise<void>): void {
    this.persistFn = fn;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, PROCESSOR_INTERVAL_MS);
    if (typeof this.timer === 'object' && 'unref' in this.timer) {
      (this.timer as NodeJS.Timeout).unref?.();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async enqueue(message: EmailMessage): Promise<EmailDispatchResult> {
    this.start();

    const id = createId();
    const now = new Date().toISOString();
    const entry: DispatchQueueEntry = {
      id,
      message,
      status: 'queued',
      attempts: 0,
      maxAttempts: message.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      lastError: null,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.entries.set(id, entry);
    await this.persist(entry);

    // Attempt immediate send for critical/high priority
    if ((message.priority ?? 'normal') === 'critical' || message.priority === 'high') {
      await this.processEntry(entry);
    } else {
      void this.tick();
    }

    const final = this.entries.get(id)!;
    if (final.result) return final.result;

    // Still queued/retrying — return provisional acceptance (never a drop)
    const identity = resolveIdentity(message.identity);
    return {
      success: true,
      messageId: id,
      identity: message.identity,
      from: identity.address,
      to: normalizeRecipients(message.to),
      status: final.status,
      attempts: final.attempts,
      provider: getTransportStats().provider,
      queuedAt: final.createdAt,
      error: final.lastError ?? undefined,
    };
  }

  /** Force-process a specific message synchronously (used by API for await mode). */
  async enqueueAndWait(message: EmailMessage): Promise<EmailDispatchResult> {
    this.start();
    const id = createId();
    const now = new Date().toISOString();
    const entry: DispatchQueueEntry = {
      id,
      message,
      status: 'queued',
      attempts: 0,
      maxAttempts: message.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      lastError: null,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.entries.set(id, entry);
    await this.persist(entry);
    await this.processEntry(entry);

    // If still retrying, keep attempting until terminal state (with backoff)
    let guard = 0;
    while (
      guard < entry.maxAttempts &&
      (entry.status === 'retrying' || entry.status === 'queued' || entry.status === 'sending')
    ) {
      guard++;
      const waitMs = Math.max(0, new Date(entry.nextAttemptAt).getTime() - Date.now());
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 3_000)));
      }
      await this.processEntry(entry);
    }

    return (
      entry.result ?? {
        success: false,
        messageId: id,
        identity: message.identity,
        from: resolveIdentity(message.identity).address,
        to: normalizeRecipients(message.to),
        status: entry.status,
        attempts: entry.attempts,
        provider: getTransportStats().provider,
        queuedAt: entry.createdAt,
        error: entry.lastError ?? 'Dispatch did not complete',
      }
    );
  }

  getEntry(id: string): DispatchQueueEntry | undefined {
    return this.entries.get(id);
  }

  getQueueSnapshot(): {
    queued: number;
    retrying: number;
    deadLetter: number;
    sent: number;
    transport: ReturnType<typeof getTransportStats>;
  } {
    let queued = 0;
    let retrying = 0;
    let deadLetter = 0;
    let sent = 0;
    for (const e of this.entries.values()) {
      if (e.status === 'queued' || e.status === 'sending') queued++;
      else if (e.status === 'retrying') retrying++;
      else if (e.status === 'dead_letter' || e.status === 'failed') deadLetter++;
      else if (e.status === 'sent') sent++;
    }
    return { queued, retrying, deadLetter, sent, transport: getTransportStats() };
  }

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const now = Date.now();
      const due = [...this.entries.values()]
        .filter(
          (e) =>
            (e.status === 'queued' || e.status === 'retrying') &&
            new Date(e.nextAttemptAt).getTime() <= now,
        )
        .sort((a, b) => {
          const pa = PRIORITY_WEIGHT[a.message.priority ?? 'normal'];
          const pb = PRIORITY_WEIGHT[b.message.priority ?? 'normal'];
          if (pa !== pb) return pa - pb;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      // Process up to pool size concurrently
      const batch = due.slice(0, 4);
      await Promise.all(batch.map((e) => this.processEntry(e)));
    } finally {
      this.processing = false;
    }
  }

  private async processEntry(entry: DispatchQueueEntry): Promise<void> {
    if (entry.status === 'sent' || entry.status === 'dead_letter') return;

    entry.status = 'sending';
    entry.attempts += 1;
    entry.updatedAt = new Date().toISOString();
    await this.persist(entry);

    const identity = resolveIdentity(entry.message.identity);
    const to = normalizeRecipients(entry.message.to);
    const cc = normalizeRecipients(entry.message.cc);
    const bcc = normalizeRecipients(entry.message.bcc);

    if (to.length === 0) {
      entry.status = 'dead_letter';
      entry.lastError = 'No recipients';
      entry.result = this.buildResult(entry, identity.address, to, false, 'No recipients');
      await this.persist(entry);
      this.logError(entry);
      return;
    }

    try {
      const transport = await transportSend({
        from: identity.address,
        fromName: identity.displayName,
        to,
        cc,
        bcc,
        subject: entry.message.subject,
        html: entry.message.html,
        text: entry.message.text,
        replyTo: entry.message.replyTo || identity.defaultReplyTo,
        attachments: entry.message.attachments,
        headers: {
          'X-FleetVu-Identity': identity.id,
          'X-FleetVu-Message-Id': entry.id,
          ...(entry.message.correlationId
            ? { 'X-FleetVu-Correlation-Id': entry.message.correlationId }
            : {}),
        },
      });

      if (transport.success) {
        entry.status = 'sent';
        entry.lastError = null;
        entry.result = {
          ...this.buildResult(entry, identity.address, to, true),
          provider: transport.provider,
          sentAt: new Date().toISOString(),
        };
        await this.persist(entry);
        return;
      }

      await this.scheduleRetry(entry, identity.address, to, transport.error || 'Unknown transport error', transport.provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unhandled dispatch error';
      await this.scheduleRetry(entry, identity.address, to, message, getTransportStats().provider);
    }
  }

  private async scheduleRetry(
    entry: DispatchQueueEntry,
    from: string,
    to: string,
    error: string,
    provider: EmailDispatchResult['provider'],
  ): Promise<void> {
    entry.lastError = error;
    entry.updatedAt = new Date().toISOString();

    if (entry.attempts >= entry.maxAttempts) {
      entry.status = 'dead_letter';
      entry.result = {
        ...this.buildResult(entry, from, to, false, error),
        provider,
      };
      await this.persist(entry);
      this.logError(entry);
      return;
    }

    const backoff = computeBackoff(entry.attempts);
    entry.status = 'retrying';
    entry.nextAttemptAt = new Date(Date.now() + backoff).toISOString();
    entry.result = {
      ...this.buildResult(entry, from, to, false, error),
      provider,
      status: 'retrying',
    };
    await this.persist(entry);
    console.warn(
      `[FleetVu Email] Retry ${entry.attempts}/${entry.maxAttempts} for ${entry.id} in ${backoff}ms — ${error}`,
    );
  }

  private buildResult(
    entry: DispatchQueueEntry,
    from: string,
    to: string[],
    success: boolean,
    error?: string,
  ): EmailDispatchResult {
    return {
      success,
      messageId: entry.id,
      identity: entry.message.identity,
      from,
      to,
      status: entry.status as EmailDispatchStatus,
      attempts: entry.attempts,
      provider: getTransportStats().provider,
      queuedAt: entry.createdAt,
      error,
      sentAt: success ? new Date().toISOString() : undefined,
    };
  }

  private async persist(entry: DispatchQueueEntry): Promise<void> {
    if (!this.persistFn) return;
    try {
      await this.persistFn(entry);
    } catch (err) {
      console.error('[FleetVu Email] Persist failed (non-fatal):', err);
    }
  }

  private logError(entry: DispatchQueueEntry): void {
    console.error('[FleetVu Email] DEAD_LETTER', {
      id: entry.id,
      identity: entry.message.identity,
      to: entry.message.to,
      subject: entry.message.subject,
      attempts: entry.attempts,
      error: entry.lastError,
      correlationId: entry.message.correlationId,
    });
  }
}

/** Process-wide singleton queue. */
const globalForEmail = globalThis as typeof globalThis & {
  __fleetvuEmailQueue?: EmailDispatchQueue;
};

export const emailDispatchQueue: EmailDispatchQueue =
  globalForEmail.__fleetvuEmailQueue ?? new EmailDispatchQueue();

if (!globalForEmail.__fleetvuEmailQueue) {
  globalForEmail.__fleetvuEmailQueue = emailDispatchQueue;
  emailDispatchQueue.start();
}
