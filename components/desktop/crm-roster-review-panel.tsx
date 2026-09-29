'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

interface RosterTokenRow {
  token: string;
  company_name: string;
  contact_email: string;
  driver_seat_limit: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

/**
 * Global Admin queue — approve submitted customer rosters → dispatch one-time keycodes.
 */
export function CrmRosterReviewPanel() {
  const [rows, setRows] = useState<RosterTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('roster_portal_tokens')
        .select('token, company_name, contact_email, driver_seat_limit, status, submitted_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      setRows((data as RosterTokenRow[]) || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (token: string) => {
    setBusyToken(token);
    setMsg(null);
    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approve failed');
      setMsg(`Approved — ${data.keycodesSent} one-time keycode emails sent via welcome@fleetvu.org.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyToken(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Roster Review Queue</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Auto-notify on submit → double-check → approve to email one-time keycodes (biometric next login / desktop TEMP password).
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs border-slate-600" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {msg && (
        <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">{msg}</div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-slate-500 uppercase border-b border-slate-800">
            <tr>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Seats</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No roster tokens yet. Send a Welcome email from Email Config.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.token} className="border-b border-slate-800/80">
                <td className="px-3 py-2.5 font-semibold text-white">{r.company_name}</td>
                <td className="px-3 py-2.5 text-slate-300">{r.contact_email}</td>
                <td className="px-3 py-2.5 text-amber-300 font-bold">{r.driver_seat_limit}</td>
                <td className="px-3 py-2.5">
                  <Badge className="bg-slate-800 border-slate-700 text-[10px] uppercase">{r.status}</Badge>
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2.5">
                  {r.status === 'submitted' ? (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-500 font-bold"
                      disabled={busyToken === r.token}
                      onClick={() => void approve(r.token)}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      {busyToken === r.token ? 'Sending…' : 'Approve & Send Keycodes'}
                    </Button>
                  ) : r.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Keycodes sent
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">Awaiting customer submit</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
