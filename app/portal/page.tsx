'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  Plus,
  Trash2,
  Send,
  Users,
  Lock,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';

interface RosterEntry {
  full_name: string;
  email: string;
  role: string;
  location: string;
  sensor_serial: string;
  truck_number: string;
}

interface PortalMeta {
  token: string;
  companyName: string;
  driverSeatLimit: number;
  status: string;
  contactName?: string;
}

const TEMPLATE_HEADERS = [
  'full_name',
  'email',
  'role',
  'location',
  'sensor_serial',
  'truck_number',
] as const;

function emptyRow(): RosterEntry {
  return {
    full_name: '',
    email: '',
    role: 'driver',
    location: '',
    sensor_serial: '',
    truck_number: '',
  };
}

function normalizeRole(value: string): string {
  const v = (value || 'driver').toLowerCase();
  if (v.includes('desk')) return 'desktop_user';
  if (v.includes('manage') || v.includes('admin')) return 'manager';
  return 'driver';
}

function pickColumn(header: string[], ...aliases: string[]): number {
  return header.findIndex((h) => aliases.some((a) => h.includes(a)));
}

function rowsFromSheetMatrix(matrix: string[][]): RosterEntry[] {
  if (matrix.length < 2) return [];
  const header = matrix[0].map((h) => String(h || '').toLowerCase().trim());
  const nameIdx = pickColumn(header, 'full_name', 'name', 'driver');
  const emailIdx = pickColumn(header, 'email', 'e-mail');
  const roleIdx = pickColumn(header, 'role', 'type');
  const locIdx = pickColumn(header, 'location', 'depot', 'terminal');
  const serialIdx = pickColumn(header, 'serial', 'sensor');
  const truckIdx = pickColumn(header, 'truck', 'vehicle', 'unit');

  if (nameIdx < 0 || emailIdx < 0) {
    throw new Error('Spreadsheet must include name and email columns.');
  }

  const parsed: RosterEntry[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cols = matrix[i].map((c) => String(c ?? '').trim());
    if (!cols[emailIdx] && !cols[nameIdx]) continue;
    parsed.push({
      full_name: cols[nameIdx] || '',
      email: cols[emailIdx] || '',
      role: normalizeRole(roleIdx >= 0 ? cols[roleIdx] : 'driver'),
      location: locIdx >= 0 ? cols[locIdx] : '',
      sensor_serial: serialIdx >= 0 ? cols[serialIdx] : '',
      truck_number: truckIdx >= 0 ? cols[truckIdx] : '',
    });
  }
  return parsed;
}

function RosterPortalInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const fileRef = useRef<HTMLInputElement>(null);
  const [portal, setPortal] = useState<PortalMeta | null>(null);
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [draft, setDraft] = useState<RosterEntry>(emptyRow());

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing roster token. Open the link from your welcome email.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/roster?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load portal');
      setPortal({
        token: data.portal.token,
        companyName: data.portal.companyName,
        driverSeatLimit: data.portal.driverSeatLimit,
        status: data.portal.status,
        contactName: data.portal.contactName,
      });
      setEntries(
        (data.entries || []).map((e: Record<string, string>) => ({
          full_name: e.full_name || '',
          email: e.email || '',
          role: e.role || 'driver',
          location: e.location || '',
          sensor_serial: e.sensor_serial || '',
          truck_number: e.truck_number || '',
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const seatLimit = portal?.driverSeatLimit ?? 0;
  const seatsUsed = entries.length;
  const seatsLeft = Math.max(0, seatLimit - seatsUsed);
  const seatPct = seatLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100)) : 0;

  const applyImport = (parsed: RosterEntry[]) => {
    if (!portal) return;
    const cleaned = parsed.filter((r) => r.email || r.full_name);
    if (!cleaned.length) {
      setMsg('No driver rows found in the spreadsheet.');
      return;
    }

    const byEmail = new Map(
      entries.filter((e) => e.email).map((e) => [e.email.toLowerCase(), e] as const),
    );
    for (const row of cleaned) {
      const key = row.email.toLowerCase();
      if (key && byEmail.has(key)) byEmail.set(key, { ...byEmail.get(key)!, ...row });
      else byEmail.set(key || `row_${byEmail.size}`, row);
    }
    const next = Array.from(byEmail.values());
    const capped = next.slice(0, portal.driverSeatLimit);
    const overflow = next.length - capped.length;
    setEntries(capped);
    setShowManual(false);
    setMsg(
      overflow > 0
        ? `Imported ${capped.length} of ${next.length} rows (seat limit ${portal.driverSeatLimit}). ${overflow} extra omitted.`
        : `Imported ${capped.length} driver${capped.length === 1 ? '' : 's'}. ${Math.max(0, portal.driverSeatLimit - capped.length)} seat(s) remaining.`,
    );
  };

  const onFile = async (file: File) => {
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.txt')) {
        const text = await file.text();
        const wb = XLSX.read(text, { type: 'string', raw: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        }) as string[][];
        applyImport(rowsFromSheetMatrix(matrix));
        return;
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      }) as string[][];
      applyImport(rowsFromSheetMatrix(matrix));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not read spreadsheet.');
    }
  };

  const downloadTemplate = () => {
    if (!portal) return;
    const rows: Record<string, string>[] = [
      {
        full_name: 'Marcus Reyes',
        email: 'marcus.reyes@example.com',
        role: 'driver',
        location: 'Newark Terminal 4',
        sensor_serial: '',
        truck_number: 'TRK-101',
      },
      {
        full_name: 'Aisha Patel',
        email: 'aisha.patel@example.com',
        role: 'driver',
        location: 'Newark Terminal 4',
        sensor_serial: '',
        truck_number: 'TRK-102',
      },
    ];
    const padTo = Math.min(portal.driverSeatLimit, Math.max(10, Math.min(25, portal.driverSeatLimit)));
    while (rows.length < padTo) {
      rows.push({
        full_name: '',
        email: '',
        role: 'driver',
        location: '',
        sensor_serial: '',
        truck_number: '',
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_HEADERS] });
    ws['!cols'] = [
      { wch: 22 },
      { wch: 28 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Driver Roster');
    XLSX.writeFile(wb, `FleetVu_Roster_Template_${portal.driverSeatLimit}_seats.xlsx`);
    setMsg(`Excel template downloaded (${portal.driverSeatLimit} seat capacity). Fill rows, save, then click Upload Excel / CSV.`);
  };

  const addManualDriver = () => {
    if (!portal || seatsLeft <= 0) return;
    if (!draft.full_name.trim() || !draft.email.trim()) {
      setMsg('Driver name and email are required.');
      return;
    }
    setEntries((prev) => [...prev, { ...draft }]);
    setDraft(emptyRow());
    setShowManual(false);
    setMsg(`Driver added · ${seatsLeft - 1} seat(s) remaining.`);
  };

  const updateRow = (idx: number, patch: Partial<RosterEntry>) => {
    setEntries((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!portal) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_entries', token: portal.token, entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMsg(`Saved ${data.count} of ${data.seatLimit} paid seats.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!portal) return;
    if (entries.length === 0) {
      setMsg('Add at least one driver before submitting.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const saveRes = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_entries', token: portal.token, entries }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Save failed');

      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', token: portal.token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setPortal((p) => (p ? { ...p, status: 'submitted' } : p));
      const remaining = Math.max(0, portal.driverSeatLimit - entries.length);
      setMsg(
        remaining > 0
          ? `Submitted ${entries.length} driver(s) · ${remaining} paid seat(s) still open.`
          : 'Submitted full roster to FleetVu. Drivers receive keycodes after approval.',
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] text-slate-300 flex items-center justify-center">
        Loading roster portal…
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen bg-[#0b1220] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white mb-2">Roster Portal Unavailable</h1>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  const locked = portal.status === 'submitted' || portal.status === 'approved';

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-200">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FV-Vault3.png" alt="FleetVu Vault" className="h-16 mx-auto object-contain" />
          <span className="inline-block mt-3 px-3 py-0.5 rounded-full border border-amber-500/50 bg-amber-500/15 text-[10px] font-bold tracking-[0.18em] text-amber-300 uppercase">
            Roster Portal
          </span>
          <h1 className="text-2xl font-bold text-white mt-4 flex items-center justify-center gap-2">
            <Building2 className="w-6 h-6 text-amber-400" />
            FleetVu Roster Portal
          </h1>
          <p className="text-sm text-slate-400 mt-3 max-w-2xl mx-auto leading-relaxed">
            Welcome to your FleetVu Forensic Vault roster portal. Add driver information below — each
            driver will receive a unique digital Access Keycode after FleetVu review. Upon receipt of
            your sensors, assign each driver/vehicle a sensor serial from your provisioned pool.
          </p>
          <p className="text-xs text-amber-300/90 mt-2 font-semibold">
            {portal.companyName} · {seatsUsed} of {seatLimit} paid seats used · {seatsLeft} remaining
          </p>
        </div>

        {/* Seat meter */}
        <div className="mb-4 h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
            style={{ width: `${seatPct}%` }}
          />
        </div>

        {msg && (
          <div className="mb-3 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
            {msg}
          </div>
        )}

        {locked && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Roster {portal.status}. Drivers receive keycodes after FleetVu approval.
          </div>
        )}

        {/* Main roster card — Excel controls live in this header so they cannot be missed */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden shadow-xl">
          <div className="px-4 py-3 border-b border-slate-700 flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2 mr-auto">
              <Users className="w-4 h-4" />
              Driver Roster ({seatsUsed}
              {seatLimit ? ` / ${seatLimit}` : ''})
            </div>

            {!locked && (
              <>
                <Button
                  size="sm"
                  className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                  onClick={downloadTemplate}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Excel Template
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs bg-orange-500 hover:bg-orange-400 text-white font-bold"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload Excel / CSV
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs bg-orange-600 hover:bg-orange-500 text-white font-bold"
                  onClick={() => setShowManual(true)}
                  disabled={seatsLeft <= 0}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Driver
                </Button>
              </>
            )}
          </div>

          {!locked && (
            <div className="px-4 py-3 border-b border-slate-800 bg-amber-500/5 flex items-start gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-amber-300">Large fleets (10+):</strong> click{' '}
                <strong>Excel Template</strong>, fill up to {seatLimit} rows in Excel, then{' '}
                <strong>Upload Excel / CSV</strong>. Manual Add Driver is for one-off entries.
              </p>
            </div>
          )}

          {showManual && !locked && (
            <div className="px-4 py-4 border-b border-slate-800 bg-slate-950/50 space-y-3">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wide">New Driver</div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="Driver Name">
                  <Input
                    className="h-9 bg-slate-950 border-slate-700 text-xs"
                    placeholder="e.g. Marcus Reyes"
                    value={draft.full_name}
                    onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    className="h-9 bg-slate-950 border-slate-700 text-xs"
                    placeholder="driver@company.com"
                    value={draft.email}
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  />
                </Field>
                <Field label="Depot / Location">
                  <Input
                    className="h-9 bg-slate-950 border-slate-700 text-xs"
                    placeholder="e.g. Newark Terminal 4"
                    value={draft.location}
                    onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                  />
                </Field>
                <Field label="Sensor Serial (optional)">
                  <Input
                    className="h-9 bg-slate-950 border-slate-700 text-xs font-mono"
                    placeholder="Assign sensor serial…"
                    value={draft.sensor_serial}
                    onChange={(e) => setDraft((d) => ({ ...d, sensor_serial: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                  onClick={addManualDriver}
                >
                  Save Driver
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 text-xs text-slate-400"
                  onClick={() => {
                    setShowManual(false);
                    setDraft(emptyRow());
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto min-h-[220px]">
            {entries.length === 0 ? (
              <div className="px-4 py-14 text-center text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No drivers added yet.</p>
                <p className="text-xs mt-2 text-slate-400 max-w-md mx-auto leading-relaxed">
                  Click <strong className="text-amber-300">Upload Excel / CSV</strong> for bulk import, or{' '}
                  <strong className="text-amber-300">Add Driver</strong> for a single entry.
                </p>
                {!locked && (
                  <div className="flex flex-wrap justify-center gap-2 mt-5">
                    <Button
                      size="sm"
                      className="h-9 text-xs bg-orange-500 hover:bg-orange-400 font-bold"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload Excel / CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs border-amber-500/40 text-amber-200"
                      onClick={downloadTemplate}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                      Get Excel Template
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-slate-500 uppercase bg-slate-950/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Sensor</th>
                    {!locked && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row, idx) => (
                    <tr key={`${row.email}-${idx}`} className="border-t border-slate-800">
                      <td className="px-3 py-1.5">
                        <Input
                          disabled={locked}
                          className="h-8 bg-slate-950 border-slate-700 text-xs"
                          value={row.full_name}
                          onChange={(e) => updateRow(idx, { full_name: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          disabled={locked}
                          className="h-8 bg-slate-950 border-slate-700 text-xs"
                          value={row.email}
                          onChange={(e) => updateRow(idx, { email: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          disabled={locked}
                          className="h-8 bg-slate-950 border-slate-700 text-xs"
                          value={row.location}
                          onChange={(e) => updateRow(idx, { location: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          disabled={locked}
                          className="h-8 bg-slate-950 border-slate-700 text-xs font-mono"
                          value={row.sensor_serial}
                          onChange={(e) => updateRow(idx, { sensor_serial: e.target.value })}
                        />
                      </td>
                      {!locked && (
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            className="p-1.5 text-red-300 hover:bg-red-500/10 rounded"
                            onClick={() => removeRow(idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!locked && entries.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-800 flex flex-wrap gap-2 justify-end bg-slate-950/30">
              <Button
                size="sm"
                className="h-9 text-xs bg-slate-700 hover:bg-slate-600"
                onClick={save}
                disabled={busy}
              >
                Save Draft
              </Button>
              <Button
                size="sm"
                className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                onClick={submit}
                disabled={busy}
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Submit to FleetVu
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
          <p className="text-xs font-bold text-amber-300 mb-1">Need help?</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Contact a FleetVu administrator for additional sensor serials or roster questions —{' '}
            <a href="mailto:welcome@fleetvu.org" className="text-amber-300 hover:underline">
              welcome@fleetvu.org
            </a>
          </p>
        </div>

        <div className="mt-4">
          <a href="/" className="text-xs text-slate-500 hover:text-amber-300">
            ← Return to FleetVu
          </a>
        </div>

        <p className="text-[10px] text-slate-600 mt-6 text-center">
          © {new Date().getFullYear()} FleetVu · patent pending: 64-036,221 · AES-256 Encrypted Session
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      {children}
    </div>
  );
}

export default function RosterPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1220] text-slate-400 flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <RosterPortalInner />
    </Suspense>
  );
}
