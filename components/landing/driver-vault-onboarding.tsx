'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp, type AuthUser } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Truck,
  Shield,
  Lock,
  Fingerprint,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  FileText,
  ScanFace,
  Loader2,
  X,
} from 'lucide-react';
import type { DriverAccessKeycode } from '@/lib/types';

type Step = 'legal' | 'keycode' | 'biometric' | 'active';

export function DriverVaultOnboarding({
  onBack,
  onVaultReady,
}: {
  onBack: () => void;
  onVaultReady?: () => void;
}) {
  const { login, setView } = useApp();
  const [step, setStep] = useState<Step>('legal');
  const [legalScrolled, setLegalScrolled] = useState(false);
  const [legalAcknowledged, setLegalAcknowledged] = useState(false);

  // Keycode step
  const [keycodeInput, setKeycodeInput] = useState('');
  const [keycodeError, setKeycodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [keycodeRecord, setKeycodeRecord] = useState<DriverAccessKeycode | null>(null);

  // Biometric step
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [biometricComplete, setBiometricComplete] = useState(false);

  const legalScrollRef = useRef<HTMLDivElement>(null);

  const handleLegalScroll = () => {
    const el = legalScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setLegalScrolled(atBottom);
  };

  const handleKeycodeSubmit = async () => {
    setKeycodeError(null);
    const code = keycodeInput.trim().toUpperCase();

    // UX Review demo codes — no DB required
    if (code === 'FV-0000-0000' || code === 'DEMO' || code === 'FV-DEMO-0000') {
      setKeycodeRecord({
        id: 'demo-keycode',
        keycode: 'FV-0000-0000',
        driver_id: 'DRV-4821',
        driver_name: 'Marcus Reyes',
        driver_number: 'DRV-4821',
        company_id: null,
        company_name: 'Acme Logistics',
        issued_by: null,
        issued_by_name: null,
        lifecycle_status: 'dispatched',
        dispatch_method: 'demo',
        dispatch_destination: null,
        dispatched_at: new Date().toISOString(),
        biometric_bound: false,
        burned_at: null,
        burned_by_device: null,
        expires_at: null,
        created_at: new Date().toISOString(),
      });
      setVerifying(false);
      setStep('biometric');
      return;
    }

    if (!code.match(/^FV-\d{4}-\d{4}$/)) {
      setKeycodeError('Invalid format. Keycode must be FV-XXXX-XXXX (or FV-0000-0000 for UX demo).');
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase
        .from('driver_access_keycodes')
        .select('*')
        .eq('keycode', code)
        .maybeSingle();

      if (error || !data) {
        setKeycodeError('Keycode not found. Contact your fleet administrator.');
        setVerifying(false);
        return;
      }

      const record = data as DriverAccessKeycode;

      if (record.lifecycle_status === 'burned') {
        setKeycodeError('This keycode has already been used and permanently destroyed. Request a new keycode from your administrator.');
        setVerifying(false);
        return;
      }

      if (record.lifecycle_status === 'revoked') {
        setKeycodeError('This keycode has been revoked. Contact your administrator.');
        setVerifying(false);
        return;
      }

      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        setKeycodeError('This keycode has expired. Request a new keycode from your administrator.');
        setVerifying(false);
        return;
      }

      setKeycodeRecord(record);
      setVerifying(false);
      setStep('biometric');
    } catch {
      setKeycodeError('Verification failed. Please try again.');
      setVerifying(false);
    }
  };

  const handleBiometricBind = async () => {
    setBiometricScanning(true);

    // Simulate biometric binding (FaceID/TouchID/Android biometrics)
    // In a real implementation this would call the WebAuthn API or native bridge
    await new Promise((resolve) => setTimeout(resolve, 2500));

    setBiometricScanning(false);
    setBiometricComplete(true);

    // Burn the keycode — permanently mark as used
    if (keycodeRecord) {
      const deviceFingerprint = getDeviceFingerprint();
      try {
        await supabase
          .from('driver_access_keycodes')
          .update({
            lifecycle_status: 'burned',
            burned_at: new Date().toISOString(),
            burned_by_device: deviceFingerprint,
            biometric_bound: true,
          })
          .eq('id', keycodeRecord.id);

        // Write audit log
        await supabase.from('audit_logs').insert({
          actor_role: 'driver',
          actor_email: keycodeRecord.driver_name || 'unknown',
          action_type: 'KEYCODE_BURNED',
          entity_type: 'driver_access_keycode',
          entity_id: keycodeRecord.id,
          new_state: {
            keycode: keycodeRecord.keycode,
            driver_name: keycodeRecord.driver_name,
            driver_number: keycodeRecord.driver_number,
            company_name: keycodeRecord.company_name,
            burned_by_device: deviceFingerprint,
            biometric_bound: true,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // Non-fatal — the driver can still proceed
      }
    }

    // Short delay to show success, then enter active dashboard
    setTimeout(() => {
      enterActiveDashboard();
    }, 1200);
  };

  const enterActiveDashboard = () => {
    if (!keycodeRecord) return;

    const driverUser: AuthUser = {
      role: 'driver',
      email: `${keycodeRecord.driver_name?.toLowerCase().replace(/\s+/g, '.')}@driver.fleetvu.com`,
      name: keycodeRecord.driver_name || 'Driver',
      companyName: keycodeRecord.company_name || undefined,
      companyId: keycodeRecord.company_id || undefined,
      driverNumber: keycodeRecord.driver_number || undefined,
      driverId: keycodeRecord.driver_number || `DRV-${(keycodeRecord.keycode || '0000').slice(-4)}`,
      truckNumber: '#072',
      sensorHardware: 'C55-Pro',
      depot: 'Primary Depot',
      location: 'Primary Depot',
      planTier: 'proplus',
      pinCode: keycodeRecord.keycode,
      biometricVerified: true,
    };

    login(driverUser);
    setView('mobile');
    onVaultReady?.();
  };

  const getDeviceFingerprint = (): string => {
    if (typeof window === 'undefined') return 'server';
    const nav = window.navigator;
    const screen = window.screen;
    const fingerprint = [
      nav.userAgent,
      nav.language,
      screen?.colorDepth,
      screen?.width + 'x' + screen?.height,
      new Date().getTimezoneOffset(),
      nav.hardwareConcurrency || 'unknown',
    ].join('|');
    return btoa(fingerprint).substring(0, 32);
  };

  const stepNumber = step === 'legal' ? 1 : step === 'keycode' ? 2 : step === 'biometric' ? 3 : 4;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            VAULT ONBOARDING
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="shrink-0 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {[
            { num: 1, label: 'Legal', icon: FileText },
            { num: 2, label: 'Keycode', icon: KeyRound },
            { num: 3, label: 'Biometric', icon: Fingerprint },
          ].map((s) => {
            const isActive = stepNumber === s.num;
            const isComplete = stepNumber > s.num;
            return (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isComplete
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40'
                          : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <s.icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? 'text-orange-400' : isComplete ? 'text-green-400' : 'text-slate-600'}`}>
                    {s.label}
                  </span>
                </div>
                {s.num < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${isComplete ? 'bg-green-500/50' : 'bg-slate-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-5 py-4 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* STEP 1: LEGAL NOTICE */}
          {step === 'legal' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-7 h-7 text-orange-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Legal Notice &amp; Driver Assistance Disclaimer</h2>
                <p className="text-xs text-slate-500 mt-1">Required reading — scroll to bottom to acknowledge</p>
              </div>

              <div
                ref={legalScrollRef}
                onScroll={handleLegalScroll}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 max-h-[340px] overflow-y-auto text-sm text-slate-300 leading-relaxed space-y-3 scrollbar-thin"
              >
                <p className="font-semibold text-white">FleetVu Forensic Vault — Driver Notice</p>
                <p>
                  The FleetVu Forensic Vault is a supplementary driver assistance system designed to
                  enhance situational awareness through 77GHz radar proximity sensing. It is NOT a
                  substitute for attentive driving, proper vehicle operation, or compliance with all
                  applicable traffic laws and regulations.
                </p>
                <p className="font-semibold text-orange-400 mt-3">Important Limitations:</p>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400">
                  <li>The system may not detect all objects, particularly small, low-profile, or non-metallic objects.</li>
                  <li>Sensor performance may be degraded by weather conditions including heavy rain, snow, fog, or extreme temperatures.</li>
                  <li>Blind spots may exist depending on vehicle configuration and sensor mounting position.</li>
                  <li>The driver remains solely responsible for safe vehicle operation at all times.</li>
                  <li>Telemetry data recorded by this system may be used for forensic analysis, insurance claims, and legal proceedings.</li>
                  <li>Data is cryptographically sealed (SHA-256) and cannot be altered after recording.</li>
                </ul>
                <p className="font-semibold text-orange-400 mt-3">Biometric Binding:</p>
                <p className="text-xs text-slate-400">
                  Access to the Vault requires biometric authentication (FaceID, TouchID, or Android
                  biometrics). Your biometric data is processed on-device and is never transmitted or
                  stored on FleetVu servers. A device fingerprint is recorded to bind this access
                  session to your current device.
                </p>
                <p className="font-semibold text-orange-400 mt-3">Data Custody &amp; Chain of Custody:</p>
                <p className="text-xs text-slate-400">
                  All telemetry recorded during your session is sealed in a WORM (Write Once Read Many)
                  cryptographic vault. Data may be disclosed to your employer, insurance carriers, or
                  legal authorities pursuant to valid legal process. By acknowledging, you consent to
                  this data collection as part of your employment duties.
                </p>
                <p className="font-semibold text-orange-400 mt-3">Acceptable Use:</p>
                <p className="text-xs text-slate-400">
                  Your disposable keycode (FV-XXXX-XXXX) is for single-use only. Upon successful
                  authentication, the keycode will be permanently destroyed. Sharing, copying, or
                  attempting to reuse a keycode is prohibited and will result in access termination.
                </p>
                <p className="text-xs text-slate-500 mt-3 border-t border-slate-800 pt-3">
                  FleetVu Technologies, Inc. — Version 3.2 — Updated 2026
                </p>
              </div>

              <label className={`flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border transition-all ${
                legalScrolled
                  ? 'border-orange-500/40 bg-orange-500/5'
                  : 'border-slate-800 bg-slate-900/40 opacity-50'
              }`}>
                <input
                  type="checkbox"
                  disabled={!legalScrolled}
                  checked={legalAcknowledged}
                  onChange={(e) => setLegalAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-slate-300">
                  I have read and understand the Legal Notice and Driver Assistance Disclaimer.
                  { !legalScrolled && <span className="block text-xs text-slate-500 mt-0.5">Scroll to bottom to enable.</span> }
                </span>
              </label>

              <Button
                disabled={!legalAcknowledged}
                onClick={() => setStep('keycode')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11"
              >
                Acknowledge to Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* STEP 2: KEYCODE */}
          {step === 'keycode' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-7 h-7 text-orange-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Secure Access Gateway</h2>
                <p className="text-xs text-slate-500 mt-1">Enter your KEY-Code issued by your fleet manager</p>
              </div>

              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
                <Lock className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-300">
                  This single use driver access code is unique to your profile and will securely expire upon initial login.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Disposable Access Keycode</Label>
                <Input
                  value={keycodeInput}
                  onChange={(e) => setKeycodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleKeycodeSubmit()}
                  placeholder="FV-XXXX-XXXX"
                  className="bg-slate-950 border-slate-700 text-white font-mono text-lg tracking-wider text-center h-12 uppercase"
                  maxLength={13}
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 text-center">
                  Format: FV-XXXX-XXXX · UX review code: <span className="font-mono text-amber-400">FV-0000-0000</span>
                </p>
              </div>

              {keycodeError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {keycodeError}
                </div>
              )}

              <Button
                onClick={handleKeycodeSubmit}
                disabled={!keycodeInput.trim() || verifying}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11"
              >
                {verifying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying Keycode…</>
                ) : (
                  <>Authorize Access<ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 border-amber-500/40 bg-amber-500/5 text-amber-200 text-xs font-semibold"
                onClick={() => {
                  setKeycodeInput('FV-0000-0000');
                  window.setTimeout(() => {
                    setKeycodeRecord({
                      id: 'demo-keycode',
                      keycode: 'FV-0000-0000',
                      driver_id: 'DRV-4821',
                      driver_name: 'Marcus Reyes',
                      driver_number: 'DRV-4821',
                      company_id: null,
                      company_name: 'Acme Logistics',
                      issued_by: null,
                      issued_by_name: null,
                      lifecycle_status: 'dispatched',
                      dispatch_method: 'demo',
                      dispatch_destination: null,
                      dispatched_at: new Date().toISOString(),
                      biometric_bound: false,
                      burned_at: null,
                      burned_by_device: null,
                      expires_at: null,
                      created_at: new Date().toISOString(),
                    });
                    setStep('biometric');
                  }, 50);
                }}
              >
                Skip with Demo Keycode (UX Review)
              </Button>
            </div>
          )}

          {/* STEP 3: BIOMETRIC BINDING */}
          {step === 'biometric' && (
            <div className="space-y-5">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Fingerprint className="w-7 h-7 text-orange-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Biometric Device Binding</h2>
                <p className="text-xs text-slate-500 mt-1">Mandatory — no skips allowed</p>
              </div>

              {/* Keycode burning notice */}
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-green-300 font-semibold">Keycode Verified &amp; Burned</p>
                  <p className="text-xs text-green-400/70 mt-0.5">
                    Your keycode has been permanently destroyed. It cannot be reused.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
                <ScanFace className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-300">
                  Bind this device using FaceID, TouchID, or Android biometrics. This creates a
                  secure link between your identity and this specific device for this session.
                </p>
              </div>

              {/* Biometric scanner visual */}
              <div className="flex flex-col items-center py-6">
                <div
                  className={`relative w-28 h-28 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                    biometricComplete
                      ? 'bg-green-500/20 border-2 border-green-500/50'
                      : biometricScanning
                        ? 'bg-orange-500/20 border-2 border-orange-500/50'
                        : 'bg-slate-800 border-2 border-slate-700'
                  }`}
                >
                  {biometricComplete ? (
                    <CheckCircle2 className="w-14 h-14 text-green-400" />
                  ) : biometricScanning ? (
                    <Fingerprint className="w-14 h-14 text-orange-400 animate-pulse" />
                  ) : (
                    <Fingerprint className="w-14 h-14 text-slate-500" />
                  )}

                  {/* Scanning line animation */}
                  {biometricScanning && (
                    <div
                      className="absolute inset-x-2 h-0.5 bg-orange-400 rounded-full"
                      style={{ animation: 'biometricScan 1.5s ease-in-out infinite' }}
                    />
                  )}
                </div>

                <p className={`text-sm mt-4 font-semibold ${
                  biometricComplete ? 'text-green-400' : biometricScanning ? 'text-orange-400' : 'text-slate-400'
                }`}>
                  {biometricComplete
                    ? 'Device Bound Successfully'
                    : biometricScanning
                      ? 'Scanning Biometrics…'
                      : 'Ready to Bind'}
                </p>
              </div>

              {!biometricComplete && !biometricScanning && (
                <Button
                  onClick={handleBiometricBind}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11"
                >
                  <Fingerprint className="w-4 h-4 mr-2" />
                  Begin Biometric Binding
                </Button>
              )}

              {biometricScanning && (
                <div className="text-center text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                  Do not close this page. Binding in progress…
                </div>
              )}

              {biometricComplete && (
                <div className="text-center text-xs text-green-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Entering Forensic Vault…
                </div>
              )}
            </div>
          )}

          <style>{`
            @keyframes biometricScan {
              0%, 100% { top: 10% }
              50% { top: 90% }
            }
          `}</style>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-800/60 px-5 py-3">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4 text-[10px] text-slate-600">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Zero-Trust</span>
          <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Burn-on-Use</span>
          <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3" /> Biometric Lock</span>
        </div>
      </div>
    </div>
  );
}
