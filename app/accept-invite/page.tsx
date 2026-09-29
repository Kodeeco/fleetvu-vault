'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Truck,
  Mail,
  Lock,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Shield,
  FileLock2,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TokenRecord = {
  token: string;
  user_email: string;
  user_id: string | null;
  company_id: string | null;
  expires_at: string;
  status: string;
};

export default function AcceptInvitePage() {
  const [tokenRecord, setTokenRecord] = useState<TokenRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const token = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('token')
    : null;

  const validateToken = useCallback(async () => {
    if (!token) {
      setError('No invite token found. Please check your invitation link.');
      setLoading(false);
      return;
    }
    const { data, error: dbErr } = await supabase
      .from('invite_tokens')
      .select('token, user_email, user_id, company_id, expires_at, status')
      .eq('token', token)
      .maybeSingle();

    if (dbErr || !data) {
      setError('Invalid invite token. Contact your FleetVu administrator.');
      setLoading(false);
      return;
    }

    const record = data as TokenRecord;

    if (record.status === 'used') {
      setError('This invite link has already been used. Please sign in with your credentials.');
      setLoading(false);
      return;
    }

    if (new Date(record.expires_at) < new Date()) {
      setError('This invite link has expired. Contact your administrator for a new invitation.');
      setLoading(false);
      return;
    }

    setTokenRecord(record);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const handleSubmit = async () => {
    setError(null);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!tokenRecord) return;

    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase
        .from('provisioned_users')
        .update({ status: 'active', temp_password: password })
        .eq('email', tokenRecord.user_email);

      if (updateErr) throw updateErr;

      await supabase
        .from('invite_tokens')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('token', tokenRecord.token);

      // Fetch the activated user's full profile to build the auth session
      const { data: activatedUser } = await supabase
        .from('provisioned_users')
        .select('full_name, email, role, company_name, company_id, scoped_company_ids, assigned_locations, plan_tier')
        .eq('email', tokenRecord.user_email)
        .maybeSingle();

      if (activatedUser) {
        const u = activatedUser as {
          full_name: string; email: string; role: string; company_name: string | null;
          company_id: string | null; scoped_company_ids: string[] | null;
          assigned_locations: string[] | null; plan_tier: string | null;
        };

        // Map provisioned role to AuthUserRole
        const authRole: 'driver' | 'executive' | 'super_admin' | 'global_admin' =
          u.role === 'super_admin' ? 'super_admin' :
          u.role === 'global_admin' ? 'global_admin' :
          u.role === 'driver' ? 'driver' : 'executive';

        const sessionUser = {
          role: authRole,
          email: u.email,
          name: u.full_name || u.email.split('@')[0],
          companyName: u.company_name || undefined,
          companyId: u.company_id || undefined,
          planTier: (u.plan_tier as 'basic' | 'pro' | 'proplus') || 'pro',
          provisionedRole: u.role,
          scopedCompanyIds: u.scoped_company_ids || [],
          assignedLocations: u.assigned_locations || [],
        };

        // Clear any cached Super-Admin session, then set the new user session
        localStorage.removeItem('fleetvu_user');
        localStorage.removeItem('fleetvu_fleet');
        localStorage.removeItem('fleetvu_global_admin_mode');
        localStorage.setItem('fleetvu_user', JSON.stringify(sessionUser));
      }

      setSuccess(true);
    } catch {
      setError('Failed to set password. Please try again or contact your administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-200 flex flex-col">
      {/* Top status bar */}
      <div className="shrink-0 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <div className={cn('w-2 h-2 rounded-full animate-pulse', success ? 'bg-green-500' : 'bg-orange-500')} />
            {success ? 'ACCOUNT ACTIVATED' : 'INVITATION ACTIVATION PORTAL'}
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> TLS 1.3 Encrypted</span>
            <span className="flex items-center gap-1"><FileLock2 className="w-3 h-3" /> FIPS 140-2 Compliant</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500 shadow-lg shadow-orange-500/30">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-white tracking-tight leading-none">FleetVu</div>
              <div className="text-[10px] text-orange-400 font-semibold tracking-wider uppercase mt-1">Invitation Setup</div>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
              <p className="text-sm text-slate-400">Verifying invitation token…</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-6 space-y-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-semibold">Activation Error</span>
              </div>
              <p className="text-sm text-slate-300">{error}</p>
              <a href="/" className="inline-flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 transition-colors">
                Return to login <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {!loading && !error && success && (
            <div className="rounded-xl border border-green-700/40 bg-green-950/30 p-6 space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-semibold text-lg">Account Activated</span>
              </div>
              <p className="text-sm text-slate-300">
                Your FleetVu account is now active. You can sign in with your email and the password you just created.
              </p>
              <a href="/" className="inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors font-semibold">
                Continue to Login <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}

          {!loading && !error && !success && tokenRecord && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Set Your Password</h2>
                <p className="text-sm text-slate-400 mt-1.5">
                  Welcome to FleetVu. Set your login password below to activate your account.
                </p>
              </div>

              {/* Account preview */}
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-medium">{tokenRecord.user_email}</span>
                </div>
              </div>

              {/* Password fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-900/50 border-slate-600 text-white pr-10"
                      placeholder="Minimum 6 characters"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Confirm Password
                  </Label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 text-white"
                    placeholder="Re-enter your password"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded-lg p-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2 h-10"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</>
                ) : (
                  <>Activate Account <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>

              <p className="text-[10px] text-slate-500 text-center">
                By activating your account, you agree to FleetVu&apos;s security and data custody policies.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
