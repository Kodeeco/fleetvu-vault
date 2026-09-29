'use client';

import type { Incident } from '@/lib/types';

export type ReviewStepId = 'phases' | 'sealed_pdf' | 'counsel_email' | 'notes';

export interface CaseReviewProgress {
  caseId: string;
  phases: { pre: boolean; impact: boolean; post: boolean };
  sealedPdf: boolean;
  counselEmail: boolean;
  notes: boolean;
  completedAt: string | null;
  updatedAt: string;
}

const STORAGE_KEY = 'accuvu_case_review_progress_v1';

export const REVIEW_STEPS: Array<{
  id: ReviewStepId;
  title: string;
  detail: string;
}> = [
  {
    id: 'phases',
    title: 'Review all reconstruction phases',
    detail: 'Open Pre-Collision, Impact, and Post-Collision on the canvas.',
  },
  {
    id: 'sealed_pdf',
    title: 'Open sealed PDF digest',
    detail: 'Generate / preview the SHA-256 sealed summary for the internal file.',
  },
  {
    id: 'counsel_email',
    title: 'Email counsel / claims',
    detail: 'Send the case package notification to counsel or claims for review.',
  },
  {
    id: 'notes',
    title: 'Save investigator notes',
    detail: 'Document what was reviewed and what remains outstanding.',
  },
];

function emptyProgress(caseId: string): CaseReviewProgress {
  return {
    caseId,
    phases: { pre: false, impact: false, post: false },
    sealedPdf: false,
    counselEmail: false,
    notes: false,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function readAll(): Record<string, CaseReviewProgress> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, CaseReviewProgress>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, CaseReviewProgress>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function loadCaseReviewProgress(caseId: string): CaseReviewProgress {
  const all = readAll();
  return all[caseId] || emptyProgress(caseId);
}

export function saveCaseReviewProgress(progress: CaseReviewProgress): CaseReviewProgress {
  const next = {
    ...progress,
    updatedAt: new Date().toISOString(),
    completedAt: isReviewComplete(progress) ? progress.completedAt || new Date().toISOString() : null,
  };
  const all = readAll();
  all[progress.caseId] = next;
  writeAll(all);
  return next;
}

export function isPhasesComplete(progress: CaseReviewProgress): boolean {
  return progress.phases.pre && progress.phases.impact && progress.phases.post;
}

export function isStepComplete(progress: CaseReviewProgress, step: ReviewStepId): boolean {
  switch (step) {
    case 'phases':
      return isPhasesComplete(progress);
    case 'sealed_pdf':
      return progress.sealedPdf;
    case 'counsel_email':
      return progress.counselEmail;
    case 'notes':
      return progress.notes;
  }
}

export function isReviewComplete(progress: CaseReviewProgress): boolean {
  return REVIEW_STEPS.every((s) => isStepComplete(progress, s.id));
}

export function getNextIncompleteStep(progress: CaseReviewProgress): ReviewStepId | null {
  for (const step of REVIEW_STEPS) {
    if (!isStepComplete(progress, step.id)) return step.id;
  }
  return null;
}

export function markPhaseViewed(
  progress: CaseReviewProgress,
  phase: 'pre' | 'impact' | 'post',
): CaseReviewProgress {
  return saveCaseReviewProgress({
    ...progress,
    phases: { ...progress.phases, [phase]: true },
  });
}

export function markStepDone(progress: CaseReviewProgress, step: Exclude<ReviewStepId, 'phases'>): CaseReviewProgress {
  return saveCaseReviewProgress({
    ...progress,
    [step === 'sealed_pdf' ? 'sealedPdf' : step === 'counsel_email' ? 'counselEmail' : 'notes']: true,
  });
}

/** Seed notes completion from existing investigator notes on the case file */
export function syncNotesFromIncident(progress: CaseReviewProgress, incident: Incident): CaseReviewProgress {
  if (progress.notes) return progress;
  if (incident.investigator_notes?.trim()) {
    return saveCaseReviewProgress({ ...progress, notes: true });
  }
  return progress;
}

export function reviewCompletionPercent(progress: CaseReviewProgress): number {
  const done = REVIEW_STEPS.filter((s) => isStepComplete(progress, s.id)).length;
  return Math.round((done / REVIEW_STEPS.length) * 100);
}
