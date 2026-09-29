'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowUpRight, Lock } from 'lucide-react';

interface GatedBlurOverlayProps {
  /** If true, the trial-mode overlay banner is shown on top of the interactive content */
  gated: boolean;
  /** If true, the content is blurred and locked (post-trial expiration) */
  locked?: boolean;
  /** Delay in ms before the overlay appears (0 = immediate) — kept for API compatibility */
  timeoutMs?: number;
  /** Badge text for the top banner */
  badgeText: string;
  /** Subtext under the badge (unused in transparent mode, kept for API compat) */
  subText?: string;
  /** Label for the upgrade button */
  upgradeLabel?: string;
  /** Called when the upgrade button is clicked */
  onUpgrade: () => void;
  /** Optional: show a "Reset Demo" link (unused in transparent mode, kept for API compat) */
  showReset?: boolean;
  children: React.ReactNode;
}

export function GatedBlurOverlay({
  gated,
  locked = false,
  badgeText,
  upgradeLabel = 'Upgrade Plan',
  onUpgrade,
  children,
}: GatedBlurOverlayProps) {
  if (locked) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm opacity-50">{children}</div>
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-950/60 backdrop-blur-sm rounded-xl animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/40">
            <Lock className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-bold text-orange-300 uppercase tracking-wide">
              {badgeText}
            </span>
          </div>
          <p className="text-xs text-slate-400 text-center max-w-xs px-4">
            Your 30-day BASIC+ trial has ended. Upgrade to PRO to unlock advanced radar telemetry,
            historical reports, and safety scorecards.
          </p>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-1.5"
            onClick={onUpgrade}
          >
            <ArrowUpRight className="w-4 h-4" />
            {upgradeLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {children}
      {gated && (
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/75 backdrop-blur-sm border-b border-orange-500/30 rounded-t-xl animate-fade-in">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wide truncate">
              BASIC+ TRIAL MODE
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline truncate">
              — {badgeText}
            </span>
          </div>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white h-6 px-2.5 text-[10px] font-bold gap-1 shrink-0"
            onClick={onUpgrade}
          >
            <ArrowUpRight className="w-3 h-3" />
            {upgradeLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
