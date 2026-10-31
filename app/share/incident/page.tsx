'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, Lock, Shield, XCircle } from 'lucide-react';

type ShareStatus = 'active' | 'expired' | 'revoked' | 'missing' | 'loading' | 'error';

type SharePayload = {
  status: ShareStatus;
  companyName?: string;
  incidentId?: string;
  incidentLabel?: string;
  expiresAt?: string;
  createdAt?: string;
  accessCount?: number;
  error?: string;
};

function statusChrome(status: ShareStatus) {
  switch (status) {
    case 'active':
      return {
        icon: <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />,
        title: 'Verified secure package',
        badge: 'Active',
        badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
      };
    case 'expired':
      return {
        icon: <Clock className="w-10 h-10 text-amber-400 mx-auto" />,
        title: 'This share link has expired',
        badge: 'Expired',
        badgeClass: 'bg-amber-500/20 text-amber-100 border-amber-500/40',
      };
    case 'revoked':
      return {
        icon: <XCircle className="w-10 h-10 text-red-400 mx-auto" />,
        title: 'This share link was revoked',
        badge: 'Revoked',
        badgeClass: 'bg-red-500/20 text-red-200 border-red-500/40',
      };
    case 'missing':
      return {
        icon: <Lock className="w-10 h-10 text-slate-400 mx-auto" />,
        title: 'Share link not found',
        badge: 'Invalid',
        badgeClass: 'bg-slate-700 text-slate-300 border-slate-600',
      };
    case 'error':
      return {
        icon: <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />,
        title: 'Unable to open share',
        badge: 'Error',
        badgeClass: 'bg-amber-500/20 text-amber-100 border-amber-500/40',
      };
    default:
      return {
        icon: <Shield className="w-10 h-10 text-amber-400 mx-auto animate-pulse" />,
        title: 'Opening secure package…',
        badge: 'Loading',
        badgeClass: 'bg-slate-700 text-slate-300 border-slate-600',
      };
  }
}

function ShareInner() {
  const params = useSearchParams();
  const t = params.get('t') || params.get('token') || '';
  const [data, setData] = useState<SharePayload>({ status: 'loading' });

  useEffect(() => {
    if (!t) {
      setData({ status: 'missing' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/share/incident?t=${encodeURIComponent(t)}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok && json.status !== 'expired' && json.status !== 'revoked') {
          setData({
            status: (json.status as ShareStatus) || (res.status === 404 ? 'missing' : 'error'),
            error: json.error,
          });
          return;
        }
        setData({
          status: (json.status as ShareStatus) || 'missing',
          companyName: json.companyName,
          incidentId: json.incidentId,
          incidentLabel: json.incidentLabel,
          expiresAt: json.expiresAt,
          createdAt: json.createdAt,
          accessCount: json.accessCount,
        });
      } catch {
        if (!cancelled) setData({ status: 'error', error: 'Network error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const chrome = statusChrome(data.status);

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-200 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border border-slate-700 bg-slate-900/90 p-6 space-y-4">
        <div className="text-center space-y-2">
          {chrome.icon}
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90 font-bold">
            FleetVu Vault · Secure share
          </p>
          <h1 className="text-xl font-bold text-white">{chrome.title}</h1>
          <span
            className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${chrome.badgeClass}`}
          >
            {chrome.badge}
          </span>
        </div>

        {(data.status === 'active' || data.status === 'expired' || data.status === 'revoked') && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-slate-500">Company</span>
              <span className="text-white font-medium text-right">{data.companyName || '—'}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-slate-500">Package</span>
              <span className="text-white font-medium text-right">
                {data.incidentLabel || data.incidentId || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-slate-500">Incident ID</span>
              <span className="font-mono text-[11px] text-slate-300 text-right">
                {data.incidentId || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-slate-500">Expires</span>
              <span className="text-slate-300 text-right">
                {data.expiresAt ? data.expiresAt.slice(0, 10) : '—'}
              </span>
            </div>
          </div>
        )}

        {data.status === 'active' && (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-200">Package contents</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Photos, licenses, insurance cards, and GPS stamps attach here when Driver Vault syncs
              the sealed roadside package. This link is verified and access is audit-logged.
            </p>
            <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-1">
              <li>Driver license &amp; insurance card captures</li>
              <li>Vehicle / scene photos</li>
              <li>Time &amp; location stamps</li>
            </ul>
          </div>
        )}

        {data.status === 'missing' && (
          <p className="text-sm text-slate-400 text-center leading-relaxed">
            {t
              ? 'This token is invalid or was never issued. Ask the fleet contact for a new secure link.'
              : 'Missing share token in the URL.'}
          </p>
        )}

        {data.status === 'error' && (
          <p className="text-sm text-amber-200/90 text-center">{data.error || 'Please try again.'}</p>
        )}

        <p className="text-[10px] text-slate-600 text-center">
          Powered by FleetVu Vault · access is audited · do not forward raw media outside this link
        </p>
      </div>
    </div>
  );
}

export default function IncidentSharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1220] text-slate-400 flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <ShareInner />
    </Suspense>
  );
}
