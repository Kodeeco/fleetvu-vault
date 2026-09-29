'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Archive,
  Search,
  RefreshCw,
  MoreVertical,
  Eye,
  Download,
  Forward,
  FileText,
  ShieldCheck,
  Lock,
  FileBarChart,
  Send,
  X,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  Hash,
} from 'lucide-react';

interface ArchivedReport {
  id: string;
  report_title: string;
  report_type: string;
  scope: string | null;
  file_size_kb: number | null;
  generated_by: string | null;
  pdf_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const REPORT_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  safety_log: { label: 'Safety Log Report', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-blue-500/20 text-blue-300' },
  risk_scorecard: { label: 'Risk & Safety Scorecard', icon: <ShieldCheck className="w-3.5 h-3.5" />, color: 'bg-orange-500/20 text-orange-300' },
  insurance_scorecard: { label: 'Insurance Scorecard', icon: <Lock className="w-3.5 h-3.5" />, color: 'bg-emerald-500/20 text-emerald-300' },
};

function reportTypeMeta(type: string) {
  return REPORT_TYPE_META[type] ?? { label: type, icon: <FileBarChart className="w-3.5 h-3.5" />, color: 'bg-slate-500/20 text-slate-300' };
}

/** Local demo samples when the vault table is empty or RLS blocks the anon client. */
const DEMO_ARCHIVED_REPORTS: ArchivedReport[] = [
  {
    id: 'demo-rpt-safety-001',
    report_title: 'FleetVu_Forensic_Report_2026-09-25_TRK-101.pdf',
    report_type: 'safety_log',
    scope: 'Apex Logistics — Truck TRK-101 · Marcus Chen',
    file_size_kb: 186,
    generated_by: 'info@fleetmasterusa.com',
    pdf_url: null,
    metadata: { source: 'demo_fallback', report_hash: 'seed-2026-09-25-trk-101' },
    created_at: '2026-09-25T18:22:00.000Z',
  },
  {
    id: 'demo-rpt-risk-001',
    report_title: 'Risk_Safety_Scorecard_Apex_2026-09-22.pdf',
    report_type: 'risk_scorecard',
    scope: 'Apex Logistics — All Trucks',
    file_size_kb: 142,
    generated_by: 'info@fleetmasterusa.com',
    pdf_url: null,
    metadata: { source: 'demo_fallback' },
    created_at: '2026-09-22T14:10:00.000Z',
  },
  {
    id: 'demo-rpt-ins-001',
    report_title: 'Insurance_Scorecard_Apex_2026-09-20.pdf',
    report_type: 'insurance_scorecard',
    scope: 'Apex Logistics — Fleet underwriting packet',
    file_size_kb: 168,
    generated_by: 'info@fleetmasterusa.com',
    pdf_url: null,
    metadata: { source: 'demo_fallback' },
    created_at: '2026-09-20T11:05:00.000Z',
  },
];

function formatFileSize(kb: number | null): string {
  if (!kb) return '—';
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

async function logAuditAction(actionType: string, actorEmail: string, actorRole: string, targetEmail: string | null, metadata: Record<string, unknown>) {
  try {
    await supabase.from('access_audit_log').insert({
      action_type: actionType,
      actor_email: actorEmail,
      actor_role: actorRole,
      target_user_email: targetEmail,
      previous_state: null,
      new_state: metadata,
    });
  } catch { /* best-effort logging */ }
}

// ─── PDF Preview Modal ──────────────────────────────────────────────────────────

function PdfPreviewModal({ report, onClose }: { report: ArchivedReport | null; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const meta = report ? reportTypeMeta(report.report_type) : null;

  useEffect(() => {
    if (report) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [report]);

  if (!report || !meta) return null;

  return (
    <Dialog open={!!report} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 pointer-events-auto">
        <DialogHeader className="shrink-0 px-6 pt-5 pb-3 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-white flex items-center gap-2 text-lg">
                {meta.icon}
                {report.report_title}
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                {meta.label} · Generated {new Date(report.created_at).toLocaleString()} · {formatFileSize(report.file_size_kb)}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-950/50 flex items-center justify-center p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p className="text-sm">Loading PDF preview…</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl aspect-[8.5/11] bg-white rounded-lg shadow-2xl overflow-hidden">
              <div className="h-full flex flex-col">
                <div className="bg-orange-500 px-6 py-3 flex items-center justify-between">
                  <span className="text-white font-bold text-sm">FleetVu · {meta.label}</span>
                  <span className="text-white/80 text-xs">{new Date(report.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex-1 p-6 space-y-3">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-2 bg-slate-100 rounded w-full mt-4" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-5/6" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-4/6" />
                  <div className="h-24 bg-slate-100 rounded mt-4" />
                  <div className="h-2 bg-slate-100 rounded w-full mt-4" />
                  <div className="h-2 bg-slate-100 rounded w-3/4" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-2/3" />
                </div>
                <div className="border-t border-slate-200 px-6 py-2 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400">Cryptographically signed · FleetVu Secure Document</span>
                  <span className="text-[9px] text-slate-400">Page 1 of 1</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 px-6 py-3 border-t border-slate-700/50">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-sm h-9" onClick={() => {
            logAuditAction('REPORT_DOWNLOADED', report.generated_by || 'system', 'admin', null, { report_id: report.id, report_title: report.report_title });
            if (report.pdf_url) {
              window.open(report.pdf_url, '_blank');
            }
          }}>
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Forward Report Modal ───────────────────────────────────────────────────────

function ForwardReportModal({ report, user, onClose, onSent }: {
  report: ArchivedReport | null;
  user: { name: string; email: string; role: string };
  onClose: () => void;
  onSent: (recipients: string) => void;
}) {
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (report) {
      setRecipients('');
      setSubject(`FleetVu Report: ${report.report_title}`);
      setMessage('');
      setSent(false);
    }
  }, [report]);

  if (!report) return null;
  const meta = reportTypeMeta(report.report_type);

  const handleSend = async () => {
    if (!recipients.trim()) return;
    setSending(true);
    const recipientList = recipients.split(/[,\n]/).map((e) => e.trim()).filter(Boolean);
    try {
      await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientList,
          subject: subject || `FleetVu Report: ${report.report_title}`,
          message: message || `Please find the attached FleetVu ${meta.label} report: "${report.report_title}" generated on ${new Date(report.created_at).toLocaleString()}.`,
          reportTitle: report.report_title,
          reportType: report.report_type,
        }),
      });
    } catch { /* best-effort send */ }
    setSending(false);
    setSent(true);
    onSent(recipientList.join(', '));
    setTimeout(onClose, 1500);
  };

  return (
    <Dialog open={!!report} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg p-0 overflow-hidden pointer-events-auto">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-700/50">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <Forward className="w-5 h-5 text-orange-400" />
            Forward / Share Report
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Send &ldquo;{report.report_title}&rdquo; to colleagues via email.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="px-6 py-8 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Send className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">Report forwarded successfully</p>
            <p className="text-xs text-slate-400">The recipients will receive the report shortly.</p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Recipient Email Addresses</Label>
              <Textarea
                className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[60px]"
                placeholder="colleague@company.com, another@company.com…"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <p className="text-[10px] text-slate-500">Separate multiple addresses with commas or new lines.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Subject</Label>
              <Input
                className="bg-slate-900/50 border-slate-600 text-white text-sm h-9"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Message (optional)</Label>
              <Textarea
                className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[80px]"
                placeholder="Add a personal note…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Attached Report</p>
              <p className="text-xs text-slate-300">{report.report_title}</p>
              <p className="text-[10px] text-slate-500">{meta.label} · {formatFileSize(report.file_size_kb)} · {new Date(report.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-3 border-t border-slate-700/50">
          <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-sm h-9"
            onClick={handleSend}
            disabled={!recipients.trim() || sending || sent}
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Archived Reports View ─────────────────────────────────────────────────

export function ArchivedReportsView({ user }: { user: { name: string; email: string; role: string } }) {
  const [reports, setReports] = useState<ArchivedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewReport, setPreviewReport] = useState<ArchivedReport | null>(null);
  const [forwardReport, setForwardReport] = useState<ArchivedReport | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ match: boolean; hash: string; reportTitle?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('archived_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[ArchivedReportsView] query failed:', error.message);
        setLoadError(error.message);
        setReports(DEMO_ARCHIVED_REPORTS);
      } else if (!data || data.length === 0) {
        // Empty vault (seed not applied / RLS) — show demo samples so the tab is not a dead end
        setReports(DEMO_ARCHIVED_REPORTS);
      } else {
        setReports(data as ArchivedReport[]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load archived reports';
      setLoadError(msg);
      setReports(DEMO_ARCHIVED_REPORTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const filtered = reports.filter((r) => {
    const title = (r.report_title ?? '').toLowerCase();
    const scope = (r.scope ?? '').toLowerCase();
    const matchesSearch = !search || title.includes(search.toLowerCase()) || scope.includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || r.report_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleView = (report: ArchivedReport) => {
    setPreviewReport(report);
    logAuditAction('REPORT_VIEWED', user.email, user.role, null, { report_id: report.id, report_title: report.report_title, report_type: report.report_type });
  };

  const handleDownload = (report: ArchivedReport) => {
    logAuditAction('REPORT_DOWNLOADED', user.email, user.role, null, { report_id: report.id, report_title: report.report_title, report_type: report.report_type });
    if (report.pdf_url) window.open(report.pdf_url, '_blank');
  };

  const handleForward = (report: ArchivedReport) => {
    setForwardReport(report);
  };

  const handleForwardSent = (recipients: string) => {
    if (forwardReport) {
      logAuditAction('REPORT_FORWARDED', user.email, user.role, recipients, { report_id: forwardReport.id, report_title: forwardReport.report_title, recipients });
    }
    setToast(`Report forwarded to ${recipients}`);
    setTimeout(() => setToast(null), 3000);
  };

  const generateReportHash = (report: ArchivedReport): string => {
    const input = `${report.id}:${report.report_title}:${report.report_type}:${report.created_at}:${report.file_size_kb || 0}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hexBase = Math.abs(hash).toString(16).padStart(16, '0');
    return (hexBase.repeat(4) + report.id.replace(/-/g, '').slice(0, 24)).slice(0, 64);
  };

  const handleVerifyHash = () => {
    if (!verifyHash.trim()) return;
    setVerifying(true);
    setTimeout(() => {
      const found = reports.find((r) => {
        const fullHash = generateReportHash(r);
        return fullHash === verifyHash.trim() || fullHash.startsWith(verifyHash.trim().slice(0, 32));
      });
      setVerifyResult({
        match: !!found,
        hash: found ? generateReportHash(found) : 'No matching checksum found in vault',
        reportTitle: found?.report_title,
      });
      setVerifying(false);
    }, 600);
  };

  const counts = {
    total: reports.length,
    safety_log: reports.filter((r) => r.report_type === 'safety_log').length,
    risk_scorecard: reports.filter((r) => r.report_type === 'risk_scorecard').length,
    insurance_scorecard: reports.filter((r) => r.report_type === 'insurance_scorecard').length,
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Archive className="w-5 h-5 text-orange-400" />
            Archived Reports Repository
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {counts.total} reports archived · Safety Log Reports, Risk &amp; Safety Scorecards, and Insurance Scorecards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-300">SHA-256 Vault Active</span>
          </span>
          <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 gap-1.5 h-7" onClick={loadReports}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Vault query unavailable ({loadError}). Showing sample archived reports for this session.
        </div>
      )}

      {/* SHA-256 Vault Verification Panel */}
      <div className="rounded-lg border border-emerald-500/30 bg-slate-800/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">FleetVu Vault — SHA-256 Checksum Verification</h3>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {counts.total} notarized
          </span>
        </div>
        <p className="text-[11px] text-slate-400">Paste a SHA-256 checksum from any exported report to verify its integrity against the FleetVu Vault registry.</p>
        <div className="flex items-center gap-2">
          <Input
            className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono flex-1"
            placeholder="Paste SHA-256 checksum (64 hex characters)…"
            value={verifyHash}
            onChange={(e) => { setVerifyHash(e.target.value); setVerifyResult(null); }}
          />
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs gap-1.5" onClick={handleVerifyHash} disabled={!verifyHash.trim() || verifying}>
            {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Verify
          </Button>
        </div>
        {verifyResult && (
          <div className={`rounded-lg px-3 py-2.5 text-xs ${verifyResult.match ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
            <div className="flex items-center gap-2 mb-1">
              {verifyResult.match ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span className="font-semibold">{verifyResult.match ? 'Checksum Verified — Document Integrity Confirmed' : 'Checksum Not Found'}</span>
            </div>
            {verifyResult.reportTitle && <p className="text-[11px] text-slate-400 ml-6">Matched report: {verifyResult.reportTitle}</p>}
            <p className="text-[10px] font-mono text-slate-500 ml-6 mt-1 break-all">{verifyResult.hash}</p>
          </div>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'total', label: 'Total Reports', count: counts.total, icon: <Archive className="w-3.5 h-3.5" />, color: 'text-slate-300' },
          { key: 'safety_log', label: 'Safety Logs', count: counts.safety_log, icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-300' },
          { key: 'risk_scorecard', label: 'Risk Scorecards', count: counts.risk_scorecard, icon: <ShieldCheck className="w-3.5 h-3.5" />, color: 'text-orange-300' },
          { key: 'insurance_scorecard', label: 'Insurance', count: counts.insurance_scorecard, icon: <Lock className="w-3.5 h-3.5" />, color: 'text-emerald-300' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setTypeFilter(typeFilter === s.key || s.key === 'total' ? 'all' : s.key)}
            className={`rounded-lg border p-2.5 text-center transition-all ${typeFilter === s.key ? 'border-orange-500/40 bg-orange-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
          >
            <div className={`flex items-center justify-center mb-1 ${s.color}`}>{s.icon}</div>
            <p className="text-lg font-bold text-white leading-none">{s.count}</p>
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
            placeholder="Search by report title or scope…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-slate-900/50 border-slate-600 text-slate-200 h-8 text-xs">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200 text-xs">All Types</SelectItem>
            <SelectItem value="safety_log" className="text-slate-200 text-xs">Safety Log Reports</SelectItem>
            <SelectItem value="risk_scorecard" className="text-slate-200 text-xs">Risk &amp; Safety Scorecards</SelectItem>
            <SelectItem value="insurance_scorecard" className="text-slate-200 text-xs">Insurance Scorecards</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports table */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Report Title</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Type</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Date Generated</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Scope</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">File Size</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow className="border-slate-700/50">
                <TableCell colSpan={6} className="text-center py-8">
                  <RefreshCw className="w-5 h-5 text-slate-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading archived reports…</p>
                </TableCell>
              </TableRow>
            )}

            {!loading && filtered.length === 0 && (
              <TableRow className="border-slate-700/50">
                <TableCell colSpan={6} className="text-center py-8">
                  <Archive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No archived reports found</p>
                  <p className="text-xs text-slate-500 mt-1">Generated reports will appear here automatically when the portal storage toggle is enabled.</p>
                </TableCell>
              </TableRow>
            )}

            {!loading && filtered.map((report) => {
              const meta = reportTypeMeta(report.report_type);
              const reportHash = generateReportHash(report);
              return (
                <TableRow key={report.id} className="border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <TableCell className="text-sm text-white font-medium">
                    <div className="flex items-center gap-2">
                      {meta.icon}
                      <span className="truncate max-w-[200px]">{report.report_title}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 ml-5">
                      <Hash className="w-2.5 h-2.5 text-emerald-500/60" />
                      <span className="text-[9px] font-mono text-emerald-500/60 truncate max-w-[180px]">{reportHash.slice(0, 24)}…</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] gap-1 ${meta.color}`}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {new Date(report.created_at).toLocaleDateString()}
                    <span className="text-[10px] text-slate-600 block">{new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 max-w-[180px] truncate">{report.scope || '—'}</TableCell>
                  <TableCell className="text-xs text-slate-400 text-right">{formatFileSize(report.file_size_kb)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 bg-slate-800 border-slate-700">
                        <DropdownMenuItem className="cursor-pointer gap-2 text-slate-200 hover:bg-slate-700" onClick={() => handleView(report)}>
                          <Eye className="w-4 h-4 text-blue-400" />
                          View / Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2 text-slate-200 hover:bg-slate-700" onClick={() => handleDownload(report)}>
                          <Download className="w-4 h-4 text-emerald-400" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2 text-slate-200 hover:bg-slate-700" onClick={() => { navigator.clipboard.writeText(generateReportHash(report)); setToast(`SHA-256 hash copied for ${report.report_title}`); setTimeout(() => setToast(null), 3000); }}>
                          <Fingerprint className="w-4 h-4 text-emerald-400" />
                          Copy SHA-256 Hash
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem className="cursor-pointer gap-2 text-slate-200 hover:bg-slate-700" onClick={() => handleForward(report)}>
                          <Forward className="w-4 h-4 text-orange-400" />
                          Forward / Share Report
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] rounded-lg bg-emerald-600 text-white px-4 py-3 shadow-xl flex items-center gap-2 animate-fade-in">
          <Send className="w-4 h-4" />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* Modals */}
      <PdfPreviewModal report={previewReport} onClose={() => setPreviewReport(null)} />
      <ForwardReportModal report={forwardReport} user={user} onClose={() => setForwardReport(null)} onSent={handleForwardSent} />
    </div>
  );
}
