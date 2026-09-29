'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lock,
  Mail,
  Save,
  Send,
  Server,
  ShieldCheck,
  TestTube2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DEFAULT_EMAIL_CONFIG,
  TRIGGER_LABELS,
  loadEmailConfig,
  normalizeDeployedSiteUrl,
  profileIdToIdentity,
  saveEmailConfig,
  type EmailConfigState,
  type SenderProfileId,
  type TriggerKey,
} from '@/lib/crm/email-config';
import type { Company } from '@/lib/types';
import { cn } from '@/lib/utils';

type AccordionId = 'mailboxes' | 'profiles' | 'triggers' | 'portal' | 'smtp' | 'test';

interface CrmEmailConfigPanelProps {
  companies: Company[];
}

interface SentDialogState {
  open: boolean;
  title: string;
  detail: string;
  portalUrl?: string;
  ok: boolean;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function tlsLabel(_port: number, enabled: boolean): string {
  if (!enabled) return 'Disabled';
  // Match Bolt Email Config label; port 465 uses implicit SMTPS in transport.
  return 'Enabled (STARTTLS)';
}

export function CrmEmailConfigPanel({ companies }: CrmEmailConfigPanelProps) {
  const [cfg, setCfg] = useState<EmailConfigState>(DEFAULT_EMAIL_CONFIG);
  const [open, setOpen] = useState<Record<AccordionId, boolean>>({
    mailboxes: true,
    profiles: true,
    triggers: false,
    portal: true,
    smtp: true,
    test: true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('welcome@fleetvu.org');
  const [testCompanyId, setTestCompanyId] = useState('');
  const [seatLimit, setSeatLimit] = useState('25');
  const [testing, setTesting] = useState(false);
  const [sentDialog, setSentDialog] = useState<SentDialogState>({
    open: false,
    title: '',
    detail: '',
    ok: true,
  });

  useEffect(() => {
    setCfg(loadEmailConfig());
  }, []);

  const toggle = (id: AccordionId) =>
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const showResult = (state: Omit<SentDialogState, 'open'>) => {
    setSentDialog({ ...state, open: true });
    setMsg(state.ok ? state.detail : state.detail);
  };

  const persistSmtp = () => {
    setSaving(true);
    const next = {
      ...cfg,
      smtp: {
        ...cfg.smtp,
        host: cfg.smtp.host.trim(),
        username: cfg.smtp.username.trim(),
        password: cfg.smtp.password.trim(),
        defaultFromEmail: cfg.smtp.defaultFromEmail.trim(),
        defaultDisplayName: cfg.smtp.defaultDisplayName.trim(),
      },
    };
    setCfg(next);
    saveEmailConfig(next);
    setMsg(
      next.liveEnabled
        ? 'SMTP config saved · EMAILS WILL BE SENT VIA LIVE SMTP'
        : 'SMTP config saved · LIVE is off (server env / dry-run).',
    );
    setSaving(false);
    setTimeout(() => setMsg(null), 3500);
  };

  const persistAll = () => {
    setSaving(true);
    saveEmailConfig(cfg);
    setMsg('Email configuration saved.');
    setSaving(false);
    setTimeout(() => setMsg(null), 2500);
  };

  const updateProfile = (
    id: SenderProfileId,
    patch: Partial<{ fromAddress: string; displayName: string }>,
  ) => {
    setCfg((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const smtpPayload = () => {
    const welcome = cfg.profiles.find((p) => p.id === 'welcome');
    return {
      host: cfg.smtp.host.trim(),
      port: cfg.smtp.port,
      tlsEnabled: cfg.smtp.tlsEnabled,
      username: cfg.smtp.username.trim(),
      password: cfg.smtp.password.trim(),
      fromEmail: (welcome?.fromAddress || cfg.smtp.defaultFromEmail).trim(),
      fromDisplayName: (welcome?.displayName || cfg.smtp.defaultDisplayName).trim(),
    };
  };

  const sendTestWelcome = async () => {
    if (!testTo.trim()) {
      showResult({
        ok: false,
        title: 'Recipient required',
        detail: 'Enter a recipient email before sending.',
      });
      return;
    }
    const company = companies.find((c) => c.id === testCompanyId) || companies[0] || null;
    const organizationName = company?.name || 'FleetVu Test Fleet';
    const contactName = company?.sales_rep || 'Fleet Partner';
    if (cfg.liveEnabled && !cfg.smtp.password.trim()) {
      showResult({
        ok: false,
        title: 'SMTP password required',
        detail:
          'LIVE is on. Enter the SMTP password used on Bolt (mail.fleetvu.org / welcome@fleetvu.org), Save SMTP Config, then retry.',
      });
      return;
    }

    setTesting(true);
    setMsg(null);
    try {
      const seats = Math.max(1, Math.min(500, parseInt(seatLimit, 10) || 25));
      const token = generateToken();
      const configured = normalizeDeployedSiteUrl(cfg.deployedSiteUrl);
      // Keep portal on this same app when testing locally so Excel upload is available.
      const runtimeOrigin =
        typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';
      const isLocalDev =
        Boolean(runtimeOrigin) &&
        /localhost|127\.0\.0\.1|webcontainer|local-credentialless/i.test(runtimeOrigin);
      const appBase = isLocalDev ? runtimeOrigin : configured;

      const res = await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'WELCOME_ROSTER_PORTAL',
          to_email: testTo.trim(),
          to_name: contactName,
          organization_name: organizationName,
          roster_token: token,
          driver_seat_limit: seats,
          company_id: company?.id ?? null,
          app_base_url: appBase,
          live: cfg.liveEnabled,
          smtp_override: cfg.liveEnabled ? smtpPayload() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');

      const provider = data.dispatch?.provider || (cfg.liveEnabled ? 'smtp' : 'dispatch');
      const portalUrl = data.portal_url || `${appBase}/portal?token=${token}`;
      showResult({
        ok: true,
        title: 'Welcome email sent',
        detail: `${data.message || `Sent to ${testTo}`} · via ${provider}${
          data.dispatch?.providerMessageId ? ` · id ${data.dispatch.providerMessageId}` : ''
        }\n\nOpen the roster link below (same link as in the email). Keep this app running if the link uses localhost.`,
        portalUrl,
      });
    } catch (err) {
      showResult({
        ok: false,
        title: 'Welcome email failed',
        detail: err instanceof Error ? err.message : 'Failed to send welcome email',
      });
    } finally {
      setTesting(false);
    }
  };

  const testSmtp = async () => {
    if (!cfg.smtp.host || !cfg.smtp.username || !cfg.smtp.password) {
      showResult({
        ok: false,
        title: 'SMTP incomplete',
        detail: 'Host, username, and password are required to test the connection.',
      });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'TEST_SMTP_CONNECTION', smtp: smtpPayload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SMTP test failed');
      showResult({
        ok: true,
        title: 'SMTP connection verified',
        detail: data.message || `Connected to ${cfg.smtp.host}:${cfg.smtp.port}`,
      });
    } catch (err) {
      showResult({
        ok: false,
        title: 'SMTP connection failed',
        detail: err instanceof Error ? err.message : 'Could not reach SMTP server.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto space-y-3 pr-1">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-200">Zero-Access Boundary Enforced</p>
          <p className="text-[11px] text-emerald-100/70 leading-relaxed mt-0.5">
            No PII beyond commercial contacts, telemetry, safety videos, or incident data are visible here.
            Welcome / keycode mail is operational only.
          </p>
        </div>
      </div>

      {msg && (
        <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">{msg}</div>
      )}

      <Accordion
        title="Active Mailboxes"
        open={open.mailboxes}
        onToggle={() => toggle('mailboxes')}
        icon={<Mail className="w-4 h-4 text-orange-400" />}
      >
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <MailboxCard label="Compliance" address="safetyreport@fleetvu.org" />
          <MailboxCard label="Welcome" address="welcome@fleetvu.org" />
          <MailboxCard label="Notices" address="notices@fleetvu.org" />
        </div>
      </Accordion>

      <Accordion
        title="Sender Profiles"
        open={open.profiles}
        onToggle={() => toggle('profiles')}
        icon={<ShieldCheck className="w-4 h-4 text-orange-400" />}
      >
        <div className="space-y-3">
          {cfg.profiles.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
              <div className="text-xs font-bold text-white">{p.label}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-400">From Address</Label>
                  <Input
                    className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
                    value={p.fromAddress}
                    onChange={(e) => updateProfile(p.id, { fromAddress: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-400">Display Name</Label>
                  <Input
                    className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
                    value={p.displayName}
                    onChange={(e) => updateProfile(p.id, { displayName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion
        title="Trigger Routing"
        open={open.triggers}
        onToggle={() => toggle('triggers')}
        icon={<Send className="w-4 h-4 text-orange-400" />}
      >
        <div className="space-y-2">
          {(Object.keys(TRIGGER_LABELS) as TriggerKey[]).map((key) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2"
            >
              <span className="text-xs text-slate-300">{TRIGGER_LABELS[key]}</span>
              <select
                className="h-8 rounded-md bg-slate-950 border border-slate-700 text-xs text-white px-2"
                value={cfg.triggers[key]}
                onChange={(e) =>
                  setCfg((prev) => ({
                    ...prev,
                    triggers: { ...prev.triggers, [key]: e.target.value as SenderProfileId },
                  }))
                }
              >
                {cfg.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className="text-[10px] text-slate-500 pt-1">
            Welcome &amp; Onboarding → {profileIdToIdentity(cfg.triggers.welcome_onboarding)}@fleetvu.org · Driver
            Keycodes → {profileIdToIdentity(cfg.triggers.driver_keycodes)}@fleetvu.org
          </p>
        </div>
      </Accordion>

      <Accordion
        title="Portal URL"
        open={open.portal}
        onToggle={() => toggle('portal')}
        icon={<Zap className="w-4 h-4 text-orange-400" />}
      >
        <Field label="Deployed Site URL">
          <Input
            className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
            value={cfg.deployedSiteUrl}
            onChange={(e) => setCfg((p) => ({ ...p, deployedSiteUrl: e.target.value }))}
            placeholder="https://app.fleetvu.org"
          />
        </Field>
        <p className="text-[10px] text-slate-500 mt-2">
          Base URL for email action links (roster portal, renewals). Welcome links use{' '}
          <span className="text-sky-300 font-mono">/portal?token=…</span>. Test sends from local /
          Bolt preview automatically use this browser&apos;s origin so Excel upload is available;
          production mail should keep <span className="text-sky-300 font-mono">https://app.fleetvu.org</span>{' '}
          after that site is redeployed with the latest portal.
        </p>
      </Accordion>

      <Accordion
        title="SMTP Transport"
        open={open.smtp}
        onToggle={() => toggle('smtp')}
        icon={<Server className="w-4 h-4 text-orange-400" />}
        headerRight={
          <div className="flex items-center gap-2 mr-2" onClick={(e) => e.stopPropagation()}>
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wide',
                cfg.liveEnabled ? 'text-emerald-400' : 'text-slate-500',
              )}
            >
              {cfg.liveEnabled ? 'LIVE' : 'OFF'}
            </span>
            <Switch
              checked={cfg.liveEnabled}
              onCheckedChange={(v) => setCfg((p) => ({ ...p, liveEnabled: v }))}
            />
          </div>
        }
      >
        <p className="text-[11px] text-slate-400 mb-3">
          Live outbound email server credentials (matches Bolt: mail.fleetvu.org:465).
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="SMTP Host">
            <Input
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              value={cfg.smtp.host}
              onChange={(e) => setCfg((p) => ({ ...p, smtp: { ...p.smtp, host: e.target.value } }))}
            />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              value={cfg.smtp.port}
              onChange={(e) =>
                setCfg((p) => ({ ...p, smtp: { ...p.smtp, port: Number(e.target.value) || 465 } }))
              }
            />
          </Field>
          <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2.5">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Use TLS</div>
              <div
                className={cn(
                  'text-xs font-semibold mt-0.5',
                  cfg.smtp.tlsEnabled ? 'text-orange-400' : 'text-slate-500',
                )}
              >
                {tlsLabel(cfg.smtp.port, cfg.smtp.tlsEnabled)}
              </div>
            </div>
            <Switch
              checked={cfg.smtp.tlsEnabled}
              onCheckedChange={(v) => setCfg((p) => ({ ...p, smtp: { ...p.smtp, tlsEnabled: v } }))}
            />
          </div>
          <Field label="SMTP Username">
            <Input
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              value={cfg.smtp.username}
              onChange={(e) => setCfg((p) => ({ ...p, smtp: { ...p.smtp, username: e.target.value } }))}
            />
          </Field>
          <Field label="SMTP Password">
            <Input
              type="password"
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              value={cfg.smtp.password}
              onChange={(e) => setCfg((p) => ({ ...p, smtp: { ...p.smtp, password: e.target.value } }))}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          <Field label="From Email">
            <Input
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              value={cfg.smtp.defaultFromEmail}
              onChange={(e) =>
                setCfg((p) => ({ ...p, smtp: { ...p.smtp, defaultFromEmail: e.target.value } }))
              }
            />
          </Field>
          <Field label="From Display Name">
            <Input
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              value={cfg.smtp.defaultDisplayName}
              onChange={(e) =>
                setCfg((p) => ({ ...p, smtp: { ...p.smtp, defaultDisplayName: e.target.value } }))
              }
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            size="sm"
            className="h-8 text-xs bg-sky-600 hover:bg-sky-500"
            onClick={persistSmtp}
            disabled={saving}
          >
            <Save className="w-3.5 h-3.5 mr-1" /> Save SMTP Config
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-orange-500 hover:bg-orange-600"
            onClick={persistAll}
            disabled={saving}
          >
            <Save className="w-3.5 h-3.5 mr-1" /> Save Sender Config
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-600"
            onClick={testSmtp}
            disabled={testing}
          >
            <TestTube2 className="w-3.5 h-3.5 mr-1" /> Test SMTP Connection
          </Button>
          {cfg.liveEnabled && (
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
              Emails will be sent via LIVE SMTP
            </span>
          )}
        </div>
      </Accordion>

      <Accordion
        title="Send Test Welcome Email"
        open={open.test}
        onToggle={() => toggle('test')}
        icon={<Send className="w-4 h-4 text-amber-400" />}
      >
        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          Sends the Fleet Partner welcome email with an Access Roster Portal link at{' '}
          <span className="text-sky-300 font-mono">
            {normalizeDeployedSiteUrl(cfg.deployedSiteUrl)}/portal?token=…
          </span>
          . Customer account is optional for SMTP tests (uses &quot;FleetVu Test Fleet&quot; when empty). A
          confirmation dialog appears when the send completes.
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Recipient">
            <Input
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              placeholder="welcome@fleetvu.org"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </Field>
          <Field label="Customer Account (optional)">
            <select
              className="w-full h-8 rounded-md bg-slate-950 border border-slate-700 text-xs text-white px-2"
              value={testCompanyId}
              onChange={(e) => setTestCompanyId(e.target.value)}
            >
              <option value="">FleetVu Test Fleet (no CRM customer)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Driver Seat Limit">
            <Input
              className="h-8 bg-slate-950 border-slate-700 text-xs text-white"
              value={seatLimit}
              onChange={(e) => setSeatLimit(e.target.value)}
              placeholder="25"
            />
          </Field>
        </div>
        <Button
          className="mt-3 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold h-9 text-xs"
          onClick={sendTestWelcome}
          disabled={testing}
        >
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {testing ? 'Sending…' : 'Send Test Welcome Email'}
        </Button>
      </Accordion>

      <div className="flex justify-end pb-4">
        <Button className="bg-orange-500 hover:bg-orange-600 h-9 text-xs font-bold" onClick={persistAll}>
          <Save className="w-3.5 h-3.5 mr-1.5" /> Save All Email Config
        </Button>
      </div>

      <Dialog
        open={sentDialog.open}
        onOpenChange={(open) => setSentDialog((s) => ({ ...s, open }))}
      >
        <DialogContent className="bg-slate-950 border-slate-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {sentDialog.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Lock className="w-5 h-5 text-red-400" />
              )}
              {sentDialog.title}
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm pt-1 whitespace-pre-wrap">
              {sentDialog.detail}
            </DialogDescription>
          </DialogHeader>
          {sentDialog.portalUrl && (
            <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
              <div className="text-[10px] text-slate-500 uppercase mb-1">Roster portal link</div>
              <a
                href={sentDialog.portalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-sky-400 break-all hover:underline"
              >
                {sentDialog.portalUrl}
              </a>
            </div>
          )}
          <DialogFooter>
            <Button
              className={cn(
                'h-9 text-xs font-bold',
                sentDialog.ok ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600',
              )}
              onClick={() => setSentDialog((s) => ({ ...s, open: false }))}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  icon,
  children,
  headerRight,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-800/40"
      >
        {icon}
        <span className="text-sm font-bold text-white flex-1">{title}</span>
        {headerRight}
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-800/80 pt-3">{children}</div>}
    </div>
  );
}

function MailboxCard({ label, address }: { label: string; address: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
      <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
      <div className="text-xs text-amber-300 font-mono mt-0.5">{address}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
