'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp, type AuthUser } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Truck,
  Mail,
  Lock,
  MapPin,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Shield,
  Radar,
  Scale,
  FileLock2,
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  MailWarning,
  Loader2,
  Gauge,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { UserRole } from '@/lib/types';
import { DesktopOptimizationBridge } from '@/components/desktop/desktop-optimization-bridge';
import {
  DEMO_APEX_COMPANY_ID,
  DEMO_CUSTOMER_SUPER_ADMIN,
  markUxDemoEnterprise,
} from '@/lib/demo-customer-seed';

const GLOBAL_ADMIN_PASSWORD = 'FleetVu!Global2026';

const PLATFORM_ADMIN_EMAILS = [
  'admin@fleetvu.com',
  'admin@fleetvu.org',
  'admin@fleetmasterusa.com',
  'info@fleetmasterusa.com',
];

const GLOBAL_ADMIN_EMAILS = [
  'admin@fleetvu.com',
  'admin@fleetvu.org',
  'admin@fleetmasterusa.com',
];

export function LoginScreen({ portalMode = 'enterprise' }: { portalMode?: 'enterprise' | 'global' | 'accuvu' }) {
  const { login, setView, setFleet } = useApp();
  const [email, setEmail] = useState(portalMode === 'global' ? 'admin@fleetvu.org' : '');
  const [pin, setPin] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const isGlobalPortal = portalMode === 'global';
  const isAccuVuPortal = portalMode === 'accuvu';
  const productSku: AuthUser['productSku'] = isAccuVuPortal ? 'accuvu' : 'fleetvu';

  const ACCUVU_DEMO_EMAIL = 'admin@fleetvu.org';
  const ACCUVU_DEMO_PASSWORD = 'FleetVu!Global2026';

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (portalMode === 'accuvu') {
      setEmail(ACCUVU_DEMO_EMAIL);
      setPin('');
    }
  }, [portalMode]);

  const completeLogin = useCallback(
    (user: AuthUser, view: 'desktop' | 'mobile' = 'desktop') => {
      login({ ...user, productSku: user.productSku ?? productSku });
      setView(view);
    },
    [login, productSku, setView],
  );

  const enterAccuVuDemo = useCallback(() => {
    markUxDemoEnterprise();
    completeLogin({
      ...DEMO_CUSTOMER_SUPER_ADMIN,
      email: ACCUVU_DEMO_EMAIL,
      name: 'AccuVu Account Admin',
      companyName: 'AccuVu Demo Company',
      productSku: 'accuvu',
    });
    setFleet({
      selectedCompanyId: DEMO_APEX_COMPANY_ID,
      selectedRegion: null,
      selectedLocation: null,
      selectedTerminal: null,
      demoPlan: 'proplus',
    });
  }, [completeLogin, setFleet]);

  const handleLogin = async () => {
    setError(null);
    if (!email || !pin) {
      setError('Email and PIN / Password are required.');
      return;
    }
    setLoading(true);
    try {
      const keyUpper = activationKey.trim().toUpperCase();
      const emailLower = email.toLowerCase().trim();

      // AccuVu UX Review credentials (no Supabase row required)
      if (
        isAccuVuPortal &&
        emailLower === ACCUVU_DEMO_EMAIL.toLowerCase() &&
        pin === ACCUVU_DEMO_PASSWORD
      ) {
        enterAccuVuDemo();
        setLoading(false);
        return;
      }

      if (keyUpper) {
        const { data: keyRecord } = await supabase
          .from('activation_keys')
          .select('key_code, role_type, status, company_name, company_id')
          .eq('key_code', keyUpper)
          .maybeSingle();

        if (keyRecord && keyRecord.status === 'active') {
          await supabase
            .from('activation_keys')
            .update({ status: 'used', used_by_email: email, used_at: new Date().toISOString() })
            .eq('key_code', keyUpper);

          if (keyRecord.role_type === 'super_admin' || keyRecord.role_type === 'global_admin') {
            const user: AuthUser = {
              role: keyRecord.role_type as UserRole,
              email,
              name: email.split('@')[0],
              companyName: keyRecord.company_name || undefined,
              companyId: keyRecord.company_id || undefined,
            };
            completeLogin(user);
            return;
          }
          if (keyRecord.role_type === 'executive') {
            let planTier: 'basic' | 'pro' | 'proplus' = 'basic';
            let companyLogoUrl: string | undefined;
            if (keyRecord.company_id) {
              const { data: company } = await supabase
                .from('companies')
                .select('plan_tier, logo_url')
                .eq('id', keyRecord.company_id)
                .maybeSingle();
              if (company) {
                planTier = (company.plan_tier as 'basic' | 'pro' | 'proplus') || 'basic';
                companyLogoUrl = (company as { logo_url?: string }).logo_url || undefined;
              }
            }
            const user: AuthUser = {
              role: 'executive' as UserRole,
              email,
              name: email.split('@')[0],
              companyName: keyRecord.company_name || undefined,
              companyId: keyRecord.company_id || undefined,
              companyLogoUrl,
              planTier,
            };
            completeLogin(user);
            return;
          }
          if (keyRecord.role_type === 'driver') {
            if (isAccuVuPortal) {
              setError('AccuVu is the reconstruction platform — use Driver / Vault Portal for field drivers.');
              setLoading(false);
              return;
            }
            let companyLogoUrl: string | undefined;
            if (keyRecord.company_id) {
              const { data: company } = await supabase
                .from('companies')
                .select('logo_url')
                .eq('id', keyRecord.company_id)
                .maybeSingle();
              companyLogoUrl = (company as { logo_url?: string } | null)?.logo_url || undefined;
            }
            const user: AuthUser = {
              role: 'driver' as UserRole,
              email,
              name: email.split('@')[0],
              companyName: keyRecord.company_name || undefined,
              companyId: keyRecord.company_id || undefined,
              companyLogoUrl,
              planTier: 'proplus',
              pinCode: pin,
            };
            completeLogin(user, 'mobile');
            return;
          }
        }

        if (keyUpper.includes('-SA') || keyUpper.includes('-GA')) {
          setError('Invalid or expired activation key. Contact your FleetVu administrator.');
          setLoading(false);
          return;
        }

        if (keyUpper === 'KEY-1234') {
          const trialUser: AuthUser = {
            role: 'executive' as UserRole,
            email,
            name: email.split('@')[0],
            planTier: 'basic',
            trialStartDate: new Date().toISOString(),
            trialDurationDays: 30,
          };
          completeLogin(trialUser);
          return;
        }
      }

      // FleetVu Global Ops credentials (CRM workspace)
      if (!isAccuVuPortal && (isGlobalPortal || GLOBAL_ADMIN_EMAILS.includes(emailLower))) {
        if (!GLOBAL_ADMIN_EMAILS.includes(emailLower) && !PLATFORM_ADMIN_EMAILS.includes(emailLower)) {
          setError('FleetVu Operations login only. Use admin@fleetvu.org');
          setLoading(false);
          return;
        }
        if (pin !== GLOBAL_ADMIN_PASSWORD) {
          setError('Invalid FleetVu Global Admin credentials.');
          setLoading(false);
          return;
        }
        const user: AuthUser = {
          role: 'global_admin',
          email: emailLower,
          name: 'FleetVu Global Admin',
          productSku: 'fleetvu',
        };
        completeLogin(user);
        return;
      }

      // Enterprise / AccuVu customer path — never grant global_admin from customer login
      if (PLATFORM_ADMIN_EMAILS.includes(emailLower) && !isGlobalPortal) {
        setError('Use the FleetVu Operations portal for platform staff accounts.');
        setLoading(false);
        return;
      }

      const { data: provisioned } = await supabase
        .from('provisioned_users')
        .select('full_name, email, role, company_name, company_id, status, scoped_company_ids, assigned_locations, plan_tier')
        .ilike('email', email)
        .maybeSingle();

      if (provisioned && provisioned.status !== 'suspended' && provisioned.status !== 'revoked') {
        let planTier: 'basic' | 'pro' | 'proplus' = (provisioned as { plan_tier?: string }).plan_tier as 'basic' | 'pro' | 'proplus' || 'basic';
        let companyId = provisioned.company_id;
        let companyLogoUrl: string | undefined;
        if (provisioned.company_name) {
          const { data: company } = await supabase
            .from('companies')
            .select('id, plan_tier, logo_url')
            .ilike('name', provisioned.company_name)
            .maybeSingle();
          if (company) {
            planTier = (company.plan_tier as 'basic' | 'pro' | 'proplus') || 'basic';
            companyId = company.id;
            companyLogoUrl = (company as { logo_url?: string }).logo_url || undefined;
          }
        }
        const mappedRole: UserRole =
          provisioned.role === 'super_admin' ? 'super_admin' :
          provisioned.role === 'global_admin' ? 'global_admin' :
          provisioned.role === 'driver' ? 'driver' : 'executive';
        if (isAccuVuPortal && (mappedRole === 'driver' || mappedRole === 'global_admin')) {
          setError(
            mappedRole === 'driver'
              ? 'AccuVu is for reconstruction / claims teams — open Driver / Vault Portal for field drivers.'
              : 'Use FleetVu Ops for platform staff accounts.',
          );
          setLoading(false);
          return;
        }
        const user: AuthUser = {
          role: mappedRole,
          email: provisioned.email,
          name: provisioned.full_name || provisioned.email.split('@')[0],
          companyName: provisioned.company_name || undefined,
          planTier,
          companyId: companyId || undefined,
          companyLogoUrl,
          provisionedRole: provisioned.role,
          scopedCompanyIds: (provisioned as { scoped_company_ids?: string[] }).scoped_company_ids || [],
          assignedLocations: (provisioned as { assigned_locations?: string[] }).assigned_locations || [],
        };
        completeLogin(user, mappedRole === 'driver' ? 'mobile' : 'desktop');
        setLoading(false);
        return;
      }

      // Enterprise portal: do not silently fall through to driver mode
      if (isGlobalPortal) {
        setError('Invalid FleetVu Global Admin credentials.');
      } else if (isAccuVuPortal) {
        setError(
          'No AccuVu account found for that email. Use “Open Demo AccuVu” below, or ask FleetVu to provision your reconstruction login.',
        );
      } else {
        setError(
          'No enterprise account found for that email. Use “Enter Company Dashboard (UX Demo)” below, or ask FleetVu to provision your login.',
        );
      }
      setLoading(false);
    } catch {
      setError('Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden pt-11">
      {/* Top status bar */}
      <div className="shrink-0 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SECURE PORTAL — NODE US-EAST-1A
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> TLS 1.3 Encrypted</span>
            <span className="flex items-center gap-1"><FileLock2 className="w-3 h-3" /> FIPS 140-2 Compliant</span>
          </div>
        </div>
      </div>

      {/* Main split — columns scroll so Jump bar + form fit the viewport */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full w-full grid lg:grid-cols-[1fr_min(480px,44vw)] gap-0">
          {/* Left: Brand & feature panel (desktop only) */}
          <div className="hidden lg:flex relative flex-col justify-between overflow-y-auto overscroll-contain bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-10 py-8 xl:px-14 xl:py-10">
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-2xl shadow-xl ${
                    isAccuVuPortal
                      ? 'bg-emerald-500 shadow-emerald-500/30'
                      : 'bg-orange-500 shadow-orange-500/30'
                  }`}
                >
                  {isAccuVuPortal ? <Gauge className="w-7 h-7 text-white" /> : <Truck className="w-7 h-7 text-white" />}
                </div>
                <div>
                  <div className="text-xl font-bold text-white tracking-tight leading-none">
                    {isAccuVuPortal ? 'AccuVu' : 'FleetVu'}
                  </div>
                  <div
                    className={`text-[10px] font-semibold tracking-wider uppercase mt-1 ${
                      isAccuVuPortal ? 'text-emerald-400' : 'text-orange-400'
                    }`}
                  >
                    {isGlobalPortal
                      ? 'Business Operations Portal'
                      : isAccuVuPortal
                        ? 'Accident Reconstruction Platform'
                        : 'Global Command Center'}
                  </div>
                </div>
              </div>

              <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight max-w-md">
                {isGlobalPortal ? (
                  <>
                    Client Onboarding<br />
                    Sales &amp; CRM<br />
                    <span className="text-orange-500">FleetVu Ops</span>
                  </>
                ) : isAccuVuPortal ? (
                  <>
                    Court-Ready<br />
                    Accident Reconstruction<br />
                    <span className="text-emerald-400">&amp; SHA-256 Custody</span>
                  </>
                ) : (
                  <>
                    Enterprise Fleet<br />
                    Telemetry &amp; Forensic<br />
                    <span className="text-orange-500">Risk Intelligence</span>
                  </>
                )}
              </h1>
              <p className="text-slate-400 mt-3 text-sm leading-relaxed max-w-md">
                {isGlobalPortal
                  ? 'Provision new customer accounts, send welcome emails, manage entitlements, and run daily FleetVu business operations. Customer accident files remain tenant-exclusive.'
                  : isAccuVuPortal
                    ? 'Secure company account for safety & claims teams — collision spine, 77GHz radar playback, sealed digests. Reconstruction-first; Driver Vault is a separate FleetVu product.'
                    : 'SHA-256 cryptographic data custody, 77GHz multi-sensor analytics, and court-admissible incident reconstruction — unified in a single command portal.'}
              </p>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-3 max-w-md mt-6">
              {isAccuVuPortal ? (
                <>
                  <FeatureHighlight
                    icon={<Gauge className="w-5 h-5" />}
                    title="Collision Spine"
                    desc="Millisecond reconstruction timeline with radar contacts, GPS, and impact vectors."
                  />
                  <FeatureHighlight
                    icon={<Radar className="w-5 h-5" />}
                    title="77GHz Playback"
                    desc="Multi-arc radar evidence for claims, counsel, and safety review."
                  />
                  <FeatureHighlight
                    icon={<FileLock2 className="w-5 h-5" />}
                    title="SHA-256 Digests"
                    desc="Court-ready sealed reports with chain-of-custody hashing."
                  />
                  <FeatureHighlight
                    icon={<Scale className="w-5 h-5" />}
                    title="Legal Isolation"
                    desc="Tenant-exclusive case files — not shared with FleetVu Ops CRM."
                  />
                </>
              ) : (
                <>
                  <FeatureHighlight
                    icon={<Radar className="w-5 h-5" />}
                    title="77GHz Radar Telemetry"
                    desc="Real-time proximity sensing with sub-meter accuracy across forward, lateral, and rear arcs."
                  />
                  <FeatureHighlight
                    icon={<MapPin className="w-5 h-5" />}
                    title="Live Fleet GPS"
                    desc="Sub-second vehicle tracking with geofence alerts and route corridor enforcement."
                  />
                  <FeatureHighlight
                    icon={<FileLock2 className="w-5 h-5" />}
                    title="Forensic Vault"
                    desc="WORM-sealed telemetry with SHA-256 chain-of-custody for litigation-ready evidence."
                  />
                  <FeatureHighlight
                    icon={<Scale className="w-5 h-5" />}
                    title="Underwriting Risk"
                    desc="Actuarial risk scoring with carrier-tiered discount certification and audit trails."
                  />
                </>
              )}
            </div>

            <div className="relative z-10 flex flex-col gap-1.5 pt-5 border-t border-slate-700/50 max-w-md mt-6">
              <TrustBadge icon={<FileLock2 className="w-4 h-4" />} text="SHA-256 Cryptographic Vault Sealed" />
              <TrustBadge icon={<Scale className="w-4 h-4" />} text="Court-Admissible Data Custody" />
              <TrustBadge icon={<Shield className="w-4 h-4" />} text="Zero-Trust WORM Architecture" />
            </div>
          </div>

          {/* Right: Login form panel */}
          <div className="flex flex-col min-h-0 overflow-y-auto overscroll-contain bg-slate-900/60 backdrop-blur-xl border-l border-slate-800/60 px-5 sm:px-8 lg:px-10 py-6 lg:py-8">
            <div className="w-full max-w-[400px] mx-auto my-auto">
              <div className="lg:hidden mb-5">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`flex items-center justify-center w-11 h-11 rounded-xl shadow-lg ${
                      isAccuVuPortal
                        ? 'bg-emerald-500 shadow-emerald-500/30'
                        : 'bg-orange-500 shadow-orange-500/30'
                    }`}
                  >
                    {isAccuVuPortal ? <Gauge className="w-6 h-6 text-white" /> : <Truck className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white tracking-tight leading-none">
                      {isAccuVuPortal ? 'AccuVu' : 'FleetVu'}
                    </div>
                    <div
                      className={`text-[10px] font-semibold tracking-wider uppercase mt-1 ${
                        isAccuVuPortal ? 'text-emerald-400' : 'text-orange-400'
                      }`}
                    >
                      {isAccuVuPortal ? 'Accident Reconstruction' : 'Global Command Center'}
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-bold text-white tracking-tight">
                Sign In to {isGlobalPortal ? 'Global Command' : isAccuVuPortal ? 'AccuVu' : 'Command Portal'}
              </h2>
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                {isGlobalPortal
                  ? 'FleetVu staff only — CRM, onboarding, and commercial operations.'
                  : isAccuVuPortal
                    ? 'Reconstruction account login — SHA-256 sealed cases for your company.'
                    : 'Customer company login — your access level is determined automatically.'}
              </p>

              <div className="mt-5 space-y-3">
                {isAccuVuPortal && (
                  <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3 text-[11px] text-emerald-50/90 space-y-1">
                    <p className="font-bold text-emerald-300 text-xs">AccuVu UX Review — no signup needed</p>
                    <p className="font-mono text-emerald-100/90">{ACCUVU_DEMO_EMAIL}</p>
                    <p className="font-mono text-emerald-100/90">{ACCUVU_DEMO_PASSWORD}</p>
                    <Button
                      type="button"
                      className="mt-1.5 h-9 w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold"
                      onClick={enterAccuVuDemo}
                    >
                      Open Demo AccuVu Reconstruction
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      name={isAccuVuPortal ? 'accuvu-email' : 'email'}
                      autoComplete={isAccuVuPortal ? 'off' : 'username'}
                      className="pl-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 h-10"
                      placeholder={isAccuVuPortal ? ACCUVU_DEMO_EMAIL : 'you@company.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>

                {/* PIN / Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">PIN / Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-xs text-slate-400 hover:text-orange-400 font-medium transition-colors flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      name={isAccuVuPortal ? 'accuvu-password' : 'password'}
                      autoComplete={isAccuVuPortal ? 'off' : 'current-password'}
                      type={showPassword ? 'text' : 'password'}
                      className="pl-10 pr-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 h-10"
                      placeholder={isAccuVuPortal ? ACCUVU_DEMO_PASSWORD : '••••••••'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {!isAccuVuPortal && (
                <div className="space-y-1.5">
                  <details className="group">
                    <summary className="text-slate-300 text-sm flex items-center gap-1.5 cursor-pointer list-none select-none">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500 group-open:text-orange-400 transition-colors" />
                      <span className="group-open:text-orange-400 transition-colors">Organization Activation Key</span>
                      <span className="text-[10px] text-slate-600 font-normal ml-1">— expand for initial setup</span>
                      <ChevronRight className="w-3 h-3 text-slate-600 ml-auto group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          className="pl-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 font-mono text-sm uppercase tracking-wider h-11"
                          placeholder="FV-XXXX-SA / GA / EX (Optional)"
                          value={activationKey}
                          onChange={(e) => setActivationKey(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                      </div>
                      <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-2.5 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          <span className="text-slate-400 font-medium">Initial corporate onboarding only.</span> Use this field when provisioning a new tenant organization for the first time. Existing admin and executive accounts can sign in with just Email and Password — leave this blank.
                        </p>
                      </div>
                    </div>
                  </details>
                </div>
                )}

                <Button
                  className={`w-full text-white font-semibold h-10 text-sm ${
                    isAccuVuPortal
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading
                    ? 'Authenticating…'
                    : isAccuVuPortal
                      ? 'Sign In to AccuVu'
                      : 'Sign In to FleetVu'}
                  {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>

                {isGlobalPortal ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-100/80 space-y-1">
                    <p className="font-bold text-amber-300">FleetVu Ops (UX Review)</p>
                    <p className="font-mono text-amber-200/90">admin@fleetvu.org</p>
                    <p className="font-mono text-amber-200/90">FleetVu!Global2026</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 h-8 w-full border-amber-500/40 text-amber-200 text-xs"
                      onClick={() => {
                        setEmail('admin@fleetvu.org');
                        setPin('FleetVu!Global2026');
                        window.setTimeout(() => {
                          completeLogin({
                            role: 'global_admin',
                            email: 'admin@fleetvu.org',
                            name: 'FleetVu Global Admin',
                            productSku: 'fleetvu',
                          });
                        }, 50);
                      }}
                    >
                      Enter Global CRM (Demo)
                    </Button>
                  </div>
                ) : !isAccuVuPortal ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 border-blue-500/40 bg-blue-500/5 text-blue-200 text-xs font-semibold"
                    onClick={() => {
                      markUxDemoEnterprise();
                      completeLogin({ ...DEMO_CUSTOMER_SUPER_ADMIN, productSku: 'fleetvu' });
                      setFleet({
                        selectedCompanyId: DEMO_APEX_COMPANY_ID,
                        selectedRegion: null,
                        selectedLocation: null,
                        selectedTerminal: null,
                        demoPlan: 'proplus',
                      });
                    }}
                  >
                    Enter Company Dashboard (UX Demo — no password)
                  </Button>
                ) : null}

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                {!isAccuVuPortal && <AccessRequestSection />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legal trust banner — mobile/tablet (below form) */}
      <div className="lg:hidden shrink-0 border-t border-slate-800/60 bg-slate-900/50 px-6 py-3">
        <div className="max-w-[400px] mx-auto flex flex-col gap-1.5">
          <TrustBadge icon={<FileLock2 className="w-4 h-4" />} text="SHA-256 Cryptographic Vault Sealed" />
          <TrustBadge icon={<Scale className="w-4 h-4" />} text="Court-Admissible Data Custody" />
          <TrustBadge icon={<Shield className="w-4 h-4" />} text="Zero-Trust WORM Architecture" />
        </div>
      </div>

      {/* Password Reset Modal */}
      <PasswordResetModal open={showResetModal} onOpenChange={setShowResetModal} />

      {/* Desktop Optimization Bridge for mobile viewers */}
      {mounted && <DesktopOptimizationBridge />}
    </div>
  );
}

function PasswordResetModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [resetEmail, setResetEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!resetEmail.trim()) return;
    setSending(true);
    try {
      await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PASSWORD_RESET',
          to_email: resetEmail.trim().toLowerCase(),
          to_name: resetEmail.split('@')[0],
        }),
      });
    } catch {
      // email send is best-effort
    }
    setSending(false);
    setSent(true);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSent(false);
    setResetEmail('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                Reset Link Sent
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                If an account exists for <span className="text-slate-300 font-medium">{resetEmail}</span>, you will receive an email with instructions to reset your access within a few minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                For security, the reset link expires in 30 minutes. Check your spam folder if you don&apos;t see the email.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="bg-orange-500 hover:bg-orange-600 text-white">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <MailWarning className="h-5 w-5 text-orange-400" />
                Reset Access
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Enter your registered email address and we&apos;ll send you a secure link to reset your PIN or password.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Registered Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="you@company.com"
                    className="pl-10 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 h-11"
                    autoFocus
                  />
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-2.5 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  For your security, we verify identity via email before allowing a reset. If you no longer have access to your email, contact your FleetVu administrator.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!resetEmail.trim() || sending}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                ) : (
                  <>Send Reset Link<ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeatureHighlight({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
      <div className="flex items-center gap-2 text-orange-400">
        {icon}
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className="text-orange-400">{icon}</span>
      <span className="font-medium">{text}</span>
    </div>
  );
}

function AccessRequestSection() {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRoute, setSubmittedRoute] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [region, setRegion] = useState('');
  const [facility, setFacility] = useState('');
  const [roleRequested, setRoleRequested] = useState('');
  const [reason, setReason] = useState('');

  const REGIONS = ['West Coast', 'Midwest', 'East Coast', 'South', 'National/Global'] as const;

  const FACILITIES_BY_REGION: Record<string, string[]> = {
    'West Coast': ['Los Angeles, CA', 'San Francisco, CA', 'Portland, OR', 'Seattle, WA', 'All West Coast Locations'],
    'Midwest': ['Chicago, IL', 'Detroit, MI', 'Minneapolis, MN', 'Kansas City, MO', 'All Midwest Locations'],
    'East Coast': ['New York, NY', 'Boston, MA', 'Atlanta, GA', 'Miami, FL', 'All East Coast Locations'],
    'South': ['Houston, TX', 'Dallas, TX', 'Phoenix, AZ', 'Denver, CO', 'All Southern Locations'],
    'National/Global': ['All Locations (Company-Wide)', 'Multi-Region', 'International'],
  };

  const ROLES = ['Safety Manager', 'HR/Legal', 'Claims Adjuster', 'Regional Director'] as const;

  const computeRoutingTarget = (selectedRegion: string, selectedFacility: string): string => {
    if (selectedRegion === 'National/Global' || selectedFacility === 'All Locations (Company-Wide)' || selectedFacility === 'Multi-Region' || selectedFacility === 'International') {
      return 'Super Admin';
    }
    if (selectedFacility.startsWith('All ') && selectedFacility.includes('Locations')) {
      return 'Regional Director';
    }
    return 'Local Location Admin';
  };

  const submitRequest = async () => {
    if (!name || !email || !company || !region || !facility || !roleRequested) return;
    const routingTarget = computeRoutingTarget(region, facility);
    await supabase.from('access_requests').insert({
      requester_name: name,
      requester_email: email,
      requester_role: roleRequested,
      company_name: company,
      department: roleRequested,
      request_reason: reason,
      region,
      location_facility: facility,
      role_requested: roleRequested,
      routing_target: routingTarget,
      status: 'pending',
    });
    setSubmittedRoute(routingTarget);
    setSubmitted(true);
    setShowForm(false);
  };

  if (submitted) {
    return (
      <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-green-950/40 border border-green-800/40 text-green-300 text-sm">
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p>Access request submitted. Routed to <span className="font-bold">{submittedRoute}</span> for review.</p>
          <p className="text-xs text-green-400/70 mt-1">You will be contacted upon approval with credentials and setup instructions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/50">
      {!showForm ? (
        <button
          className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1"
          onClick={() => setShowForm(true)}
        >
          Request Portal Access (HR, Insurance, Legal)
          <ChevronRight className="w-3 h-3" />
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-300">Access Request Form</p>
          <Input
            className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 text-sm h-9"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 text-sm h-9"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 text-sm h-9"
            placeholder="Company Name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <select
            className="w-full h-9 rounded-md bg-slate-950/60 border border-slate-700 text-white text-sm px-2"
            value={region}
            onChange={(e) => { setRegion(e.target.value); setFacility(''); }}
          >
            <option value="">Select Region...</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {region && (
            <select
              className="w-full h-9 rounded-md bg-slate-950/60 border border-slate-700 text-white text-sm px-2"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
            >
              <option value="">Select Location / Facility...</option>
              {(FACILITIES_BY_REGION[region] || []).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}
          <select
            className="w-full h-9 rounded-md bg-slate-950/60 border border-slate-700 text-white text-sm px-2"
            value={roleRequested}
            onChange={(e) => setRoleRequested(e.target.value)}
          >
            <option value="">Select Role Requested...</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <textarea
            className="w-full rounded-md bg-slate-950/60 border border-slate-700 text-white placeholder:text-slate-500 text-sm p-2 min-h-[60px]"
            placeholder="Reason for access"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {region && facility && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-950/40 border border-orange-800/40">
              <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">
                This request will be routed to <span className="font-bold">{computeRoutingTarget(region, facility)}</span> for approval.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={submitRequest}
              disabled={!name || !email || !company || !region || !facility || !roleRequested}
            >
              Submit Request
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
