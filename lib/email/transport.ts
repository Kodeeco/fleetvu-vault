/**
 * FleetVu Email Transport Layer
 *
 * Dual-provider transport with connection pooling, timeouts, and circuit-breaker
 * semantics. Prefer SMTP pool when SMTP_* env is configured; otherwise fall back
 * to Resend HTTP API. Dry-run mode when neither is set (local/dev) — never drops
 * a dispatch as failed solely due to missing credentials in development.
 */

import { createSmtpPool, type SmtpConnectionPool } from './smtp-pool';
import type { TransportSendRequest, TransportSendResult } from './types';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_MAX_CONNECTIONS = Math.max(1, Number(process.env.SMTP_MAX_CONNECTIONS || '5'));
const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || '15000');

const RESEND_API_KEY =
  process.env.EMAIL_SERVICE_API_KEY || process.env.RESEND_API_KEY || '';
const RESEND_TIMEOUT_MS = Number(process.env.RESEND_TIMEOUT_MS || '12000');
const RESEND_MAX_CONCURRENT = Math.max(1, Number(process.env.RESEND_MAX_CONCURRENT || '4'));

const DRY_RUN = process.env.EMAIL_DRY_RUN === 'true';

type Provider = 'smtp' | 'resend' | 'dry_run';

interface PoolStats {
  provider: Provider;
  active: number;
  waiting: number;
  totalSent: number;
  totalFailed: number;
  circuitOpen: boolean;
}

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  get stats(): { active: number; waiting: number } {
    return { active: this.active, waiting: this.waiters.length };
  }
}

class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly threshold = 8,
    private readonly coolDownMs = 30_000,
  ) {}

  get isOpen(): boolean {
    if (this.openedAt === null) return false;
    if (Date.now() - this.openedAt >= this.coolDownMs) {
      this.openedAt = null;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.threshold) {
      this.openedAt = Date.now();
    }
  }
}

let smtpPool: SmtpConnectionPool | null = null;
let smtpInitAttempted = false;
const resendSemaphore = new Semaphore(RESEND_MAX_CONCURRENT);
const circuit = new CircuitBreaker();
const stats: PoolStats = {
  provider: resolvePreferredProvider(),
  active: 0,
  waiting: 0,
  totalSent: 0,
  totalFailed: 0,
  circuitOpen: false,
};

function resolvePreferredProvider(): Provider {
  if (DRY_RUN) return 'dry_run';
  if (SMTP_HOST && SMTP_USER) return 'smtp';
  if (RESEND_API_KEY) return 'resend';
  return 'dry_run';
}

function getSmtpPool(): SmtpConnectionPool | null {
  if (smtpPool) return smtpPool;
  if (smtpInitAttempted) return null;
  smtpInitAttempted = true;

  if (!SMTP_HOST || !SMTP_USER) return null;

  try {
    smtpPool = createSmtpPool({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: SMTP_USER,
      pass: SMTP_PASS,
      maxConnections: SMTP_MAX_CONNECTIONS,
      connectionTimeoutMs: SMTP_TIMEOUT_MS,
      socketTimeoutMs: SMTP_TIMEOUT_MS,
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true',
    });
    return smtpPool;
  } catch (err) {
    console.error('[FleetVu SMTP] Failed to initialize pool:', err);
    return null;
  }
}

async function sendViaSmtp(req: TransportSendRequest): Promise<TransportSendResult> {
  const start = Date.now();
  const pool = getSmtpPool();
  if (!pool) {
    return { success: false, error: 'SMTP pool unavailable', latencyMs: Date.now() - start };
  }

  try {
    const info = await Promise.race([
      pool.sendMail({
        from: `"${req.fromName}" <${req.from}>`,
        to: req.to,
        cc: req.cc,
        bcc: req.bcc,
        subject: req.subject,
        html: req.html,
        text: req.text,
        replyTo: req.replyTo,
        headers: req.headers,
        attachments: req.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.contentBase64, 'base64'),
          contentType: a.contentType,
          contentId: a.contentId,
          disposition: a.disposition,
        })),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`SMTP send timed out after ${SMTP_TIMEOUT_MS}ms`)), SMTP_TIMEOUT_MS),
      ),
    ]);

    return {
      success: true,
      providerMessageId: info.messageId,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'SMTP send failed',
      latencyMs: Date.now() - start,
    };
  }
}

