'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AccessAuditLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Shield,
  KeyRound,
  Search,
  Download,
  Send,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  LogIn,
  LogOut,
  UserPlus,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  Hash,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  LOGIN:              { label: 'Login',           color: 'bg-green-500/20 text-green-400',  icon: <LogIn className="w-3 h-3" /> },
  LOGOUT:             { label: 'Logout',          color: 'bg-slate-500/20 text-slate-400',  icon: <LogOut className="w-3 h-3" /> },
  PROVISION_USER:     { label: 'User Provisioned',color: 'bg-orange-500/20 text-orange-400',icon: <UserPlus className="w-3 h-3" /> },
  ROLE_CHANGE:        { label: 'Role Changed',    color: 'bg-blue-500/20 text-blue-400',    icon: <Shield className="w-3 h-3" /> },
  PERMISSION_UPDATE:  { label: 'Permissions',     color: 'bg-cyan-500/20 text-cyan-400',    icon: <KeyRound className="w-3 h-3" /> },
  ACCOUNT_SUSPEND:    { label: 'Suspended',       color: 'bg-amber-500/20 text-amber-400',  icon: <AlertTriangle className="w-3 h-3" /> },
  ACCOUNT_REVOKE:     { label: 'Revoked',         color: 'bg-red-500/20 text-red-400',      icon: <Lock className="w-3 h-3" /> },
  ACCOUNT_REACTIVATE: { label: 'Reactivated',     color: 'bg-emerald-500/20 text-emerald-400', icon: <Unlock className="w-3 h-3" /> },
  ACCOUNT_DELETE:     { label: 'Deleted',         color: 'bg-red-700/30 text-red-400',      icon: <Trash2 className="w-3 h-3" /> },
  ACCESS_DENIED:      { label: 'Access Denied',   color: 'bg-red-500/20 text-red-400',      icon: <XCircle className="w-3 h-3" /> },
  REPORT_VIEWED:      { label: 'Report Viewed',   color: 'bg-blue-500/20 text-blue-400',    icon: <Eye className="w-3 h-3" /> },
  REPORT_DOWNLOADED:  { label: 'Report Downloaded', color: 'bg-emerald-500/20 text-emerald-400', icon: <Download className="w-3 h-3" /> },
  REPORT_FORWARDED:   { label: 'Report Forwarded', color: 'bg-orange-500/20 text-orange-400', icon: <Send className="w-3 h-3" /> },
};

function actionMeta(type: string) {
  return ACTION_META[type] ?? { label: type, color: 'bg-slate-500/20 text-slate-400', icon: <Hash className="w-3 h-3" /> };
}

function truncateHash(hash: string | null, len = 12) {
  if (!hash) return '—';
  return hash.slice(0, len) + '…';
}

// ─── row component ────────────────────────────────────────────────────────────

