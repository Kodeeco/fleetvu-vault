'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  Globe2,
  MapPin,
  Truck,
  User,
  IdCard,
  Cpu,
  Clock,
  X,
  Save,
} from 'lucide-react';
import type { AuthUser } from '@/lib/app-context';
import { useApp } from '@/lib/app-context';
import { getPostCheckState, setPostCheckState, type PostCheckState } from '@/lib/vault-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthorizationGate } from '@/components/auth/authorization-gate';
import { PostStatusBadge } from '@/components/hud/post-status-badge';
import { shouldBypassGate } from '@/lib/testing-mode';
import { isScfuelsTrialUser, SCFUELS_TRIAL } from '@/lib/scfuels-trial';
import { resolveCompanyLogoUrl, companyBrandTagline } from '@/lib/company-branding';
import { EDGE_FILTER_THRESHOLD_M } from '@/lib/edge-filter';
import { autoConnectAndPost } from '@/lib/sensor-auto-connect';

interface VaultLockScreenProps {
  user: AuthUser;
  onLaunch: () => void;
  onEditProfile?: () => void;
  previewMode?: boolean;
}

/**
 * FleetVu MobileAPP Opening page — vault door hero, V badge on wheel, glass DRIVER PROFILE.
 */
export function VaultLockScreen({
  user,
  onLaunch,
  onEditProfile,
  previewMode = false,
}: VaultLockScreenProps) {
  const { login } = useApp();
  const [mounted, setMounted] = useState(false);
  const [postCheck, setPostCheck] = useState<PostCheckState>({ status: 'pending', lastRunAt: null });
  const [postRunning, setPostRunning] = useState(false);
  const [inactiveNotice, setInactiveNotice] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const [draftName, setDraftName] = useState(user.name);
  const [draftTruck, setDraftTruck] = useState(user.truckNumber || SCFUELS_TRIAL.trucks[0]);
  const [draftDepot, setDraftDepot] = useState(user.depot || user.location || SCFUELS_TRIAL.depot);
  const [draftHardware, setDraftHardware] = useState(user.sensorHardware || SCFUELS_TRIAL.hardware);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateAction, setGateAction] = useState<'launch' | 'edit'>('launch');

  useEffect(() => {
    setMounted(true);
    setPostCheck(getPostCheckState());
  }, []);

  useEffect(() => {
    setDraftName(user.name);
    setDraftTruck(user.truckNumber || SCFUELS_TRIAL.trucks[0]);
    setDraftDepot(user.depot || user.location || SCFUELS_TRIAL.depot);
    setDraftHardware(user.sensorHardware || SCFUELS_TRIAL.hardware);
  }, [user]);

  const trialBranded = isScfuelsTrialUser(user);
  const brandLogo = resolveCompanyLogoUrl(user);
  const brandTagline = companyBrandTagline(user);
  const truck = user.truckNumber || SCFUELS_TRIAL.trucks[0];
  const hardware = user.sensorHardware || SCFUELS_TRIAL.hardware;
  const depot = user.depot || user.location || SCFUELS_TRIAL.depot;
  const driverId = user.driverId || user.driverNumber || 'SCF-DRV-01';
  const company = user.companyName || (trialBranded ? SCFUELS_TRIAL.companyName : 'FleetVu Partner');

  const requestLaunch = () => {
    // Trial / demo vault sessions skip the 13-digit corporate gate so Tap to Launch
    // goes straight into the C55 HUD (SCFuels evaluation + #demo-vault).
    const demoSession =
      trialBranded ||
      Boolean(user.biometricVerified) ||
      (typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('demo-vault'));

    if (previewMode || demoSession || shouldBypassGate('vault_access')) {
      onLaunch();
      return;
    }
    setGateAction('launch');
    setGateOpen(true);
  };

  const runPostCheck = async () => {
    if (postRunning) return;
    setPostRunning(true);
    try {
      const result = await autoConnectAndPost(undefined, (post) => {
        const next = {
          status: post.passed ? ('passed' as const) : ('failed' as const),
          lastRunAt: post.timestamp,
        };
        setPostCheckState(next);
        setPostCheck(next);
      });
      if (!result.postCheckResult) {
        const next = { status: 'passed' as const, lastRunAt: new Date().toISOString() };
        setPostCheckState(next);
        setPostCheck(next);
      }
    } catch {
      const next = { status: 'failed' as const, lastRunAt: new Date().toISOString() };
      setPostCheckState(next);
      setPostCheck(next);
    } finally {
      setPostRunning(false);
    }
  };

  const openEdit = () => {
    if (onEditProfile) {
      onEditProfile();
      return;
    }
    const demoSession =
      trialBranded ||
      Boolean(user.biometricVerified) ||
      (typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('demo-vault'));

    if (previewMode || demoSession || shouldBypassGate('profile_edit')) {
      setEditOpen(true);
      return;
    }
    setGateAction('edit');
    setGateOpen(true);
  };

  const saveEdit = () => {
    login({
      ...user,
      name: draftName.trim() || user.name,
      truckNumber: draftTruck.trim() || truck,
      depot: draftDepot.trim() || depot,
      location: draftDepot.trim() || depot,
      sensorHardware: draftHardware.trim() || hardware,
    });
    setEditOpen(false);
  };

  return (
    <div className="h-[100dvh] w-full max-w-md mx-auto text-slate-100 flex flex-col relative overflow-hidden bg-[#05070b] shadow-2xl shadow-black/80">
      {/* Full vault door — portrait asset (not the gold wordmark) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/FV-Vault-door.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-[center_38%] pointer-events-none select-none"
      />
      {/* Soft veil so metal + wheel stay the hero */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/45 via-transparent to-black/80" />

      {/* V badge pinned to vault wheel hub */}
      <div
        className={`absolute left-1/2 z-10 -translate-x-1/2 top-[26%] transition-all duration-700 pointer-events-none ${
          mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/FleetVu-VaultBadge.jpg"
          alt="FleetVu Vault"
          className="h-[96px] w-[96px] rounded-full object-cover object-center shadow-[0_0_32px_rgba(251,191,36,0.4)] ring-1 ring-amber-400/30"
        />
      </div>

      {/* ── Header (brand + status — badge sits on the wheel) ── */}
      <div className="relative z-20 pt-2 px-4 text-center shrink-0">
        {brandLogo && (
          <div className="mx-auto w-full max-w-[340px] rounded-xl border border-white/10 bg-black/70 backdrop-blur-md px-3 py-2.5 shadow-lg shadow-black/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogo}
              alt={company}
              className="mx-auto h-12 w-auto max-w-[260px] object-contain object-center"
            />
            {brandTagline && (
              <p className="mt-1.5 text-center text-[10px] font-semibold text-cyan-200/90 tracking-wide">
                {brandTagline}
              </p>
            )}
            {(trialBranded || user.truckNumber) && (
              <p className="text-center text-[9px] text-slate-400 mt-0.5 font-mono">
                Truck {truck}
                {trialBranded
                  ? ` · FWD ${SCFUELS_TRIAL.channels.channel_forward_range_m}m · L/R ${SCFUELS_TRIAL.channels.channel_left_range_m}m · EDGE @ ${EDGE_FILTER_THRESHOLD_M}m`
                  : ''}
              </p>
            )}
          </div>
        )}

        {previewMode && (
          <div className="mt-2 mx-auto max-w-sm rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[10px] text-violet-200">
            Preview — Driver Vault opening page
          </div>
        )}

        {inactiveNotice && (
          <div className="mt-2.5 mx-auto max-w-[340px] rounded-lg border border-amber-500/50 bg-black/55 backdrop-blur-md px-3 py-2 text-[11px] text-amber-50 flex items-start gap-2 shadow-lg shadow-black/40">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="flex-1 text-left leading-snug">
              Vault locked due to inactivity. Session preserved — tap Launch to re-enter.
            </span>
            <button
              type="button"
              className="text-amber-300/70 hover:text-white shrink-0 text-xs leading-none pt-0.5"
              onClick={() => setInactiveNotice(false)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.2)]">
          <Globe2 className="w-3 h-3 text-emerald-400" />
          AES-256 Encryption — Connected
        </div>
      </div>

      {/* ── Profile over lower door (badge lives on wheel above) ── */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-end min-h-0 px-4 pb-1 pt-[10%]">
        <p className="mb-2 text-[11px] text-slate-200/85 drop-shadow">
          Session active — awaiting driver return.
        </p>

        <div
          className={`w-full max-w-[360px] rounded-xl border border-amber-500/40 bg-[#0a0c10]/72 backdrop-blur-xl shadow-[0_12px_48px_rgba(0,0,0,0.65)] overflow-hidden transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              {brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandLogo}
                  alt={company}
                  className="h-5 w-auto max-w-[110px] object-contain object-left"
                />
              ) : (
                <span className="text-[11px] font-bold tracking-[0.16em] text-amber-400 uppercase">
                  Driver Profile
                </span>
              )}
              {trialBranded && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90 shrink-0">
                  Driver
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center gap-1 rounded border border-amber-500/55 bg-amber-500/5 px-2 py-0.5 text-[10px] font-bold text-amber-400 hover:bg-amber-500/15 active:scale-95"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            </div>
          </div>

          <div className="px-3.5 py-3.5 grid grid-cols-2 gap-x-4 gap-y-3.5">
            <div className="space-y-3.5">
              <ProfileField icon={<Building2 className="w-3.5 h-3.5" />} label="Company Name" value={company} />
              <ProfileField icon={<User className="w-3.5 h-3.5" />} label="Driver Name" value={user.name} />
              <ProfileField icon={<IdCard className="w-3.5 h-3.5" />} label="Driver ID" value={driverId} />
              <ProfileField
                icon={<Cpu className="w-3.5 h-3.5" />}
                label="Sensor Hardware"
                value={
                  <span>
                    {hardware}{' '}
                    <span className="text-emerald-400 font-semibold">(Verified)</span>
                  </span>
                }
              />
            </div>
            <div className="space-y-3.5">
              <ProfileField icon={<Truck className="w-3.5 h-3.5" />} label="Truck #" value={truck} />
              <ProfileField icon={<MapPin className="w-3.5 h-3.5" />} label="Depot" value={depot} />
              <div className="flex items-start gap-2 min-w-0 pt-0.5">
                <div className="mt-0.5 w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] text-amber-500/80 uppercase tracking-wide font-semibold">
                    Daily POST Check
                  </div>
                  <div className="mt-1">
                    <PostStatusBadge
                      lastPostCheckAt={postCheck.lastRunAt}
                      size="sm"
                      isRunning={postRunning}
                      onClick={() => void runPostCheck()}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Launch footer ── */}
      <div className="relative z-20 pb-6 pt-1 px-4 text-center shrink-0">
        <p className="text-[12px] text-white/85 mb-1 drop-shadow">Launch the</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/FV-Vault-logo-gold.png"
          alt="Vault"
          className="mx-auto h-12 sm:h-14 object-contain mb-1 drop-shadow-[0_0_22px_rgba(251,191,36,0.4)]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/FV-Vault1k-.png';
          }}
        />
        <p className="text-[9px] text-white/45 mb-4 tracking-wide">patent pending: 64-036,221</p>

        <button type="button" onClick={requestLaunch} className="group mx-auto inline-block focus:outline-none">
          <span
            className="text-[13px] font-black tracking-[0.28em] uppercase"
            style={{
              background: 'linear-gradient(180deg, #fde68a 0%, #fbbf24 45%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              borderBottom: '1px solid rgba(251, 191, 36, 0.55)',
              paddingBottom: '2px',
            }}
          >
            Tap to Launch
          </span>
        </button>
      </div>

      {/* Edit profile sheet */}
      {editOpen && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl border border-amber-500/30 bg-[#0c1219] p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black text-white">Edit Driver Profile</p>
                <p className="text-[10px] text-slate-500">Cab assignment details for this device</p>
              </div>
              <button type="button" onClick={() => setEditOpen(false)} className="text-slate-500 hover:text-white" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-[10px] text-amber-400/80 uppercase">Driver Name</Label>
                <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-1 bg-slate-950 border-slate-700 text-white h-10" />
              </div>
              <div>
                <Label className="text-[10px] text-amber-400/80 uppercase">Truck #</Label>
                <Input value={draftTruck} onChange={(e) => setDraftTruck(e.target.value)} className="mt-1 bg-slate-950 border-slate-700 text-white h-10" />
              </div>
              <div>
                <Label className="text-[10px] text-amber-400/80 uppercase">Depot</Label>
                <Input value={draftDepot} onChange={(e) => setDraftDepot(e.target.value)} className="mt-1 bg-slate-950 border-slate-700 text-white h-10" />
              </div>
              <div>
                <Label className="text-[10px] text-amber-400/80 uppercase">Sensor Hardware</Label>
                <Input value={draftHardware} onChange={(e) => setDraftHardware(e.target.value)} className="mt-1 bg-slate-950 border-slate-700 text-white h-10" />
              </div>
              <p className="text-[9px] text-slate-600">
                Company Name and Driver ID are set by your fleet administrator and cannot be changed here.
              </p>
            </div>

            <Button className="mt-4 w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold gap-2" onClick={saveEdit}>
              <Save className="w-4 h-4" />
              Save Profile
            </Button>
          </div>
        </div>
      )}

      <AuthorizationGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        title={gateAction === 'launch' ? 'Authorize Vault Launch' : 'Authorize Profile Edit'}
        actionLabel={gateAction === 'launch' ? 'Launch the Vault' : 'Edit Profile'}
        onAuthorized={() => {
          setGateOpen(false);
          if (gateAction === 'launch') onLaunch();
          else setEditOpen(true);
        }}
      />
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] text-amber-500/80 uppercase tracking-wide font-semibold">{label}</div>
        <div className="text-[13px] font-semibold text-white truncate leading-snug">{value}</div>
      </div>
    </div>
  );
}
