'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AuthUser } from '@/lib/app-context';
import type { Company, Driver, ProvisionedUser, PlanTier } from '@/lib/types';
import { UnifiedOnboardingWizard } from '@/components/onboarding/unified-onboarding-wizard';
import { FleetVuErrorBoundary } from '@/components/error-boundary';
import {
  Server, Building2, KeyRound, Send, CheckCircle2, Clock, Shield, Radio,
  MapPin, Globe, Users, Mail, Copy, ArrowRight, Crown, AlertCircle,
  TrendingUp, FileText, Lock, Zap, UserPlus, Trash2, Search,
  DollarSign, Calendar, Activity, BarChart3, Phone, Briefcase,
  ChevronRight, Save, X, RefreshCw,
} from 'lucide-react';

interface FeatureEntitlements {
  radar: boolean;
  gps: boolean;
  vault: boolean;
  risk_scoring: boolean;
}

const DEFAULT_ENTITLEMENTS: FeatureEntitlements = {
  radar: true,
  gps: true,
  vault: false,
  risk_scoring: false,
};

const FEATURE_META: Record<keyof FeatureEntitlements, { label: string; icon: typeof Radio; desc: string }> = {
  radar: { label: 'Sensor Radar', icon: Radio, desc: '77GHz radar visualization & telemetry' },
  gps: { label: 'GPS Tracking', icon: MapPin, desc: 'Real-time fleet GPS & geofencing' },
  vault: { label: 'Forensic Vault', icon: Lock, desc: 'Encrypted incident evidence storage' },
  risk_scoring: { label: 'Risk Scoring', icon: TrendingUp, desc: 'Actuarial risk models & insurance scorecards' },
};

interface ProvisionedClient {
  id: string;
  name: string;
  region: string;
  plan_tier: string;
  fleet_locations: string[];
  created_at: string;
  lead_name: string;
  lead_email: string;
  lead_role: 'super_admin' | 'location_admin';
  activation_key: string;
  key_status: string;
  key_expires_at: string | null;
  setup_sent: boolean;
  onboarded: boolean;
}

function generateActivationKey(orgName: string): string {
  const prefix = 'FV';
  const nums = Math.floor(1000 + Math.random() * 9000).toString();
  const letters = orgName
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, 'X');
  return `${prefix}-${nums}-${letters}`;
}

