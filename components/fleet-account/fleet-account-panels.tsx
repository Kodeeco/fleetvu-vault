'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Shield,
  Settings2,
  FileText,
  AlertTriangle,
  ScrollText,
  Plus,
  Trash2,
  Link2,
  Download,
  KeyRound,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  FleetAccountCadence,
  FleetAccountSettings,
  FleetAuditEntry,
  IncidentShareLink,
  ReportKind,
  ReportRecipient,
} from '@/lib/fleet-account/types';

const SESSION_KEY = 'fleetvu_fleet_account_session';

export type FleetPortalTab =
  | 'roster'
  | 'reports'
  | 'incidents'
  | 'settings'
  | 'audit'
  | 'account';

export function getFleetSession(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setFleetSession(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

async function faFetch(token: string, pathQuery: string, init?: RequestInit) {
  const session = getFleetSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (session) headers['X-Fleet-Session'] = session;
  return fetch(`/api/fleet-account?token=${encodeURIComponent(token)}${pathQuery}`, {
    ...init,
    headers,
  });
}

export function FleetAccountNav({
  tab,
  onChange,
  companyName,
  logoUrl,
}: {
  tab: FleetPortalTab;
  onChange: (t: FleetPortalTab) => void;
  companyName: string;
  logoUrl?: string | null;
}) {
  const items: { id: FleetPortalTab; label: string; icon: ReactNode }[] = [
    { id: 'roster', label: 'Roster', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings2 className="w-3.5 h-3.5" /> },
    { id: 'audit', label: 'Audit Log', icon: <ScrollText className="w-3.5 h-3.5" /> },
    { id: 'account', label: 'Login', icon: <KeyRound className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl || '/FV-Vault3.png'}
            alt={companyName}
            className="h-12 w-auto max-w-[160px] object-contain"
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90 font-bold">
              Fleet Account Portal
            </p>
            <h1 className="text-lg font-bold text-white truncate">{companyName}</h1>
            <p className="text-[10px] text-slate-500">Powered by FleetVu Vault</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-slate-700 pb-3">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              tab === it.id
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AccountAuthPanel({
  token,
  contactEmail,
  passwordSet,
  onAuthed,
}: {
  token: string;
  contactEmail: string;
  passwordSet: boolean;
  onAuthed: () => void;
}) {
  const [email, setEmail] = useState(contactEmail || '');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (action: 'set_password' | 'login') => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/fleet-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, token, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.sessionToken) setFleetSession(data.sessionToken);
      setMsg(action === 'login' ? 'Signed in.' : 'Password saved. You can return anytime with email + password.');
      onAuthed();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 space-y-4 max-w-md">
      <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
        <LogIn className="w-4 h-4" />
        {passwordSet ? 'Sign in to your fleet account' : 'Create your fleet portal password'}
      </h2>
      <p className="text-xs text-slate-400 leading-relaxed">
        Bookmark this portal. After you set a password, you can sign in without relying only on the
        welcome-email token. Super-Admin / Admin access for roster, reports, incidents, and settings.
      </p>
      <div className="space-y-2">
        <label className="text-[10px] uppercase text-slate-500 font-bold">Email</label>
        <Input
          className="h-9 bg-slate-950 border-slate-700 text-xs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="text-[10px] uppercase text-slate-500 font-bold">Password</label>
        <Input
          type="password"
          className="h-9 bg-slate-950 border-slate-700 text-xs"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      {msg && <p className="text-xs text-sky-200">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {!passwordSet ? (
          <Button
            disabled={busy}
            className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
            onClick={() => void submit('set_password')}
          >
            Set password
          </Button>
        ) : (
          <>
            <Button
              disabled={busy}
              className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              onClick={() => void submit('login')}
            >
              Sign in
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              className="h-9 text-xs border-slate-600"
              onClick={() => void submit('set_password')}
            >
              Reset / update password
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function SettingsPanel({
  token,
  initial,
  actorEmail,
  onSaved,
}: {
  token: string;
  initial: FleetAccountSettings;
  actorEmail: string;
  onSaved?: (s: FleetAccountSettings) => void;
}) {
  const [settings, setSettings] = useState(initial);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [target, setTarget] = useState<ReportKind>('safety_digest');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(initial);
  }, [initial]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/fleet-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          token,
          updatedBy: actorEmail,
          safetyDigestCadence: settings.safetyDigestCadence,
          recipients: settings.recipients,
          notifyDriverOnSensorFault: settings.notifyDriverOnSensorFault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSettings(data.settings);
      onSaved?.(data.settings);
      setMsg('Settings saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const addRecipient = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    const list = [...(settings.recipients[target] || [])];
    if (list.some((r) => r.email === email)) {
      setMsg('That email is already on the list.');
      return;
    }
    const row: ReportRecipient = {
      email,
      name: newName.trim() || undefined,
      external: true,
      addedAt: new Date().toISOString(),
      addedBy: actorEmail,
    };
    setSettings((s) => ({
      ...s,
      recipients: { ...s.recipients, [target]: [...list, row] },
    }));
    setNewEmail('');
    setNewName('');
  };

  const removeRecipient = (kind: ReportKind, email: string) => {
    setSettings((s) => ({
      ...s,
      recipients: {
        ...s.recipients,
        [kind]: (s.recipients[kind] || []).filter((r) => r.email !== email),
      },
    }));
  };

  const cadences: { id: FleetAccountCadence; label: string }[] = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'biweekly', label: 'Bi-weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'quarterly', label: 'Quarterly' },
  ];

  const kinds: { id: ReportKind; label: string }[] = [
    { id: 'safety_digest', label: 'Safety digest' },
    { id: 'insurance_scorecard', label: 'Insurance scorecard' },
    { id: 'post_logs', label: 'POST / logs' },
    { id: 'sensor_fault_alerts', label: 'Sensor fault alerts' },
    { id: 'incident_packages', label: 'Incident packages' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
        <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide">Report cadence</h2>
        <p className="text-xs text-slate-400">
          Default is weekly. Choose how often sealed Safety digests are generated for your fleet.
        </p>
        <div className="flex flex-wrap gap-2">
          {cadences.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, safetyDigestCadence: c.id }))}
              className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                settings.safetyDigestCadence === c.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300 pt-2">
          <input
            type="checkbox"
            checked={settings.notifyDriverOnSensorFault}
            onChange={(e) =>
              setSettings((s) => ({ ...s, notifyDriverOnSensorFault: e.target.checked }))
            }
          />
          Notify driver in Vault when a sensor is offline / faulty
        </label>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
        <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
          Who receives what
        </h2>
        <p className="text-xs text-slate-400">
          Add HR, brokers, safety managers, or colleagues per report type. Changes are audit-logged.
        </p>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setTarget(k.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                target === k.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input
            className="h-9 bg-slate-950 border-slate-700 text-xs"
            placeholder="email@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Input
            className="h-9 bg-slate-950 border-slate-700 text-xs"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="h-8 text-xs bg-slate-700 hover:bg-slate-600"
          onClick={addRecipient}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add to {kinds.find((k) => k.id === target)?.label}
        </Button>
        <ul className="space-y-1.5">
          {(settings.recipients[target] || []).map((r) => (
            <li
              key={r.email}
              className="flex items-center justify-between gap-2 text-xs bg-slate-950/60 border border-slate-800 rounded-md px-3 py-2"
            >
              <span>
                <span className="text-white font-medium">{r.name || r.email}</span>
                {r.name ? <span className="text-slate-500"> · {r.email}</span> : null}
              </span>
              <button
                type="button"
                className="text-red-400 hover:text-red-300"
                onClick={() => removeRecipient(target, r.email)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {(settings.recipients[target] || []).length === 0 && (
            <li className="text-xs text-slate-500">No recipients yet for this report type.</li>
          )}
        </ul>
      </div>

      {msg && <p className="text-xs text-sky-200">{msg}</p>}
      <Button
        disabled={busy}
        className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
        onClick={() => void save()}
      >
        Save account settings
      </Button>
    </div>
  );
}

export function AuditPanel({ token }: { token: string }) {
  const [entries, setEntries] = useState<FleetAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await faFetch(token, '&view=audit');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setEntries(data.entries || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    const header = ['at', 'action', 'actorEmail', 'actorName', 'ip', 'detail'];
    const rows = entries.map((e) =>
      [e.at, e.action, e.actorEmail || '', e.actorName || '', e.ip || '', e.detail || '']
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleetvu-account-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide mr-auto">
          Account activity (append-only)
        </h2>
        <Button size="sm" variant="outline" className="h-8 text-xs border-slate-600" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5 mr-1" />
          Export CSV
        </Button>
      </div>
      {error && <p className="px-4 py-2 text-xs text-red-300">{error}</p>}
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-950 text-slate-500 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">When (UTC)</th>
              <th className="text-left px-3 py-2 font-semibold">Action</th>
              <th className="text-left px-3 py-2 font-semibold">Who</th>
              <th className="text-left px-3 py-2 font-semibold">IP</th>
              <th className="text-left px-3 py-2 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-800 text-slate-300">
                <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px]">{e.at}</td>
                <td className="px-3 py-2 text-amber-200/90">{e.action}</td>
                <td className="px-3 py-2">{e.actorEmail || e.actorName || '—'}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{e.ip || '—'}</td>
                <td className="px-3 py-2 text-slate-400">{e.detail || '—'}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No activity yet. Logins, settings changes, and shares will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportsPanel({ companyName }: { companyName: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 space-y-3">
      <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Reports library
      </h2>
      <p className="text-xs text-slate-400 leading-relaxed">
        {companyName}&apos;s sealed Safety digests, Insurance scorecards, POST / event logs, and
        incident packs will list here for Admin / Super-Admin download. Cadence and recipients are
        controlled under <strong className="text-amber-200">Settings</strong>.
      </p>
      <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
        <li>Safety &amp; Event digest (Fri→Mon leadership pack)</li>
        <li>Insurance scorecard / forensic exhibits</li>
        <li>Daily POST compliance history</li>
        <li>Incident packages (photos, licenses, insurance cards, GPS stamps)</li>
      </ul>
      <p className="text-[11px] text-slate-500">
        Live archive wiring continues next — settings + audit + secure share are live now.
      </p>
    </div>
  );
}

export function IncidentsPanel({
  token,
  actorEmail,
}: {
  token: string;
  actorEmail: string;
}) {
  const [shares, setShares] = useState<IncidentShareLink[]>([]);
  const [incidentId, setIncidentId] = useState('');
  const [label, setLabel] = useState('');
  const [recipients, setRecipients] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await faFetch(token, '&view=shares');
    const data = await res.json();
    if (res.ok) setShares(data.shares || []);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const createShare = async () => {
    setMsg(null);
    setLastUrl(null);
    try {
      const res = await fetch('/api/fleet-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_share',
          token,
          incidentId: incidentId.trim() || `pending-${Date.now()}`,
          incidentLabel: label.trim() || 'Roadside incident package',
          recipients: recipients.split(/[,;\s]+/).filter(Boolean),
          createdBy: actorEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Share failed');
      setLastUrl(data.shareUrl);
      setMsg('Secure share link created. Forward this link — do not email raw photos.');
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Share failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 space-y-3">
        <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Incidents &amp; secure forward
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Driver Vault captures licenses, insurance cards, vehicle photos, time, and location into a
          sealed package. From this portal, create an <strong className="text-amber-200">expiring
          secure link</strong> for insurance adjusters, police, or colleagues. Every share is
          audit-logged.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input
            className="h-9 bg-slate-950 border-slate-700 text-xs"
            placeholder="Incident ID (or leave blank for draft id)"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
          />
          <Input
            className="h-9 bg-slate-950 border-slate-700 text-xs"
            placeholder="Label e.g. I-95 / Unit 72"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Input
          className="h-9 bg-slate-950 border-slate-700 text-xs"
          placeholder="Recipients: adjuster@insurer.com, officer@pd.gov"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
        />
        <Button
          className="h-9 text-xs bg-orange-500 hover:bg-orange-400 text-white font-bold"
          onClick={() => void createShare()}
        >
          <Link2 className="w-3.5 h-3.5 mr-1.5" />
          Create secure share link
        </Button>
        {msg && <p className="text-xs text-sky-200">{msg}</p>}
        {lastUrl && (
          <p className="text-[11px] font-mono text-amber-200/90 break-all bg-slate-950/80 border border-slate-800 rounded p-2">
            {lastUrl}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700 text-xs font-bold text-slate-400 uppercase">
          Active shares
        </div>
        <ul className="divide-y divide-slate-800 text-xs">
          {shares.map((s) => (
            <li key={s.id} className="px-4 py-3 text-slate-300">
              <div className="font-medium text-white">{s.incidentLabel || s.incidentId}</div>
              <div className="text-slate-500 mt-0.5">
                To: {s.recipients.join(', ')} · Expires {s.expiresAt.slice(0, 10)}
                {s.revokedAt ? ' · REVOKED' : ''}
              </div>
            </li>
          ))}
          {shares.length === 0 && (
            <li className="px-4 py-6 text-slate-500 text-center">No shares yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
