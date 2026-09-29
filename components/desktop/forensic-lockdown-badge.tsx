'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Lock,
  AlertTriangle,
  ShieldX,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { verifyLicense } from '@/src/vault/licensing';
import { getSubscriptionRequestStatus } from '@/lib/subscription-workflow';

export type ForensicLockdownStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'pending_subscription'
  | 'unknown';

export interface ForensicLockdownBadgeProps {
  hardwareSerial: string;
  companyId: string;
  /** Show the full banner (for vault dashboards) or compact badge (for inline) */
  variant?: 'banner' | 'badge';
  /** Called when user clicks "Start Subscription" */
  onStartSubscription?: () => void;
  className?: string;
}

export function ForensicLockdownBadge({
  hardwareSerial,
  companyId,
  variant = 'badge',
  onStartSubscription,
  className,
}: ForensicLockdownBadgeProps) {
  const [status, setStatus] = useState<ForensicLockdownStatus>('unknown');
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [subStatus, setSubStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const verification = await verifyLicense(hardwareSerial);
        if (!active) return;

        // Unbound hardware ≠ expired. Treat as complimentary / unknown-active until a real license expires.
        if (!verification.valid && verification.error && /no license bound/i.test(verification.error)) {
          setStatus('active');
          return;
        }

        if (!verification.valid) {
          const sub = await getSubscriptionRequestStatus(companyId);
          if (!active) return;
          setSubStatus(sub.status);
          setStatus(sub.status === 'submitted' ? 'pending_subscription' : 'expired');
        } else if (verification.complimentary_remaining_days <= 30) {
          setStatus('expiring_soon');
          setDaysRemaining(verification.complimentary_remaining_days);
        } else {
          setStatus('active');
        }
      } catch {
        if (!active) return;
        setStatus('unknown');
      }
    }
    check();
    return () => { active = false; };
  }, [hardwareSerial, companyId]);

  const config = {
    active: {
      bg: 'bg-green-500',
      border: 'border-green-600',
      text: 'text-white',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'FORENSIC VAULT: ACTIVE',
      sublabel: 'All enterprise features unlocked',
    },
    expiring_soon: {
      bg: 'bg-amber-500',
      border: 'border-amber-600',
      text: 'text-white',
      icon: <Clock className="w-4 h-4" />,
      label: `FORENSIC VAULT: EXPIRING IN ${daysRemaining} DAYS`,
      sublabel: 'Start subscription to maintain access',
    },
    expired: {
      bg: 'bg-red-600',
      border: 'border-red-700',
      text: 'text-white',
      icon: <ShieldX className="w-4 h-4" />,
      label: 'FORENSIC VAULT: NOT ACTIVE / SUBSCRIPTION REQUIRED',
      sublabel: 'SHA-256 hashing, Merkle chaining, ZKP exports, and Accident Reconstruction are locked',
    },
    pending_subscription: {
      bg: 'bg-blue-500',
      border: 'border-blue-600',
      text: 'text-white',
      icon: <Clock className="w-4 h-4 animate-pulse" />,
      label: 'SUBSCRIPTION PENDING',
      sublabel: 'Your subscription request has been submitted. FleetVu team will contact you shortly.',
    },
    unknown: {
      bg: 'bg-slate-400',
      border: 'border-slate-500',
      text: 'text-white',
      icon: <AlertTriangle className="w-4 h-4" />,
      label: 'FORENSIC VAULT: STATUS UNKNOWN',
      sublabel: 'Unable to verify license status',
    },
  };

  const c = config[status];

  if (variant === 'badge') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wide',
          c.bg, c.text, c.border,
          className,
        )}
        title={c.sublabel}
      >
        {c.icon}
        {c.label}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3 rounded-xl border-2',
        c.bg, c.border,
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">{c.icon}</div>
        <div className="min-w-0">
          <p className={cn('text-sm font-bold uppercase tracking-wide', c.text)}>
            {c.label}
          </p>
          <p className={cn('text-xs opacity-90 truncate', c.text)}>
            {c.sublabel}
          </p>
        </div>
      </div>
      {(status === 'expired' || status === 'expiring_soon') && onStartSubscription && (
        <button
          onClick={onStartSubscription}
          className="shrink-0 px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 transition-colors"
        >
          Start Subscription
        </button>
      )}
      {status === 'pending_subscription' && (
        <div className="shrink-0 px-4 py-2 rounded-lg bg-white/20 text-white text-sm font-semibold">
          Request Submitted
        </div>
      )}
    </div>
  );
}
