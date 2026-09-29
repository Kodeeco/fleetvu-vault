'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Company, ProvisionedUser, InviteToken } from '@/lib/types';
import { REGION_LOCATIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  ShieldCheck,
  User,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
  Pencil,
  Send,
  Ban,
  Clock,
  Copy,
  Link2,
  FileText,
  Video,
  Download,
  Truck,
  Building2,
  Plus,
} from 'lucide-react';
import { LocationTagInput } from './location-tag-input';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  );
  return `FV-${segments.join('-')}`;
}

const ALL_LOCATIONS = Object.values(REGION_LOCATIONS).flat();

function getCompanyLocations(companies: Company[]): string[] {
  const custom = companies.flatMap((c) => c.fleet_locations || []);
  return Array.from(new Set([...ALL_LOCATIONS, ...custom]));
}

async function registerLocationToCompany(companyId: string | null, location: string, currentLocations: string[]): Promise<void> {
  if (!companyId || currentLocations.includes(location)) return;
  await supabase
    .from('companies')
    .update({ fleet_locations: [...currentLocations, location] })
    .eq('id', companyId);
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  super_admin: { label: 'Super-Admin', color: 'bg-violet-600', icon: <Crown className="w-3 h-3" /> },
  admin: { label: 'Admin', color: 'bg-blue-600', icon: <Shield className="w-3 h-3" /> },
  manager: { label: 'Location Manager', color: 'bg-cyan-600', icon: <ShieldCheck className="w-3 h-3" /> },
  standard_user: { label: 'User', color: 'bg-slate-600', icon: <User className="w-3 h-3" /> },
  auditor: { label: 'Auditor', color: 'bg-emerald-600', icon: <CheckCircle2 className="w-3 h-3" /> },
};

type RoleKey = 'super_admin' | 'admin' | 'manager' | 'standard_user' | 'auditor';

const MANAGER_DEFAULT_PERMISSIONS: Record<PermissionKey, boolean> = {
  driver_management: true,
  incident_playback: false,
  historical_reports: true,
  insurance_scorecards: true,
  pdf_downloads: false,
  live_gps: true,
};

const ADMIN_DEFAULT_PERMISSIONS: Record<PermissionKey, boolean> = {
  driver_management: true,
  incident_playback: true,
  historical_reports: true,
  insurance_scorecards: true,
  pdf_downloads: true,
  live_gps: true,
};

const USER_READ_ONLY_PERMISSIONS: Record<PermissionKey, boolean> = {
  driver_management: false,
  incident_playback: false,
  historical_reports: false,
  insurance_scorecards: false,
  pdf_downloads: false,
  live_gps: false,
};

const AUDITOR_READ_ONLY_PERMISSIONS: Record<PermissionKey, boolean> = {
  driver_management: false,
  incident_playback: false,
  historical_reports: true,
  insurance_scorecards: true,
  pdf_downloads: true,
  live_gps: false,
};

const DEFAULT_PERMISSIONS: Record<PermissionKey, boolean> = {
  driver_management: false,
  incident_playback: false,
  historical_reports: false,
  insurance_scorecards: false,
  pdf_downloads: false,
  live_gps: true,
};

const isReadOnlyRole = (r: RoleKey) => r === 'standard_user' || r === 'auditor';

type FunctionalTitle = 'hr_legal' | 'safety_officer' | 'operations_manager' | 'terminal_manager' | 'other';

const FUNCTIONAL_TITLES: { value: FunctionalTitle; label: string }[] = [
  { value: 'hr_legal', label: 'HR / Legal' },
  { value: 'safety_officer', label: 'Safety Officer' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'terminal_manager', label: 'Terminal Manager' },
  { value: 'other', label: 'Other' },
];

const TITLE_LABELS: Record<FunctionalTitle, string> = {
  hr_legal: 'HR / Legal',
  safety_officer: 'Safety Officer',
  operations_manager: 'Operations Manager',
  terminal_manager: 'Terminal Manager',
  other: 'Other',
};

const TITLE_TO_ROLE: Record<FunctionalTitle, RoleKey> = {
  hr_legal: 'auditor',
  safety_officer: 'manager',
  operations_manager: 'admin',
  terminal_manager: 'manager',
  other: 'standard_user',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  pending_invitation: 'bg-yellow-500/20 text-yellow-400',
  suspended: 'bg-orange-500/20 text-orange-400',
  revoked: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending_invitation: 'Pending Invitation',
  suspended: 'Suspended',
  revoked: 'Revoked',
};