function generateSetupToken(): string {
  const segments = [8, 4, 4, 4, 12];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return segments
    .map((len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
    .join('-');
}

function timeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const now = new Date();
  const exp = new Date(expiresAt);
  const diff = exp.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m remaining`;
}

function paymentStatusColor(status?: string | null): string {
  if (status === 'current') return 'text-green-400';
  if (status === 'past_due') return 'text-red-400';
  if (status === 'comped') return 'text-blue-400';
  return 'text-slate-500';
}

async function writeAuditLog(entry: {
  actor_email: string;
  actor_role: string;
  action_type: string;
  target_user_email: string | null;
  target_user_role: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const recordHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify({ ...entry, ts: Date.now() })),
    );
    const hashArray = Array.from(new Uint8Array(recordHash));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    await supabase.from('access_audit_log').insert({
      actor_email: entry.actor_email,
      actor_role: entry.actor_role,
      action_type: entry.action_type,
      target_user_email: entry.target_user_email,
      target_user_role: entry.target_user_role,
      previous_state: entry.previous_state,
      new_state: entry.new_state,
      record_hash: hashHex,
      prev_hash: null,
      metadata: entry.metadata || {},
    });
  } catch {
    // Best-effort audit logging
  }
}

interface DeployResult {
  success: boolean;
  company?: Company;
  activationKey?: string;
  setupToken?: string;
  error?: string;
}

interface MasterProvisioningConsoleProps {
  user: AuthUser;
  companies: Company[];
  onClientCreated: () => void;
  onClose: () => void;
}

export function MasterProvisioningConsole({ user, companies, onClientCreated, onClose }: MasterProvisioningConsoleProps) {
  const [activeTab, setActiveTab] = useState<'deploy' | 'clients' | 'keys' | 'drivers' | 'invites' | 'crm'>('deploy');
  const [provisionedClients, setProvisionedClients] = useState<ProvisionedClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [deploying, setDeploying] = useState(false);

  // Drivers state
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [driverSearch, setDriverSearch] = useState('');
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverCompany, setNewDriverCompany] = useState('');
  const [newDriverLocation, setNewDriverLocation] = useState('');
  const [addingDriver, setAddingDriver] = useState(false);

  // Employee invite state
  const [allProvisionedUsers, setAllProvisionedUsers] = useState<ProvisionedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCompany, setInviteCompany] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'standard_user' | 'auditor'>('standard_user');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null);

  // CRM state
  const [crmCompanies, setCrmCompanies] = useState<Company[]>([]);
  const [loadingCrm, setLoadingCrm] = useState(true);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmFilterStatus, setCrmFilterStatus] = useState<string>('all');
  const [selectedCrmClient, setSelectedCrmClient] = useState<Company | null>(null);
  const [editingClient, setEditingClient] = useState<Company | null>(null);
  const [savingClient, setSavingClient] = useState(false);

  // Deploy form state
  const [orgName, setOrgName] = useState('');
  const [orgRegion, setOrgRegion] = useState('South');
  const [primaryLocation, setPrimaryLocation] = useState('Houston, TX');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadRole, setLeadRole] = useState<'super_admin' | 'location_admin'>('super_admin');
  const [planTier, setPlanTier] = useState<'basic' | 'pro' | 'proplus'>('pro');
  const [entitlements, setEntitlements] = useState<FeatureEntitlements>(DEFAULT_ENTITLEMENTS);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const loadProvisionedClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const { data: keys } = await supabase
        .from('activation_keys')
        .select('*')
        .eq('is_setup_link', true)
        .order('created_at', { ascending: false });

      const { data: users } = await supabase
        .from('provisioned_users')
        .select('*')
        .in('primary_contact_role', ['super_admin', 'location_admin'])
        .order('created_at', { ascending: false });

      const { data: orgs } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      const clientMap = new Map<string, ProvisionedClient>();
      const orgMap = new Map((orgs || []).map((o: Company) => [o.id, o]));
      const userByCompany = new Map((users || []).map((u: Record<string, unknown>) => [u.company_id as string, u]));

      for (const key of keys || []) {
        const org = key.company_id ? orgMap.get(key.company_id) : null;
        const lead = key.company_id ? userByCompany.get(key.company_id) : null;
        if (!org) continue;

        clientMap.set(org.id, {
          id: org.id,
          name: org.name,
          region: org.region,
          plan_tier: org.plan_tier,
          fleet_locations: org.fleet_locations || [],
          created_at: org.created_at,
          lead_name: (lead?.full_name as string) || key.recipient_email || '—',
          lead_email: (lead?.email as string) || key.recipient_email || '—',
          lead_role: (lead?.primary_contact_role as 'super_admin' | 'location_admin') || 'super_admin',
          activation_key: key.key_code,
          key_status: key.status,
          key_expires_at: key.expires_at,
          setup_sent: !!key.recipient_email,
          onboarded: (lead?.onboarding_completed as boolean) || false,
        });
      }

      setProvisionedClients(Array.from(clientMap.values()));
    } catch {
      // Non-fatal — clients list will be empty
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const loadAllDrivers = useCallback(async () => {
    setLoadingDrivers(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAllDrivers(data as Driver[]);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingDrivers(false);
    }
  }, []);

  const loadAllProvisionedUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('provisioned_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAllProvisionedUsers(data as ProvisionedUser[]);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadCrmCompanies = useCallback(async () => {
    setLoadingCrm(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setCrmCompanies(data as Company[]);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingCrm(false);
    }
  }, []);

  const handleSaveClient = async () => {
    if (!editingClient) return;
    setSavingClient(true);
    try {
      const { id, ...updates } = editingClient;
      const { error } = await supabase
        .from('companies')
        .update({
          account_status: updates.account_status || null,
          contract_start_date: updates.contract_start_date || null,
          contract_end_date: updates.contract_end_date || null,
          plan_start_date: updates.plan_start_date || null,
          plan_end_date: updates.plan_end_date || null,
          trial_start_date: updates.trial_start_date || null,
          trial_end_date: updates.trial_end_date || null,
          monthly_recurring_revenue: updates.monthly_recurring_revenue ?? 0,
          annual_contract_value: updates.annual_contract_value ?? 0,
          billing_cycle: updates.billing_cycle || 'monthly',
          payment_status: updates.payment_status || 'none',
          sales_rep: updates.sales_rep || null,
          industry: updates.industry || null,
          fleet_size: updates.fleet_size ?? 0,
          notes: updates.notes || null,
          renewal_status: updates.renewal_status || 'manual',
          health_score: updates.health_score ?? 80,
          plan_tier: updates.plan_tier,
        })
        .eq('id', id);
      if (error) throw error;
      setEditingClient(null);
      loadCrmCompanies();
    } catch {
      // keep edit form open on error
    } finally {
      setSavingClient(false);
    }
  };

  useEffect(() => {
    loadProvisionedClients();
    loadAllDrivers();
    loadAllProvisionedUsers();
    loadCrmCompanies();
  }, [loadProvisionedClients, loadAllDrivers, loadAllProvisionedUsers, loadCrmCompanies]);


  const handleAddDriver = async () => {
    if (!newDriverName.trim() || !newDriverCompany) return;
    setAddingDriver(true);
    try {
      const selectedCompany = companies.find((c) => c.id === newDriverCompany);
      const { error } = await supabase.from('drivers').insert({
        name: newDriverName.trim(),
        email: newDriverEmail.trim().toLowerCase() || null,
        company_id: newDriverCompany,
        company_name: selectedCompany?.name || null,
        location: newDriverLocation.trim() || selectedCompany?.location || null,
        status: 'active',
      });
      if (error) throw error;
      setShowAddDriver(false);
      setNewDriverName('');
      setNewDriverEmail('');
      setNewDriverCompany('');
      setNewDriverLocation('');
      loadAllDrivers();
    } catch (err) {
      // keep form open on error
    } finally {
      setAddingDriver(false);
    }
  };

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    if (!confirm(`Remove driver "${driverName}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('drivers').delete().eq('id', driverId);
      if (error) throw error;
      loadAllDrivers();
    } catch {
      // non-fatal
    }
  };

  const handleSendInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteCompany) return;
    setSendingInvite(true);
    setInviteResult(null);
    try {
      const selectedCompany = companies.find((c) => c.id === inviteCompany);
      const setupToken = generateSetupToken();
      const inviteEmailLower = inviteEmail.trim().toLowerCase();

      // Create provisioned user
      const { error: userErr } = await supabase.from('provisioned_users').insert({
        full_name: inviteName.trim(),
        email: inviteEmailLower,
        company_id: inviteCompany,
        company_name: selectedCompany?.name || null,
        role: inviteRole,
        primary_contact_role: null,
        status: 'pending_invitation',
        plan_tier: selectedCompany?.plan_tier || 'pro',
        assigned_locations: [selectedCompany?.location || 'HQ'],
        scoped_company_ids: [inviteCompany],
        deployment_hardware: 'c55_pro',
        feature_permissions: {
          driver_management: true,
          incident_playback: true,
          historical_reports: true,
          insurance_scorecards: false,
          pdf_downloads: true,
          live_gps: true,
        },
        provisioned_by: user.email,
        provisioned_by_role: user.role,
        onboarding_completed: false,
      });

      if (userErr) throw userErr;

      // Create invite token (24h expiry)
      const { error: tokenErr } = await supabase.from('invite_tokens').insert({
        token: setupToken,
        user_email: inviteEmailLower,
        company_id: inviteCompany,
        created_by: user.email,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        invite_type: 'team_invite',
      });

      if (tokenErr) throw tokenErr;

      // Send welcome email
      try {
        await fetch('/api/communications/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'TEAM_INVITE',
            to_email: inviteEmailLower,
            to_name: inviteName.trim(),
            role: inviteRole.replace(/_/g, ' '),
            company_name: selectedCompany?.name || null,
            invite_token: setupToken,
            provisioned_by_name: user.name,
          }),
        });
      } catch {
        // email non-fatal
      }

      await writeAuditLog({
        actor_email: user.email,
        actor_role: user.role,
        action_type: 'INVITE_EMPLOYEE',
        target_user_email: inviteEmailLower,
        target_user_role: inviteRole,
        previous_state: null,
        new_state: {
          company_id: inviteCompany,
          company_name: selectedCompany?.name,
          role: inviteRole,
          invite_token: setupToken,
        },
      });

      setInviteResult({ success: true, message: `Invitation sent to ${inviteEmailLower}. They will receive an email with a link to register and set their password.` });
      setInviteName('');
      setInviteEmail('');
      setInviteCompany('');
      setInviteRole('standard_user');
      loadAllProvisionedUsers();
    } catch (err) {
      setInviteResult({ success: false, message: err instanceof Error ? err.message : 'Failed to send invitation.' });
    } finally {
      setSendingInvite(false);
    }
  };

  const resetForm = () => {
    setOrgName('');
    setOrgRegion('South');
    setPrimaryLocation('Houston, TX');
    setLeadName('');
    setLeadEmail('');
    setLeadPhone('');
    setLeadRole('super_admin');
    setPlanTier('pro');
    setEntitlements(DEFAULT_ENTITLEMENTS);
    setWelcomeMessage('');
  };

  const handleDeploy = async () => {
    if (!orgName.trim() || !leadName.trim() || !leadEmail.trim()) return;
    setDeploying(true);
    try {
      const keyCode = generateActivationKey(orgName);
      const setupToken = generateSetupToken();

      // 1. Create the company
      const { data: newCompany, error: companyErr } = await supabase
        .from('companies')
        .insert({
          name: orgName.trim(),
          region: orgRegion,
          location: primaryLocation,
          plan_tier: planTier,
          fleet_locations: leadRole === 'super_admin' ? [primaryLocation] : [primaryLocation],
        })
        .select()
        .single();

      if (companyErr || !newCompany) {
        setDeployResult({ success: false, error: companyErr?.message || 'Failed to create client organization.' });
        setDeploying(false);
        return;
      }

      // 2. Create the primary contact as a provisioned user
      const { error: userErr } = await supabase.from('provisioned_users').insert({
        full_name: leadName.trim(),
        email: leadEmail.trim().toLowerCase(),
        phone: leadPhone.trim() || null,
        corporate_title: leadRole === 'super_admin' ? 'Primary Contact — Super-Admin' : 'Primary Contact — Location Admin',
        company_id: newCompany.id,
        company_name: newCompany.name,
        role: leadRole,
        primary_contact_role: leadRole,
        status: 'pending_invitation',
        plan_tier: planTier,
        assigned_locations: [primaryLocation],
        scoped_company_ids: leadRole === 'location_admin' ? [newCompany.id] : [],
        deployment_hardware: 'c55_pro',
        feature_permissions: {
          driver_management: true,
          incident_playback: entitlements.radar,
          historical_reports: true,
          insurance_scorecards: entitlements.risk_scoring,
          pdf_downloads: true,
          live_gps: entitlements.gps,
        },
        provisioned_by: user.email,
        provisioned_by_role: user.role,
        onboarded_by: user.email,
        onboarding_completed: false,
      });

      if (userErr) {
        setDeployResult({ success: false, error: userErr.message });
        setDeploying(false);
        return;
      }

      // 3. Create the permanent Organization Activation Key
      const { error: keyErr } = await supabase.from('activation_keys').insert({
        key_code: keyCode,
        role_type: leadRole,
        company_name: newCompany.name,
        company_id: newCompany.id,
        recipient_email: leadEmail.trim().toLowerCase(),
        status: 'active',
        created_by_email: user.email,
        organization_name: newCompany.name,
        feature_entitlements: entitlements,
        is_setup_link: true,
        expires_at: null, // permanent org key — no expiry
      });

      if (keyErr) {
        setDeployResult({ success: false, error: keyErr.message });
        setDeploying(false);
        return;
      }

      // 4. Create the single-use setup token (72h expiry)
      const { error: tokenErr } = await supabase.from('invite_tokens').insert({
        token: setupToken,
        user_email: leadEmail.trim().toLowerCase(),
        company_id: newCompany.id,
        created_by: user.email,
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        invite_type: 'setup_link',
      });

      if (tokenErr) {
        setDeployResult({ success: false, error: tokenErr.message });
        setDeploying(false);
        return;
      }

      // 5. Send the welcome/setup email
      try {
        await fetch('/api/communications/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'CLIENT_SETUP_LINK',
            to_email: leadEmail.trim().toLowerCase(),
            to_name: leadName.trim(),
            organization_name: newCompany.name,
            lead_role: leadRole,
            activation_key: keyCode,
            setup_token: setupToken,
            primary_location: primaryLocation,
            feature_entitlements: entitlements,
            plan_tier: planTier,
            welcome_message: welcomeMessage.trim(),
            deployed_by_name: user.name,
          }),
        });
      } catch {
        // Email send is non-fatal — the setup link is still shown in the result modal
      }

      // 6. Audit log
      await writeAuditLog({
        actor_email: user.email,
        actor_role: user.role,
        action_type: 'PROVISION_CLIENT',
        target_user_email: leadEmail.trim().toLowerCase(),
        target_user_role: leadRole,
        previous_state: null,
        new_state: {
          company_id: newCompany.id,
          company_name: newCompany.name,
          activation_key: keyCode,
          setup_token: setupToken,
          plan_tier: planTier,
          feature_entitlements: entitlements,
        },
        metadata: { deployed_by: user.email, organization_name: newCompany.name },
      });

      setDeployResult({
        success: true,
        company: newCompany,
        activationKey: keyCode,
        setupToken,
      });
      resetForm();
      onClientCreated();
      loadProvisionedClients();
    } catch (err) {
      setDeployResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown deployment error.',
      });
    } finally {
      setDeploying(false);
    }
  };

  const stats = {
    total: provisionedClients.length,
    pending: provisionedClients.filter((c) => !c.onboarded && c.key_status === 'active').length,
    onboarded: provisionedClients.filter((c) => c.onboarded).length,
    expired: provisionedClients.filter((c) => c.key_status === 'used' || (c.key_expires_at && new Date(c.key_expires_at) < new Date())).length,
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/30">
              <Server className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">FleetVu Master Provisioning Console</h1>
              <p className="text-xs text-slate-500">Internal staff only — client account deployment & activation key management</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Clients', value: stats.total, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Pending Setup', value: stats.pending, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Onboarded', value: stats.onboarded, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Keys Used/Expired', value: stats.expired, icon: KeyRound, color: 'text-slate-400', bg: 'bg-slate-500/10' },
          ].map((s) => (
            <Card key={s.label} className="bg-slate-900/50 border-slate-800">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="deploy" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
              <Send className="w-4 h-4 mr-2" /> Deploy New Client
            </TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
              <Building2 className="w-4 h-4 mr-2" /> Client Directory
            </TabsTrigger>
            <TabsTrigger value="keys" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
              <KeyRound className="w-4 h-4 mr-2" /> Activation Keys
            </TabsTrigger>
            <TabsTrigger value="drivers" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
              <Users className="w-4 h-4 mr-2" /> Drivers
            </TabsTrigger>
            <TabsTrigger value="invites" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
              <Mail className="w-4 h-4 mr-2" /> Invite Employees
            </TabsTrigger>
            <TabsTrigger value="crm" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
              <BarChart3 className="w-4 h-4 mr-2" /> CRM
            </TabsTrigger>
          </TabsList>

          {/* Deploy Tab — Unified Company / Contact / Fleet onboarding */}
          <TabsContent value="deploy" className="mt-6">
            <FleetVuErrorBoundary name="DeployOnboarding">
              <UnifiedOnboardingWizard
                actor={{ email: user.email, role: user.role, name: user.name }}
                onComplete={async (result) => {
                  if (!result.success || !result.companyId) {
                    setDeployResult({
                      success: false,
                      error: result.error || 'Onboarding transaction failed',
                    });
                    return;
                  }

                  await writeAuditLog({
                    actor_email: user.email,
                    actor_role: user.role,
                    action_type: 'PROVISION_CLIENT',
                    target_user_email: result.data.contactEmail,
                    target_user_role: result.data.contactRole,
                    previous_state: null,
                    new_state: {
                      company_id: result.companyId,
                      company_name: result.data.organizationName,
                      activation_key: result.activationKey,
                      setup_token: result.setupToken,
                      plan_tier: result.data.planTier,
                      feature_entitlements: result.data.entitlements,
                      hierarchy: 'company→fleet_director→fleet',
                    },
                    metadata: {
                      deployed_by: user.email,
                      organization_name: result.data.organizationName,
                      email_dispatched: result.emailDispatched,
                      identity: 'welcome@fleetvu.org',
                    },
                  });

                  setDeployResult({
                    success: true,
                    company: {
                      id: result.companyId,
                      name: result.data.organizationName,
                      region: result.data.region,
                      location: result.data.primaryLocation,
                      plan_tier: result.data.planTier,
                      fleet_locations: result.data.fleetLocations,
                      created_at: new Date().toISOString(),
                    },
                    activationKey: result.activationKey || '',
                    setupToken: result.setupToken || '',
                  });
                  onClientCreated();
                  loadProvisionedClients();
                }}
              />
            </FleetVuErrorBoundary>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="mt-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-400" /> Provisioned Client Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
            {loadingClients ? (
                  <div className="py-12 text-center text-slate-500">Loading provisioned clients...</div>
                ) : provisionedClients.length === 0 ? (
                  <div className="py-12 text-center">
                    <Building2 className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No clients provisioned yet.</p>
                    <p className="text-xs text-slate-600 mt-1">Deploy your first client from the Deploy tab.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {provisionedClients.map((client) => (
                      <div
                        key={client.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
                              <Building2 className="h-5 w-5 text-slate-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-white">{client.name}</h4>
                                {client.onboarded ? (
                                  <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Onboarded
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
                                    <Clock className="w-3 h-3 mr-1" /> Pending Setup
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {client.region} · {client.plan_tier.toUpperCase()} · Created {new Date(client.created_at).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className="text-slate-400">
                                  <Users className="w-3 h-3 inline mr-1 text-slate-500" />
                                  {client.lead_name} ({client.lead_role === 'super_admin' ? 'Super-Admin' : 'Location Admin'})
                                </span>
                                <span className="text-slate-400">
                                  <MapPin className="w-3 h-3 inline mr-1 text-slate-500" />
                                  {client.fleet_locations.length} location(s)
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500 mb-1">Activation Key</div>
                            <code className="text-sm font-mono text-orange-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                              {client.activation_key}
                            </code>
                            <div className="text-xs text-slate-600 mt-1">
                              {client.key_status === 'active' ? 'Permanent key — active' : `Status: ${client.key_status}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Keys Tab */}
          <TabsContent value="keys" className="mt-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-orange-400" /> Organization Activation Keys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {provisionedClients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="flex items-center gap-3">
                        <KeyRound className="h-4 w-4 text-orange-400" />
                        <div>
                          <code className="text-sm font-mono text-orange-300">{client.activation_key}</code>
                          <div className="text-xs text-slate-500">{client.name} → {client.lead_email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{timeRemaining(client.key_expires_at)}</span>
                        <Badge
                          className={
                            client.key_status === 'active'
                              ? 'bg-green-500/15 text-green-400 border-green-500/30 text-xs'
                              : 'bg-slate-500/15 text-slate-400 border-slate-500/30 text-xs'
                          }
                        >
                          {client.key_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {provisionedClients.length === 0 && (
                    <div className="py-8 text-center text-slate-500">No activation keys issued yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="mt-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-orange-400" /> All Client Drivers
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                        placeholder="Search drivers..."
                        className="bg-slate-950 border-slate-700 text-white pl-8 w-56 h-9"
                      />
                    </div>
                    <Button
                      onClick={() => setShowAddDriver(true)}
                      className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2"
                    >
                      <UserPlus className="w-4 h-4" /> Add Driver
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDrivers ? (
                  <div className="py-12 text-center text-slate-500">Loading drivers...</div>
                ) : allDrivers.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No drivers found across any client account.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allDrivers
                      .filter((d) => {
                        const q = driverSearch.toLowerCase();
                        return !q || d.name.toLowerCase().includes(q) || (d.email || '').includes(q) || (d.company_name || '').includes(q);
                      })
                      .map((driver) => (
                      <div
                        key={driver.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                            <Users className="h-4 w-4 text-slate-400" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{driver.name}</div>
                            <div className="text-xs text-slate-500">
                              {driver.company_name || 'Unassigned'} · {driver.location || '—'} · {driver.email || 'No email'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={
                            driver.status === 'active'
                              ? 'bg-green-500/15 text-green-400 border-green-500/30 text-xs'
                              : 'bg-slate-500/15 text-slate-400 border-slate-500/30 text-xs'
                          }>
                            {driver.status}
                          </Badge>
                          <button
                            onClick={() => handleDeleteDriver(driver.id, driver.name)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                            title="Remove driver"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invite Employees Tab */}
          <TabsContent value="invites" className="mt-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Invite Form */}
              <div className="col-span-1">
                <Card className="bg-slate-900/50 border-slate-800 sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-orange-400" /> Send Employee Invitation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Employee Name</Label>
                      <Input
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="e.g. Sarah Johnson"
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Email Address</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="e.g. sarah@company.com"
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Assign to Company</Label>
                      <Select value={inviteCompany} onValueChange={setInviteCompany}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                          <SelectValue placeholder="Select company..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Role</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="standard_user">Standard User</SelectItem>
                          <SelectItem value="auditor">Auditor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleSendInvite}
                      disabled={!inviteName.trim() || !inviteEmail.trim() || !inviteCompany || sendingInvite}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                      {sendingInvite ? (
                        <>Sending...</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" /> Send Welcome Email</>
                      )}
                    </Button>
                    {inviteResult && (
                      <div className={`rounded-lg px-3 py-2.5 text-xs ${inviteResult.success ? 'bg-green-500/10 border border-green-500/30 text-green-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
                        {inviteResult.message}
                      </div>
                    )}
                    <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                      <div className="flex items-center gap-2 text-xs text-orange-300">
                        <Mail className="h-3.5 w-3.5" />
                        <span>The employee will receive an email with a link to the Access Portal to set their password and register.</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Provisioned Users List */}
              <div className="col-span-2">
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-orange-400" /> Provisioned Employees
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingUsers ? (
                      <div className="py-12 text-center text-slate-500">Loading employees...</div>
                    ) : allProvisionedUsers.length === 0 ? (
                      <div className="py-12 text-center">
                        <Users className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-400">No employees provisioned yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
                        {allProvisionedUsers.map((pu) => (
                          <div
                            key={pu.id}
                            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                                <Users className="h-4 w-4 text-slate-400" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-white">{pu.full_name}</div>
                                <div className="text-xs text-slate-500">
                                  {pu.email} · {pu.company_name || '—'} · {pu.role.replace(/_/g, ' ')}
                                </div>
                              </div>
                            </div>
                            <Badge className={
                              pu.status === 'active' ? 'bg-green-500/15 text-green-400 border-green-500/30 text-xs'
                              : pu.status === 'pending_invitation' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs'
                              : pu.status === 'suspended' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30 text-xs'
                              : 'bg-slate-500/15 text-slate-400 border-slate-500/30 text-xs'
                            }>
                              {pu.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* CRM Tab */}
          <TabsContent value="crm" className="mt-6">
            {(() => {
              const filtered = crmCompanies.filter((c) => {
                const statusMatch = crmFilterStatus === 'all' || (c.account_status || 'active') === crmFilterStatus;
                const q = crmSearch.toLowerCase();
                const searchMatch = !q || c.name.toLowerCase().includes(q) || (c.region || '').toLowerCase().includes(q) || (c.sales_rep || '').toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q);
                return statusMatch && searchMatch;
              });
              const totalMrr = filtered.reduce((sum, c) => sum + (Number(c.monthly_recurring_revenue) || 0), 0);
              const totalAcv = filtered.reduce((sum, c) => sum + (Number(c.annual_contract_value) || 0), 0);
              const activeCount = filtered.filter((c) => (c.account_status || 'active') === 'active').length;
              const trialCount = filtered.filter((c) => c.account_status === 'trial').length;
              const churnedCount = filtered.filter((c) => c.account_status === 'churned').length;
              const avgHealth = filtered.length > 0 ? Math.round(filtered.reduce((sum, c) => sum + (c.health_score || 80), 0) / filtered.length) : 0;
              const now = new Date();
              const expiringSoon = filtered.filter((c) => {
                if (!c.contract_end_date) return false;
                const days = Math.floor((new Date(c.contract_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return days >= 0 && days <= 30;
              });
              const planExpiringSoon = filtered.filter((c) => {
                if (!c.plan_end_date) return false;
                const days = Math.floor((new Date(c.plan_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return days >= 0 && days <= 30;
              });

              const statusColors: Record<string, string> = {
                active: 'bg-green-500/15 text-green-400 border-green-500/30',
                trial: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                prospect: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                suspended: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                churned: 'bg-red-500/15 text-red-400 border-red-500/30',
              };
              const paymentColors: Record<string, string> = {
                current: 'text-green-400',
                past_due: 'text-red-400',
                none: 'text-slate-500',
                comped: 'text-blue-400',
              };
              const planPricing: Record<string, number> = { basic: 0, pro: 9.95, proplus: 19.95 };

              return (
                <div className="space-y-5">
                  {/* Revenue Summary Cards */}
                  <div className="grid grid-cols-5 gap-3">
                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-green-400" />
                          <span className="text-xs text-slate-500">Total MRR</span>
                        </div>
                        <div className="text-2xl font-bold text-white">${totalMrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-4 w-4 text-blue-400" />
                          <span className="text-xs text-slate-500">Total ACV</span>
                        </div>
                        <div className="text-2xl font-bold text-white">${totalAcv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-4 w-4 text-green-400" />
                          <span className="text-xs text-slate-500">Active</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{activeCount}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-blue-400" />
                          <span className="text-xs text-slate-500">On Trial</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{trialCount}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <BarChart3 className="h-4 w-4 text-orange-400" />
                          <span className="text-xs text-slate-500">Avg Health</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{avgHealth}<span className="text-sm text-slate-500">/100</span></div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Alerts */}
                  {(expiringSoon.length > 0 || planExpiringSoon.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {expiringSoon.length > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Calendar className="h-4 w-4 text-amber-400" />
                            <span className="text-xs font-semibold text-amber-300">Contracts Expiring (30 days)</span>
                          </div>
                          <div className="space-y-1">
                            {expiringSoon.map((c) => (
                              <div key={c.id} className="text-xs text-amber-200">
                                {c.name} — {new Date(c.contract_end_date!).toLocaleDateString()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {planExpiringSoon.length > 0 && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Calendar className="h-4 w-4 text-blue-400" />
                            <span className="text-xs font-semibold text-blue-300">Plans Expiring (30 days)</span>
                          </div>
                          <div className="space-y-1">
                            {planExpiringSoon.map((c) => (
                              <div key={c.id} className="text-xs text-blue-200">
                                {c.name} — {new Date(c.plan_end_date!).toLocaleDateString()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search + Filter */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        value={crmSearch}
                        onChange={(e) => setCrmSearch(e.target.value)}
                        placeholder="Search by name, region, sales rep, industry..."
                        className="bg-slate-950 border-slate-700 text-white pl-8"
                      />
                    </div>
                    <Select value={crmFilterStatus} onValueChange={setCrmFilterStatus}>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-white w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="all">All Accounts</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Client Table */}
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-0">
                      {loadingCrm ? (
                        <div className="py-12 text-center text-slate-500">Loading CRM data...</div>
                      ) : filtered.length === 0 ? (
                        <div className="py-12 text-center">
                          <Building2 className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                          <p className="text-slate-400">No accounts match your filters.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                                <th className="text-left px-4 py-3 font-medium">Client</th>
                                <th className="text-left px-4 py-3 font-medium">Status</th>
                                <th className="text-left px-4 py-3 font-medium">Plan</th>
                                <th className="text-right px-4 py-3 font-medium">MRR</th>
                                <th className="text-left px-4 py-3 font-medium">Contract</th>
                                <th className="text-left px-4 py-3 font-medium">Plan Period</th>
                                <th className="text-left px-4 py-3 font-medium">Health</th>
                                <th className="text-left px-4 py-3 font-medium">Sales Rep</th>
                                <th className="px-4 py-3"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((c) => {
                                const status = c.account_status || 'active';
                                const healthColor = (c.health_score || 80) >= 80 ? 'text-green-400' : (c.health_score || 80) >= 50 ? 'text-amber-400' : 'text-red-400';
                                return (
                                  <tr
                                    key={c.id}
                                    className="border-b border-slate-800/50 hover:bg-slate-950/50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedCrmClient(c)}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-white">{c.name}</div>
                                      <div className="text-xs text-slate-500">{c.region} · {c.industry || '—'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge className={`${statusColors[status] || statusColors.active} text-xs`}>{status}</Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="text-white">{(c.plan_tier || 'basic').toUpperCase()}</div>
                                      <div className="text-xs text-slate-500 capitalize">{c.billing_cycle || 'monthly'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="text-white font-semibold">${(Number(c.monthly_recurring_revenue) || 0).toFixed(2)}</div>
                                      <div className={`text-xs ${paymentColors[c.payment_status || 'none'] || 'text-slate-500'}`}>{c.payment_status || '—'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-400">
                                      {c.contract_start_date ? new Date(c.contract_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                                      <span className="text-slate-600 mx-1">→</span>
                                      {c.contract_end_date ? new Date(c.contract_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-400">
                                      {c.plan_start_date ? new Date(c.plan_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                      <span className="text-slate-600 mx-1">→</span>
                                      {c.plan_end_date ? new Date(c.plan_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${(c.health_score || 80) >= 80 ? 'bg-green-500' : (c.health_score || 80) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${c.health_score || 80}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs font-semibold ${healthColor}`}>{c.health_score || 80}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{c.sales_rep || '—'}</td>
                                    <td className="px-4 py-3">
                                      <ChevronRight className="h-4 w-4 text-slate-600" />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Deploy Result Modal */}
      <Dialog open={!!deployResult} onOpenChange={(open) => !open && setDeployResult(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          {deployResult?.success ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  Client Deployed Successfully
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {deployResult.company?.name} has been provisioned and a setup link has been sent to the primary contact.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Organization</div>
                    <div className="text-sm font-semibold text-white">{deployResult.company?.name}</div>
                    <div className="text-xs text-slate-400">{deployResult.company?.region} · {deployResult.company?.plan_tier.toUpperCase()}</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Organization Activation Key (Permanent)</div>
                    <code className="text-lg font-mono text-orange-300 bg-slate-900 px-3 py-1.5 rounded border border-orange-500/20 block">
                      {deployResult.activationKey}
                    </code>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Single-Use Setup Link (72h expiry)</div>
                    <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs text-blue-300 break-all font-mono">
                      {typeof window !== 'undefined' ? `${window.location.origin}/accept-invite?token=${deployResult.setupToken}` : `/accept-invite?token=${deployResult.setupToken}`}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-300">
                    If the email didn't deliver, share the setup link above directly with the client lead. The link expires in 72 hours.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeployResult(null)} className="border-slate-700 text-slate-300">
                  Deploy Another
                </Button>
                <Button onClick={onClose} className="bg-orange-500 hover:bg-orange-600 text-white">
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  Deployment Failed
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {deployResult?.error || 'An unexpected error occurred during client deployment.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeployResult(null)} className="border-slate-700 text-slate-300">
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Driver Modal */}
      <Dialog open={showAddDriver} onOpenChange={(open) => !open && setShowAddDriver(false)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-orange-400" />
              Add New Driver
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a driver to any client organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300 mb-1.5 block">Driver Name</Label>
              <Input
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
                placeholder="e.g. Mike Thompson"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 mb-1.5 block">Email (optional)</Label>
              <Input
                type="email"
                value={newDriverEmail}
                onChange={(e) => setNewDriverEmail(e.target.value)}
                placeholder="e.g. mike@company.com"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 mb-1.5 block">Company</Label>
              <Select value={newDriverCompany} onValueChange={setNewDriverCompany}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 mb-1.5 block">Location (optional)</Label>
              <Input
                value={newDriverLocation}
                onChange={(e) => setNewDriverLocation(e.target.value)}
                placeholder="e.g. Dallas, TX"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDriver(false)} className="border-slate-700 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleAddDriver}
              disabled={!newDriverName.trim() || !newDriverCompany || addingDriver}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {addingDriver ? 'Adding...' : 'Add Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRM Client Detail Drawer */}
      <Dialog open={!!selectedCrmClient && !editingClient} onOpenChange={(open) => !open && setSelectedCrmClient(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCrmClient && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-400" />
                  {selectedCrmClient.name}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {selectedCrmClient.region} · {selectedCrmClient.industry || 'Industry not set'} · Fleet size: {selectedCrmClient.fleet_size || 0}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Status & Health Bar */}
                <div className="flex items-center gap-3">
                  <Badge className={`${(selectedCrmClient.account_status || 'active') === 'active' ? 'bg-green-500/15 text-green-400 border-green-500/30' : (selectedCrmClient.account_status === 'trial') ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : (selectedCrmClient.account_status === 'churned') ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'} text-xs`}>
                    {(selectedCrmClient.account_status || 'active').replace(/_/g, ' ')}
                  </Badge>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-slate-500">Health</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(selectedCrmClient.health_score || 80) >= 80 ? 'bg-green-500' : (selectedCrmClient.health_score || 80) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${selectedCrmClient.health_score || 80}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-white">{selectedCrmClient.health_score || 80}/100</span>
                  </div>
                </div>

                {/* Revenue Section */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> MRR</div>
                    <div className="text-lg font-bold text-white">${(Number(selectedCrmClient.monthly_recurring_revenue) || 0).toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> ACV</div>
                    <div className="text-lg font-bold text-white">${(Number(selectedCrmClient.annual_contract_value) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Billing</div>
                    <div className="text-lg font-bold text-white capitalize">{selectedCrmClient.billing_cycle || 'monthly'}</div>
                  </div>
                </div>

                {/* Contract Dates */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Contract & Plan Timeline
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <div className="text-xs text-slate-500">Contract Start</div>
                      <div className="text-sm text-white">{selectedCrmClient.contract_start_date ? new Date(selectedCrmClient.contract_start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Contract End</div>
                      <div className="text-sm text-white">{selectedCrmClient.contract_end_date ? new Date(selectedCrmClient.contract_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Plan Start</div>
                      <div className="text-sm text-white">{selectedCrmClient.plan_start_date ? new Date(selectedCrmClient.plan_start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Plan End</div>
                      <div className="text-sm text-white">{selectedCrmClient.plan_end_date ? new Date(selectedCrmClient.plan_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Trial Start</div>
                      <div className="text-sm text-white">{selectedCrmClient.trial_start_date ? new Date(selectedCrmClient.trial_start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Trial End</div>
                      <div className="text-sm text-white">{selectedCrmClient.trial_end_date ? new Date(selectedCrmClient.trial_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</div>
                    </div>
                  </div>
                </div>

                {/* Account Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1">Plan Tier</div>
                    <div className="text-sm font-semibold text-white uppercase">{selectedCrmClient.plan_tier}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1">Payment Status</div>
                    <div className={`text-sm font-semibold capitalize ${paymentStatusColor(selectedCrmClient.payment_status)}`}>{selectedCrmClient.payment_status || 'none'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1">Renewal Status</div>
                    <div className="text-sm font-semibold text-white capitalize">{(selectedCrmClient.renewal_status || 'manual').replace(/_/g, ' ')}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Briefcase className="h-3 w-3" /> Sales Rep</div>
                    <div className="text-sm font-semibold text-white">{selectedCrmClient.sales_rep || 'Unassigned'}</div>
                  </div>
                </div>

                {/* Notes */}
                {selectedCrmClient.notes && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500 mb-1.5">Internal Notes</div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedCrmClient.notes}</p>
                  </div>
                )}

                {/* Created / Activity */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Client since {new Date(selectedCrmClient.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  {selectedCrmClient.last_activity_at && (
                    <span>Last active {new Date(selectedCrmClient.last_activity_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedCrmClient(null)} className="border-slate-700 text-slate-300">
                  Close
                </Button>
                <Button
                  onClick={() => setEditingClient({ ...selectedCrmClient })}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Edit Account
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* CRM Edit Client Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto">
          {editingClient && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Save className="h-5 w-5 text-orange-400" />
                  Edit {editingClient.name}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Update CRM details, contract dates, billing, and account settings.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Account Status & Health */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 mb-1.5 block">Account Status</Label>
                    <Select
                      value={editingClient.account_status || 'active'}
                      onValueChange={(v) => setEditingClient({ ...editingClient, account_status: v })}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300 mb-1.5 block">Health Score (0-100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editingClient.health_score ?? 80}
                      onChange={(e) => setEditingClient({ ...editingClient, health_score: parseInt(e.target.value) || 0 })}
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                </div>

                {/* Plan & Billing */}
                <div className="pt-3 border-t border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-orange-400" /> Plan & Billing
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Plan Tier</Label>
                      <Select
                        value={editingClient.plan_tier || 'basic'}
                        onValueChange={(v) => setEditingClient({ ...editingClient, plan_tier: v as PlanTier })}
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="proplus">Pro+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Billing Cycle</Label>
                      <Select
                        value={editingClient.billing_cycle || 'monthly'}
                        onValueChange={(v) => setEditingClient({ ...editingClient, billing_cycle: v })}
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Payment Status</Label>
                      <Select
                        value={editingClient.payment_status || 'none'}
                        onValueChange={(v) => setEditingClient({ ...editingClient, payment_status: v })}
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="current">Current</SelectItem>
                          <SelectItem value="past_due">Past Due</SelectItem>
                          <SelectItem value="comped">Comped</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Monthly Recurring Revenue ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingClient.monthly_recurring_revenue ?? 0}
                        onChange={(e) => setEditingClient({ ...editingClient, monthly_recurring_revenue: parseFloat(e.target.value) || 0 })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Annual Contract Value ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingClient.annual_contract_value ?? 0}
                        onChange={(e) => setEditingClient({ ...editingClient, annual_contract_value: parseFloat(e.target.value) || 0 })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Renewal Status</Label>
                      <Select
                        value={editingClient.renewal_status || 'manual'}
                        onValueChange={(v) => setEditingClient({ ...editingClient, renewal_status: v })}
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="auto_renew">Auto Renew</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="cancel_pending">Cancel Pending</SelectItem>
                          <SelectItem value="renewed">Renewed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contract Dates */}
                <div className="pt-3 border-t border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-400" /> Contract Dates
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Contract Start Date</Label>
                      <Input
                        type="date"
                        value={editingClient.contract_start_date || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, contract_start_date: e.target.value || null })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Contract End Date</Label>
                      <Input
                        type="date"
                        value={editingClient.contract_end_date || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, contract_end_date: e.target.value || null })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Plan Dates */}
                <div className="pt-3 border-t border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-400" /> Plan Billing Cycle
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Plan Start Date</Label>
                      <Input
                        type="date"
                        value={editingClient.plan_start_date || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, plan_start_date: e.target.value || null })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Plan End Date</Label>
                      <Input
                        type="date"
                        value={editingClient.plan_end_date || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, plan_end_date: e.target.value || null })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Trial Dates */}
                <div className="pt-3 border-t border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-400" /> Trial Period
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Trial Start Date</Label>
                      <Input
                        type="date"
                        value={editingClient.trial_start_date || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, trial_start_date: e.target.value || null })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Trial End Date</Label>
                      <Input
                        type="date"
                        value={editingClient.trial_end_date || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, trial_end_date: e.target.value || null })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Info */}
                <div className="pt-3 border-t border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-orange-400" /> Account Info
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Sales Rep</Label>
                      <Input
                        value={editingClient.sales_rep || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, sales_rep: e.target.value || null })}
                        placeholder="e.g. John Martinez"
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Industry</Label>
                      <Input
                        value={editingClient.industry || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, industry: e.target.value || null })}
                        placeholder="e.g. Logistics"
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Fleet Size</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editingClient.fleet_size ?? 0}
                        onChange={(e) => setEditingClient({ ...editingClient, fleet_size: parseInt(e.target.value) || 0 })}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="pt-3 border-t border-slate-800">
                  <Label className="text-slate-300 mb-1.5 block">Internal CRM Notes</Label>
                  <Textarea
                    value={editingClient.notes || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value || null })}
                    placeholder="Account notes, renewal discussions, special terms..."
                    className="bg-slate-950 border-slate-700 text-white min-h-[80px]"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingClient(null)} className="border-slate-700 text-slate-300">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveClient}
                  disabled={savingClient}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {savingClient ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
