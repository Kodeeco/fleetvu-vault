'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Lock,
  Loader2,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { checkFeatureAccess } from '@/src/vault/feature-tiers';
import { ForensicLockdownBadge } from './forensic-lockdown-badge';

/**
 * Accident Reconstruction Module — Subscription Wrapper (Item 7)
 *
 * Wraps the accident reconstruction component inside the permission middleware.
 * Dynamically checks the master license status:
 *   - Vault OPEN (complimentary / active trial): full access
 *   - Complimentary 12-Month / Active Paid Enterprise: full access
 *   - Vault LOCKED (expired): displays "NOT ACTIVE / SUBSCRIPTION REQUIRED"
 *
 * The underlying reconstruction canvas/renderer is the existing
 * ReconstructionPortal component — this wrapper gates access to it.
 */

export interface ReconstructionWrapperProps {
  companyId: string;
  hardwareSerial: string;
  /** When Vault is OPEN, reconstruction is always granted (binary vault model). */
  vaultIsOpen?: boolean;
  /** The reconstruction component to render when access is granted */
  children: React.ReactNode;
  /** Called when user tries to access while locked */
  onLockedAction?: () => void;
  className?: string;
}

export function ReconstructionWrapper({
  companyId,
  hardwareSerial,
  vaultIsOpen = true,
  children,
  onLockedAction,
  className,
}: ReconstructionWrapperProps) {
  const [accessState, setAccessState] = useState<'loading' | 'granted' | 'locked' | 'grace'>(
    vaultIsOpen ? 'granted' : 'loading',
  );
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Binary Vault: OPEN ⇒ forensic modules available. Do not gate on unbound demo serials.
    if (vaultIsOpen) {
      setAccessState('granted');
      setReason(null);
      return () => {
        active = false;
      };
    }

    async function check() {
      try {
        const result = await checkFeatureAccess(companyId, 'collision_reconstruction', hardwareSerial);
        if (!active) return;
        if (result.allowed) {
          setAccessState('granted');
        } else if (result.in_grace_period) {
          setAccessState('grace');
          setReason(result.reason);
        } else {
          setAccessState('locked');
          setReason(result.reason);
        }
      } catch (err) {
        if (!active) return;
        // Soft-fail closed only when vault is already LOCKED; never blank the tab.
        console.warn('[ReconstructionWrapper] feature check failed:', err);
        setAccessState('locked');
        setReason(err instanceof Error ? err.message : 'Feature check failed');
      }
    }
    check();
    return () => {
      active = false;
    };
  }, [companyId, hardwareSerial, vaultIsOpen]);

  if (accessState === 'loading') {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (accessState === 'granted') {
    return <div className={className}>{children}</div>;
  }

  // Locked or grace — do NOT mount children (avoids canvas/runtime work behind the overlay)
  return (
    <div className={cn('relative min-h-[420px]', className)}>
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-sm rounded-xl">
        <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
          {accessState === 'grace' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-amber-300">
                Grace Period — Accident Reconstruction
              </h3>
              <p className="text-sm text-slate-400">
                Your complimentary period has expired but you&apos;re in the grace window.
                Start a subscription to maintain full access.
              </p>
              <p className="text-xs text-amber-400/80">{reason}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-red-300">
                Accident Reconstruction Module
              </h3>
              <p className="text-sm text-slate-400">
                Vault is LOCKED. This module is included at no cost while Vault is OPEN
                (12-month complimentary hardware period). Renew to restore forensic access.
              </p>
              <div className="mt-2">
                <ForensicLockdownBadge
                  hardwareSerial={hardwareSerial}
                  companyId={companyId}
                  variant="banner"
                  onStartSubscription={onLockedAction}
                />
              </div>
            </>
          )}

          {onLockedAction && (
            <Button
              className="mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold"
              onClick={onLockedAction}
            >
              <Play className="w-4 h-4 mr-2" />
              Start Subscription
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
