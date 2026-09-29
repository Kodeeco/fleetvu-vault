'use client';

/**
 * FleetVu Admin CRM Workspace
 * ===========================
 * INTERNAL FleetVu staff only (Global Admin).
 * Manages customer commercial accounts — never sensor/incident/forensic data.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Truck,
  Lock,
  Plus,
  Search,
  Pencil,
  Eye,
  LogOut,
  Settings,
  Users,
  Calendar,
  KeyRound,
  DollarSign,
  Mail,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useApp, type AuthUser } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import type { Company } from '@/lib/types';
import { MasterProvisioningConsole } from '@/components/desktop/master-provisioning-console';
import { SystemSettingsPanel } from '@/components/desktop/system-settings-panel';
import { CrmEmailConfigPanel } from '@/components/desktop/crm-email-config-panel';
import { CrmRosterReviewPanel } from '@/components/desktop/crm-roster-review-panel';

type CrmTab =
  | 'customers'
  | 'pipeline'
  | 'calendar'
  | 'entitlements'
  | 'pricing'
  | 'renewals'
  | 'email'
  | 'roster_review'
  | 'audit'
  | 'onboard'
  | 'settings';

interface FleetVuCrmWorkspaceProps {
  user: AuthUser;
}

export function FleetVuCrmWorkspace({ user }: FleetVuCrmWorkspaceProps) {
  const { logout } = useApp();
  const [tab, setTab] = useState<CrmTab>('customers');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('companies').select('*').order('name');
      setCompanies((data as Company[]) || []);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const totalMrr = companies.reduce((s, c) => s + Number(c.monthly_recurring_revenue || 0), 0);
    const active = companies.filter((c) => (c.account_status || 'active') === 'active').length;
    const trial = companies.filter((c) => c.account_status === 'trial').length;
    const healthy = companies.filter((c) => (c.health_score ?? 80) >= 70).length;
    const atRisk = companies.filter((c) => (c.health_score ?? 80) < 60).length;
    const now = Date.now();
    const expiring = companies.filter((c) => {
      if (!c.contract_end_date && !c.plan_end_date) return false;
      const end = new Date(c.contract_end_date || c.plan_end_date || '').getTime();
      const days = (end - now) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 60;
    }).length;
    const expired = companies.filter((c) => {
      const endRaw = c.contract_end_date || c.plan_end_date;
      if (!endRaw) return false;
      return new Date(endRaw).getTime() < now;
    }).length;
    return { totalMrr, accounts: companies.length, active, trial, healthy, atRisk, expiring, expired };
  }, [companies]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      (c.sales_rep || '').toLowerCase().includes(q);
    const st = (c.account_status || 'active').toLowerCase();
    const matchesStatus = statusFilter === 'all' || st === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const tabs: Array<{ id: CrmTab; label: string; icon: typeof Users }> = [
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'pipeline', label: 'Pipeline', icon: Building2 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'entitlements', label: 'Feature Entitlements', icon: KeyRound },
    { id: 'pricing', label: 'Pricing Tiers', icon: DollarSign },
    { id: 'renewals', label: 'Renewal Notices', icon: Mail },
    { id: 'email', label: 'Email Config', icon: Mail },
    { id: 'roster_review', label: 'Roster Review', icon: Users },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  ];

  if (tab === 'onboard') {
    return (
      <div className="h-[100dvh] bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
        <CrmHeader user={user} onLogout={logout} />
        <div className="flex-1 overflow-y-auto">
          <MasterProvisioningConsole
            user={user}
            companies={companies}
            onClientCreated={load}
            onClose={() => setTab('customers')}
          />
        </div>
      </div>
    );
  }

  if (tab === 'settings') {
    return (
      <div className="h-[100dvh] bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
        <CrmHeader user={user} onLogout={logout} />
        <div className="flex-1 overflow-y-auto">
          <SystemSettingsPanel user={user} onClose={() => setTab('customers')} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      <CrmHeader user={user} onLogout={logout} onAccount={() => setTab('settings')} />

      {/* Nav tabs */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/80 px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zero-access banner */}
      <div className="shrink-0 mx-4 mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-200">Zero-Access Boundary Enforced</p>
          <p className="text-[11px] text-emerald-100/70 leading-relaxed mt-0.5">
            This portal manages service control only — customer name, location, phone, email, vehicle count, and contract timelines.
            No sensor data, driver records, safety reports, or forensic vault content is accessible.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="shrink-0 px-4 pt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Kpi label="TOTAL MRR" value={`$${metrics.totalMrr.toLocaleString()}`} color="text-emerald-400" />
        <Kpi label="ACCOUNTS" value={`${metrics.accounts}`} sub={`${metrics.active} active · ${metrics.trial} trial`} color="text-sky-400" />
        <Kpi label="HEALTHY" value={`${metrics.healthy}`} sub={`of ${metrics.accounts}`} color="text-emerald-400" />
        <Kpi label="AT RISK" value={`${metrics.atRisk}`} sub="health &lt; 60" color="text-orange-400" />
        <Kpi label="EXPIRING" value={`${metrics.expiring}`} sub="within 60 days" color="text-amber-300" />
        <Kpi label="EXPIRED" value={`${metrics.expired}`} color="text-red-400" />
      </div>

      {/* Main */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 py-3 flex flex-col">
        {tab === 'customers' && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs font-bold"
                onClick={() => setTab('onboard')}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Onboard New Client
              </Button>
              <select
                className="h-8 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-300 px-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="prospect">Prospect</option>
                <option value="at_risk">At Risk</option>
                <option value="churned">Churned</option>
              </select>
              <div className="relative flex-1 min-w-[160px] max-w-xs ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search companies…"
                  className="h-8 pl-8 bg-slate-900 border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-800 bg-slate-900/50">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Company</th>
                    <th className="px-3 py-2 font-semibold">Owner</th>
                    <th className="px-3 py-2 font-semibold">MRR</th>
                    <th className="px-3 py-2 font-semibold">Health</th>
                    <th className="px-3 py-2 font-semibold">Plan</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Vault</th>
                    <th className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                        Loading accounts…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                        No customer accounts yet. Onboard a new client to begin.
                      </td>
                    </tr>
                  )}
                  {filtered.map((c) => {
                    const health = c.health_score ?? 80;
                    const status = (c.account_status || 'active').toUpperCase();
                    const vaultLabel = vaultStatusLabel(c);
                    return (
                      <tr key={c.id} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-white">{c.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {[c.location, c.region].filter(Boolean).join(', ') || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{c.sales_rep || '—'}</td>
                        <td className="px-3 py-2.5 text-emerald-300 font-semibold">
                          ${Number(c.monthly_recurring_revenue || 0).toLocaleString()}/mo
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-bold ${
                              health >= 70 ? 'text-emerald-400' : health >= 60 ? 'text-amber-300' : 'text-orange-400'
                            }`}
                          >
                            {health}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-[10px] uppercase">
                            {c.plan_tier}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{vaultLabel}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button type="button" className="p-1.5 rounded hover:bg-slate-700 text-slate-400" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" className="p-1.5 rounded hover:bg-slate-700 text-slate-400" title="View">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'email' && (
          <div className="flex-1 min-h-0">
            <CrmEmailConfigPanel companies={companies} />
          </div>
        )}

        {tab === 'roster_review' && (
          <div className="flex-1 min-h-0">
            <CrmRosterReviewPanel />
          </div>
        )}

        {tab !== 'customers' && tab !== 'email' && tab !== 'roster_review' && (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="text-center max-w-md px-6">
              <ShieldCheck className="w-10 h-10 text-orange-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white capitalize">{tab.replace('_', ' ')}</h3>
              <p className="text-sm text-slate-400 mt-2">
                FleetVu internal CRM module. Commercial ops only — no customer legal or forensic data.
              </p>
              <Button className="mt-4 bg-orange-500 hover:bg-orange-600" onClick={() => setTab('customers')}>
                Back to Customers
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CrmHeader({
  user,
  onLogout,
  onAccount,
}: {
  user: AuthUser;
  onLogout: () => void;
  onAccount?: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white leading-tight">FleetVu Admin</div>
          <div className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">CRM Workspace</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex flex-col items-end leading-tight mr-1">
          <span className="text-xs text-slate-300 truncate max-w-[180px]">{user.email}</span>
          <span className="text-[9px] font-black text-orange-400 tracking-wide">GLOBAL_ADMIN</span>
        </div>
        {onAccount && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-slate-300 hover:text-white"
            onClick={onAccount}
          >
            <Settings className="w-3.5 h-3.5 mr-1" /> Account
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 text-xs text-red-300 hover:text-red-200" onClick={onLogout}>
          <LogOut className="w-3.5 h-3.5 mr-1" /> Log off
        </Button>
      </div>
    </header>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2">
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-base font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-500" dangerouslySetInnerHTML={{ __html: sub }} />}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === 'active'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : s === 'at_risk' || s === 'past_due'
        ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
        : s === 'prospect' || s === 'trial'
          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
          : 'bg-slate-700/50 text-slate-300 border-slate-600';
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${cls}`}>
      {status}
    </span>
  );
}

function vaultStatusLabel(c: Company): string {
  const end = c.plan_end_date || c.contract_end_date || c.trial_end_date;
  if (!end) return 'NOT SET';
  if (new Date(end).getTime() < Date.now()) return 'EXPIRED';
  return 'ACTIVE';
}
