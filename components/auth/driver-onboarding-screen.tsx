'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Fingerprint,
  KeyRound,
  Clock,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import {
  initializeOnboarding,
  selectBiometricAuth,
  selectKeycodeAuth,
  generatePinFallback,
  verifyPinFallback,
  type OnboardingMethod,
} from '@/lib/driver-onboarding';
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from '@/lib/auth-gate';

export interface DriverOnboardingScreenProps {
  open: boolean;
  onClose: () => void;
  driverEmail: string;
  driverId?: string | null;
  companyId?: string | null;
  onComplete?: (method: OnboardingMethod) => void;
}

export function DriverOnboardingScreen({
  open,
  onClose,
  driverEmail,
  driverId,
  companyId,
  onComplete,
}: DriverOnboardingScreenProps) {
  const [step, setStep] = useState<'select' | 'biometric' | 'keycode' | 'pin' | 'success'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [pinExpiresAt, setPinExpiresAt] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<OnboardingMethod | null>(null);

  useEffect(() => {
    if (open) {
      setStep('select');
      setError(null);
      setLoading(true);
      if (isWebAuthnSupported()) {
        isPlatformAuthenticatorAvailable().then(setBiometricAvailable);
      }
      initializeOnboarding(driverEmail, driverId ?? null, companyId ?? null).then((state) => {
        if (state) setOnboardingId(state.id);
        setLoading(false);
      });
    }
  }, [open, driverEmail, driverId, companyId]);

  const handleBiometric = async () => {
    if (!onboardingId) return;
    setLoading(true);
    setError(null);
    const result = await selectBiometricAuth(onboardingId, driverEmail);
    setLoading(false);
    if (result.success) {
      setSelectedMethod('biometric');
      setStep('success');
      onComplete?.('biometric');
    } else {
      setError(result.error ?? 'Biometric registration failed');
    }
  };

  const handleKeycode = async () => {
    if (!onboardingId) return;
    setSelectedMethod('keycode');
    setStep('keycode');
  };

  const handlePinFallback = async () => {
    if (!onboardingId) return;
    setLoading(true);
    setError(null);
    const result = await generatePinFallback(onboardingId);
    setLoading(false);
    if (result) {
      setPin(result.pin);
      setPinExpiresAt(result.expiresAt);
      setStep('pin');
    } else {
      setError('Failed to generate PIN fallback');
    }
  };

  const handlePinVerify = async () => {
    if (!onboardingId) return;
    setLoading(true);
    const result = await verifyPinFallback(onboardingId);
    setLoading(false);
    if (result.valid) {
      setSelectedMethod('pin_fallback');
      setStep('success');
      onComplete?.('pin_fallback');
    } else {
      setError(result.expired ? 'PIN has expired' : 'PIN verification failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            Welcome to FleetVu Driver Vault
          </DialogTitle>
          <DialogDescription>
            Choose your authentication method for secure access.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm text-slate-500">Setting up...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs text-red-700">{error}</span>
          </div>
        )}

        {!loading && step === 'select' && (
          <div className="space-y-3">
            {/* Biometric — Recommended */}
            <button
              onClick={handleBiometric}
              disabled={!biometricAvailable}
              className="w-full p-4 rounded-xl border-2 border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Biometric Fingerprint</span>
                    <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">RECOMMENDED</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Hardware-backed smartphone passkey (WebAuthn/FIDO2). Fast, secure, never forget.
                  </p>
                  {!biometricAvailable && (
                    <p className="text-[10px] text-slate-400 mt-1">Not available on this device</p>
                  )}
                </div>
              </div>
            </button>

            {/* Keycode */}
            <button
              onClick={handleKeycode}
              className="w-full p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-slate-900">Secure KEY-Code</span>
                  <p className="text-xs text-slate-600 mt-1">
                    Traditional alphanumeric token. Store securely — manual recovery required if lost.
                  </p>
                </div>
              </div>
            </button>

            {/* PIN Fallback — for loaner devices */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handlePinFallback}
                className="w-full p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500">15-Minute PIN Fallback (Loaner Device)</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-6">
                  Terminal admin supervisor override for temporary device access.
                </p>
              </button>
            </div>
          </div>
        )}

        {step === 'keycode' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <Smartphone className="w-8 h-8 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Enter your FleetVu Keycode</p>
                <p className="text-xs text-slate-500">Format: FV-XXXX-XXXX</p>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (onboardingId) {
                  selectKeycodeAuth(onboardingId, 'manual').then(() => {
                    setSelectedMethod('keycode');
                    setStep('success');
                    onComplete?.('keycode');
                  });
                }
              }}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Confirm Keycode Authentication
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep('select')}>
              Back
            </Button>
          </div>
        )}

        {step === 'pin' && pin && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="px-6 py-4 rounded-xl bg-amber-50 border-2 border-amber-300">
                <p className="text-3xl font-black tracking-[0.3em] text-amber-700">{pin}</p>
              </div>
              {pinExpiresAt && (
                <p className="text-xs text-slate-500">
                  Expires at {new Date(pinExpiresAt).toLocaleTimeString()}
                </p>
              )}
              <p className="text-xs text-slate-400 text-center max-w-xs">
                Enter this PIN on the driver app to gain temporary access.
                The PIN expires in 15 minutes.
              </p>
            </div>
            <Button className="w-full" onClick={handlePinVerify} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify PIN'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep('select')}>
              Back
            </Button>
          </div>
        )}

        {step === 'success' && selectedMethod && (
          <div className="flex flex-col items-center py-8 gap-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">Authentication Configured!</p>
              <p className="text-sm text-slate-500 mt-1">
                You&apos;re all set with{' '}
                {selectedMethod === 'biometric' && 'Biometric Fingerprint'}
                {selectedMethod === 'keycode' && 'Secure Keycode'}
                {selectedMethod === 'pin_fallback' && 'PIN Fallback'}
              </p>
            </div>
            <Button className="w-full" onClick={onClose}>
              Continue to Driver Vault
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
