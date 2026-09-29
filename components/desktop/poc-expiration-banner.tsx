'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import {
  checkExpirationStatus,
  submitSubscriptionRequest,
  getSubscriptionRequestStatus,
  type SubscriptionRequestInput,
} from '@/lib/subscription-workflow';

/**
 * Role-Restricted POC Expiration Banner (Items 12-13)
 *
 * Appears ONLY on POC / Admin / Super screens — hidden from drivers.
 * Must never contradict the header Vault OPEN / LOCKED badge.
 */

const RESTRICTED_ROLES = ['executive', 'super_admin', 'global_admin', 'admin', 'manager'];

export interface PocExpirationBannerProps {
  hardwareSerial: string;
  companyId: string;
  companyName: string;
  location?: string | null;
  pocName?: string;
  pocEmail?: string;
  hardwareSerials?: string[];
  /** When Vault UI is OPEN (trial/complimentary), never show "Expired / LOCKED" */
  vaultIsOpen?: boolean;
  className?: string;
}

export function PocExpirationBanner({
  hardwareSerial,
  companyId,
  companyName,
  location,
  pocName,
  pocEmail,
  hardwareSerials = [],
  vaultIsOpen = true,
  className,
}: PocExpirationBannerProps) {
  const { user } = useApp();
  const roleAllowed = !!user && RESTRICTED_ROLES.includes(user.role);

  const [expiringSoon, setExpiringSoon] = useState(false);
  const [expired, setExpired] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [licenseBound, setLicenseBound] = useState(false);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!roleAllowed) return;
    let active = true;
    async function check() {
      const status = await checkExpirationStatus(hardwareSerial);
      if (!active) return;
      setExpiringSoon(status.expiringSoon);
      setExpired(status.expired);
      setDaysRemaining(status.daysRemaining);
      setLicenseBound(status.licenseBound);

      const sub = await getSubscriptionRequestStatus(companyId);
      if (!active) return;
      setSubStatus(sub.status);
    }
    void check();
    return () => {
      active = false;
    };
  }, [hardwareSerial, companyId, roleAllowed]);

  if (!roleAllowed) return null;
  if (dismissed) return null;
  if (subStatus === 'submitted' || subStatus === 'invoiced' || subStatus === 'paid') return null;
  // No bound license yet — do not invent expired against an OPEN vault
  if (!licenseBound) return null;
  // Never contradict header OPEN badge
  if (vaultIsOpen && expired) return null;
  if (!expiringSoon && !expired) return null;

  const showAsExpired = expired && !vaultIsOpen;

  const handleStartSubscription = async () => {
    setSubmitting(true);
    const input: SubscriptionRequestInput = {
      companyId,
      companyName,
      location: location ?? null,
      pocName: pocName ?? user?.name ?? 'Unknown',
      pocEmail: pocEmail ?? user?.email ?? 'unknown@fleetvu.org',
      affectedUnitCount: Math.max(1, hardwareSerials.length),
      hardwareSerials,
    };
    await submitSubscriptionRequest(input);
    setSubmitting(false);
    setShowConfirmation(true);
    setSubStatus('submitted');
  };

  if (showConfirmation) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-3 rounded-xl',
          'bg-blue-50 border-2 border-blue-300',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-900">Subscription Request Submitted Successfully!</p>
            <p className="text-xs text-blue-700">
              Status: Subscription Pending — FleetVu team will contact you shortly.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="text-blue-400 hover:text-blue-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 rounded-xl',
        showAsExpired ? 'bg-red-50 border-2 border-red-300' : 'bg-amber-50 border-2 border-amber-300',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={cn('w-5 h-5 shrink-0', showAsExpired ? 'text-red-500' : 'text-amber-500')}
        />
        <div>
          <p className={cn('text-sm font-bold', showAsExpired ? 'text-red-900' : 'text-amber-900')}>
            {showAsExpired
              ? 'Forensic Vault Is LOCKED'
              : `Forensic Vault will LOCK in ${daysRemaining} Days`}
          </p>
          <p className={cn('text-xs', showAsExpired ? 'text-red-700' : 'text-amber-700')}>
            {showAsExpired
              ? 'SHA-256 sealing and reconstruction are locked. PDFs still download unsealed. Start your subscription to reopen the Vault.'
              : 'Vault is still OPEN. Start your subscription now to keep SHA-256 sealing, Merkle chaining, and reconstruction.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className={cn(
            'font-bold',
            showAsExpired
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white',
          )}
          onClick={handleStartSubscription}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Submitting...
            </>
          ) : (
            'Start Subscription'
          )}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={cn('hover:opacity-70', showAsExpired ? 'text-red-400' : 'text-amber-400')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