const PERMISSION_FIELDS = [
  { key: 'driver_management', label: 'Driver Management', icon: <Truck className="w-4 h-4" /> },
  { key: 'incident_playback', label: 'Incident Reconstruction & Playback', icon: <Video className="w-4 h-4" /> },
  { key: 'historical_reports', label: 'Historical Reports', icon: <FileText className="w-4 h-4" /> },
  { key: 'insurance_scorecards', label: 'Insurance Score Cards', icon: <ShieldCheck className="w-4 h-4" /> },
  { key: 'pdf_downloads', label: 'PDF Downloads', icon: <Download className="w-4 h-4" /> },
  { key: 'live_gps', label: 'Live GPS & Telemetry Tracking', icon: <MapPin className="w-4 h-4" /> },
] as const;

type PermissionKey = typeof PERMISSION_FIELDS[number]['key'];

type AuditLogInput = {
  actor_email: string;
  actor_role: string;
  action_type: string;
  target_user_email: string | null;
  target_user_role: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  utc_timestamp: string;
  metadata?: Record<string, unknown>;
};

async function writeAuditLog(entry: AuditLogInput) {
  const payload = JSON.stringify({ ...entry, ts: Date.now() });
  const record_hash = await sha256(payload);
  await supabase.from('access_audit_log').insert({
    ...entry,
    record_hash,
    prev_hash: null,
  });
}

// ─── Add Team Member Modal ───────────────────────────────────────────────────

