/**
 * FleetVu Lightweight SMTP Client with Connection Pooling
 * Zero external dependencies — uses Node net/tls only.
 * Supports AUTH LOGIN, STARTTLS, and pooled concurrent sends.
 */

import net from 'net';
import tls from 'tls';

export interface SmtpPoolConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  maxConnections: number;
  connectionTimeoutMs: number;
  socketTimeoutMs: number;
  rejectUnauthorized: boolean;
}

export interface SmtpMailOptions {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    contentId?: string;
    disposition?: 'inline' | 'attachment';
  }>;
}

interface PooledSocket {
  socket: net.Socket | tls.TLSSocket;
  busy: boolean;
  authenticated: boolean;
}

function encodeBase64(value: string | Buffer): string {
  return Buffer.isBuffer(value) ? value.toString('base64') : Buffer.from(value, 'utf8').toString('base64');
}

function buildMime(options: SmtpMailOptions): string {
  const mixedBoundary = `fleetvu_mix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const relatedBoundary = `fleetvu_rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const lines: string[] = [
    `From: ${options.from}`,
    `To: ${options.to.join(', ')}`,
  ];
  if (options.cc?.length) lines.push(`Cc: ${options.cc.join(', ')}`);
  if (options.replyTo) lines.push(`Reply-To: ${options.replyTo}`);
  lines.push(`Subject: ${options.subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push('X-Mailer: FleetVu-SMTP-Pool/1.0');

  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      lines.push(`${k}: ${v}`);
    }
  }

  const attachments = options.attachments || [];
  const inline = attachments.filter((a) => a.disposition === 'inline' || a.contentId);
  const regular = attachments.filter((a) => !(a.disposition === 'inline' || a.contentId));

  const pushHtmlPart = (boundary: string) => {
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(encodeBase64(options.html));
    lines.push('');
  };

  const pushInlineParts = (boundary: string) => {
    for (const att of inline) {
      const cid = (att.contentId || att.filename).replace(/[<>]/g, '');
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('Content-Disposition: inline');
      lines.push(`Content-ID: <${cid}>`);
      lines.push('');
      lines.push(att.content.toString('base64'));
      lines.push('');
    }
  };

  const pushRegularParts = (boundary: string) => {
    for (const att of regular) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push('');
      lines.push(att.content.toString('base64'));
      lines.push('');
    }
  };

  if (inline.length && regular.length) {
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    lines.push('');
    lines.push(`--${mixedBoundary}`);
    lines.push(`Content-Type: multipart/related; boundary="${relatedBoundary}"`);
    lines.push('');
    pushHtmlPart(relatedBoundary);
    pushInlineParts(relatedBoundary);
    lines.push(`--${relatedBoundary}--`);
    lines.push('');
    pushRegularParts(mixedBoundary);
    lines.push(`--${mixedBoundary}--`);
  } else if (inline.length) {
    lines.push(`Content-Type: multipart/related; boundary="${relatedBoundary}"`);
    lines.push('');
    pushHtmlPart(relatedBoundary);
    pushInlineParts(relatedBoundary);
    lines.push(`--${relatedBoundary}--`);
  } else if (regular.length) {
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    lines.push('');
    pushHtmlPart(mixedBoundary);
    pushRegularParts(mixedBoundary);
    lines.push(`--${mixedBoundary}--`);
  } else {
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(encodeBase64(options.html));
  }

  return lines.join('\r\n') + '\r\n';
}

function readResponse(socket: net.Socket | tls.TLSSocket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP response timeout'));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      // Multi-line responses end when a line starts with XXX<space>
      const parts = buffer.split(/\r?\n/);
      for (const line of parts) {
        if (/^\d{3} /.test(line)) {
          cleanup();
          resolve(buffer);
          return;
        }
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function sendCommand(
  socket: net.Socket | tls.TLSSocket,
  command: string,
  timeoutMs: number,
  expectCode: number | number[],
  options?: { sensitive?: boolean },
): Promise<string> {
  const expected = Array.isArray(expectCode) ? expectCode : [expectCode];
  socket.write(command.endsWith('\r\n') ? command : `${command}\r\n`);
  const response = await readResponse(socket, timeoutMs);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) {
    const label = options?.sensitive
      ? '[credentials]'
      : command.startsWith('AUTH')
        ? 'AUTH'
        : command.split(/\s/)[0] || 'command';
    const detail = response.trim().replace(/\r?\n/g, ' ');
    if (code === 535) {
      throw new Error(
        'SMTP authentication failed (535). Check username/password — use the exact mailbox credentials from Bolt (no extra spaces).',
      );
    }
    throw new Error(`SMTP unexpected response to "${label}": ${detail}`);
  }
  return response;
}

async function upgradeToTls(
  socket: net.Socket,
  host: string,
  rejectUnauthorized: boolean,
): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = tls.connect(
      {
        socket,
        host,
        servername: host,
        rejectUnauthorized,
      },
      () => resolve(secure),
    );
    secure.on('error', reject);
  });
}

async function openConnection(config: SmtpPoolConfig): Promise<PooledSocket> {
  let active: net.Socket | tls.TLSSocket;

  if (config.secure || config.port === 465) {
    // Implicit TLS (SMTPS) — required for port 465
    active = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const s = tls.connect(
        {
          host: config.host,
          port: config.port,
          servername: config.host,
          rejectUnauthorized: config.rejectUnauthorized,
        },
        () => resolve(s),
      );
      s.setTimeout(config.connectionTimeoutMs);
      s.once('error', reject);
      s.once('timeout', () => {
        s.destroy();
        reject(new Error('SMTP TLS connection timeout'));
      });
    });
    active.setTimeout(config.socketTimeoutMs);
    await readResponse(active, config.connectionTimeoutMs); // banner 220
    await sendCommand(active, `EHLO fleetvu-dispatch`, config.socketTimeoutMs, 250);
  } else {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect({ host: config.host, port: config.port }, () => resolve(s));
      s.setTimeout(config.connectionTimeoutMs);
      s.once('error', reject);
      s.once('timeout', () => {
        s.destroy();
        reject(new Error('SMTP connection timeout'));
      });
    });

    socket.setTimeout(config.socketTimeoutMs);
    await readResponse(socket, config.connectionTimeoutMs); // banner 220
    active = socket;

    await sendCommand(active, `EHLO fleetvu-dispatch`, config.socketTimeoutMs, 250);
    // STARTTLS (typical for port 587)
    try {
      await sendCommand(active, 'STARTTLS', config.socketTimeoutMs, 220);
      active = await upgradeToTls(socket, config.host, config.rejectUnauthorized);
      active.setTimeout(config.socketTimeoutMs);
      await sendCommand(active, `EHLO fleetvu-dispatch`, config.socketTimeoutMs, 250);
    } catch {
      // Server may not support STARTTLS; continue on plain (dev only)
    }
  }

  // AUTH LOGIN — trim credentials (UI paste often adds trailing spaces → 535)
  const user = config.user.trim();
  const pass = config.pass.trim();
  await sendCommand(active, 'AUTH LOGIN', config.socketTimeoutMs, 334);
  await sendCommand(active, encodeBase64(user), config.socketTimeoutMs, 334, { sensitive: true });
  await sendCommand(active, encodeBase64(pass), config.socketTimeoutMs, 235, { sensitive: true });

  return { socket: active, busy: false, authenticated: true };
}

export class SmtpConnectionPool {
  private readonly pool: PooledSocket[] = [];
  private readonly waitQueue: Array<(conn: PooledSocket) => void> = [];
  private creating = 0;
  private closed = false;

  constructor(private readonly config: SmtpPoolConfig) {}

  private async acquire(): Promise<PooledSocket> {
    if (this.closed) throw new Error('SMTP pool is closed');

    const free = this.pool.find((c) => !c.busy && !c.socket.destroyed);
    if (free) {
      free.busy = true;
      return free;
    }

    if (this.pool.length + this.creating < this.config.maxConnections) {
      this.creating++;
      try {
        const conn = await openConnection(this.config);
        conn.busy = true;
        this.pool.push(conn);
        return conn;
      } finally {
        this.creating--;
      }
    }

    return new Promise<PooledSocket>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private release(conn: PooledSocket): void {
    const waiter = this.waitQueue.shift();
    if (waiter) {
      waiter(conn);
      return;
    }
    conn.busy = false;
  }

  async sendMail(options: SmtpMailOptions): Promise<{ messageId: string }> {
    const conn = await this.acquire();
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@fleetvu.org>`;

    try {
      const recipients = [
        ...options.to,
        ...(options.cc || []),
        ...(options.bcc || []),
      ];

      await sendCommand(conn.socket, `MAIL FROM:<${extractAddress(options.from)}>`, this.config.socketTimeoutMs, 250);
      for (const rcpt of recipients) {
        await sendCommand(conn.socket, `RCPT TO:<${extractAddress(rcpt)}>`, this.config.socketTimeoutMs, [250, 251]);
      }
      await sendCommand(conn.socket, 'DATA', this.config.socketTimeoutMs, 354);

      const mime = buildMime({
        ...options,
        headers: { ...(options.headers || {}), 'Message-ID': messageId },
      });
      conn.socket.write(mime.replace(/^\./gm, '..')); // dot-stuffing
      conn.socket.write('\r\n.\r\n');
      await readResponse(conn.socket, this.config.socketTimeoutMs);

      return { messageId };
    } catch (err) {
      // Drop broken connection from pool
      try {
        conn.socket.destroy();
      } catch {
        /* ignore */
      }
      const idx = this.pool.indexOf(conn);
      if (idx >= 0) this.pool.splice(idx, 1);
      throw err;
    } finally {
      if (!conn.socket.destroyed) {
        this.release(conn);
      }
    }
  }

  async verify(): Promise<boolean> {
    const conn = await this.acquire();
    try {
      await sendCommand(conn.socket, 'NOOP', this.config.socketTimeoutMs, 250);
      return true;
    } finally {
      this.release(conn);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const conn of this.pool) {
      try {
        conn.socket.write('QUIT\r\n');
        conn.socket.destroy();
      } catch {
        /* ignore */
      }
    }
    this.pool.length = 0;
  }

  get stats(): { size: number; busy: number; waiting: number } {
    return {
      size: this.pool.length,
      busy: this.pool.filter((c) => c.busy).length,
      waiting: this.waitQueue.length,
    };
  }
}

function extractAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}

/** Factory used by the transport layer. */
export function createSmtpPool(config: SmtpPoolConfig): SmtpConnectionPool {
  return new SmtpConnectionPool(config);
}
