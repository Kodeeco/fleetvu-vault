'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Company, ProvisionedUser, AccessAuditLog } from '@/lib/types';
import { REGION_LOCATIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Building2,
  MapPin,
  Cpu,
  Zap,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Sparkles,
  KeyRound,
  Globe,
  FileText,
  Navigation,
  Truck,
  Video,
  Download,
  RefreshCw,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

type AuditLogInput = Partial<Omit<AccessAuditLog, 'id' | 'seq' | 'created_at' | 'record_hash' | 'prev_hash'>> &
  Pick<AccessAuditLog, 'action_type' | 'utc_timestamp'> & { prev_hash?: string };

async function writeAuditLog(entry: AuditLogInput) {
  const payload = JSON.stringify({ ...entry, ts: Date.now() });
  const record_hash = await sha256(payload);
  await supabase.from('access_audit_log').insert({
    ...entry,
    record_hash,
    prev_hash: entry.prev_hash ?? null,
  });
}

// ─── RBAC permission matrix data ─────────────────────────────────────────────

const ROLE_MATRIX = [
  {
    role: 'super_admin',
    label: 'Super-Admin',
    color: 'bg-orange-600',
    icon: <Crown className="w-4 h-4" />,
    description: 'Full system governance, global fleet access, tenant management, audit logs, and role promotion/demotion across all users.',
    permissions: [
      'Global fleet access across all tenants',
      'Promote / demote / revoke any user role',
      'Assign location boundaries',
      'Full audit log access',
      'Tenant management',
      'Hardware provisioning',
      'Pricing configuration (read-only)',
    ],
    restrictions: [],
  },
  {
    role: 'admin',
    label: 'Admin',
    color: 'bg-blue-600',
    icon: <Shield className="w-4 h-4" />,
    description: 'Operational control limited to designated locations. Can manage local Managers and Users, toggle feature widgets, and configure site assets.',
    permissions: [
      'Manage Managers and Users within assigned locations',
      'Toggle feature widgets (e.g. Historical Report Generator)',
      'Configure site assets',
      'Location-scoped fleet visibility',
      'Access local audit events',
    ],
    restrictions: [
      'Cannot access other tenants',
      'Cannot promote to Super-Admin',
      'Cannot edit global pricing',
    ],
  },
  {
    role: 'manager',
    label: 'Manager',
    color: 'bg-cyan-600',
    icon: <ShieldCheck className="w-4 h-4" />,
    description: 'Controlled access to assigned site assets and delegated widgets explicitly granted by an Admin or Super-Admin.',
    permissions: [
      'View assigned site asset fleet',
      'Access delegated feature widgets',
      'Manage Standard Users (if delegated)',
    ],
    restrictions: [
      'Cannot provision new users',
      'Cannot change role assignments',
      'Limited to explicitly delegated features',
    ],
  },
  {
    role: 'auditor',
    label: 'Auditor',
    color: 'bg-emerald-600',
    icon: <CheckCircle2 className="w-4 h-4" />,
    description: 'Read-only access to FleetVu Vault notarized records, signed driver compliance forms, and audit trails. Live dispatch and GPS controls are hidden.',
    permissions: [
      'View Vault notarized telemetry records',
      'View signed driver compliance forms',
      'View audit trails and access logs',
      'Export historical reports (PDF)',
      'View insurance score cards',
    ],
    restrictions: [
      'No live GPS or dispatch controls',
      'No driver management',
      'No incident reconstruction',
      'No user provisioning',
    ],
  },
  {
    role: 'standard_user',
    label: 'Standard User',
    color: 'bg-slate-600',
    icon: <User className="w-4 h-4" />,
    description: 'View-only or restricted driver/operator HUD access.',
    permissions: [
      'Driver/operator HUD access',
      'View assigned vehicle telemetry',
      'Submit incident reports',
    ],
    restrictions: [
      'No fleet management',
      'No user management',
      'No system configuration',
    ],
  },
];

const ALL_LOCATIONS = Object.values(REGION_LOCATIONS).flat();

const FEATURE_OPTIONS = [
  { key: 'driver_management', label: 'Driver Management', icon: <Truck className="w-3.5 h-3.5" /> },
  { key: 'incident_playback', label: 'Incident Reconstruction & Playback', icon: <Video className="w-3.5 h-3.5" /> },
  { key: 'historical_reports', label: 'Historical Reports', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'insurance_scorecards', label: 'Insurance Score Cards', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: 'pdf_downloads', label: 'PDF Downloads', icon: <Download className="w-3.5 h-3.5" /> },
  { key: 'live_gps', label: 'Live GPS & Telemetry Tracking', icon: <Navigation className="w-3.5 h-3.5" /> },
] as const;

// ─── sub-components ───────────────────────────────────────────────────────────

function RoleMatrixCard({ entry, expanded, onToggle }: { entry: typeof ROLE_MATRIX[0]; expanded: boolean; onToggle: () => void }) {
  return (
    <div className={cn('rounded-lg border transition-all', expanded ? 'border-orange-500/40 bg-slate-900/80' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600')}>
      <button className="w-full flex items-center gap-3 p-3 text-left" onClick={onToggle}>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white', entry.color)}>
          {entry.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{entry.label}</p>
          <p className="text-[10px] text-slate-400 truncate">{entry.description.slice(0, 60)}…</p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2">
          <p className="text-xs text-slate-300">{entry.description}</p>
          <div className="grid grid-cols-2 gap-2">
            {entry.permissions.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-green-400 uppercase tracking-wide">Permitted</p>
                {entry.permissions.map((p) => (
                  <div key={p} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                    {p}
                  </div>
                ))}
              </div>
            )}
            {entry.restrictions.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-red-400 uppercase tracking-wide">Restricted</p>
                {entry.restrictions.map((r) => (
                  <div key={r} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                    <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeEmailModal({
  user,
  provisioner,
  onClose,
}: {
  user: ProvisionedUser & { temp_password: string };
  provisioner: { name: string; email: string; role: string };
  onClose: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const sentAt = new Date().toISOString();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-green-400" />
            Welcome Email — Simulated Delivery
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            The following welcome email was triggered. In production, this would be delivered via your configured SMTP provider.
          </DialogDescription>
        </DialogHeader>

        {/* Email preview */}
        <div className="rounded-lg border border-slate-600 overflow-hidden">
          {/* Email header */}
          <div className="bg-slate-900/80 px-4 py-3 space-y-1 text-xs border-b border-slate-700">
            <div className="flex gap-2"><span className="text-slate-500 w-12 shrink-0">From:</span><span className="text-slate-300">FleetVu Security &lt;noreply@fleetvu.io&gt;</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-12 shrink-0">To:</span><span className="text-slate-300">{user.full_name} &lt;{user.email}&gt;</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-12 shrink-0">CC:</span><span className="text-slate-300">{provisioner.email} (Super-Admin)</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-12 shrink-0">Sent:</span><span className="text-slate-300">{new Date(sentAt).toLocaleString()} UTC</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-12 shrink-0">Subject:</span><span className="text-white font-semibold">Your FleetVu Mobile Command Access Has Been Provisioned</span></div>
          </div>

          {/* Email body */}
          <div className="bg-slate-950/60 p-4 space-y-4 text-sm text-slate-300">
            <p>Dear <span className="font-semibold text-white">{user.full_name}</span>,</p>
            <p>
              Your FleetVu Mobile Command account has been provisioned by{' '}
              <span className="font-semibold text-white">{provisioner.name}</span> ({provisioner.role}).
              Please log in using the temporary credentials below and change your password immediately upon first access.
            </p>

            <div className="rounded-lg border border-orange-500/30 bg-orange-950/20 p-4 space-y-3">
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">Temporary Access Credentials</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-slate-500">Email / Login:</span><br /><span className="font-mono font-bold text-white">{user.email}</span></div>
                <div>
                  <span className="text-slate-500">Temporary Password:</span><br />
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{showPassword ? user.temp_password : '••••••••••••••'}</span>
                    <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-white">
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div><span className="text-slate-500">Assigned Role:</span><br /><span className="font-bold text-white capitalize">{user.role.replace('_', ' ')}</span></div>
                <div><span className="text-slate-500">Plan Tier:</span><br /><span className="font-bold text-white uppercase">{user.plan_tier}</span></div>
                <div><span className="text-slate-500">Company / Tenant:</span><br /><span className="font-bold text-white">{user.company_name || 'N/A'}</span></div>
                <div><span className="text-slate-500">Assigned Locations:</span><br /><span className="font-bold text-white">{user.assigned_locations.join(', ') || 'All'}</span></div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Delegated Feature Access</p>
              <div className="flex flex-wrap gap-1.5">
                {FEATURE_OPTIONS.map((f) => (
                  <Badge
                    key={f.key}
                    className={user.feature_permissions[f.key] ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-700/50 text-slate-500 border border-slate-600'}
                  >
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded border border-amber-600/30 bg-amber-950/20 p-3 text-xs text-amber-400">
              <p className="font-bold mb-1">Security Notice</p>
              <p>This temporary password expires in 72 hours. You must set a new password on first login. Do not share these credentials. If you did not request access, contact your system administrator immediately.</p>
            </div>

            <p className="text-xs text-slate-500">
              This message was generated automatically by FleetVu Mobile Command. Provisioned by: {provisioner.email} at {new Date(sentAt).toLocaleString()}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={onClose}>
            <CheckCircle2 className="w-4 h-4" />
            Acknowledged — User Provisioned
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProvisionUserModal({
  companies,
  provisioner,
  onClose,
  onProvisioned,
}: {
  companies: Company[];
  provisioner: { name: string; email: string; role: string };
  onClose: () => void;
  onProvisioned: (user: ProvisionedUser & { temp_password: string }) => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [functionalTitle, setFunctionalTitle] = useState<FunctionalTitle | ''>('');
  const [customTitle, setCustomTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'standard_user' | 'auditor'>('standard_user');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [hardware, setHardware] = useState<'c55_pro' | 'c93_dual'>('c55_pro');
  const [planTier, setPlanTier] = useState<'basic' | 'pro' | 'proplus'>('basic');
  const [enableTrial, setEnableTrial] = useState(true);
  const [trialDuration, setTrialDuration] = useState(30);
  const [features, setFeatures] = useState({
    driver_management: false,
    incident_playback: false,
    historical_reports: false,
    insurance_scorecards: false,
    pdf_downloads: false,
    live_gps: true,
  });

  const selectedCompany = companies.find((c) => c.id === companyId);

  const toggleLocation = (loc: string) => {
    setSelectedLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const handleFunctionalTitleChange = (t: FunctionalTitle) => {
    setFunctionalTitle(t);
    if (t === 'hr_legal') {
      setRole('auditor');
      setFeatures({ driver_management: false, incident_playback: false, historical_reports: true, insurance_scorecards: true, pdf_downloads: true, live_gps: false });
    } else if (t === 'safety_officer') {
      setRole('manager');
      setFeatures({ driver_management: true, incident_playback: false, historical_reports: true, insurance_scorecards: true, pdf_downloads: false, live_gps: true });
    } else if (t === 'operations_manager') {
      setRole('admin');
      setFeatures({ driver_management: true, incident_playback: true, historical_reports: true, insurance_scorecards: true, pdf_downloads: true, live_gps: true });
    } else if (t === 'terminal_manager') {
      setRole('manager');
      setFeatures({ driver_management: true, incident_playback: false, historical_reports: true, insurance_scorecards: true, pdf_downloads: false, live_gps: true });
    }
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required.');
      return;
    }
    if (!functionalTitle) {
      setError('Functional title is required. Please select a title before provisioning the user.');
      return;
    }
    setSaving(true);
    setError('');
    const tempPassword = generateTempPassword();
    const corporateTitle = functionalTitle === 'other' ? (customTitle || 'Other') : TITLE_LABELS[functionalTitle];

    try {
      const { data, error: dbErr } = await supabase
        .from('provisioned_users')
        .insert({
          full_name: fullName,
          email,
          phone: phone || null,
          corporate_title: corporateTitle,
          company_id: companyId || null,
          company_name: selectedCompany?.name || null,
          role,
          assigned_locations: selectedLocations,
          assigned_vehicle_count: vehicleCount,
          deployment_hardware: hardware,
          plan_tier: planTier,
          feature_permissions: features,
          temp_password: tempPassword,
          status: 'active',
          provisioned_by: provisioner.email,
          provisioned_by_role: provisioner.role,
          trial_start_date: enableTrial ? new Date().toISOString() : null,
          trial_duration_days: enableTrial ? trialDuration : null,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      await writeAuditLog({
        actor_email: provisioner.email,
        actor_role: provisioner.role,
        action_type: 'PROVISION_USER',
        target_user_email: email,
        target_user_role: role,
        previous_state: null,
        new_state: { email, role, plan_tier: planTier, company_name: selectedCompany?.name },
        utc_timestamp: new Date().toISOString(),
        metadata: { full_name: fullName, feature_permissions: features },
      });

      onProvisioned({ ...(data as ProvisionedUser), temp_password: tempPassword });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to provision user.');
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
            Provision New User / Admin
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Step {step} of 3 — {step === 1 ? 'Identity & Role' : step === 2 ? 'Location & Hardware' : 'Feature Permissions'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn('h-1 flex-1 rounded-full transition-colors', s <= step ? 'bg-orange-500' : 'bg-slate-700')} />
          ))}
        </div>

        <div className="space-y-4">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Full Name *</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white" placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Email Address *</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Phone Number</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Company / Tenant</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select company…" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-slate-200 hover:bg-slate-700">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs flex items-center gap-1"><Crown className="w-3 h-3" /> Role Assignment</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="admin" className="text-slate-200 hover:bg-slate-700">Admin</SelectItem>
                      <SelectItem value="manager" className="text-slate-200 hover:bg-slate-700">Manager</SelectItem>
                      <SelectItem value="auditor" className="text-slate-200 hover:bg-slate-700">Auditor (Read-Only — Vault &amp; Compliance)</SelectItem>
                      <SelectItem value="standard_user" className="text-slate-200 hover:bg-slate-700">Standard User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Role preview */}
              {(() => {
                const entry = ROLE_MATRIX.find((r) => r.role === role);
                return entry ? (
                  <div className={cn('rounded-lg p-3 border text-xs', role === 'admin' ? 'bg-blue-950/30 border-blue-700/30' : role === 'manager' ? 'bg-cyan-950/30 border-cyan-700/30' : 'bg-slate-900/50 border-slate-700')}>
                    <p className="font-bold text-white mb-1">{entry.label} — Scope Preview</p>
                    <p className="text-slate-400">{entry.description}</p>
                  </div>
                ) : null;
              })()}
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Location / Terminal Assignment</Label>
                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                  {ALL_LOCATIONS.map((loc) => (
                    <label key={loc} className={cn('flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all', selectedLocations.includes(loc) ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600')}>
                      <Checkbox
                        checked={selectedLocations.includes(loc)}
                        onCheckedChange={() => toggleLocation(loc)}
                        className="border-slate-600"
                      />
                      {loc}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Vehicle Capacity</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white"
                    type="number"
                    min={0}
                    value={vehicleCount}
                    onChange={(e) => setVehicleCount(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs flex items-center gap-1"><Cpu className="w-3 h-3" /> Deployment Hardware</Label>
                  <Select value={hardware} onValueChange={(v) => setHardware(v as typeof hardware)}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="c55_pro" className="text-slate-200">C55-Pro (Forward)</SelectItem>
                      <SelectItem value="c93_dual" className="text-slate-200">C93 Dual-Layer Suite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs flex items-center gap-1"><Zap className="w-3 h-3" /> FleetVu Plan</Label>
                  <Select value={planTier} onValueChange={(v) => setPlanTier(v as typeof planTier)}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="basic" className="text-slate-200">Basic</SelectItem>
                      <SelectItem value="pro" className="text-slate-200">Pro</SelectItem>
                      <SelectItem value="proplus" className="text-slate-200">Pro+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Trial configuration */}
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">30-Day Full-Feature Trial</p>
                      <p className="text-[10px] text-slate-500">Grant temporary access to all PRO/PRO+ features</p>
                    </div>
                  </div>
                  <Switch checked={enableTrial} onCheckedChange={setEnableTrial} />
                </div>
                {enableTrial && (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <Label className="text-slate-400 text-[10px] whitespace-nowrap">Trial Duration</Label>
                    <Select value={String(trialDuration)} onValueChange={(v) => setTrialDuration(Number(v))}>
                      <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white h-7 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="14" className="text-slate-200">14 Days</SelectItem>
                        <SelectItem value="30" className="text-slate-200">30 Days (Default)</SelectItem>
                        <SelectItem value="60" className="text-slate-200">60 Days</SelectItem>
                        <SelectItem value="90" className="text-slate-200">90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] text-slate-500">Starts on first login</span>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs flex items-center gap-1"><Sparkles className="w-3 h-3" /> Delegated Feature Permissions</Label>
                <div className="space-y-2">
                  {FEATURE_OPTIONS.map((f) => (
                    <label key={f.key} className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all', features[f.key] ? 'border-green-500/40 bg-green-500/10' : 'border-slate-700 bg-slate-900/50 hover:border-slate-600')}>
                      <Checkbox
                        checked={features[f.key]}
                        onCheckedChange={(checked) => setFeatures((prev) => ({ ...prev, [f.key]: Boolean(checked) }))}
                        className="border-slate-600"
                      />
                      <span className={features[f.key] ? 'text-green-300' : 'text-slate-400'}>{f.icon}</span>
                      <div>
                        <p className={cn('text-sm font-semibold', features[f.key] ? 'text-green-300' : 'text-slate-300')}>{f.label}</p>
                        <p className="text-[10px] text-slate-500">{features[f.key] ? 'Enabled for this user' : 'Not delegated'}</p>
                      </div>
                      {features[f.key] && <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />}
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary before submit */}
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-1 text-xs">
                <p className="font-bold text-white mb-2">Provisioning Summary</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div><span className="text-slate-500">Name:</span> <span className="text-slate-200">{fullName || '—'}</span></div>
                  <div><span className="text-slate-500">Email:</span> <span className="text-slate-200">{email || '—'}</span></div>
                  <div><span className="text-slate-500">Role:</span> <span className="text-slate-200 capitalize">{role.replace('_', ' ')}</span></div>
                  <div><span className="text-slate-500">Plan:</span> <span className="text-slate-200 uppercase">{planTier}</span></div>
                  <div><span className="text-slate-500">Company:</span> <span className="text-slate-200">{selectedCompany?.name || 'N/A'}</span></div>
                  <div><span className="text-slate-500">Locations:</span> <span className="text-slate-200">{selectedLocations.length || 'All'}</span></div>
                  <div><span className="text-slate-500">Hardware:</span> <span className="text-slate-200">{hardware === 'c55_pro' ? 'C55-Pro' : 'C93 Dual'}</span></div>
                  <div><span className="text-slate-500">Provisioned by:</span> <span className="text-slate-200">{provisioner.email}</span></div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
              Cancel
            </Button>
          </div>
          {step < 3 ? (
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setStep(step + 1)} disabled={step === 1 && (!fullName.trim() || !email.trim() || !functionalTitle)}>
              Next Step
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={handleSubmit} disabled={saving}>
              <UserPlus className="w-4 h-4" />
              {saving ? 'Provisioning…' : 'Provision User & Send Welcome'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({
  user: u,
  provisioner,
  onStatusChange,
}: {
  user: ProvisionedUser;
  provisioner: { email: string; role: string };
  onStatusChange: (id: string, status: 'active' | 'suspended' | 'revoked') => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = u.status === 'active' ? 'bg-green-500/20 text-green-400' : u.status === 'suspended' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';
  const roleColor = u.role === 'admin' ? 'bg-blue-600' : u.role === 'manager' ? 'bg-cyan-600' : u.role === 'auditor' ? 'bg-emerald-600' : 'bg-slate-600';

  const handleStatusChange = async (newStatus: 'active' | 'suspended' | 'revoked') => {
    await supabase.from('provisioned_users').update({ status: newStatus }).eq('id', u.id);
    await writeAuditLog({
      actor_email: provisioner.email,
      actor_role: provisioner.role,
      action_type: newStatus === 'suspended' ? 'ACCOUNT_SUSPEND' : newStatus === 'revoked' ? 'ACCOUNT_REVOKE' : 'ACCOUNT_REACTIVATE',
      target_user_email: u.email,
      target_user_role: u.role,
      previous_state: { status: u.status },
      new_state: { status: newStatus },
      utc_timestamp: new Date().toISOString(),
    });
    onStatusChange(u.id, newStatus);
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0', roleColor)}>
          {u.role === 'admin' ? <Shield className="w-4 h-4" /> : u.role === 'manager' ? <ShieldCheck className="w-4 h-4" /> : u.role === 'auditor' ? <CheckCircle2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white truncate">{u.full_name}</p>
            <Badge className={cn('text-[10px] shrink-0', statusColor)}>{u.status}</Badge>
          </div>
          <p className="text-xs text-slate-400 truncate">{u.email} · {u.corporate_title || u.role.replace('_', ' ')}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={cn('text-[10px] text-white', roleColor)}>{u.role.replace('_', ' ')}</Badge>
          <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 uppercase">{u.plan_tier}</Badge>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-white ml-1">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 px-3 pb-3 pt-2 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-slate-500">Phone:</span><br /><span className="text-slate-300">{u.phone || '—'}</span></div>
            <div><span className="text-slate-500">Company:</span><br /><span className="text-slate-300">{u.company_name || '—'}</span></div>
            <div><span className="text-slate-500">Hardware:</span><br /><span className="text-slate-300">{u.deployment_hardware === 'c55_pro' ? 'C55-Pro' : 'C93 Dual'}</span></div>
            <div><span className="text-slate-500">Locations:</span><br /><span className="text-slate-300">{u.assigned_locations.length > 0 ? u.assigned_locations.join(', ') : 'All'}</span></div>
            <div><span className="text-slate-500">Vehicles:</span><br /><span className="text-slate-300">{u.assigned_vehicle_count}</span></div>
            <div><span className="text-slate-500">Provisioned:</span><br /><span className="text-slate-300">{new Date(u.created_at).toLocaleDateString()}</span></div>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase mb-1.5">Feature Access</p>
            <div className="flex flex-wrap gap-1.5">
              {FEATURE_OPTIONS.map((f) => (
                <Badge key={f.key} className={u.feature_permissions[f.key] ? 'bg-green-500/20 text-green-300 border border-green-500/30 text-[10px]' : 'bg-slate-700/50 text-slate-500 border border-slate-600 text-[10px]'}>
                  {f.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 pt-1 border-t border-slate-700/50">
            {u.status !== 'active' && (
              <Button size="sm" variant="outline" className="text-green-300 border-green-500/40 hover:bg-green-500/10 h-6 text-[10px] gap-1" onClick={() => handleStatusChange('active')}>
                <Unlock className="w-3 h-3" /> Reactivate
              </Button>
            )}
            {u.status === 'active' && (
              <Button size="sm" variant="outline" className="text-amber-300 border-amber-500/40 hover:bg-amber-500/10 h-6 text-[10px] gap-1" onClick={() => handleStatusChange('suspended')}>
                <AlertTriangle className="w-3 h-3" /> Suspend
              </Button>
            )}
            {u.status !== 'revoked' && (
              <Button size="sm" variant="outline" className="text-red-300 border-red-500/40 hover:bg-red-500/10 h-6 text-[10px] gap-1" onClick={() => handleStatusChange('revoked')}>
                <Trash2 className="w-3 h-3" /> Revoke
              </Button>
            )}
            <div className="ml-auto text-[9px] text-slate-500 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              By {u.provisioned_by || '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────

export function UserManagementPanel({
  companies,
  user,
}: {
  companies: Company[];
  user: { name: string; email: string; role: string };
}) {
  const [tab, setTab] = useState<'matrix' | 'users'>('users');
  const [provisionedUsers, setProvisionedUsers] = useState<ProvisionedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState<(ProvisionedUser & { temp_password: string }) | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>('admin');
  const [search, setSearch] = useState('');
  const [expandedMatrix, setExpandedMatrix] = useState<string | null>('admin');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('provisioned_users').select('*').order('created_at', { ascending: false });
    if (data) setProvisionedUsers(data as ProvisionedUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = provisionedUsers.filter((u) =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const isSuperAdmin = user.role === 'super_admin' || user.role === 'global_admin';

  const byRole = (role: string) => filtered.filter((u) => u.role === role);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-400" />
            User &amp; Team Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">RBAC provisioning, role governance, and access control</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 gap-1.5 h-7" onClick={loadUsers}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          {isSuperAdmin && (
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 h-7" onClick={() => setShowProvisionModal(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Provision User
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(['users', 'matrix'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-bold border transition-all', tab === t ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600')}
          >
            {t === 'users' ? 'Provisioned Users' : 'Permission Matrix'}
          </button>
        ))}
      </div>

      {tab === 'matrix' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Role hierarchy and permission boundaries for each access tier in FleetVu Mobile Command.</p>
          {ROLE_MATRIX.map((entry) => (
            <RoleMatrixCard
              key={entry.role}
              entry={entry}
              expanded={expandedMatrix === entry.role}
              onToggle={() => setExpandedMatrix(expandedMatrix === entry.role ? null : entry.role)}
            />
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
          <Input
            className="bg-slate-900/50 border-slate-600 text-white h-8 text-sm"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No provisioned users yet.</p>
              {isSuperAdmin && (
                <Button size="sm" className="mt-3 bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={() => setShowProvisionModal(true)}>
                  <UserPlus className="w-3.5 h-3.5" /> Provision First User
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(['admin', 'manager', 'auditor', 'standard_user'] as const).map((role) => {
                const users = byRole(role);
                if (users.length === 0) return null;
                const roleEntry = ROLE_MATRIX.find((r) => r.role === role)!;
                return (
                  <div key={role}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white text-[10px]', roleEntry.color)}>
                        {roleEntry.icon}
                      </div>
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">{roleEntry.label}s</p>
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-500">{users.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {users.map((u) => (
                        <UserRow
                          key={u.id}
                          user={u}
                          provisioner={{ email: user.email, role: user.role }}
                          onStatusChange={(id, status) => {
                            setProvisionedUsers((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showProvisionModal && (
        <ProvisionUserModal
          companies={companies}
          provisioner={{ name: user.name, email: user.email, role: user.role }}
          onClose={() => setShowProvisionModal(false)}
          onProvisioned={(newUser) => {
            setProvisionedUsers((prev) => [newUser, ...prev]);
            setShowProvisionModal(false);
            setWelcomeUser(newUser);
          }}
        />
      )}

      {welcomeUser && (
        <WelcomeEmailModal
          user={welcomeUser}
          provisioner={{ name: user.name, email: user.email, role: user.role }}
          onClose={() => setWelcomeUser(null)}
        />
      )}
    </div>
  );
}
