'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Loader2,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  authorizeGate,
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  type AuthGateResult,
} from '@/lib/auth-gate';

export interface AuthorizationGateProps {
  open: boolean;
  onClose: () => void;
  onAuthorized: (result: AuthGateResult) => void;
  /** Title shown in the dialog */
  title?: string;
  /** What action is being authorized */
  actionLabel?: string;
  /** Whether keycode input is offered */
  allowKeycode?: boolean;
  /** Whether session token check is offered */
  allowSession?: boolean;
  /** Whether biometric (WebAuthn) is offered */
  allowBiometric?: boolean;
}

export function AuthorizationGate({
  open,
  onClose,
  onAuthorized,
  title = 'Authorization Required',
  actionLabel = 'This action',
  allowKeycode = true,
  allowSession = true,
  allowBiometric = true,
}: AuthorizationGateProps) {
  const [keycode, setKeycode] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  React.useEffect(() => {
    if (open && allowBiometric) {
      isPlatformAuthenticatorAvailable().then(setBiometricAvailable);
    }
    if (open) {
      setStatus('idle');
      setErrorMsg(null);
      setKeycode('');
    }
  }, [open, allowBiometric]);

  const handleKeycodeAuth = useCallback(async () => {
    setStatus('verifying');
    setErrorMsg(null);
    const result = await authorizeGate({
      keycode,
      requireMethods: ['keycode'],
    });
    if (result.granted) {
      setStatus('success');
      setTimeout(() => {
        onAuthorized(result);
        onClose();
      }, 600);
    } else {
      setStatus('error');
      setErrorMsg(result.reason || 'Keycode verification failed');
    }
  }, [keycode, onAuthorized, onClose]);

  const handleSessionAuth = useCallback(async () => {
    setStatus('verifying');
    setErrorMsg(null);
    const result = await authorizeGate({
      requireMethods: ['session'],
    });
    if (result.granted) {
      setStatus('success');
      setTimeout(() => {
        onAuthorized(result);
        onClose();
      }, 600);
    } else {
      setStatus('error');
      setErrorMsg(result.reason || 'Session verification failed');
    }
  }, [onAuthorized, onClose]);

  const handleBiometricAuth = useCallback(async () => {
    setStatus('verifying');
    setErrorMsg(null);
    const result = await authorizeGate({
      requireMethods: ['webauthn'],
    });
    if (result.granted) {
      setStatus('success');
      setTimeout(() => {
        onAuthorized(result);
        onClose();
      }, 600);
    } else {
      setStatus('error');
      setErrorMsg(result.reason || 'Biometric verification failed');
    }
  }, [onAuthorized, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {actionLabel} requires authorization. Choose a verification method below.
          </DialogDescription>
        </DialogHeader>

        {status === 'success' ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-sm font-semibold text-slate-700">Authorization Granted</p>
          </div>
        ) : status === 'verifying' ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm text-slate-500">Verifying...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {status === 'error' && errorMsg && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-xs text-red-700">{errorMsg}</span>
              </div>
            )}

            {allowKeycode && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  FleetVu Access Keycode
                </label>
                <InputOTP
                  maxLength={13}
                  value={keycode}
                  onChange={setKeycode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <span className="text-slate-400 mx-1">-</span>
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                    <InputOTPSlot index={6} />
                  </InputOTPGroup>
                  <span className="text-slate-400 mx-1">-</span>
                  <InputOTPGroup>
                    <InputOTPSlot index={7} />
                    <InputOTPSlot index={8} />
                    <InputOTPSlot index={9} />
                    <InputOTPSlot index={10} />
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  className="w-full"
                  onClick={handleKeycodeAuth}
                  disabled={keycode.length < 13}
                >
                  Verify Keycode
                </Button>
              </div>
            )}

            {(allowKeycode && (allowSession || allowBiometric)) && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">or</span>
                </div>
              </div>
            )}

            {allowSession && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSessionAuth}
              >
                <ShieldCheck className="w-4 h-4 mr-2 text-slate-500" />
                Verify via Corporate Session
              </Button>
            )}

            {allowBiometric && biometricAvailable && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleBiometricAuth}
              >
                <Fingerprint className="w-4 h-4 mr-2 text-orange-500" />
                Use Biometric (Touch ID / Face ID)
              </Button>
            )}

            {allowBiometric && !biometricAvailable && isWebAuthnSupported() && (
              <p className="text-xs text-slate-400 text-center">
                Biometric verification available on supported devices only.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={status === 'verifying'}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