function AuditRow({ log }: { log: AccessAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = actionMeta(log.action_type);

  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/20 text-left transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* sequence */}
        <span className="text-[9px] font-mono text-slate-600 w-6 shrink-0 text-right">#{log.seq}</span>

        {/* action badge */}
        <Badge className={cn('text-[10px] gap-1 shrink-0 font-semibold', meta.color)}>
          {meta.icon} {meta.label}
        </Badge>

        {/* actor */}
        <div className="flex-1 min-w-0">
          <span className="text-xs text-slate-300 truncate">{log.actor_email || '—'}</span>
          {log.target_user_email && log.target_user_email !== log.actor_email && (
            <span className="text-[10px] text-slate-500 ml-1.5">→ {log.target_user_email}</span>
          )}
        </div>

        {/* timestamp */}
        <span className="text-[10px] text-slate-500 shrink-0 hidden md:block">
          {new Date(log.utc_timestamp).toLocaleString()}
        </span>

        {/* hash indicator */}
        <span className="text-[9px] font-mono text-slate-600 shrink-0 hidden lg:flex items-center gap-1">
          <Hash className="w-2.5 h-2.5" />{truncateHash(log.record_hash)}
        </span>

        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-slate-900/30 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Actor</p>
              <p className="text-slate-300">{log.actor_email || '—'}</p>
              <p className="text-slate-500">{log.actor_role || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Target</p>
              <p className="text-slate-300">{log.target_user_email || '—'}</p>
              <p className="text-slate-500">{log.target_user_role || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">UTC Timestamp</p>
              <p className="text-slate-300 font-mono text-[10px]">{log.utc_timestamp}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">IP Address</p>
              <p className="text-slate-300 font-mono text-[10px]">{log.ip_address || '—'}</p>
            </div>
          </div>

          {/* State diff */}
          {(log.previous_state || log.new_state) && (
            <div className="grid grid-cols-2 gap-2">
              {log.previous_state && (
                <div className="rounded bg-slate-800 border border-slate-700 p-2">
                  <p className="text-[9px] font-bold text-red-400 uppercase mb-1">Previous State</p>
                  <pre className="text-[10px] text-slate-400 overflow-x-auto">{JSON.stringify(log.previous_state, null, 2)}</pre>
                </div>
              )}
              {log.new_state && (
                <div className="rounded bg-slate-800 border border-slate-700 p-2">
                  <p className="text-[9px] font-bold text-green-400 uppercase mb-1">New State</p>
                  <pre className="text-[10px] text-slate-400 overflow-x-auto">{JSON.stringify(log.new_state, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {/* Cryptographic chain */}
          <div className="rounded bg-slate-950/60 border border-slate-700/50 p-2 space-y-1">
            <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Hash className="w-2.5 h-2.5" /> 256-bit Cryptographic Chain
            </p>
            <div className="grid grid-cols-1 gap-1 text-[9px] font-mono">
              <div className="flex gap-2">
                <span className="text-slate-600 w-20 shrink-0">record_hash:</span>
                <span className="text-emerald-400 break-all">{log.record_hash || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-600 w-20 shrink-0">prev_hash:</span>
                <span className="text-slate-500 break-all">{log.prev_hash || 'GENESIS'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────

export function AuditTrailPanel({ user }: { user: { name: string; email: string; role: string } }) {
  const [logs, setLogs] = useState<AccessAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('access_audit_log')
      .select('*')
      .order('utc_timestamp', { ascending: false })
      .limit(500);
    if (data) setLogs(data as AccessAuditLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = logs.filter((l) => {
    const matchesSearch =
      !search ||
      (l.actor_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.target_user_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      l.action_type.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || l.action_type === actionFilter;
    return matchesSearch && matchesAction;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const exportCSV = () => {
    const headers = ['seq', 'utc_timestamp', 'action_type', 'actor_email', 'actor_role', 'target_user_email', 'target_user_role', 'record_hash', 'prev_hash'];
    const rows = filtered.map((l) =>
      [l.seq, l.utc_timestamp, l.action_type, l.actor_email ?? '', l.actor_role ?? '', l.target_user_email ?? '', l.target_user_role ?? '', l.record_hash ?? '', l.prev_hash ?? ''].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleetvu-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary counts
  const counts = Object.keys(ACTION_META).reduce((acc, key) => {
    acc[key] = logs.filter((l) => l.action_type === key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-orange-400" />
            System Access &amp; Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tamper-evident 256-bit cryptographic chain — {logs.length} events recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 gap-1.5 h-7" onClick={loadLogs}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" className="text-green-300 border-green-500/40 hover:bg-green-500/10 gap-1.5 h-7" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { key: 'LOGIN', label: 'Logins', icon: <LogIn className="w-3.5 h-3.5" /> },
          { key: 'PROVISION_USER', label: 'Provisioned', icon: <UserPlus className="w-3.5 h-3.5" /> },
          { key: 'ROLE_CHANGE', label: 'Role Changes', icon: <Shield className="w-3.5 h-3.5" /> },
          { key: 'ACCOUNT_SUSPEND', label: 'Suspensions', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          { key: 'ACCESS_DENIED', label: 'Denied', icon: <XCircle className="w-3.5 h-3.5" /> },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setActionFilter(actionFilter === s.key ? 'all' : s.key)}
            className={cn('rounded-lg border p-2.5 text-center transition-all', actionFilter === s.key ? 'border-orange-500/40 bg-orange-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600')}
          >
            <div className={cn('flex items-center justify-center mb-1', actionMeta(s.key).color.replace('bg-', 'text-').split(' ')[1])}>
              {s.icon}
            </div>
            <p className="text-lg font-bold text-white leading-none">{counts[s.key] ?? 0}</p>
            <p className="text-[9px] text-slate-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <Input
            className="pl-8 bg-slate-900/50 border-slate-600 text-white h-8 text-sm"
            placeholder="Search by email, action…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44 bg-slate-900/50 border-slate-600 text-slate-200 h-8 text-xs">
            <Filter className="w-3 h-3 mr-1.5 text-slate-500" />
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200 text-xs">All Actions</SelectItem>
            {Object.entries(ACTION_META).map(([key, m]) => (
              <SelectItem key={key} value={key} className="text-slate-200 text-xs">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log table */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-700 bg-slate-900/50">
          <span className="text-[9px] font-bold text-slate-500 uppercase w-6 text-right">#</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase w-28">Event</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase flex-1">Actor / Target</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase hidden md:block w-32">Timestamp (UTC)</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase hidden lg:block w-24">Hash</span>
          <span className="w-4" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No audit events match your filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {paginated.map((log) => <AuditRow key={log.id} log={log} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{filtered.length} events · page {page + 1} of {totalPages}</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-6 text-[10px] border-slate-600 text-slate-300" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] border-slate-600 text-slate-300" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Chain integrity note */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3 flex items-start gap-2">
        <Hash className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-emerald-400">256-bit Cryptographic Audit Chain</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Each log entry carries a SHA-256 digest of its own payload (record_hash) and references the previous entry's hash (prev_hash), forming a tamper-evident chain.
            Any modification to a historical record will break the chain integrity, making unauthorized changes detectable.
            The first record carries GENESIS as its prev_hash.
          </p>
        </div>
      </div>
    </div>
  );
}
