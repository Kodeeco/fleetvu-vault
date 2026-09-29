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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AuthUser } from '@/lib/app-context';
import {
  Crown, MapPin, Users, Mail, Send, CheckCircle2, ArrowRight, ArrowLeft,
  Building2, Shield, Lock, Radio, FileText, TrendingUp, Plus, Copy,
  AlertCircle, Globe, ChevronRight,
} from 'lucide-react';

type SetupStep = 'welcome' | 'organization' | 'locations' | 'team' | 'permissions' | 'review' | 'complete';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'standard_user' | 'auditor';
  functionalTitle: string;
  locations: string[];
  permissions: {
    driver_management: boolean;
    incident_playback: boolean;
    historical_reports: boolean;
    insurance_scorecards: boolean;
    pdf_downloads: boolean;
    live_gps: boolean;
  };
  inviteSent: boolean;
  inviteToken: string | null;
  activationKey: string | null;
  status: 'pending' | 'active';
}

interface RoleTemplate {
  role: TeamMember['role'];
  label: string;
  icon: typeof Shield;
  color: string;
  description: string;
  defaultPermissions: TeamMember['permissions'];
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    role: 'admin',
    label: 'Manager',
    icon: Shield,
    color: 'text-cyan-400',
    description: 'Driver management, incident playback, historical reports, GPS tracking',
    defaultPermissions: {
      driver_management: true,
      incident_playback: true,
      historical_reports: true,
      insurance_scorecards: false,
      pdf_downloads: true,
      live_gps: true,
    },
  },
  {
    role: 'auditor',
    label: 'HR / Legal (Read-Only Vault)',
    icon: Lock,
    color: 'text-emerald-400',
    description: 'Read-only access to forensic vault, historical reports, and insurance scorecards',
    defaultPermissions: {
      driver_management: false,
      incident_playback: false,
      historical_reports: true,
      insurance_scorecards: true,
      pdf_downloads: true,
      live_gps: false,
    },
  },
  {
    role: 'standard_user',
    label: 'Driver / Standard User',
    icon: Users,
    color: 'text-slate-400',
    description: 'Basic dashboard access, live GPS, no management controls',
    defaultPermissions: {
      driver_management: false,
      incident_playback: false,
      historical_reports: false,
      insurance_scorecards: false,
      pdf_downloads: false,
      live_gps: true,
    },
  },
];

const FUNCTIONAL_TITLE_MAP: Record<string, { role: TeamMember['role']; label: string }> = {
  hr_legal: { role: 'auditor', label: 'HR / Legal' },
  safety_officer: { role: 'admin', label: 'Safety Officer' },
  operations_manager: { role: 'admin', label: 'Operations Manager' },
  terminal_manager: { role: 'admin', label: 'Terminal Manager' },
  dispatcher: { role: 'standard_user', label: 'Dispatcher' },
  driver: { role: 'standard_user', label: 'Driver' },
  other: { role: 'standard_user', label: 'Other' },
};

const FUNCTIONAL_TITLES = Object.entries(FUNCTIONAL_TITLE_MAP).map(([key, val]) => ({ key, ...val }));

const PERMISSION_FIELDS: { key: keyof TeamMember['permissions']; label: string; icon: typeof Radio }[] = [
  { key: 'driver_management', label: 'Driver Management', icon: Users },
  { key: 'incident_playback', label: 'Incident Playback', icon: Radio },
  { key: 'historical_reports', label: 'Historical Reports', icon: FileText },
  { key: 'insurance_scorecards', label: 'Insurance Scorecards', icon: TrendingUp },
  { key: 'pdf_downloads', label: 'PDF Downloads', icon: FileText },
  { key: 'live_gps', label: 'Live GPS', icon: MapPin },
];