async function sendViaResend(req: TransportSendRequest): Promise<TransportSendResult> {
  const start = Date.now();
  if (!RESEND_API_KEY) {
    return { success: false, error: 'Resend API key not configured', latencyMs: Date.now() - start };
  }

  await resendSemaphore.acquire();
  try {
    const body: Record<string, unknown> = {
      from: `${req.fromName} <${req.from}>`,
      to: req.to,
      subject: req.subject,
      html: req.html,
    };
    if (req.cc.length) body.cc = req.cc;
    if (req.bcc.length) body.bcc = req.bcc;
    if (req.text) body.text = req.text;
    if (req.replyTo) body.reply_to = req.replyTo;
    if (req.attachments?.length) {
      body.attachments = req.attachments.map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
        content_type: a.contentType,
      }));
    }
    if (req.headers) body.headers = req.headers;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          error: `Resend error ${res.status}: ${errText}`,
          latencyMs: Date.now() - start,
        };
      }

      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return {
        success: true,
        providerMessageId: json.id,
        latencyMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Resend timed out after ${RESEND_TIMEOUT_MS}ms`
          : err.message
        : 'Resend send failed';
    return { success: false, error: message, latencyMs: Date.now() - start };
  } finally {
    resendSemaphore.release();
  }
}

function sendDryRun(req: TransportSendRequest): TransportSendResult {
  const id = `dryrun_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  console.info('[FleetVu Email DRY_RUN]', {
    messageId: id,
    from: req.from,
    to: req.to,
    subject: req.subject,
  });
  return { success: true, providerMessageId: id, latencyMs: 0 };
}

/**
 * Send a single email via the preferred transport.
 * Automatically falls back SMTP → Resend → dry_run.
 */
export async function transportSend(
  req: TransportSendRequest,
): Promise<TransportSendResult & { provider: Provider }> {
  if (circuit.isOpen) {
    stats.circuitOpen = true;
    return {
      success: false,
      error: 'Email circuit breaker open — cooling down after consecutive failures',
      latencyMs: 0,
      provider: stats.provider,
    };
  }
  stats.circuitOpen = false;

  const preferred = resolvePreferredProvider();
  stats.provider = preferred;

  let result: TransportSendResult;
  let provider: Provider = preferred;

  if (preferred === 'smtp') {
    result = await sendViaSmtp(req);
    if (!result.success && RESEND_API_KEY) {
      console.warn('[FleetVu Email] SMTP failed, falling back to Resend:', result.error);
      result = await sendViaResend(req);
      provider = 'resend';
    }
  } else if (preferred === 'resend') {
    result = await sendViaResend(req);
    provider = 'resend';
  } else {
    result = sendDryRun(req);
    provider = 'dry_run';
  }

  if (result.success) {
    circuit.recordSuccess();
    stats.totalSent++;
  } else {
    circuit.recordFailure();
    stats.totalFailed++;
  }

  const sem = resendSemaphore.stats;
  const smtpStats = smtpPool?.stats;
  stats.active = smtpStats?.busy ?? sem.active;
  stats.waiting = smtpStats?.waiting ?? sem.waiting;

  return { ...result, provider };
}

export function getTransportStats(): PoolStats {
  return { ...stats, circuitOpen: circuit.isOpen };
}

export function getActiveProvider(): Provider {
  return resolvePreferredProvider();
}

/** One-shot SMTP send using CRM UI credentials (LIVE transport). */
export async function sendWithSmtpCredentials(
  req: TransportSendRequest,
  smtp: {
    host: string;
    port: number;
    tlsEnabled: boolean;
    username: string;
    password: string;
  },
): Promise<TransportSendResult & { provider: 'smtp' }> {
  const start = Date.now();
  if (!smtp.host || !smtp.username || !smtp.password) {
    return {
      success: false,
      error: 'SMTP host, username, and password are required for LIVE send.',
      latencyMs: Date.now() - start,
      provider: 'smtp',
    };
  }

  const port = smtp.port || 465;
  // Port 465 = implicit TLS (SMTPS). Port 587 = STARTTLS (secure=false → upgrade after EHLO).
  let poolSecure: boolean;
  if (!smtp.tlsEnabled) {
    poolSecure = false;
  } else if (port === 465) {
    poolSecure = true;
  } else {
    poolSecure = false;
  }

  const pool = createSmtpPool({
    host: smtp.host.trim(),
    port,
    secure: poolSecure,
    user: smtp.username.trim(),
    pass: smtp.password.trim(),
    maxConnections: 1,
    connectionTimeoutMs: SMTP_TIMEOUT_MS,
    socketTimeoutMs: SMTP_TIMEOUT_MS,
    // Shared hosts (cPanel/mail.fleetvu.org) and local AV TLS inspection often
    // present incomplete or substituted chains — Bolt-compatible LIVE path.
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true',
  });

  try {
    const info = await Promise.race([
      pool.sendMail({
        from: `"${req.fromName}" <${req.from}>`,
        to: req.to,
        cc: req.cc,
        bcc: req.bcc,
        subject: req.subject,
        html: req.html,
        text: req.text,
        replyTo: req.replyTo,
        headers: req.headers,
        attachments: req.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.contentBase64, 'base64'),
          contentType: a.contentType,
          contentId: a.contentId,
          disposition: a.disposition,
        })),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`SMTP send timed out after ${SMTP_TIMEOUT_MS}ms`)), SMTP_TIMEOUT_MS),
      ),
    ]);

    await pool.close();
    return {
      success: true,
      providerMessageId: info.messageId,
      latencyMs: Date.now() - start,
      provider: 'smtp',
    };
  } catch (err) {
    try {
      await pool.close();
    } catch {
      /* ignore */
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'SMTP send failed',
      latencyMs: Date.now() - start,
      provider: 'smtp',
    };
  }
}
