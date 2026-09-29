'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PortalMobileSyncManager,
  getOrCreateDeviceId,
  type ConnectionState,
  type SyncChannel,
  type SyncEvent,
} from '@/lib/sync';

/**
 * React hook — portal↔mobile sync with automatic reconnect.
 * Isolates network failures; never throws into the render tree.
 */
export function usePortalMobileSync(options?: {
  companyId?: string | null;
  enabled?: boolean;
}) {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const managerRef = useRef<PortalMobileSyncManager | null>(null);

  useEffect(() => {
    if (options?.enabled === false) return;

    const manager = new PortalMobileSyncManager({
      deviceId: getOrCreateDeviceId(),
      companyId: options?.companyId ?? null,
      onStateChange: (s) => {
        setState(s);
        setPendingCount(manager.pendingCount);
      },
      onError: (err) => setLastError(err.message),
      onEventAcked: () => setPendingCount(manager.pendingCount),
    });
    managerRef.current = manager;
    manager.start();

    return () => {
      manager.stop();
      managerRef.current = null;
    };
  }, [options?.companyId, options?.enabled]);

  const enqueue = useCallback((channel: SyncChannel, payload: Record<string, unknown>): SyncEvent | null => {
    try {
      const event = managerRef.current?.enqueue(channel, payload) ?? null;
      setPendingCount(managerRef.current?.pendingCount ?? 0);
      return event;
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Enqueue failed');
      return null;
    }
  }, []);

  const flush = useCallback(async () => {
    try {
      await managerRef.current?.flush();
      setPendingCount(managerRef.current?.pendingCount ?? 0);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Flush failed');
    }
  }, []);

  return { state, pendingCount, lastError, enqueue, flush };
}
