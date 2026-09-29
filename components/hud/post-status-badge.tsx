'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export type PostStatus = 'completed' | 'pending' | 'running' | 'unknown';

export interface PostStatusBadgeProps {
  /** ISO timestamp of the last completed POST check */
  lastPostCheckAt: string | null;
  /** Whether a POST check is currently running */
  isRunning?: boolean;
  /** Hours after which a completed check is considered stale (default: 24) */
  staleThresholdHours?: number;
  /** Optional click handler */
  onClick?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Compute the POST status from the last check timestamp.
 * - Green (COMPLETED) if the last check was within the stale threshold
 * - Orange (RUN TEST / PENDING) if stale or never run
 */
export function computePostStatus(
  lastPostCheckAt: string | null,
  staleThresholdHours = 24,
): PostStatus {
  if (!lastPostCheckAt) return 'pending';

  const lastCheck = new Date(lastPostCheckAt);
  const now = new Date();
  const hoursSinceCheck = (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60);

  if (hoursSinceCheck < 0) return 'completed'; // future timestamp = fresh
  if (hoursSinceCheck <= staleThresholdHours) return 'completed';
  return 'pending';
}

export function PostStatusBadge({
  lastPostCheckAt,
  isRunning = false,
  staleThresholdHours = 24,
  onClick,
  size = 'md',
  className,
}: PostStatusBadgeProps) {
  const status: PostStatus = isRunning
    ? 'running'
    : computePostStatus(lastPostCheckAt, staleThresholdHours);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const config = {
    completed: {
      bg: 'bg-green-500',
      text: 'text-white',
      border: 'border-green-600',
      label: 'POST: COMPLETED',
      icon: <CheckCircle2 className={cn(iconSize[size])} />,
      pulse: false,
    },
    pending: {
      bg: 'bg-orange-500',
      text: 'text-white',
      border: 'border-orange-600',
      label: 'POST: RUN TEST',
      icon: <AlertTriangle className={cn(iconSize[size])} />,
      pulse: true,
    },
    running: {
      bg: 'bg-blue-500',
      text: 'text-white',
      border: 'border-blue-600',
      label: 'POST: RUNNING...',
      icon: <Loader2 className={cn(iconSize[size], 'animate-spin')} />,
      pulse: false,
    },
    unknown: {
      bg: 'bg-slate-400',
      text: 'text-white',
      border: 'border-slate-500',
      label: 'POST: UNKNOWN',
      icon: <AlertTriangle className={cn(iconSize[size])} />,
      pulse: false,
    },
  };

  const c = config[status];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'inline-flex items-center rounded-full border font-bold uppercase tracking-wide transition-all',
        sizeClasses[size],
        c.bg,
        c.text,
        c.border,
        c.pulse && 'animate-pulse',
        onClick && 'hover:opacity-90 cursor-pointer',
        !onClick && 'cursor-default',
        className,
      )}
      title={
        status === 'completed'
          ? `Last POST check: ${formatTimestamp(lastPostCheckAt)}`
          : status === 'pending'
            ? 'Sensors idle >24h or fresh boot — POST check required'
            : status === 'running'
              ? 'POST check in progress...'
              : 'POST status unknown'
      }
    >
      {c.icon}
      {c.label}
    </button>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
