'use client';

import type { VaultPhase } from '@/lib/app-context';

const STORAGE_KEY = 'fleetvu_vault_phase';
const POST_KEY = 'fleetvu_vault_post_check';

export function getVaultPhase(): VaultPhase {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'locked' || v === 'hub' || v === 'active') return v;
    return null;
  } catch {
    return null;
  }
}

export function setVaultPhase(phase: VaultPhase): void {
  if (typeof window === 'undefined') return;
  try {
    if (phase === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, phase);
  } catch {
    /* ignore */
  }
}

export interface PostCheckState {
  status: 'pending' | 'passed' | 'failed';
  lastRunAt: string | null;
}

export function getPostCheckState(): PostCheckState {
  if (typeof window === 'undefined') return { status: 'pending', lastRunAt: null };
  try {
    const raw = window.localStorage.getItem(POST_KEY);
    if (!raw) return { status: 'pending', lastRunAt: null };
    return JSON.parse(raw) as PostCheckState;
  } catch {
    return { status: 'pending', lastRunAt: null };
  }
}

export function setPostCheckState(state: PostCheckState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POST_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
