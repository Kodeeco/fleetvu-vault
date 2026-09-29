/**
 * Portal ↔ Mobile Realtime Sync
 *
 * Offline-capable event queue with automatic reconnection, exponential backoff,
 * and defensive error isolation so transient network drops never crash the app
 * or corrupt local event queues.
 */

export type SyncChannel =
  | 'hazard_cues'
  | 'compliance_signoff'
  | 'telemetry'
  | 'incident'
  | 'driver_status'
  | 'custody';

export type SyncEventStatus = 'pending' | 'sending' | 'acked' | 'failed' | 'dead';

export interface SyncEvent {
  id: string;
  channel: SyncChannel;
  companyId: string | null;
  deviceId: string;
  payload: Record<string, unknown>;
  clientTimestampMs: number;
  status: SyncEventStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface SyncManagerOptions {
  deviceId: string;
  companyId?: string | null;
  endpoint?: string;
  maxAttempts?: number;
  maxQueueSize?: number;
  storageKey?: string;
  onStateChange?: (state: ConnectionState) => void;
  onEventAcked?: (event: SyncEvent) => void;
  onError?: (error: Error, event?: SyncEvent) => void;
}

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_MAX_QUEUE = 500;
const STORAGE_KEY = 'fleetvu_sync_queue_v1';

function createEventId(): string {
  return `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeStorageGet(key: string): SyncEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SyncEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeStorageSet(key: string, events: SyncEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(events.slice(-DEFAULT_MAX_QUEUE)));
  } catch {
    // Quota exceeded — drop oldest acked/dead first
    try {
      const pruned = events.filter((e) => e.status === 'pending' || e.status === 'failed' || e.status === 'sending');
      window.localStorage.setItem(key, JSON.stringify(pruned.slice(-200)));
    } catch {
      /* never throw from storage */
    }
  }
}

export class PortalMobileSyncManager {
  private queue: SyncEvent[] = [];
  private state: ConnectionState = 'disconnected';
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private readonly maxAttempts: number;
  private readonly maxQueueSize: number;
  private readonly storageKey: string;
  private readonly endpoint: string;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(private readonly options: SyncManagerOptions) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE;
    this.storageKey = options.storageKey ?? STORAGE_KEY;
    this.endpoint = options.endpoint ?? '/api/sync/events';
    this.queue = safeStorageGet(this.storageKey);
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  get pendingCount(): number {
    return this.queue.filter((e) => e.status === 'pending' || e.status === 'failed').length;
  }

  start(): void {
    if (this.destroyed) return;
    this.bindNetworkListeners();
    this.setState(typeof navigator !== 'undefined' && navigator.onLine === false ? 'disconnected' : 'connecting');
    this.flushTimer = setInterval(() => {
      void this.flush().catch((err) => this.safeError(err));
    }, 2_000);
    void this.flush().catch((err) => this.safeError(err));
  }

  stop(): void {
    this.destroyed = true;
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.unbindNetworkListeners();
    this.persist();
    this.setState('disconnected');
  }

  /**
   * Enqueue an event for reliable delivery. Never throws.
   */
  enqueue(
    channel: SyncChannel,
    payload: Record<string, unknown>,
  ): SyncEvent | null {
    try {
      if (this.queue.length >= this.maxQueueSize) {
        // Drop oldest terminal events first; never drop unacked if possible
        const dropIdx = this.queue.findIndex((e) => e.status === 'acked' || e.status === 'dead');
        if (dropIdx >= 0) {
          this.queue.splice(dropIdx, 1);
        } else {
          this.queue.shift();
        }
      }

      const now = new Date().toISOString();
      const event: SyncEvent = {
        id: createEventId(),
        channel,
        companyId: this.options.companyId ?? null,
        deviceId: this.options.deviceId,
        payload: { ...payload },
        clientTimestampMs: Date.now(),
        status: 'pending',
        attempts: 0,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      };
      this.queue.push(event);
      this.persist();
      void this.flush().catch((err) => this.safeError(err, event));
      return event;
    } catch (err) {
      this.safeError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }

  async flush(): Promise<void> {
    if (this.destroyed) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState('disconnected');
      this.scheduleReconnect();
      return;
    }

    const pending = this.queue.filter(
      (e) => e.status === 'pending' || e.status === 'failed',
    );
    if (pending.length === 0) {
      this.setState('connected');
      this.reconnectAttempt = 0;
      return;
    }

    this.setState(this.state === 'reconnecting' ? 'reconnecting' : 'connecting');

    for (const event of pending.slice(0, 10)) {
      await this.sendOne(event);
    }

    const stillPending = this.queue.some((e) => e.status === 'pending' || e.status === 'failed');
    this.setState(stillPending ? 'reconnecting' : 'connected');
    if (stillPending) this.scheduleReconnect();
    else this.reconnectAttempt = 0;
  }

  private async sendOne(event: SyncEvent): Promise<void> {
    event.status = 'sending';
    event.attempts += 1;
    event.updatedAt = new Date().toISOString();
    this.persist();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [event] }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Sync HTTP ${res.status}`);
      }

      event.status = 'acked';
      event.lastError = null;
      event.updatedAt = new Date().toISOString();
      this.persist();
      try {
        this.options.onEventAcked?.(event);
      } catch (cbErr) {
        this.safeError(cbErr instanceof Error ? cbErr : new Error(String(cbErr)), event);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync send failed';
      event.lastError = message;
      event.updatedAt = new Date().toISOString();
      if (event.attempts >= this.maxAttempts) {
        event.status = 'dead';
      } else {
        event.status = 'failed';
      }
      this.persist();
      this.safeError(new Error(message), event);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.destroyed) return;
    const delay = Math.min(30_000, 500 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.flush().catch((err) => this.safeError(err));
    }, delay);
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    try {
      this.options.onStateChange?.(state);
    } catch (err) {
      this.safeError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private persist(): void {
    safeStorageSet(this.storageKey, this.queue);
  }

  private bindNetworkListeners(): void {
    if (typeof window === 'undefined') return;
    this.onlineHandler = () => {
      this.reconnectAttempt = 0;
      void this.flush().catch((err) => this.safeError(err));
    };
    this.offlineHandler = () => {
      this.setState('disconnected');
    };
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private unbindNetworkListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
  }

  private safeError(err: unknown, event?: SyncEvent): void {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[FleetVu Sync]', error.message, event?.id);
    try {
      this.options.onError?.(error, event);
    } catch {
      /* never let callback failures propagate */
    }
  }
}

/** Stable device id for the current browser / PWA install. */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'fleetvu_device_id';
  try {
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = `dev_${crypto.randomUUID()}`;
      window.localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `dev_ephemeral_${Date.now()}`;
  }
}
