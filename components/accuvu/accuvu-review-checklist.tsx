'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Eye,
  FileText,
  Mail,
  Pencil,
  ArrowRight,
} from 'lucide-react';
import type { Incident } from '@/lib/types';
import {
  REVIEW_STEPS,
  getNextIncompleteStep,
  isReviewComplete,
  isStepComplete,
  loadCaseReviewProgress,
  markPhaseViewed,
  markStepDone,
  reviewCompletionPercent,
  syncNotesFromIncident,
  type CaseReviewProgress,
  type ReviewStepId,
} from '@/lib/accuvu-review-checklist';

interface AccuVuReviewChecklistProps {
  incident: Incident;
  reconPhase: 'pre' | 'impact' | 'post';
  accent?: 'sky' | 'orange';
  /** Bump when parent marks PDF / counsel / notes outside this panel */
  refreshKey?: number;
  onJumpToPhase: (phase: 'pre' | 'impact' | 'post') => void;
  onOpenSealedPdf: () => void;
  onEmailCounsel: () => void;
  onFocusNotes: () => void;
}

export function AccuVuReviewChecklist({
  incident,
  reconPhase,
  accent = 'sky',
  refreshKey = 0,
  onJumpToPhase,
  onOpenSealedPdf,
  onEmailCounsel,
  onFocusNotes,
}: AccuVuReviewChecklistProps) {
  const caseKey = incident.case_id || incident.id;
  const [progress, setProgress] = useState<CaseReviewProgress>(() => loadCaseReviewProgress(caseKey));

  useEffect(() => {
    let p = loadCaseReviewProgress(caseKey);
    p = syncNotesFromIncident(p, incident);
    setProgress(p);
  }, [caseKey, incident.id, incident.investigator_notes, refreshKey]);

  useEffect(() => {
    setProgress((prev) => {
      if (prev.caseId !== caseKey) return prev;
      if (prev.phases[reconPhase]) return prev;
      return markPhaseViewed(prev, reconPhase);
    });
  }, [reconPhase, caseKey]);

  const nextStep = useMemo(() => getNextIncompleteStep(progress), [progress]);
  const pct = reviewCompletionPercent(progress);
  const complete = isReviewComplete(progress);

  const sky = accent === 'sky';
  const tone = sky
    ? {
        border: 'border-sky-500/35',
        bg: 'bg-sky-950/40',
        title: 'text-sky-300',
        bar: 'bg-sky-400',
        active: 'border-sky-400/50 bg-sky-500/15',
        btn: 'bg-sky-500 hover:bg-sky-600 text-white',
      }
    : {
        border: 'border-orange-500/35',
        bg: 'bg-orange-950/30',
        title: 'text-orange-300',
        bar: 'bg-orange-400',
        active: 'border-orange-400/50 bg-orange-500/15',
        btn: 'bg-orange-500 hover:bg-orange-600 text-white',
      };

  const runStep = (step: ReviewStepId) => {
    if (step === 'phases') {
      const missing: Array<'pre' | 'impact' | 'post'> = (['pre', 'impact', 'post'] as const).filter(
        (p) => !progress.phases[p],
      );
      onJumpToPhase(missing[0] || 'impact');
      return;
    }
    if (step === 'sealed_pdf') {
      onOpenSealedPdf();
      setProgress(markStepDone(progress, 'sealed_pdf'));
      return;
    }
    if (step === 'counsel_email') {
      onEmailCounsel();
      setProgress(markStepDone(progress, 'counsel_email'));
      return;
    }
    onFocusNotes();
  };

  const markNotesSaved = () => {
    setProgress(markStepDone(progress, 'notes'));
  };

  return (
    <div className={`rounded-lg border p-3 ${tone.border} ${tone.bg}`} data-review-checklist>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className={`w-4 h-4 ${tone.title}`} />
          <span className="text-sm font-bold text-white">Internal Review Walkthrough</span>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-bold uppercase tracking-wide ${
            complete ? 'border-green-400/50 text-green-300' : `${tone.border} ${tone.title}`
          }`}
        >
          {complete ? 'Review complete' : `${pct}% complete`}
        </Badge>
      </div>

      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all duration-500 ${complete ? 'bg-green-400' : tone.bar}`} style={{ width: `${pct}%` }} />
      </div>

      {!complete && nextStep && (
        <div className={`mb-3 rounded-md border px-3 py-2 ${tone.active}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Next required step</p>
          <p className="text-xs text-white font-semibold">
            {REVIEW_STEPS.find((s) => s.id === nextStep)?.title}
          </p>
          <Button size="sm" className={`mt-2 h-8 text-xs ${tone.btn}`} onClick={() => runStep(nextStep)}>
            Continue
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {complete && (
        <div className="mb-3 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-green-300">All internal review steps verified</p>
            <p className="text-[11px] text-green-200/80 mt-0.5">
              Phases reviewed, sealed PDF opened, counsel/claims notified, and investigator notes saved.
              {progress.completedAt ? ` Completed ${new Date(progress.completedAt).toLocaleString()}.` : ''}
            </p>
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {REVIEW_STEPS.map((step, idx) => {
          const done = isStepComplete(progress, step.id);
          const isNext = nextStep === step.id;
          return (
            <li
              key={step.id}
              className={`rounded-md border px-2.5 py-2 ${
                done
                  ? 'border-green-500/30 bg-green-500/5'
                  : isNext
                    ? tone.active
                    : 'border-slate-700/60 bg-slate-950/40'
              }`}
            >
              <div className="flex items-start gap-2">
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className={`w-4 h-4 shrink-0 mt-0.5 ${isNext ? tone.title : 'text-slate-600'}`} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${done ? 'text-green-200' : 'text-white'}`}>
                    {idx + 1}. {step.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{step.detail}</p>
                  {step.id === 'phases' && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(['pre', 'impact', 'post'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onJumpToPhase(p)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            progress.phases[p]
                              ? 'border-green-400/40 text-green-300 bg-green-500/10'
                              : 'border-slate-600 text-slate-400 hover:border-slate-400'
                          }`}
                        >
                          {p === 'pre' ? 'Pre' : p === 'impact' ? 'Impact' : 'Post'}
                          {progress.phases[p] ? ' ✓' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  {!done && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-[10px] border-slate-600 text-slate-200"
                      onClick={() => runStep(step.id)}
                    >
                      {step.id === 'phases' && <Eye className="w-3 h-3 mr-1" />}
                      {step.id === 'sealed_pdf' && <FileText className="w-3 h-3 mr-1" />}
                      {step.id === 'counsel_email' && <Mail className="w-3 h-3 mr-1" />}
                      {step.id === 'notes' && <Pencil className="w-3 h-3 mr-1" />}
                      {step.id === 'phases'
                        ? 'Open next phase'
                        : step.id === 'sealed_pdf'
                          ? 'Open sealed PDF'
                          : step.id === 'counsel_email'
                            ? 'Send counsel email'
                            : 'Go to notes'}
                    </Button>
                  )}
                  {step.id === 'notes' && !done && (
                    <Button
                      size="sm"
                      className={`mt-2 ml-2 h-7 text-[10px] ${tone.btn}`}
                      onClick={markNotesSaved}
                    >
                      Mark notes saved
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Call after notes are persisted so the walkthrough can auto-check. */
export function markCaseNotesComplete(caseId: string) {
  const progress = loadCaseReviewProgress(caseId);
  return markStepDone(progress, 'notes');
}