function AddTeamMemberModal({
  companies,
  provisioner,
  onClose,
  onCreated,
  onCompanyCreated,
}: {
  companies: Company[];
  provisioner: { name: string; email: string; role: string };
  onClose: () => void;
  onCreated: (user: ProvisionedUser, inviteUrl: string) => void;
  onCompanyCreated?: (company: Company) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [functionalTitle, setFunctionalTitle] = useState<FunctionalTitle | ''>('');
  const [customTitle, setCustomTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleKey>('manager');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(DEFAULT_PERMISSIONS);

  const handleFunctionalTitleChange = (t: FunctionalTitle) => {
    setFunctionalTitle(t);
    const mappedRole = TITLE_TO_ROLE[t];
    setRole(mappedRole);
    if (mappedRole === 'manager') {
      setPermissions(MANAGER_DEFAULT_PERMISSIONS);
    } else if (mappedRole === 'admin' || mappedRole === 'super_admin') {
      setPermissions(ADMIN_DEFAULT_PERMISSIONS);
    } else if (mappedRole === 'auditor') {
      setPermissions(AUDITOR_READ_ONLY_PERMISSIONS);
    } else if (mappedRole === 'standard_user') {
      setPermissions(USER_READ_ONLY_PERMISSIONS);
    } else {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  // Company registration inline form state
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCity, setNewCompanyCity] = useState('');
  const [newCompanyOrgId, setNewCompanyOrgId] = useState('');
  const [registeringCompany, setRegisteringCompany] = useState(false);

  const isSuperAdminProvisioner = provisioner.role === 'super_admin' || provisioner.role === 'global_admin';
  const isAdminProvisioner = isSuperAdminProvisioner || provisioner.role === 'admin';
  const showCompanyScope = isAdminProvisioner && companies.length >= 1;

  const scopedCompanies = showCompanyScope && selectedCompanyIds.length > 0
    ? companies.filter((c) => selectedCompanyIds.includes(c.id))
    : companies;
  const availableLocations = getCompanyLocations(scopedCompanies);

  const handleRoleChange = (newRole: RoleKey) => {
    setRole(newRole);
    if (newRole === 'manager') {
      setPermissions(MANAGER_DEFAULT_PERMISSIONS);
    } else if (newRole === 'admin' || newRole === 'super_admin') {
      setPermissions(ADMIN_DEFAULT_PERMISSIONS);
    } else if (newRole === 'standard_user') {
      setPermissions(USER_READ_ONLY_PERMISSIONS);
    } else {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  const readOnly = isReadOnlyRole(role);

  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const handleRegisterNewLocation = async (location: string) => {
    const targetCompany = scopedCompanies[0];
    if (targetCompany) {
      await registerLocationToCompany(targetCompany.id, location, targetCompany.fleet_locations || []);
    }
  };

  const handleRegisterCompany = async () => {
    if (!newCompanyName.trim()) {
      setError('Company legal name is required.');
      return;
    }
    setRegisteringCompany(true);
    setError('');
    try {
      const primaryLocation = newCompanyCity.trim() || 'HQ';
      const { data, error: dbErr } = await supabase
        .from('companies')
        .insert({
          name: newCompanyName.trim(),
          region: newCompanyCity.trim() || 'Unspecified',
          location: newCompanyCity.trim() || 'Unspecified',
          plan_tier: 'pro',
          fleet_locations: [primaryLocation],
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      const newCompany = data as Company;

      await writeAuditLog({
        actor_email: provisioner.email,
        actor_role: provisioner.role,
        action_type: 'REGISTER_COMPANY',
        target_user_email: null,
        target_user_role: null,
        previous_state: null,
        new_state: { company_id: newCompany.id, company_name: newCompany.name, org_tag: newCompanyOrgId || null },
        utc_timestamp: new Date().toISOString(),
        metadata: { org_tag: newCompanyOrgId || null },
      });

      onCompanyCreated?.(newCompany);
      setSelectedCompanyIds((prev) => [...prev, newCompany.id]);
      setNewCompanyName('');
      setNewCompanyCity('');
      setNewCompanyOrgId('');
      setShowCompanyForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to register company.');
    } finally {
      setRegisteringCompany(false);
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First name, last name, and email are required.');
      return;
    }
    if (!functionalTitle) {
      setError('Functional title is required. Please select a title before creating the user.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const effectiveCompanyIds = showCompanyScope && selectedCompanyIds.length > 0 ? selectedCompanyIds : companies.map((c) => c.id);
      const primaryCompanyId = effectiveCompanyIds[0] || null;
      const primaryCompanyName = companies.find((c) => c.id === primaryCompanyId)?.name || null;
      const inviteToken = generateInviteToken();

      const { data, error: dbErr } = await supabase
        .from('provisioned_users')
        .insert({
          full_name: fullName,
          email: email.trim().toLowerCase(),
          phone: phone || null,
          corporate_title: functionalTitle === 'other' ? (customTitle || 'Other') : TITLE_LABELS[functionalTitle],
          company_id: primaryCompanyId,
          company_name: primaryCompanyName,
          scoped_company_ids: effectiveCompanyIds,
          role,
          assigned_locations: selectedLocations,
          assigned_vehicle_count: 0,
          deployment_hardware: 'c55_pro',
          plan_tier: 'pro',
          feature_permissions: permissions,
          status: 'pending_invitation',
          provisioned_by: provisioner.email,
          provisioned_by_role: provisioner.role,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      const newUserId = (data as ProvisionedUser).id;

      await supabase.from('invite_tokens').insert({
        token: inviteToken,
        user_email: email.trim().toLowerCase(),
        user_id: newUserId,
        company_id: primaryCompanyId,
        created_by: provisioner.email,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
      });

      await writeAuditLog({
        actor_email: provisioner.email,
        actor_role: provisioner.role,
        action_type: 'PROVISION_USER',
        target_user_email: email.trim().toLowerCase(),
        target_user_role: role,
        previous_state: null,
        new_state: { full_name: fullName, role, status: 'pending_invitation' },
        utc_timestamp: new Date().toISOString(),
        metadata: { invite_token: inviteToken },
      });

      const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite?token=${inviteToken}`;

      // Dispatch activation email via the communications API
      try {
        await fetch('/api/communications/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'TEAM_INVITE',
            to_email: email.trim().toLowerCase(),
            to_name: fullName,
            role: ROLE_LABELS[role]?.label || role,
            company_name: primaryCompanyName,
            invite_token: inviteToken,
            provisioned_by_name: provisioner.name,
          }),
        });
      } catch {
        // Email dispatch failure is non-fatal — the invite link still works
      }

      onCreated(data as ProvisionedUser, inviteUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create team member.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-orange-400" />
            Add Team Member
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Create a new user with role-based access and a one-time invite link valid for 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Identity fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">First Name *</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Last Name *</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white" placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Functional Title *</Label>
              <select
                value={functionalTitle}
                onChange={(e) => handleFunctionalTitleChange(e.target.value as FunctionalTitle)}
                className="w-full bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 cursor-pointer appearance-none"
              >
                <option value="" disabled>Select a functional title…</option>
                {FUNCTIONAL_TITLES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {functionalTitle === 'hr_legal' && (
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Auto-mapped to Auditor role: read-only access to Vault notarized records, signed compliance forms, and audit trails. Live dispatch controls are hidden.
                </p>
              )}
            </div>
            {functionalTitle === 'other' && (
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Custom Title</Label>
                <Input className="bg-slate-900/50 border-slate-600 text-white" placeholder="Enter custom title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Phone</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-slate-300 text-xs">Email Address *</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          {/* Step 1: Role Assignment */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs flex items-center gap-1"><Crown className="w-3 h-3" /> Role Assignment</Label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as RoleKey)}
              className="w-full bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 cursor-pointer appearance-none"
              style={{ zIndex: 60 }}
            >
              {isSuperAdminProvisioner && (
                <option value="super_admin">Super-Admin</option>
              )}
              <option value="admin">Admin</option>
              <option value="manager">Location Manager</option>
              <option value="auditor">Auditor (Read-Only — Vault &amp; Compliance)</option>
              <option value="standard_user">User</option>
            </select>
            {role === 'admin' && (
              <p className="text-[10px] text-blue-400 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> Enterprise Admin: Full administrative access scoped to assigned companies and locations. All feature permissions enabled.
              </p>
            )}
            {role === 'super_admin' && (
              <p className="text-[10px] text-violet-400 flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" /> Super-Admin: Full administrative access across all companies. Can register new company entities. All feature permissions enabled.
              </p>
            )}
            {role === 'manager' && (
              <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" /> Location Manager permissions auto-configured: Driver Management, Historical Reports, Insurance Score Cards, Live GPS &amp; Telemetry Tracking.
              </p>
            )}
            {role === 'standard_user' && (
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> User: Read-only access. All permission toggles are locked to off.
              </p>
            )}
            {role === 'auditor' && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> Auditor: Read-only access to Vault notarized records, signed driver compliance forms, and audit trails. Live GPS &amp; dispatch controls are disabled.
              </p>
            )}
          </div>

          {/* Step 2: Company Scope */}
          {showCompanyScope && (
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Company Scope</Label>
              <p className="text-[10px] text-slate-500">
                {isSuperAdminProvisioner
                  ? 'Select which companies this team member can access. Leave empty for all companies.'
                  : 'Select from your pre-approved companies. Leave empty for all assigned companies.'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCompanySelection(c.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                      selectedCompanyIds.includes(c.id)
                        ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    <Building2 className="w-3 h-3 shrink-0" />
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Register New Company — Super-Admin only */}
              {isSuperAdminProvisioner && !showCompanyForm && (
                <button
                  type="button"
                  onClick={() => setShowCompanyForm(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-violet-500/40 bg-violet-500/5 px-2.5 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/10 transition-all"
                >
                  <Building2 className="w-3 h-3 shrink-0" />
                  + Register New Company / Entity
                </button>
              )}

              {/* Inline Company Registration Form */}
              {isSuperAdminProvisioner && showCompanyForm && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-950/10 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Register New Company
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowCompanyForm(false); setNewCompanyName(''); setNewCompanyCity(''); setNewCompanyOrgId(''); }}
                      className="text-slate-500 hover:text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-slate-400 text-[10px]">Company Legal Name *</Label>
                      <Input
                        className="bg-slate-900/50 border-slate-600 text-white h-8 text-xs"
                        placeholder="Apex Logistics LLC"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-[10px]">Primary Terminal City / State</Label>
                      <Input
                        className="bg-slate-900/50 border-slate-600 text-white h-8 text-xs"
                        placeholder="Dallas, TX"
                        value={newCompanyCity}
                        onChange={(e) => setNewCompanyCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-[10px]">Default Org ID Tag</Label>
                      <Input
                        className="bg-slate-900/50 border-slate-600 text-white h-8 text-xs"
                        placeholder="APEX-001"
                        value={newCompanyOrgId}
                        onChange={(e) => setNewCompanyOrgId(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 h-7 text-xs w-full"
                    onClick={handleRegisterCompany}
                    disabled={registeringCompany || !newCompanyName.trim()}
                  >
                    {registeringCompany ? (
                      <><RefreshCw className="w-3 h-3 animate-spin" /> Registering…</>
                    ) : (
                      <><CheckCircle2 className="w-3 h-3" /> Save & Add to Scope</>
                    )}
                  </Button>
                </div>
              )}

              {selectedCompanyIds.length > 0 && (
                <p className="text-[10px] text-blue-400">{selectedCompanyIds.length} compan{selectedCompanyIds.length > 1 ? 'ies' : 'y'} selected · {selectedCompanyIds.length === companies.length ? 'All companies' : 'Subset'}</p>
              )}
            </div>
          )}

          {/* Step 3: Location Access Assignment */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Location Access Assignment</Label>
            {showCompanyScope && selectedCompanyIds.length > 0 && (
              <p className="text-[10px] text-slate-500">Showing locations for {selectedCompanyIds.length} selected compan{selectedCompanyIds.length > 1 ? 'ies' : 'y'}.</p>
            )}
            {showCompanyScope && selectedCompanyIds.length === 0 && (
              <p className="text-[10px] text-slate-500">Showing locations across all managed companies.</p>
            )}
            {isAdminProvisioner && (
              <p className="text-[10px] text-emerald-400/70 flex items-center gap-1">
                <Plus className="w-2.5 h-2.5" />
                Type a new location name and press Enter to add a terminal to the selected company.
              </p>
            )}
            <LocationTagInput
              selected={selectedLocations}
              onChange={setSelectedLocations}
              availableLocations={availableLocations}
              onRegisterNewLocation={isAdminProvisioner ? handleRegisterNewLocation : undefined}
            />
            {selectedLocations.length > 0 && (
              <p className="text-[10px] text-orange-400 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />
                {selectedLocations.length} location{selectedLocations.length > 1 ? 's' : ''} selected{role === 'manager' ? ' · Data scoped to assigned location(s) only' : ''}
              </p>
            )}
          </div>

          {/* Step 4: Preconfigured Permission Panel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 text-xs">Preconfigured Permission Panel</Label>
              {role === 'manager' && (
                <span className="text-[10px] text-cyan-400 font-medium">Auto-configured for Location Manager</span>
              )}
              {(role === 'admin' || role === 'super_admin') && (
                <span className="text-[10px] text-blue-400 font-medium">All features enabled</span>
              )}
              {role === 'auditor' && (
                <span className="text-[10px] text-emerald-400 font-medium">Read-Only · Vault &amp; Compliance</span>
              )}
              {readOnly && (
                <span className="text-[10px] text-slate-400 font-medium">Locked · Read-Only</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSION_FIELDS.map((f) => (
                <div key={f.key} className={cn('flex items-center justify-between p-2.5 rounded-lg border transition-all', permissions[f.key] ? 'border-green-500/40 bg-green-500/10' : 'border-slate-700 bg-slate-900/50', readOnly && 'opacity-50')}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={permissions[f.key] ? 'text-green-400' : 'text-slate-500'}>{f.icon}</span>
                    <span className={cn('text-xs font-medium truncate', permissions[f.key] ? 'text-green-300' : 'text-slate-400')}>{f.label}</span>
                  </div>
                  <Switch
                    checked={permissions[f.key]}
                    onCheckedChange={(checked) => setPermissions((prev) => ({ ...prev, [f.key]: checked }))}
                    disabled={readOnly}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>Cancel</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={handleSubmit} disabled={saving}>
            <UserPlus className="w-4 h-4" />
            {saving ? 'Creating & Generating Invite…' : 'Create User & Send Invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Scope/Permissions Modal ────────────────────────────────────────────

function EditScopeModal({
  user: targetUser,
  provisioner,
  onClose,
  onUpdated,
}: {
  user: ProvisionedUser;
  provisioner: { email: string; role: string };
  onClose: () => void;
  onUpdated: (updated: ProvisionedUser) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<RoleKey>(targetUser.role as RoleKey);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(targetUser.assigned_locations);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    driver_management: targetUser.feature_permissions.driver_management ?? false,
    incident_playback: targetUser.feature_permissions.incident_playback ?? false,
    historical_reports: targetUser.feature_permissions.historical_reports ?? false,
    insurance_scorecards: targetUser.feature_permissions.insurance_scorecards ?? false,
    pdf_downloads: targetUser.feature_permissions.pdf_downloads ?? false,
    live_gps: targetUser.feature_permissions.live_gps ?? true,
  });

  const availableLocations = ALL_LOCATIONS;

  const handleRoleChange = (newRole: RoleKey) => {
    setRole(newRole);
    if (newRole === 'manager') {
      setPermissions(MANAGER_DEFAULT_PERMISSIONS);
    } else if (newRole === 'admin' || newRole === 'super_admin') {
      setPermissions(ADMIN_DEFAULT_PERMISSIONS);
    } else if (newRole === 'auditor') {
      setPermissions(AUDITOR_READ_ONLY_PERMISSIONS);
    } else if (newRole === 'standard_user') {
      setPermissions(USER_READ_ONLY_PERMISSIONS);
    } else {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  const readOnly = isReadOnlyRole(role);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { data, error: dbErr } = await supabase
        .from('provisioned_users')
        .update({
          role,
          assigned_locations: selectedLocations,
          feature_permissions: permissions,
        })
        .eq('id', targetUser.id)
        .select()
        .single();

      if (dbErr) throw dbErr;

      await writeAuditLog({
        actor_email: provisioner.email,
        actor_role: provisioner.role,
        action_type: 'PERMISSION_UPDATE',
        target_user_email: targetUser.email,
        target_user_role: role,
        previous_state: { role: targetUser.role, assigned_locations: targetUser.assigned_locations, feature_permissions: targetUser.feature_permissions },
        new_state: { role, assigned_locations: selectedLocations, feature_permissions: permissions },
        utc_timestamp: new Date().toISOString(),
      });

      onUpdated(data as ProvisionedUser);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Pencil className="w-5 h-5 text-orange-400" />
            Edit Scope &amp; Permissions — {targetUser.full_name}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Modify role, location assignments, and feature access for this user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Role</Label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as RoleKey)}
              className="w-full bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 cursor-pointer appearance-none"
              style={{ zIndex: 60 }}
            >
              <option value="super_admin">Super-Admin</option>
              <option value="admin">Admin</option>
              <option value="manager">Location Manager</option>
              <option value="auditor">Auditor (Read-Only — Vault &amp; Compliance)</option>
              <option value="standard_user">User</option>
            </select>
            {role === 'admin' && (
              <p className="text-[10px] text-blue-400 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> Enterprise Admin: Full administrative access scoped to assigned companies and locations. All feature permissions enabled.
              </p>
            )}
            {role === 'super_admin' && (
              <p className="text-[10px] text-violet-400 flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" /> Super-Admin: Full administrative access across all companies. Can register new company entities. All feature permissions enabled.
              </p>
            )}
            {role === 'manager' && (
              <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" /> Data created or managed by this user is automatically scoped to their assigned location(s) only.
              </p>
            )}
            {role === 'standard_user' && (
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> User: Read-only access. All permission toggles are locked to off.
              </p>
            )}
            {role === 'auditor' && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> Auditor: Read-only access to Vault notarized records, signed driver compliance forms, and audit trails. Live GPS &amp; dispatch controls are disabled.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Assigned Locations</Label>
            <LocationTagInput
              selected={selectedLocations}
              onChange={setSelectedLocations}
              availableLocations={availableLocations}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 text-xs">Feature Permissions</Label>
              {readOnly && (
                <span className="text-[10px] text-slate-400 font-medium">Locked · Read-Only</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSION_FIELDS.map((f) => (
                <div key={f.key} className={cn('flex items-center justify-between p-2.5 rounded-lg border transition-all', permissions[f.key] ? 'border-green-500/40 bg-green-500/10' : 'border-slate-700 bg-slate-900/50', readOnly && 'opacity-50')}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={permissions[f.key] ? 'text-green-400' : 'text-slate-500'}>{f.icon}</span>
                    <span className={cn('text-xs font-medium truncate', permissions[f.key] ? 'text-green-300' : 'text-slate-400')}>{f.label}</span>
                  </div>
                  <Switch checked={permissions[f.key]} onCheckedChange={(checked) => setPermissions((prev) => ({ ...prev, [f.key]: checked }))} disabled={readOnly} />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>Cancel</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invite Link Modal ───────────────────────────────────────────────────────

function InviteLinkModal({
  user: targetUser,
  inviteUrl,
  token,
  onClose,
}: {
  user: ProvisionedUser;
  inviteUrl: string;
  token: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            Invitation Successfully Sent
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Invitation successfully sent to {targetUser.email}. The user will appear as &quot;Pending Invitation&quot; until account setup is complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-green-500/30 bg-green-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-green-400">
              <Mail className="w-3.5 h-3.5" />
              <span className="font-semibold">Activation email dispatched to {targetUser.email}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              <span>Invite link valid for 24 hours</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between"><span className="text-slate-500">Name</span><span className="text-slate-200 font-semibold">{targetUser.full_name}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Email</span><span className="text-slate-200 font-semibold">{targetUser.email}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Role</span><span className="text-slate-200 font-semibold">{ROLE_LABELS[targetUser.role]?.label || targetUser.role}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Pending Invitation</Badge></div>
          </div>

          {/* Secondary: Copy Direct Setup Link */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Link2 className="w-3 h-3" />
              <span className="font-semibold uppercase tracking-wide">Direct Setup Link (Manual Sharing)</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={inviteUrl}
                className="bg-slate-900/60 border-slate-700 text-slate-300 font-mono text-xs"
              />
              <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 gap-1.5 shrink-0" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
            <div className="text-[10px] text-slate-500">
              Token: <span className="font-mono text-slate-400">{token}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={onClose}>
            <CheckCircle2 className="w-4 h-4" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── User Directory Table Row ────────────────────────────────────────────────

function UserDirectoryRow({
  user: u,
  provisioner,
  onEdit,
  onResend,
  onDeactivate,
}: {
  user: ProvisionedUser;
  provisioner: { email: string; role: string };
  onEdit: (u: ProvisionedUser) => void;
  onResend: (u: ProvisionedUser) => void;
  onDeactivate: (id: string, status: ProvisionedUser['status']) => void;
}) {
  const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-slate-600', icon: <User className="w-3 h-3" /> };
  const scopeText = u.assigned_locations.length > 0 ? u.assigned_locations.join(', ') : 'All Locations';

  return (
    <div className="grid grid-cols-[1fr_1fr_1.5fr_auto_auto] gap-3 items-center px-4 py-3 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
      {/* Name + Title */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0', roleInfo.color)}>
            {roleInfo.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{u.full_name}</p>
            <p className="text-[10px] text-slate-500 truncate">{u.corporate_title || '—'}</p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="min-w-0 flex flex-col gap-0.5 text-left">
        <div className="flex items-center gap-1 text-xs text-slate-300 truncate text-left">
          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate text-left">{u.email}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 truncate text-left">
          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate text-left">{u.phone || '—'}</span>
        </div>
      </div>

      {/* Role + Scope */}
      <div className="min-w-0 space-y-1">
        <Badge className={cn('text-[10px] text-white inline-flex items-center justify-center gap-1.5', roleInfo.color)}>
          <span className="inline-flex items-center justify-center shrink-0">{roleInfo.icon}</span>
          {roleInfo.label}
        </Badge>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
          <MapPin className="w-2.5 h-2.5 shrink-0" />
          {scopeText}
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <Badge className={cn('text-[10px]', STATUS_STYLES[u.status] || 'bg-slate-700 text-slate-400')}>
          {STATUS_LABELS[u.status] || u.status}
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(u)}
          className="p-1.5 rounded-md text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
          title="Edit Scope/Permissions"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {u.status === 'pending_invitation' && (
          <button
            onClick={() => onResend(u)}
            className="p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title="Resend Setup Link"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
        {u.status !== 'suspended' && u.status !== 'revoked' && (
          <button
            onClick={() => onDeactivate(u.id, 'suspended')}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Deactivate User"
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
        )}
        {u.status === 'suspended' && (
          <button
            onClick={() => onDeactivate(u.id, 'active')}
            className="p-1.5 rounded-md text-slate-400 hover:text-green-400 hover:bg-green-500/10 transition-colors"
            title="Reactivate User"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function UserManagement({
  companies,
  user,
}: {
  companies: Company[];
  user: { name: string; email: string; role: string };
}) {
  const [users, setUsers] = useState<ProvisionedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<ProvisionedUser | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{ user: ProvisionedUser; url: string; token: string } | null>(null);
  const [companiesList, setCompaniesList] = useState<Company[]>(companies);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('provisioned_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setUsers(data as ProvisionedUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDeactivate = async (id: string, newStatus: ProvisionedUser['status']) => {
    await supabase.from('provisioned_users').update({ status: newStatus }).eq('id', id);
    await writeAuditLog({
      actor_email: user.email,
      actor_role: user.role,
      action_type: newStatus === 'suspended' ? 'ACCOUNT_SUSPEND' : 'ACCOUNT_REACTIVATE',
      target_user_email: users.find((u) => u.id === id)?.email || null,
      target_user_role: users.find((u) => u.id === id)?.role || null,
      previous_state: { status: users.find((u) => u.id === id)?.status },
      new_state: { status: newStatus },
      utc_timestamp: new Date().toISOString(),
    });
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: newStatus } : u));
  };

  const handleResend = async (targetUser: ProvisionedUser) => {
    const token = generateInviteToken();
    await supabase.from('invite_tokens').insert({
      token,
      user_email: targetUser.email,
      user_id: targetUser.id,
      company_id: targetUser.company_id,
      created_by: user.email,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    });
    await supabase.from('provisioned_users').update({ status: 'pending_invitation' }).eq('id', targetUser.id);
    await writeAuditLog({
      actor_email: user.email,
      actor_role: user.role,
      action_type: 'RESEND_INVITE',
      target_user_email: targetUser.email,
      target_user_role: targetUser.role,
      previous_state: null,
      new_state: { token, status: 'pending_invitation' },
      utc_timestamp: new Date().toISOString(),
    });
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite?token=${token}`;
    try {
      await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TEAM_INVITE',
          to_email: targetUser.email,
          to_name: targetUser.full_name,
          role: ROLE_LABELS[targetUser.role]?.label || targetUser.role,
          company_name: targetUser.company_name,
          invite_token: token,
          provisioned_by_name: user.name,
        }),
      });
    } catch {
      // Email dispatch failure is non-fatal
    }
    setInviteInfo({ user: targetUser, url, token });
  };

  const isSuperAdmin = user.role === 'super_admin' || user.role === 'global_admin';
  const isAdmin = user.role === 'admin' || isSuperAdmin;

  // Stats
  const activeCount = users.filter((u) => u.status === 'active').length;
  const pendingCount = users.filter((u) => u.status === 'pending_invitation').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-400" />
            User &amp; Location Access Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Self-serve team provisioning, role assignment, and location scoping</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 gap-1.5 h-7" onClick={loadUsers}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          {isAdmin && (
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 h-7" onClick={() => setShowAddModal(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Add Team Member
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-green-700/30 bg-green-950/20 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-slate-300">Active</span>
          </div>
          <p className="text-2xl font-bold text-green-400 mt-1">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-yellow-700/30 bg-yellow-950/20 p-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-slate-300">Pending Invite</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-orange-700/30 bg-orange-950/20 p-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-slate-300">Suspended</span>
          </div>
          <p className="text-2xl font-bold text-orange-400 mt-1">{suspendedCount}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          className="bg-slate-900/50 border-slate-600 text-white h-8 text-sm flex-1 min-w-[200px]"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white h-8 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200 hover:bg-slate-700">All Status</SelectItem>
            <SelectItem value="active" className="text-slate-200 hover:bg-slate-700">Active</SelectItem>
            <SelectItem value="pending_invitation" className="text-slate-200 hover:bg-slate-700">Pending Invitation</SelectItem>
            <SelectItem value="suspended" className="text-slate-200 hover:bg-slate-700">Suspended</SelectItem>
            <SelectItem value="revoked" className="text-slate-200 hover:bg-slate-700">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User Directory Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No users found.</p>
          {isAdmin && (
            <Button size="sm" className="mt-3 bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={() => setShowAddModal(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Add First Team Member
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1.5fr_auto_auto] gap-3 items-center px-4 py-2 bg-slate-800/60 border-b border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Name / Title</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Contact</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Role &amp; Scope</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Actions</span>
          </div>
          {/* Table rows */}
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
            {filtered.map((u) => (
              <UserDirectoryRow
                key={u.id}
                user={u}
                provisioner={{ email: user.email, role: user.role }}
                onEdit={(targetUser) => setEditUser(targetUser)}
                onResend={handleResend}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddTeamMemberModal
          companies={companiesList}
          provisioner={{ name: user.name, email: user.email, role: user.role }}
          onClose={() => setShowAddModal(false)}
          onCreated={(newUser, url) => {
            setUsers((prev) => [newUser, ...prev]);
            setShowAddModal(false);
            const token = url.split('invite=')[1] || '';
            setInviteInfo({ user: newUser, url, token });
          }}
          onCompanyCreated={(newCompany) => {
            setCompaniesList((prev) => [...prev, newCompany]);
          }}
        />
      )}

      {editUser && (
        <EditScopeModal
          user={editUser}
          provisioner={{ email: user.email, role: user.role }}
          onClose={() => setEditUser(null)}
          onUpdated={(updated) => {
            setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
            setEditUser(null);
          }}
        />
      )}

      {inviteInfo && (
        <InviteLinkModal
          user={inviteInfo.user}
          inviteUrl={inviteInfo.url}
          token={inviteInfo.token}
          onClose={() => setInviteInfo(null)}
        />
      )}
    </div>
  );
}