function generateInviteToken(): string {
  const segments = [8, 4, 4, 4, 12];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return segments
    .map((len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
    .join('-');
}

function generateActivationKey(suffix: string): string {
  const nums = Math.floor(1000 + Math.random() * 9000).toString();
  return `FV-${nums}-${suffix.toUpperCase().slice(0, 2).padEnd(2, 'X')}`;
}

let memberCounter = 0;
function newMemberId(): string {
  memberCounter++;
  return `member-${memberCounter}-${Date.now()}`;
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
    // Best-effort
  }
}

interface DelegateSetupWizardProps {
  user: AuthUser;
  companyId: string;
  companyName: string;
  isSuperAdmin: boolean;
  primaryLocation: string;
  existingLocations: string[];
  featureEntitlements: { radar: boolean; gps: boolean; vault: boolean; risk_scoring: boolean };
  onComplete: () => void;
  onClose: () => void;
}

export function DelegateSetupWizard({
  user,
  companyId,
  companyName,
  isSuperAdmin,
  primaryLocation,
  existingLocations,
  featureEntitlements,
  onComplete,
  onClose,
}: DelegateSetupWizardProps) {
  const [step, setStep] = useState<SetupStep>('welcome');
  const [locations, setLocations] = useState<string[]>(existingLocations.length > 0 ? existingLocations : [primaryLocation]);
  const [newLocation, setNewLocation] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResults, setInviteResults] = useState<TeamMember[]>([]);
  const [showInviteResults, setShowInviteResults] = useState(false);

  // Add member form
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberTitle, setMemberTitle] = useState('safety_officer');
  const [memberRole, setMemberRole] = useState<TeamMember['role']>('admin');
  const [memberLocations, setMemberLocations] = useState<string[]>([primaryLocation]);
  const [memberPermissions, setMemberPermissions] = useState<TeamMember['permissions']>(
    ROLE_TEMPLATES[0].defaultPermissions,
  );

  useEffect(() => {
    if (isSuperAdmin) {
      setMemberLocations([]);
    } else {
      setMemberLocations([primaryLocation]);
    }
  }, [isSuperAdmin, primaryLocation]);

  const handleTitleChange = (titleKey: string) => {
    setMemberTitle(titleKey);
    const mapping = FUNCTIONAL_TITLE_MAP[titleKey];
    if (mapping) {
      setMemberRole(mapping.role);
      const template = ROLE_TEMPLATES.find((t) => t.role === mapping.role);
      if (template) {
        setMemberPermissions({ ...template.defaultPermissions });
      }
    }
  };

  const handleRoleTemplateChange = (role: TeamMember['role']) => {
    setMemberRole(role);
    const template = ROLE_TEMPLATES.find((t) => t.role === role);
    if (template) {
      setMemberPermissions({ ...template.defaultPermissions });
    }
  };

  const addLocation = () => {
    const loc = newLocation.trim();
    if (loc && !locations.includes(loc)) {
      setLocations((prev) => [...prev, loc]);
      setNewLocation('');
    }
  };

  const removeLocation = (loc: string) => {
    if (loc === primaryLocation) return; // Can't remove primary
    setLocations((prev) => prev.filter((l) => l !== loc));
  };

  const addTeamMember = () => {
    if (!memberName.trim() || !memberEmail.trim()) return;
    const member: TeamMember = {
      id: newMemberId(),
      name: memberName.trim(),
      email: memberEmail.trim().toLowerCase(),
      role: memberRole,
      functionalTitle: FUNCTIONAL_TITLE_MAP[memberTitle]?.label || memberTitle,
      locations: isSuperAdmin ? memberLocations : [primaryLocation],
      permissions: { ...memberPermissions },
      inviteSent: false,
      inviteToken: null,
      activationKey: null,
      status: 'pending',
    };
    setTeamMembers((prev) => [...prev, member]);
    // Reset form
    setMemberName('');
    setMemberEmail('');
    setMemberTitle('safety_officer');
    setMemberRole('admin');
    setMemberPermissions(ROLE_TEMPLATES[0].defaultPermissions);
    if (isSuperAdmin) {
      setMemberLocations([]);
    } else {
      setMemberLocations([primaryLocation]);
    }
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMemberPermission = (id: string, key: keyof TeamMember['permissions'], value: boolean) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, permissions: { ...m.permissions, [key]: value } } : m)),
    );
  };

  const updateMemberLocations = (id: string, loc: string) => {
    setTeamMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const has = m.locations.includes(loc);
        return {
          ...m,
          locations: has ? m.locations.filter((l) => l !== loc) : [...m.locations, loc],
        };
      }),
    );
  };

  const sendBatchInvites = async () => {
    if (teamMembers.length === 0) {
      setStep('complete');
      return;
    }
    setSendingInvites(true);
    const batchId = `batch-${Date.now()}`;
    const results: TeamMember[] = [];

    for (const member of teamMembers) {
      const token = generateInviteToken();
      const keySuffix = member.name.split(' ').pop() || member.email.slice(0, 2);
      const activationKey = generateActivationKey(keySuffix);

      try {
        // Insert provisioned user
        await supabase.from('provisioned_users').insert({
          full_name: member.name,
          email: member.email,
          role: member.role,
          company_id: companyId,
          company_name: companyName,
          status: 'pending_invitation',
          plan_tier: user.planTier || 'pro',
          assigned_locations: member.locations,
          scoped_company_ids: isSuperAdmin ? [] : [companyId],
          deployment_hardware: 'c55_pro',
          feature_permissions: member.permissions,
          provisioned_by: user.email,
          provisioned_by_role: user.provisionedRole || user.role,
        });

        // Create invite token (72h expiry)
        await supabase.from('invite_tokens').insert({
          token,
          user_email: member.email,
          company_id: companyId,
          created_by: user.email,
          expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          invite_type: 'batch',
          batch_id: batchId,
        });

        // Create activation key
        await supabase.from('activation_keys').insert({
          key_code: activationKey,
          role_type: member.role,
          company_name: companyName,
          company_id: companyId,
          recipient_email: member.email,
          status: 'active',
          created_by_email: user.email,
          expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        });

        // Send email
        try {
          await fetch('/api/communications/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'TEAM_INVITE',
              to_email: member.email,
              to_name: member.name,
              role: ROLE_TEMPLATES.find((t) => t.role === member.role)?.label || member.role,
              company_name: companyName,
              invite_token: token,
              provisioned_by_name: user.name,
            }),
          });
        } catch {
          // Non-fatal
        }

        // Audit log
        await writeAuditLog({
          actor_email: user.email,
          actor_role: user.role,
          action_type: 'PROVISION_USER',
          target_user_email: member.email,
          target_user_role: member.role,
          previous_state: null,
          new_state: {
            name: member.name,
            role: member.role,
            locations: member.locations,
            permissions: member.permissions,
            invite_token: token,
            activation_key: activationKey,
          },
          metadata: { batch_id: batchId, company_name: companyName },
        });

        results.push({ ...member, inviteSent: true, inviteToken: token, activationKey, status: 'pending' });
      } catch {
        results.push({ ...member, inviteSent: false, inviteToken: null, activationKey: null, status: 'pending' });
      }
    }

    // Update company fleet_locations if super-admin added new ones
    if (isSuperAdmin && locations.length > existingLocations.length) {
      try {
        await supabase.from('companies').update({ fleet_locations: locations }).eq('id', companyId);
      } catch {
        // Non-fatal
      }
    }

    // Mark onboarding complete
    try {
      await supabase
        .from('provisioned_users')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('email', user.email)
        .eq('company_id', companyId);

      await writeAuditLog({
        actor_email: user.email,
        actor_role: user.role,
        action_type: 'ONBOARDING_COMPLETE',
        target_user_email: null,
        target_user_role: null,
        previous_state: null,
        new_state: {
          company_id: companyId,
          company_name: companyName,
          locations_configured: locations,
          team_members_invited: results.length,
        },
        metadata: { batch_id: batchId },
      });
    } catch {
      // Non-fatal
    }

    setInviteResults(results);
    setShowInviteResults(true);
    setSendingInvites(false);
    setStep('complete');
  };

  const steps: { id: SetupStep; label: string; icon: typeof Users; superAdminOnly?: boolean }[] = [
    { id: 'welcome', label: 'Welcome', icon: CheckCircle2 },
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'locations', label: 'Locations', icon: MapPin, superAdminOnly: true },
    { id: 'team', label: 'Team Invites', icon: Users },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'review', label: 'Review & Deploy', icon: Send },
  ];

  const visibleSteps = steps.filter((s) => !s.superAdminOnly || isSuperAdmin);
  const currentStepIndex = visibleSteps.findIndex((s) => s.id === step);

  const canProceed = () => {
    switch (step) {
      case 'welcome': return true;
      case 'organization': return locations.length > 0;
      case 'locations': return locations.length > 0;
      case 'team': return true; // Can proceed with zero members
      case 'permissions': return true;
      case 'review': return true;
      default: return false;
    }
  };

  const goNext = () => {
    const next = visibleSteps[currentStepIndex + 1];
    if (next) setStep(next.id);
  };

  const goPrev = () => {
    const prev = visibleSteps[currentStepIndex - 1];
    if (prev) setStep(prev.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isSuperAdmin ? 'bg-violet-500/10 border border-violet-500/30' : 'bg-blue-500/10 border border-blue-500/30'}`}>
              {isSuperAdmin ? <Crown className="h-5 w-5 text-violet-400" /> : <MapPin className="h-5 w-5 text-blue-400" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Delegate Setup Wizard</h1>
              <p className="text-xs text-slate-500">
                {isSuperAdmin ? 'Multi-location onboarding' : `Scoped to ${primaryLocation}`} · {companyName}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            Exit Wizard
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Step Progress */}
        <div className="flex items-center justify-between mb-8">
          {visibleSteps.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < currentStepIndex;
            const isActive = i === currentStepIndex;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                      isDone
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : isActive
                        ? isSuperAdmin
                          ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                          : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-900 border-slate-700 text-slate-600'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs ${isActive ? 'text-white font-medium' : 'text-slate-500'}`}>{s.label}</span>
                </div>
                {i < visibleSteps.length - 1 && (
                  <div className={`h-px flex-1 mx-2 ${isDone ? 'bg-green-500/30' : 'bg-slate-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Welcome */}
          {step === 'welcome' && (
            <Card className="bg-slate-900/50 border-slate-800 max-w-2xl mx-auto">
              <CardContent className="p-8 text-center">
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${isSuperAdmin ? 'bg-violet-500/10 border border-violet-500/30' : 'bg-blue-500/10 border border-blue-500/30'}`}>
                  {isSuperAdmin ? <Crown className="h-8 w-8 text-violet-400" /> : <MapPin className="h-8 w-8 text-blue-400" />}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to FleetVu, {user.name}</h2>
                <p className="text-slate-400 mb-6">
                  You've been provisioned as a <span className={isSuperAdmin ? 'text-violet-300' : 'text-blue-300'}>{isSuperAdmin ? 'Super-Admin' : 'Location Admin'}</span> for <span className="text-white font-medium">{companyName}</span>.
                  This wizard will guide you through setting up your fleet operations.
                </p>

                <div className="grid grid-cols-2 gap-3 text-left mb-6">
                  {isSuperAdmin ? (
                    <>
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
                        <Globe className="h-5 w-5 text-violet-400 mb-2" />
                        <div className="text-sm font-medium text-white">Multi-Location Setup</div>
                        <div className="text-xs text-slate-500">Add and configure multiple facilities across regions</div>
                      </div>
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
                        <Users className="h-5 w-5 text-violet-400 mb-2" />
                        <div className="text-sm font-medium text-white">Regional Team Invites</div>
                        <div className="text-xs text-slate-500">Invite managers and staff across all your locations</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
                        <MapPin className="h-5 w-5 text-blue-400 mb-2" />
                        <div className="text-sm font-medium text-white">Single Location Scope</div>
                        <div className="text-xs text-slate-500">Manage staff at {primaryLocation} only</div>
                      </div>
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
                        <Users className="h-5 w-5 text-blue-400 mb-2" />
                        <div className="text-sm font-medium text-white">Local Team Invites</div>
                        <div className="text-xs text-slate-500">Invite site staff with role-based permissions</div>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3 text-left">
                  <div className="flex items-center gap-2 text-xs text-orange-300">
                    <Mail className="h-3.5 w-3.5" />
                    <span>Team members you invite will receive personalized welcome emails with 72-hour activation links.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Organization */}
          {step === 'organization' && (
            <Card className="bg-slate-900/50 border-slate-800 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-400" /> Organization Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
                    <div className="text-xs text-slate-500 mb-1">Organization</div>
                    <div className="text-sm font-semibold text-white">{companyName}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
                    <div className="text-xs text-slate-500 mb-1">Your Role</div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      {isSuperAdmin ? <Crown className="h-4 w-4 text-violet-400" /> : <MapPin className="h-4 w-4 text-blue-400" />}
                      {isSuperAdmin ? 'Super-Admin' : 'Location Admin'}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300 mb-2 block">Primary Location</Label>
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-orange-400" />
                    <span className="text-sm text-white">{primaryLocation}</span>
                    <Badge className="ml-auto bg-orange-500/15 text-orange-400 border-orange-500/30 text-xs">Primary</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300 mb-2 block">Entitled Features</Label>
                  <div className="flex flex-wrap gap-2">
                    {featureEntitlements.radar && (
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700"><Radio className="w-3 h-3 mr-1" /> Radar</Badge>
                    )}
                    {featureEntitlements.gps && (
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700"><MapPin className="w-3 h-3 mr-1" /> GPS</Badge>
                    )}
                    {featureEntitlements.vault && (
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700"><Lock className="w-3 h-3 mr-1" /> Vault</Badge>
                    )}
                    {featureEntitlements.risk_scoring && (
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700"><TrendingUp className="w-3 h-3 mr-1" /> Risk Scoring</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Locations (Super-Admin only) */}
          {step === 'locations' && isSuperAdmin && (
            <Card className="bg-slate-900/50 border-slate-800 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-orange-400" /> Multi-Location Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-400">
                  As a Super-Admin, you can add multiple facility locations. Each location can have its own staff and configurations.
                </p>

                <div className="space-y-2">
                  {locations.map((loc) => (
                    <div key={loc} className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 p-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-orange-400" />
                        <span className="text-sm text-white">{loc}</span>
                        {loc === primaryLocation && (
                          <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-xs">Primary</Badge>
                        )}
                      </div>
                      {loc !== primaryLocation && (
                        <Button variant="ghost" size="sm" onClick={() => removeLocation(loc)} className="text-slate-500 hover:text-red-400 text-xs">
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLocation()}
                    placeholder="e.g. Dallas, TX"
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                  <Button onClick={addLocation} variant="outline" className="border-slate-700 text-slate-300">
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Invites */}
          {step === 'team' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-orange-400" /> Invite Team Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-400">
                    {isSuperAdmin
                      ? 'Invite team members across your locations. Each member will receive a personalized email with a 72-hour activation link.'
                      : `Invite local site staff for ${primaryLocation}. Each member will receive a personalized email with a 72-hour activation link.`}
                  </p>

                  {/* Add Member Form */}
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-slate-300 mb-1 block text-xs">Name</Label>
                        <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Full name" className="bg-slate-900 border-slate-700 text-white h-9" />
                      </div>
                      <div>
                        <Label className="text-slate-300 mb-1 block text-xs">Email</Label>
                        <Input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="email@company.com" className="bg-slate-900 border-slate-700 text-white h-9" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-slate-300 mb-1 block text-xs">Functional Title</Label>
                        <Select value={memberTitle} onValueChange={handleTitleChange}>
                          <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {FUNCTIONAL_TITLES.map((t) => (
                              <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-300 mb-1 block text-xs">Role Template</Label>
                        <Select value={memberRole} onValueChange={(v) => handleRoleTemplateChange(v as TeamMember['role'])}>
                          <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {ROLE_TEMPLATES.map((t) => (
                              <SelectItem key={t.role} value={t.role}>
                                <span className="flex items-center gap-2">
                                  <t.icon className={`w-3.5 h-3.5 ${t.color}`} /> {t.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Location assignment (Super-Admin only) */}
                    {isSuperAdmin && (
                      <div>
                        <Label className="text-slate-300 mb-1.5 block text-xs">Assign to Locations</Label>
                        <div className="flex flex-wrap gap-2">
                          {locations.map((loc) => (
                            <button
                              key={loc}
                              onClick={() => {
                                const has = memberLocations.includes(loc);
                                setMemberLocations((prev) => has ? prev.filter((l) => l !== loc) : [...prev, loc]);
                              }}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                memberLocations.includes(loc)
                                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                                  : 'bg-slate-900 border-slate-700 text-slate-500'
                              }`}
                            >
                              <MapPin className="w-3 h-3 inline mr-1" />{loc}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button onClick={addTeamMember} disabled={!memberName.trim() || !memberEmail.trim()} className="w-full bg-slate-800 hover:bg-slate-700 text-white border-slate-700">
                      <Plus className="w-4 h-4 mr-1" /> Add Team Member
                    </Button>
                  </div>

                  {/* Member List */}
                  {teamMembers.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {teamMembers.length} Member{teamMembers.length !== 1 ? 's' : ''} to Invite
                      </div>
                      {teamMembers.map((m) => {
                        const template = ROLE_TEMPLATES.find((t) => t.role === m.role);
                        const RoleIcon = template?.icon || Users;
                        return (
                          <div key={m.id} className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800`}>
                                  <RoleIcon className={`h-4 w-4 ${template?.color || 'text-slate-400'}`} />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">{m.name}</div>
                                  <div className="text-xs text-slate-500">{m.email}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{m.functionalTitle}</Badge>
                                    {m.locations.length > 0 && (
                                      <span className="text-xs text-slate-500">{m.locations.join(', ')}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => removeTeamMember(m.id)} className="text-slate-500 hover:text-red-400 text-xs">
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {teamMembers.length === 0 && (
                    <div className="py-8 text-center text-slate-500">
                      <Users className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-sm">No team members added yet. You can skip this step and invite them later.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Permissions */}
          {step === 'permissions' && (
            <div className="max-w-3xl mx-auto space-y-4">
              {teamMembers.length === 0 ? (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-8 text-center">
                    <Shield className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No team members to configure. You can skip this step.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-400" /> Permission Overrides
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Role templates have been applied. Toggle individual permissions to customize access for each member.
                    </p>
                  </div>
                  {teamMembers.map((m) => {
                    const template = ROLE_TEMPLATES.find((t) => t.role === m.role);
                    const RoleIcon = template?.icon || Users;
                    return (
                      <Card key={m.id} className="bg-slate-900/50 border-slate-800">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                              <RoleIcon className={`h-4 w-4 ${template?.color}`} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{m.name}</div>
                              <div className="text-xs text-slate-500">{template?.label} · {m.email}</div>
                            </div>
                          </div>

                          {/* Permissions */}
                          <div className="grid grid-cols-2 gap-2">
                            {PERMISSION_FIELDS.map((field) => {
                              const Icon = field.icon;
                              const enabled = m.permissions[field.key];
                              return (
                                <div
                                  key={field.key}
                                  className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                                    enabled ? 'border-orange-500/30 bg-orange-500/5' : 'border-slate-800 bg-slate-950'
                                  }`}
                                  onClick={() => updateMemberPermission(m.id, field.key, !enabled)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className={`h-3.5 w-3.5 ${enabled ? 'text-orange-400' : 'text-slate-600'}`} />
                                    <span className={`text-xs ${enabled ? 'text-white' : 'text-slate-500'}`}>{field.label}</span>
                                  </div>
                                  <Switch checked={enabled} onCheckedChange={(v) => updateMemberPermission(m.id, field.key, v)} />
                                </div>
                              );
                            })}
                          </div>

                          {/* Location assignment (Super-Admin only) */}
                          {isSuperAdmin && (
                            <div className="mt-3 pt-3 border-t border-slate-800">
                              <div className="text-xs text-slate-500 mb-1.5">Assigned Locations</div>
                              <div className="flex flex-wrap gap-2">
                                {locations.map((loc) => (
                                  <button
                                    key={loc}
                                    onClick={() => updateMemberLocations(m.id, loc)}
                                    className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                                      m.locations.includes(loc)
                                        ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                                        : 'bg-slate-950 border-slate-800 text-slate-600'
                                    }`}
                                  >
                                    {loc}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Review */}
          {step === 'review' && (
            <Card className="bg-slate-900/50 border-slate-800 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Send className="h-5 w-5 text-orange-400" /> Review & Deploy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                  <div>
                    <div className="text-xs text-slate-500">Organization</div>
                    <div className="text-sm font-semibold text-white">{companyName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Locations ({locations.length})</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {locations.map((loc) => (
                        <Badge key={loc} variant="outline" className="text-xs border-slate-700 text-slate-300">
                          <MapPin className="w-3 h-3 mr-1" />{loc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Team Members ({teamMembers.length})</div>
                    {teamMembers.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {teamMembers.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                            <span className="text-slate-300">{m.name}</span>
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-500">{ROLE_TEMPLATES.find((t) => t.role === m.role)?.label}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 mt-1">No team members — you can invite them later.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-4">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-orange-300">
                      <p className="font-medium mb-1">Ready to deploy:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-orange-300/80">
                        {teamMembers.length > 0 && <li>{teamMembers.length} personalized welcome emails with 72-hour activation links</li>}
                        {isSuperAdmin && locations.length > existingLocations.length && <li>{locations.length - existingLocations.length} new location(s) will be added to {companyName}</li>}
                        <li>Your onboarding will be marked as complete</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={sendBatchInvites}
                  disabled={sendingInvites}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5"
                >
                  {sendingInvites ? (
                    <>Sending invites...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {teamMembers.length > 0 ? `Deploy & Send ${teamMembers.length} Invite${teamMembers.length !== 1 ? 's' : ''}` : 'Complete Onboarding'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Complete */}
          {step === 'complete' && (
            <Card className="bg-slate-900/50 border-slate-800 max-w-2xl mx-auto">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/30">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Onboarding Complete!</h2>
                <p className="text-slate-400 mb-6">
                  {inviteResults.length > 0
                    ? `${inviteResults.length} team member${inviteResults.length !== 1 ? 's have' : ' has'} been invited to ${companyName}.`
                    : `Your organization ${companyName} is now set up and ready to go.`}
                </p>

                {inviteResults.length > 0 && (
                  <div className="text-left space-y-2 mb-6">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invitation Status</div>
                    {inviteResults.map((m) => (
                      <div key={m.id} className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">{m.name}</div>
                            <div className="text-xs text-slate-500">{m.email}</div>
                          </div>
                          <Badge className={m.inviteSent ? 'bg-green-500/15 text-green-400 border-green-500/30 text-xs' : 'bg-red-500/15 text-red-400 border-red-500/30 text-xs'}>
                            {m.inviteSent ? 'Invite Sent' : 'Failed'}
                          </Badge>
                        </div>
                        {m.inviteSent && m.inviteToken && (
                          <div className="mt-2 pt-2 border-t border-slate-800">
                            <div className="text-xs text-slate-500 mb-1">Activation Link (72h):</div>
                            <div className="text-xs text-blue-300 font-mono break-all">
                              {typeof window !== 'undefined' ? `${window.location.origin}/accept-invite?token=${m.inviteToken}` : `/accept-invite?token=${m.inviteToken}`}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={onComplete} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                  Enter Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        {step !== 'welcome' && step !== 'complete' && (
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={goPrev} className="border-slate-700 text-slate-300">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button
              onClick={goNext}
              disabled={!canProceed()}
              className={isSuperAdmin ? 'bg-violet-500 hover:bg-violet-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'welcome' && (
          <div className="flex justify-end mt-6">
            <Button
              onClick={goNext}
              className={isSuperAdmin ? 'bg-violet-500 hover:bg-violet-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}
            >
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
