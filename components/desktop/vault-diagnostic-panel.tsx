'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Database,
  Shield,
  Key,
  GitBranch,
  Radar,
  CarFront,
  FileLock,
  Webhook,
  Layers,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  runVaultDiagnostic,
  type DiagnosticResult,
  type DiagnosticCheck,
  type CheckCategory,
} from '@/lib/vault-diagnostic';

const CATEGORY_ICONS: Record<CheckCategory, React.ReactNode> = {
  database: <Database className="w-4 h-4" />,
  crypto: <Shield className="w-4 h-4" />,
  licensing: <Key className="w-4 h-4" />,
  feature_gate: <Layers className="w-4 h-4" />,
  sensor_parser: <Radar className="w-4 h-4" />,
  merkle_chain: <GitBranch className="w-4 h-4" />,
  edge_filter: <Radar className="w-4 h-4" />,
  collision_detection: <CarFront className="w-4 h-4" />,
  zkp_compliance: <FileLock className="w-4 h-4" />,
  enterprise_webhook: <Webhook className="w-4 h-4" />,
  edge_function: <Webhook className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<CheckCategory, string> = {
  database: 'text-blue-500',
  crypto: 'text-purple-500',
  licensing: 'text-amber-500',
  feature_gate: 'text-indigo-500',
  sensor_parser: 'text-cyan-500',
  merkle_chain: 'text-green-500',
  edge_filter: 'text-teal-500',
  collision_detection: 'text-red-500',
  zkp_compliance: 'text-violet-500',
  enterprise_webhook: 'text-orange-500',
  edge_function: 'text-pink-500',
};

export function VaultDiagnosticPanel({
  open,
  onClose,
  companyId,
}: {
  open: boolean;
  onClose: () => void;
  companyId?: string;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = useCallback(async () => {
    setRunning(true);
    const res = await runVaultDiagnostic(companyId);
    setResult(res);
    setRunning(false);
  }, [companyId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDot className="w-5 h-5 text-orange-500" />
            Vault Pipeline Diagnostic
          </DialogTitle>
          <DialogDescription>
            Live end-to-end verification of every link in the vault pipeline.
            {!companyId && ' Pass a company ID to run the full pipeline test including licensing, ZKP, and ingestion.'}
          </DialogDescription>
        </DialogHeader>

        {/* Run button */}
        <div className="flex items-center gap-3">
          <Button onClick={runDiagnostic} disabled={running}>
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Diagnostic...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Full Pipeline Test
              </>
            )}
          </Button>
          {result && !running && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold',
              result.overallStatus === 'pass' && 'bg-green-50 text-green-700 border border-green-200',
              result.overallStatus === 'warn' && 'bg-amber-50 text-amber-700 border border-amber-200',
              result.overallStatus === 'fail' && 'bg-red-50 text-red-700 border border-red-200',
            )}>
              {result.overallStatus === 'pass' && <CheckCircle2 className="w-4 h-4" />}
              {result.overallStatus === 'warn' && <AlertTriangle className="w-4 h-4" />}
              {result.overallStatus === 'fail' && <XCircle className="w-4 h-4" />}
              {result.passed} passed / {result.failed} failed / {result.warnings} warnings
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-2 mt-4">
            {/* Pipeline flow diagram */}
            <div className="flex items-center gap-1 flex-wrap mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              {result.checks.map((check, idx) => (
                <React.Fragment key={check.id}>
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0',
                      check.status === 'pass' && 'bg-green-500 border-green-600',
                      check.status === 'fail' && 'bg-red-500 border-red-600',
                      check.status === 'warn' && 'bg-amber-500 border-amber-600',
                      check.status === 'pending' && 'bg-slate-300 border-slate-400',
                    )}
                    title={check.label}
                  >
                    {check.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-white" />}
                    {check.status === 'fail' && <XCircle className="w-4 h-4 text-white" />}
                    {check.status === 'warn' && <AlertTriangle className="w-4 h-4 text-white" />}
                    {check.status === 'pending' && <CircleDot className="w-4 h-4 text-white" />}
                  </div>
                  {idx < result.checks.length - 1 && (
                    <div className={cn(
                      'h-0.5 w-6',
                      check.status === 'pass' ? 'bg-green-400' : 'bg-slate-300',
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Detailed checks */}
            {result.checks.map((check) => (
              <DiagnosticCheckRow key={check.id} check={check} />
            ))}

            {/* Timestamp */}
            <p className="text-xs text-slate-400 text-center pt-2">
              Diagnostic run at {new Date(result.timestamp).toLocaleString()}
            </p>
          </div>
        )}

        {!result && !running && (
          <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
            <CircleDot className="w-12 h-12 opacity-30" />
            <p className="text-sm">Click &quot;Run Full Pipeline Test&quot; to verify all vault links.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiagnosticCheckRow({ check }: { check: DiagnosticCheck }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all cursor-pointer',
        check.status === 'pass' && 'border-green-200 bg-green-50/50',
        check.status === 'fail' && 'border-red-200 bg-red-50/50',
        check.status === 'warn' && 'border-amber-200 bg-amber-50/50',
        check.status === 'pending' && 'border-slate-200 bg-slate-50',
      )}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className={cn('shrink-0', CATEGORY_COLORS[check.category])}>
          {CATEGORY_ICONS[check.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">{check.label}</span>
            <span className="text-[10px] text-slate-400 uppercase">{check.category}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{check.detail}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] text-slate-400 tabular-nums">{check.durationMs}ms</span>
          {check.status === 'pass' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
          {check.status === 'fail' && <XCircle className="w-5 h-5 text-red-500" />}
          {check.status === 'warn' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {check.status === 'pending' && <CircleDot className="w-5 h-5 text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-1">{check.description}</p>
          <p className="text-xs font-mono text-slate-700 bg-slate-100 rounded px-2 py-1.5 mt-1">
            {check.detail}
          </p>
        </div>
      )}
    </div>
  );
}
