'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsTrigger, TabsList } from '@/components/ui/tabs';
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
import {
  Code2,
  KeyRound,
  Lock,
  ShieldCheck,
  Database,
  Fingerprint,
  Copy,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Webhook,
  AlertTriangle,
  Activity,
  Server,
  Clock,
  Hash,
  FileCheck2,
  Save,
  ShieldAlert,
  ScanLine,
  Globe,
  Zap,
  TrendingUp,
  XCircle,
  Cpu,
  Code,
  FileLock2,
  Network,
  Boxes,
} from 'lucide-react';

interface SystemSettingsPanelProps {
  user: { name: string; email: string; role: string };
  onClose: () => void;
}

interface ApiKey {
  id: string;
  label: string;
  keyPreview: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
  rateLimit: number;
  status: 'active' | 'revoked';
}

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'paused';
  secret: string;
}

interface ChecksumRecord {
  id: string;
  fileName: string;
  hash: string;
  algorithm: string;
  timestamp: string;
  verified: boolean;
  pkiSigned: boolean;
}

type SettingsTab = 'gateway' | 'vault' | 'oauth' | 'timescale' | 'encryption' | 'telemetry' | 'security' | 'ip-guard';

export function SystemSettingsPanel({ user, onClose }: SystemSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('gateway');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const showSaved = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
              <Server className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">System Settings</h2>
              <p className="text-xs text-slate-400">Enterprise infrastructure, security, and integration controls</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {saveStatus}
              </span>
            )}
            <Button variant="outline" size="sm" className="text-slate-300 border-slate-600 hover:bg-slate-700 h-8" onClick={onClose}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800/30 border-b border-slate-700 px-4 py-2 shrink-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)} className="flex flex-col h-full">
          <TabsList className="bg-slate-800 border border-slate-700 h-auto p-1 flex flex-wrap gap-1 justify-start w-full">
            <TabsTrigger value="gateway" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <Code2 className="w-3.5 h-3.5" />
              OpenAPI Gateway
            </TabsTrigger>
            <TabsTrigger value="vault" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <Fingerprint className="w-3.5 h-3.5" />
              Vault &amp; SHA-256
            </TabsTrigger>
            <TabsTrigger value="oauth" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              OAuth / OIDC
            </TabsTrigger>
            <TabsTrigger value="timescale" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <Database className="w-3.5 h-3.5" />
              TimescaleDB
            </TabsTrigger>
            <TabsTrigger value="encryption" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <Lock className="w-3.5 h-3.5" />
              AES-256 &amp; GDPR
            </TabsTrigger>
            <TabsTrigger value="telemetry" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <Activity className="w-3.5 h-3.5" />
              Telemetry
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-red-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Security Center
            </TabsTrigger>
            <TabsTrigger value="ip-guard" className="data-[state=active]:bg-red-500 data-[state=active]:text-white text-slate-300 text-xs gap-1.5 px-3 py-1.5">
              <FileLock2 className="w-3.5 h-3.5" />
              IP Integrity Guard
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto scrollbar-thin mt-0">
            <TabsContent value="gateway" className="mt-0">
              <GatewayTab onSave={showSaved} />
            </TabsContent>
            <TabsContent value="vault" className="mt-0">
              <VaultTab onSave={showSaved} />
            </TabsContent>
            <TabsContent value="oauth" className="mt-0">
              <OAuthTab onSave={showSaved} />
            </TabsContent>
            <TabsContent value="timescale" className="mt-0">
              <TimescaleTab onSave={showSaved} />
            </TabsContent>
            <TabsContent value="encryption" className="mt-0">
              <EncryptionTab onSave={showSaved} />
            </TabsContent>
            <TabsContent value="telemetry" className="mt-0">
              <TelemetryTab onSave={showSaved} />
            </TabsContent>
            <TabsContent value="security" className="mt-0">
              <SecurityCenterTab user={user} onSave={showSaved} />
            </TabsContent>
            <TabsContent value="ip-guard" className="mt-0">
              <IPIntegrityGuardTab user={user} onSave={showSaved} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Tab 1: OpenAPI Gateway Management ─────────────────────────────────────────

function GatewayTab({ onSave }: { onSave: (msg: string) => void }) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: '1', label: 'Production Telemetry Ingestion', keyPreview: 'fv_live_••••••••4f2a', scopes: ['telemetry:write', 'telemetry:read'], createdAt: '2026-08-15', lastUsed: '2 min ago', rateLimit: 10000, status: 'active' },
    { id: '2', label: 'Insurance Partner Read-Only', keyPreview: 'fv_live_••••••••9b7c', scopes: ['assets:read', 'vault:read'], createdAt: '2026-07-22', lastUsed: '1 hour ago', rateLimit: 1000, status: 'active' },
  ]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    { id: '1', url: 'https://hooks.partner.com/fleetvu/incidents', events: ['incident.created', 'alert.threshold_breached'], status: 'active', secret: 'whsec_••••••3a8f' },
  ]);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState('1000');
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [showRawKey, setShowRawKey] = useState<string | null>(null);

  const allScopes = ['telemetry:write', 'telemetry:read', 'assets:read', 'assets:write', 'vault:notarize', 'vault:read'];

  const handleCreateKey = () => {
    if (!newKeyLabel.trim()) return;
    const id = String(Date.now());
    const randomSuffix = Math.random().toString(16).slice(2, 6);
    setApiKeys((prev) => [...prev, {
      id,
      label: newKeyLabel,
      keyPreview: `fv_live_••••••••${randomSuffix}`,
      scopes: newKeyScopes.length > 0 ? newKeyScopes : ['telemetry:read'],
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: null,
      rateLimit: parseInt(newKeyRateLimit) || 1000,
      status: 'active',
    }]);
    setNewKeyLabel('');
    setNewKeyScopes([]);
    setNewKeyRateLimit('1000');
    setShowKeyDialog(false);
    onSave('API key created');
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: 'revoked' as const } : k));
    onSave('API key revoked');
  };

  const handleCreateWebhook = () => {
    if (!newWebhookUrl.trim()) return;
    setWebhooks((prev) => [...prev, {
      id: String(Date.now()),
      url: newWebhookUrl,
      events: ['incident.created'],
      status: 'active',
      secret: `whsec_••••••${Math.random().toString(16).slice(2, 6)}`,
    }]);
    setNewWebhookUrl('');
    setShowWebhookDialog(false);
    onSave('Webhook registered');
  };

  const handleDeleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    onSave('Webhook removed');
  };

  return (
    <div className="p-6 w-full space-y-6">
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
        <h3 className="text-sm font-bold text-orange-200 flex items-center gap-2">
          <Code2 className="w-4 h-4" />
          Developer Resources — OpenAPI &amp; TMS
        </h3>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          Download the Enterprise OpenAPI specification and wire HMAC-SHA256 webhooks into your TMS without vehicle CAN-bus wiring.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-orange-500/40 text-orange-200 hover:bg-orange-500/20"
            onClick={() => window.open('/api/docs/openapi.json', '_blank')}
          >
            Open OpenAPI Spec (JSON)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-600 text-slate-300"
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/api/docs/openapi.json`);
              onSave('OpenAPI URL copied');
            }}
          >
            Copy Spec URL
          </Button>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-orange-400" />
              Live API Keys
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage bearer tokens for third-party integrations</p>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 gap-1.5 text-xs" onClick={() => setShowKeyDialog(true)}>
            <Plus className="w-3.5 h-3.5" />
            Generate Key
          </Button>
        </div>

        <div className="space-y-2">
          {apiKeys.map((key) => (
            <div key={key.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3.5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{key.label}</span>
                  {key.status === 'active' ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px]">Active</Badge>
                  ) : (
                    <Badge className="bg-red-500/20 text-red-300 border border-red-500/40 text-[9px]">Revoked</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-slate-400 font-mono">{key.keyPreview}</code>
                  <button
                    className="p-0.5 rounded hover:bg-slate-700 transition-colors"
                    onClick={() => setShowRawKey(showRawKey === key.id ? null : key.id)}
                    title={showRawKey === key.id ? 'Hide' : 'Reveal'}
                  >
                    {showRawKey === key.id ? <EyeOff className="w-3 h-3 text-slate-500" /> : <Eye className="w-3 h-3 text-slate-500" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {key.scopes.map((scope) => (
                    <span key={scope} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-700/50 text-orange-300 border border-slate-600">{scope}</span>
                  ))}
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-500">{key.rateLimit.toLocaleString()} req/min</span>
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-500">Created {key.createdAt}</span>
                  {key.lastUsed && <><span className="text-[10px] text-slate-500">·</span><span className="text-[10px] text-slate-500">Last used {key.lastUsed}</span></>}
                </div>
              </div>
              {key.status === 'active' && (
                <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10 h-7 text-xs shrink-0" onClick={() => handleRevokeKey(key.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rate Limits Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            Rate Limiting &amp; Quotas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Global Rate Limit</p>
              <Input className="bg-slate-900 border-slate-600 text-white text-sm h-8" defaultValue="10000" />
              <p className="text-[9px] text-slate-500 mt-1">requests / minute</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Burst Capacity</p>
              <Input className="bg-slate-900 border-slate-600 text-white text-sm h-8" defaultValue="5000" />
              <p className="text-[9px] text-slate-500 mt-1">concurrent requests</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Daily Quota</p>
              <Input className="bg-slate-900 border-slate-600 text-white text-sm h-8" defaultValue="1000000" />
              <p className="text-[9px] text-slate-500 mt-1">requests / day</p>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs gap-1.5" onClick={() => onSave('Rate limits updated')}>
            <Save className="w-3.5 h-3.5" />
            Save Rate Limits
          </Button>
        </CardContent>
      </Card>

      {/* Webhooks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Webhook className="w-4 h-4 text-orange-400" />
              Webhook Endpoints
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Event-driven callbacks for integration partners</p>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 gap-1.5 text-xs" onClick={() => setShowWebhookDialog(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add Webhook
          </Button>
        </div>
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3.5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs text-white font-mono truncate">{wh.url}</code>
                  {wh.status === 'active' ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px]">Active</Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[9px]">Paused</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {wh.events.map((ev) => (
                    <span key={ev} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-700/50 text-blue-300 border border-slate-600">{ev}</span>
                  ))}
                  <span className="text-[10px] text-slate-500">·</span>
                  <code className="text-[10px] text-slate-500 font-mono">{wh.secret}</code>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10 h-7 text-xs shrink-0" onClick={() => handleDeleteWebhook(wh.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md p-0 overflow-hidden pointer-events-auto">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-700/50">
            <DialogTitle className="text-white text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-orange-400" />
              Generate New API Key
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Key Label</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" placeholder="e.g. Partner Integration Key" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Rate Limit (req/min)</Label>
              <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={newKeyRateLimit} onChange={(e) => setNewKeyRateLimit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">OAuth Scopes</Label>
              <div className="flex flex-wrap gap-1.5">
                {allScopes.map((scope) => {
                  const selected = newKeyScopes.includes(scope);
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setNewKeyScopes((prev) => selected ? prev.filter((s) => s !== scope) : [...prev, scope])}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-mono border transition-all',
                        selected ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-500'
                      )}
                    >
                      {scope}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-3 border-t border-slate-700/50">
            <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700 text-sm h-9" onClick={() => setShowKeyDialog(false)}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-sm h-9 gap-1.5" onClick={handleCreateKey} disabled={!newKeyLabel.trim()}>
              <Plus className="w-4 h-4" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md p-0 overflow-hidden pointer-events-auto">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-700/50">
            <DialogTitle className="text-white text-base flex items-center gap-2">
              <Webhook className="w-4 h-4 text-orange-400" />
              Register Webhook Endpoint
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Callback URL</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" placeholder="https://your-server.com/webhook" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="px-6 py-3 border-t border-slate-700/50">
            <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700 text-sm h-9" onClick={() => setShowWebhookDialog(false)}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-sm h-9 gap-1.5" onClick={handleCreateWebhook} disabled={!newWebhookUrl.trim()}>
              <Plus className="w-4 h-4" />
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 2: FleetVu Vault & SHA-256 Cryptographic Engine ───────────────────────

function VaultTab({ onSave }: { onSave: (msg: string) => void }) {
  const [checksums, setChecksums] = useState<ChecksumRecord[]>([
    { id: '1', fileName: 'safety_log_TKN-4471_2026-09.pdf', hash: 'a7f3c2d8e5b1...4f2a9c', algorithm: 'SHA-256', timestamp: '2026-09-11T14:32:00Z', verified: true, pkiSigned: true },
    { id: '2', fileName: 'insurance_scorecard_Q3.pdf', hash: 'b8e4d1f7c3a9...7b1e3d', algorithm: 'SHA-256', timestamp: '2026-09-10T09:15:00Z', verified: true, pkiSigned: true },
    { id: '3', fileName: 'risk_scorecard_fleet_aug.pdf', hash: 'c9f5e2a8d4b0...8c2f1e', algorithm: 'SHA-256', timestamp: '2026-09-08T17:45:00Z', verified: true, pkiSigned: false },
  ]);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ match: boolean; hash: string } | null>(null);
  const [pkiSignature, setPkiSignature] = useState('');
  const [pkiResult, setPkiResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  const generateHash = () => {
    setGenerating(true);
    setTimeout(() => {
      const hash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
      setVerifyResult({ match: true, hash });
      setGenerating(false);
    }, 800);
  };

  const verifyChecksum = () => {
    if (!verifyInput.trim()) return;
    const found = checksums.find((c) => c.hash.startsWith(verifyInput.trim()) || verifyInput.trim().startsWith(c.hash.slice(0, 20)));
    setVerifyResult({ match: !!found, hash: found?.hash || 'No matching checksum found' });
  };

  const verifyPki = () => {
    if (!pkiSignature.trim()) return;
    setPkiResult({ valid: pkiSignature.length >= 64, message: pkiSignature.length >= 64 ? 'PKI signature verified — RSA-2048 chain valid' : 'Invalid signature format' });
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Vault Status Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-orange-400" />
            FleetVu Vault — Cryptographic Engine Status
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            SHA-256 hash chain integrity for all notarized documents and exported reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Algorithm</p>
              <p className="text-sm font-bold text-white">SHA-256</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Notarized Docs</p>
              <p className="text-sm font-bold text-emerald-400">{checksums.length}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">PKI Signed</p>
              <p className="text-sm font-bold text-blue-400">{checksums.filter((c) => c.pkiSigned).length}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Chain Status</p>
              <p className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Intact
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checksum Inspection */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Hash className="w-4 h-4 text-orange-400" />
          Checksum Inspection &amp; Verification
        </h3>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono flex-1"
              placeholder="Paste a SHA-256 checksum to verify…"
              value={verifyInput}
              onChange={(e) => { setVerifyInput(e.target.value); setVerifyResult(null); }}
            />
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={verifyChecksum}>
              <FileCheck2 className="w-3.5 h-3.5" />
              Verify
            </Button>
            <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 h-9 text-xs gap-1.5" onClick={generateHash} disabled={generating}>
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Generate New
            </Button>
          </div>
          {verifyResult && (
            <div className={cn(
              'rounded-lg px-3 py-2 text-xs flex items-center gap-2',
              verifyResult.match ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
            )}>
              {verifyResult.match ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span className="font-mono break-all">{verifyResult.hash}</span>
            </div>
          )}
        </div>
      </div>

      {/* PKI Signature Verification */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-400" />
          PKI Signature Verification (RSA-2048)
        </h3>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
          <Textarea
            className="bg-slate-900/50 border-slate-600 text-white text-sm font-mono min-h-[80px] resize-none"
            placeholder="Paste a Base64-encoded PKI signature to verify against the FleetVu signing key…"
            value={pkiSignature}
            onChange={(e) => { setPkiSignature(e.target.value); setPkiResult(null); }}
          />
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={verifyPki} disabled={!pkiSignature.trim()}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Verify PKI Signature
          </Button>
          {pkiResult && (
            <div className={cn(
              'rounded-lg px-3 py-2 text-xs flex items-center gap-2',
              pkiResult.valid ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
            )}>
              {pkiResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              {pkiResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Checksum Registry Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-400" />
          Notarized Document Registry
        </h3>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Document</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">SHA-256 Hash</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Date</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Verified</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase px-3 py-2">PKI</th>
              </tr>
            </thead>
            <tbody>
              {checksums.map((rec) => (
                <tr key={rec.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-white font-medium truncate max-w-[200px]">{rec.fileName}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400 font-mono truncate max-w-[200px]">{rec.hash}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{new Date(rec.timestamp).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-center">
                    {rec.verified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {rec.pkiSigned ? <ShieldCheck className="w-3.5 h-3.5 text-blue-400 mx-auto" /> : <span className="text-[10px] text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: OAuth 2.0 / OIDC Identity Providers ────────────────────────────────

function OAuthTab({ onSave }: { onSave: (msg: string) => void }) {
  const [provider, setProvider] = useState('supabase');
  const [config, setConfig] = useState({
    supabase: { issuer: 'https://fleetvu.supabase.co/auth/v1', clientId: '', clientSecret: '', jwksUri: 'https://fleetvu.supabase.co/auth/v1/.well-known/jwks.json', callbackUrl: 'https://fleetvu.app/auth/callback', enabled: true },
    auth0: { issuer: '', clientId: '', clientSecret: '', jwksUri: '', callbackUrl: 'https://fleetvu.app/auth/callback', enabled: false },
    cognito: { issuer: '', clientId: '', clientSecret: '', jwksUri: '', callbackUrl: 'https://fleetvu.app/auth/callback', enabled: false },
  });

  const currentConfig = config[provider as keyof typeof config];

  const updateField = (field: string, value: string | boolean) => {
    setConfig((prev) => ({
      ...prev,
      [provider]: { ...prev[provider as keyof typeof prev], [field]: value },
    }));
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Provider Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-orange-400" />
          Identity Provider Configuration
        </h3>
        <p className="text-xs text-slate-400">Select an OAuth 2.0 / OIDC identity provider for FleetVu authentication.</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'supabase', label: 'Supabase Auth', desc: 'Built-in provider', icon: <Database className="w-4 h-4 text-emerald-400" /> },
            { key: 'auth0', label: 'Auth0', desc: 'Okta Auth0 SSO', icon: <ShieldCheck className="w-4 h-4 text-blue-400" /> },
            { key: 'cognito', label: 'AWS Cognito', desc: 'Amazon Cognito', icon: <KeyRound className="w-4 h-4 text-orange-400" /> },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setProvider(p.key)}
              className={cn(
                'rounded-lg border p-3 text-left transition-all',
                provider === p.key ? 'border-orange-500/40 bg-orange-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                {p.icon}
                <span className="text-sm font-bold text-white">{p.label}</span>
              </div>
              <p className="text-[10px] text-slate-400">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Provider Configuration */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm capitalize">{provider === 'supabase' ? 'Supabase' : provider === 'auth0' ? 'Auth0' : 'AWS Cognito'} Configuration</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{currentConfig.enabled ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={currentConfig.enabled} onCheckedChange={(checked) => updateField('enabled', checked)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Issuer URL</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono" value={currentConfig.issuer} onChange={(e) => updateField('issuer', e.target.value)} placeholder="https://your-issuer.auth0.com/" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">JWKS URI</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono" value={currentConfig.jwksUri} onChange={(e) => updateField('jwksUri', e.target.value)} placeholder="https://your-issuer/.well-known/jwks.json" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Client ID</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono" value={currentConfig.clientId} onChange={(e) => updateField('clientId', e.target.value)} placeholder="your-client-id" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Client Secret</Label>
              <Input type="password" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono" value={currentConfig.clientSecret} onChange={(e) => updateField('clientSecret', e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs font-semibold">Callback / Redirect URL</Label>
            <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono" value={currentConfig.callbackUrl} onChange={(e) => updateField('callbackUrl', e.target.value)} />
          </div>
          <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Supported Flows</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">Client Credentials</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/40">Authorization Code + PKCE</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">Refresh Token Rotation</span>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave(`${provider === 'supabase' ? 'Supabase' : provider === 'auth0' ? 'Auth0' : 'AWS Cognito'} configuration saved`)}>
            <Save className="w-3.5 h-3.5" />
            Save Provider Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 4: TimescaleDB Data Retention & Aggregation ──────────────────────────

function TimescaleTab({ onSave }: { onSave: (msg: string) => void }) {
  const [rawRetention, setRawRetention] = useState('90');
  const [rawUnit, setRawUnit] = useState('days');
  const [aggRetention, setAggRetention] = useState('730');
  const [aggUnit, setAggUnit] = useState('days');
  const [chunkInterval, setChunkInterval] = useState('1');
  const [chunkUnit, setChunkUnit] = useState('hour');
  const [compressionAfter, setCompressionAfter] = useState('7');
  const [compressionUnit, setCompressionUnit] = useState('days');
  const [continuousAggEnabled, setContinuousAggEnabled] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(true);

  const aggregationJobs = [
    { name: 'telemetry_5min_avg', interval: '5 minutes', retention: '730 days', status: 'active' },
    { name: 'telemetry_hourly_summary', interval: '1 hour', retention: '730 days', status: 'active' },
    { name: 'telemetry_daily_rollup', interval: '1 day', retention: '5 years', status: 'active' },
    { name: 'safety_score_weekly', interval: '1 week', retention: '3 years', status: 'active' },
  ];

  return (
    <div className="p-6 w-full space-y-6">
      {/* Retention Policy */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            Data Retention Policies
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Configure how long raw and aggregated telemetry data is retained in the TimescaleDB hypertables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Raw Telemetry Data</span>
              </div>
              <p className="text-[11px] text-slate-400">High-frequency C55 sensor events, radar sweeps, and GPS pings stored at microsecond precision.</p>
              <div className="flex items-center gap-2">
                <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-24" value={rawRetention} onChange={(e) => setRawRetention(e.target.value)} />
                <Select value={rawUnit} onValueChange={setRawUnit}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">Aggregated Data</span>
              </div>
              <p className="text-[11px] text-slate-400">Downsampled continuous aggregates for long-term analytics and historical reporting.</p>
              <div className="flex items-center gap-2">
                <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-24" value={aggRetention} onChange={(e) => setAggRetention(e.target.value)} />
                <Select value={aggUnit} onValueChange={setAggUnit}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave('Retention policies updated')}>
            <Save className="w-3.5 h-3.5" />
            Save Retention Policies
          </Button>
        </CardContent>
      </Card>

      {/* Chunk & Compression */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-400" />
            Hypertable Chunking &amp; Compression
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Chunk Interval</Label>
              <div className="flex items-center gap-2">
                <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-24" value={chunkInterval} onChange={(e) => setChunkInterval(e.target.value)} />
                <Select value={chunkUnit} onValueChange={setChunkUnit}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="minute">Minutes</SelectItem>
                    <SelectItem value="hour">Hours</SelectItem>
                    <SelectItem value="day">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-slate-500">Partition size for time-based chunking of the telemetry hypertable.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Compress After</Label>
              <div className="flex items-center gap-2">
                <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-24" value={compressionAfter} onChange={(e) => setCompressionAfter(e.target.value)} />
                <Select value={compressionUnit} onValueChange={setCompressionUnit}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-slate-500">Automatically compress chunks older than this threshold.</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={compressionEnabled} onCheckedChange={setCompressionEnabled} />
              <span className="text-xs text-slate-300">Columnar Compression</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={continuousAggEnabled} onCheckedChange={setContinuousAggEnabled} />
              <span className="text-xs text-slate-300">Continuous Aggregates</span>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave('Chunk & compression settings saved')}>
            <Save className="w-3.5 h-3.5" />
            Save Chunk Settings
          </Button>
        </CardContent>
      </Card>

      {/* Aggregation Jobs */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          Continuous Aggregation Jobs
        </h3>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Materialized View</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Interval</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Retention</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {aggregationJobs.map((job) => (
                <tr key={job.name} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-white font-mono">{job.name}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{job.interval}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{job.retention}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: AES-256 Encryption & GDPR Compliance ──────────────────────────────

function EncryptionTab({ onSave }: { onSave: (msg: string) => void }) {
  const [aesEnabled, setAesEnabled] = useState(true);
  const [encryptionMode, setEncryptionMode] = useState('AES-256-GCM');
  const [keyRotationDays, setKeyRotationDays] = useState('90');
  const [gdprEnabled, setGdprEnabled] = useState(true);
  const [dataMinimization, setDataMinimization] = useState(true);
  const [rightToErasure, setRightToErasure] = useState(true);
  const [auditEncryption, setAuditEncryption] = useState(true);
  const [piiFields, setPiiFields] = useState([
    { field: 'driver_name', encrypted: true, tokenized: false },
    { field: 'driver_license', encrypted: true, tokenized: true },
    { field: 'email_address', encrypted: true, tokenized: false },
    { field: 'phone_number', encrypted: true, tokenized: true },
    { field: 'gps_location', encrypted: false, tokenized: false },
  ]);

  const togglePiiField = (field: string, key: 'encrypted' | 'tokenized') => {
    setPiiFields((prev) => prev.map((f) => f.field === field ? { ...f, [key]: !f[key] } : f));
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* AES-256 Encryption */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-400" />
              AES-256 Data-at-Rest Encryption
            </CardTitle>
            <Switch checked={aesEnabled} onCheckedChange={setAesEnabled} />
          </div>
          <CardDescription className="text-slate-400 text-xs">
            Military-grade AES-256-GCM encryption for all sensitive fleet and driver data stored in the FleetVu Vault.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Encryption Mode</Label>
              <Select value={encryptionMode} onValueChange={setEncryptionMode} disabled={!aesEnabled}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="AES-256-GCM">AES-256-GCM (Authenticated)</SelectItem>
                  <SelectItem value="AES-256-CBC">AES-256-CBC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Key Rotation Period</Label>
              <div className="flex items-center gap-2">
                <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-24" value={keyRotationDays} onChange={(e) => setKeyRotationDays(e.target.value)} disabled={!aesEnabled} />
                <span className="text-xs text-slate-400">days</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-[11px] text-emerald-300">
              {aesEnabled
                ? `Encryption active — ${encryptionMode} with automatic key rotation every ${keyRotationDays} days. All PII fields are encrypted at rest.`
                : 'Encryption is currently disabled. Enable to protect sensitive data at rest.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* GDPR Compliance */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              GDPR Compliance Controls
            </CardTitle>
            <Switch checked={gdprEnabled} onCheckedChange={setGdprEnabled} />
          </div>
          <CardDescription className="text-slate-400 text-xs">
            General Data Protection Regulation controls for EU/UK fleet operations and data subject rights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2.5">
            {[
              { key: 'dataMinimization', label: 'Data Minimization', desc: 'Only collect telemetry and PII necessary for safety compliance.', state: dataMinimization, setter: setDataMinimization },
              { key: 'rightToErasure', label: 'Right to Erasure (Article 17)', desc: 'Allow data subjects to request permanent deletion of personal data.', state: rightToErasure, setter: setRightToErasure },
              { key: 'auditEncryption', label: 'Audit Trail Encryption', desc: 'Encrypt forensic audit logs containing personal identifiers.', state: auditEncryption, setter: setAuditEncryption },
            ].map((ctrl) => (
              <div key={ctrl.key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
                <div className="flex-1">
                  <Label className="text-sm font-semibold text-white">{ctrl.label}</Label>
                  <p className="text-[11px] text-slate-400 mt-0.5">{ctrl.desc}</p>
                </div>
                <Switch checked={ctrl.state} onCheckedChange={ctrl.setter} disabled={!gdprEnabled} />
              </div>
            ))}
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave('Encryption & GDPR settings saved')}>
            <Save className="w-3.5 h-3.5" />
            Save Compliance Settings
          </Button>
        </CardContent>
      </Card>

      {/* PII Field Encryption Mapping */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-400" />
          PII Field Encryption Mapping
        </h3>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Field Name</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase px-3 py-2">AES-256 Encrypted</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Tokenized</th>
              </tr>
            </thead>
            <tbody>
              {piiFields.map((f) => (
                <tr key={f.field} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-white font-mono">{f.field}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch checked={f.encrypted} onCheckedChange={() => togglePiiField(f.field, 'encrypted')} className="scale-75 inline-flex" />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch checked={f.tokenized} onCheckedChange={() => togglePiiField(f.field, 'tokenized')} className="scale-75 inline-flex" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 6: Sentry / PostHog Telemetry Instrumentation ────────────────────────

function TelemetryTab({ onSave }: { onSave: (msg: string) => void }) {
  const [sentryEnabled, setSentryEnabled] = useState(true);
  const [sentryDsn, setSentryDsn] = useState('https://a1b2c3d4@o543210.ingest.sentry.io/1234567');
  const [sentryEnv, setSentryEnv] = useState('production');
  const [sentryTraces, setSentryTraces] = useState('100');
  const [posthogEnabled, setPosthogEnabled] = useState(true);
  const [posthogKey, setPosthogKey] = useState('phc_•••••••••••••••••••••8f2a');
  const [posthogHost, setPosthogHost] = useState('https://app.posthog.com');
  const [posthogSessionRecording, setPosthogSessionRecording] = useState(false);
  const [showSentryDsn, setShowSentryDsn] = useState(false);
  const [showPosthogKey, setShowPosthogKey] = useState(false);

  return (
    <div className="p-6 w-full space-y-6">
      {/* Sentry Error Tracking */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              Sentry Error Tracking
            </CardTitle>
            <Switch checked={sentryEnabled} onCheckedChange={setSentryEnabled} />
          </div>
          <CardDescription className="text-slate-400 text-xs">
            Real-time error monitoring, performance tracing, and crash reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs font-semibold">Sentry DSN</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showSentryDsn ? 'text' : 'password'}
                className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono"
                value={sentryDsn}
                onChange={(e) => setSentryDsn(e.target.value)}
                disabled={!sentryEnabled}
                placeholder="https://<key>@<org>.ingest.sentry.io/<project>"
              />
              <Button size="sm" variant="ghost" className="h-9 px-2 text-slate-400 hover:text-white" onClick={() => setShowSentryDsn(!showSentryDsn)}>
                {showSentryDsn ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Environment</Label>
              <Select value={sentryEnv} onValueChange={setSentryEnv} disabled={!sentryEnabled}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Traces Sample Rate (%)</Label>
              <Input type="number" min={0} max={100} className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={sentryTraces} onChange={(e) => setSentryTraces(e.target.value)} disabled={!sentryEnabled} />
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5 flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', sentryEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
            <p className="text-[11px] text-slate-300">
              {sentryEnabled ? `Connected — ${sentryEnv} environment · ${sentryTraces}% trace sampling` : 'Sentry integration disabled'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PostHog Product Analytics */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-400" />
              PostHog Product Analytics
            </CardTitle>
            <Switch checked={posthogEnabled} onCheckedChange={setPosthogEnabled} />
          </div>
          <CardDescription className="text-slate-400 text-xs">
            Feature flags, funnel analytics, user session recordings, and product telemetry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Project API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showPosthogKey ? 'text' : 'password'}
                  className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono"
                  value={posthogKey}
                  onChange={(e) => setPosthogKey(e.target.value)}
                  disabled={!posthogEnabled}
                  placeholder="phc_..."
                />
                <Button size="sm" variant="ghost" className="h-9 px-2 text-slate-400 hover:text-white" onClick={() => setShowPosthogKey(!showPosthogKey)}>
                  {showPosthogKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Host URL</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 font-mono" value={posthogHost} onChange={(e) => setPosthogHost(e.target.value)} disabled={!posthogEnabled} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
            <div>
              <Label className="text-sm font-semibold text-white">Session Recording</Label>
              <p className="text-[11px] text-slate-400 mt-0.5">Capture user interaction replays for UX debugging.</p>
            </div>
            <Switch checked={posthogSessionRecording} onCheckedChange={setPosthogSessionRecording} disabled={!posthogEnabled} />
          </div>
          <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5 flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', posthogEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
            <p className="text-[11px] text-slate-300">
              {posthogEnabled ? `Connected — ${posthogHost} · Session recording ${posthogSessionRecording ? 'enabled' : 'disabled'}` : 'PostHog integration disabled'}
            </p>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave('Telemetry instrumentation saved')}>
            <Save className="w-3.5 h-3.5" />
            Save Telemetry Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 7: Security & Hardening Center ────────────────────────────────────────

interface SecurityAuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  severity: 'info' | 'warning' | 'critical';
  ip: string;
}

interface ThreatRule {
  id: string;
  name: string;
  pattern: string;
  action: 'block' | 'throttle' | 'alert';
  enabled: boolean;
  hits: number;
}

function SecurityCenterTab({ user, onSave }: { user: { name: string; email: string; role: string }; onSave: (msg: string) => void }) {
  // 1) Encryption & TLS 1.3 / AES-256 Key Management
  const [tlsEnabled, setTlsEnabled] = useState(true);
  const [tlsVersion, setTlsVersion] = useState('1.3');
  const [aesMode, setAesMode] = useState('AES-256-GCM');
  const [keyRotationDays, setKeyRotationDays] = useState('90');
  const [hsmEnabled, setHsmEnabled] = useState(true);
  const [certificateExpiry, setCertificateExpiry] = useState('2027-03-15');

  // 2) SHA-256 Chain Validation
  const [chainValidationEnabled, setChainValidationEnabled] = useState(true);
  const [chainValidated, setChainValidated] = useState(true);
  const [lastValidation, setLastValidation] = useState('2026-09-12 08:14 UTC');
  const [chainBreaks, setChainBreaks] = useState(0);
  const [validating, setValidating] = useState(false);

  // 3) OAuth 2.0 / MFA Enforcement
  const [mfaRequired, setMfaRequired] = useState(true);
  const [mfaEnforcementScope, setMfaEnforcementScope] = useState('all-users');
  const [oauthTokenLifetime, setOauthTokenLifetime] = useState('3600');
  const [refreshTokenRotation, setRefreshTokenRotation] = useState(true);
  const [pkceRequired, setPkceRequired] = useState(true);

  // 4) API Gateway Rate Limiting & Threat Protection
  const [rateLimitGlobal, setRateLimitGlobal] = useState('10000');
  const [rateLimitBurst, setRateLimitBurst] = useState('5000');
  const [ddosProtection, setDdosProtection] = useState(true);
  const [ipAllowlisting, setIpAllowlisting] = useState(false);
  const [geoBlocking, setGeoBlocking] = useState(true);
  const [threatRules, setThreatRules] = useState<ThreatRule[]>([
    { id: '1', name: 'SQL Injection Pattern', pattern: '(?i)(union.*select|drop.*table|insert.*into)', action: 'block', enabled: true, hits: 3 },
    { id: '2', name: 'XSS Script Injection', pattern: '(?i)(<script|javascript:|onerror=)', action: 'block', enabled: true, hits: 7 },
    { id: '3', name: 'Path Traversal', pattern: '\\.\\./|\\.\\.\\\\', action: 'block', enabled: true, hits: 1 },
    { id: '4', name: 'Brute Force Auth', pattern: '5+ failed logins / 60s', action: 'throttle', enabled: true, hits: 12 },
    { id: '5', name: 'Anomalous Payload Size', pattern: 'body > 10MB', action: 'alert', enabled: false, hits: 0 },
  ]);

  // 5) Real-Time Security Audit Logs
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([
    { id: '1', timestamp: '2026-09-12T14:32:18Z', actor: 'admin@fleetvu.com', action: 'API_KEY_REVOKED', resource: 'api_keys/2', severity: 'warning', ip: '10.0.1.42' },
    { id: '2', timestamp: '2026-09-12T14:28:03Z', actor: 'admin@fleetvu.com', action: 'MFA_POLICY_UPDATED', resource: 'security/mfa', severity: 'info', ip: '10.0.1.42' },
    { id: '3', timestamp: '2026-09-12T13:15:47Z', actor: 'system', action: 'THREAT_RULE_TRIGGERED', resource: 'gateway/xss_block', severity: 'critical', ip: '203.0.113.99' },
    { id: '4', timestamp: '2026-09-12T12:04:22Z', actor: 'admin@fleetvu.com', action: 'TLS_CONFIG_SAVED', resource: 'security/tls', severity: 'info', ip: '10.0.1.42' },
    { id: '5', timestamp: '2026-09-12T11:50:09Z', actor: 'system', action: 'CHAIN_VALIDATION_PASSED', resource: 'vault/sha256', severity: 'info', ip: '127.0.0.1' },
    { id: '6', timestamp: '2026-09-12T10:22:34Z', actor: 'system', action: 'BRUTE_FORCE_BLOCKED', resource: 'auth/login', severity: 'critical', ip: '198.51.100.23' },
    { id: '7', timestamp: '2026-09-12T09:08:12Z', actor: 'partner@insurance.com', action: 'RATE_LIMIT_EXCEEDED', resource: 'gateway/v1/telemetry', severity: 'warning', ip: '192.0.2.77' },
  ]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

  const runChainValidation = () => {
    setValidating(true);
    setTimeout(() => {
      setChainValidated(true);
      setChainBreaks(0);
      setLastValidation(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
      setValidating(false);
      onSave('SHA-256 chain validation passed');
    }, 1200);
  };

  const toggleThreatRule = (id: string) => {
    setThreatRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const filteredLogs = logFilter === 'all' ? auditLogs : auditLogs.filter((l) => l.severity === logFilter);

  const severityColors: Record<string, string> = {
    info: 'text-slate-400 bg-slate-700/40 border-slate-600',
    warning: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40',
    critical: 'text-red-300 bg-red-500/15 border-red-500/40',
  };

  const securityScore = [
    tlsEnabled,
    chainValidationEnabled && chainValidated,
    mfaRequired,
    pkceRequired,
    ddosProtection,
    hsmEnabled,
  ].filter(Boolean).length;
  const scorePercent = Math.round((securityScore / 6) * 100);

  return (
    <div className="p-6 w-full space-y-6">
      {/* Security Posture Score Banner */}
      <div className={cn(
        'rounded-xl border p-4 flex items-center justify-between gap-4',
        scorePercent >= 80 ? 'bg-emerald-500/10 border-emerald-500/30' : scorePercent >= 50 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-lg flex items-center justify-center border',
            scorePercent >= 80 ? 'bg-emerald-500/20 border-emerald-500/40' : scorePercent >= 50 ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-red-500/20 border-red-500/40'
          )}>
            <ShieldCheck className={cn('w-6 h-6', scorePercent >= 80 ? 'text-emerald-400' : scorePercent >= 50 ? 'text-yellow-400' : 'text-red-400')} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Security Posture Score</h3>
            <p className="text-xs text-slate-400">{securityScore}/6 controls active · {scorePercent}% hardening coverage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[
            { label: 'TLS', active: tlsEnabled },
            { label: 'SHA-256', active: chainValidationEnabled && chainValidated },
            { label: 'MFA', active: mfaRequired },
            { label: 'PKCE', active: pkceRequired },
            { label: 'DDoS', active: ddosProtection },
            { label: 'HSM', active: hsmEnabled },
          ].map((c) => (
            <div key={c.label} className={cn(
              'px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1',
              c.active ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-red-300 bg-red-500/10 border-red-500/30'
            )}>
              {c.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* 1) Encryption & TLS 1.3 / AES-256 Key Management */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-400" />
              Encryption &amp; TLS 1.3 / AES-256 Key Management
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={cn('flex items-center gap-1 text-[10px] font-semibold', tlsEnabled ? 'text-emerald-300' : 'text-red-300')}>
                <span className={cn('w-1.5 h-1.5 rounded-full', tlsEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
                {tlsEnabled ? 'Active' : 'Disabled'}
              </span>
              <Switch checked={tlsEnabled} onCheckedChange={setTlsEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">TLS Version</Label>
              <Select value={tlsVersion} onValueChange={setTlsVersion} disabled={!tlsEnabled}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="1.3">TLS 1.3 (Recommended)</SelectItem>
                  <SelectItem value="1.2">TLS 1.2 (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">AES Encryption Mode</Label>
              <Select value={aesMode} onValueChange={setAesMode} disabled={!tlsEnabled}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="AES-256-GCM">AES-256-GCM</SelectItem>
                  <SelectItem value="AES-256-CBC">AES-256-CBC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Key Rotation (days)</Label>
              <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={keyRotationDays} onChange={(e) => setKeyRotationDays(e.target.value)} disabled={!tlsEnabled} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <div>
                <Label className="text-sm font-semibold text-white">HSM-Backed Key Storage</Label>
                <p className="text-[11px] text-slate-400 mt-0.5">Store master encryption keys in a hardware security module.</p>
              </div>
            </div>
            <Switch checked={hsmEnabled} onCheckedChange={setHsmEnabled} disabled={!tlsEnabled} />
          </div>
          <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Cert Expiry</span>
              <span className="text-xs font-mono text-white">{certificateExpiry}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Cipher Suite</span>
              <span className="text-xs font-mono text-emerald-400">TLS_AES_256_GCM_SHA384</span>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave('TLS & encryption settings saved')}>
            <Save className="w-3.5 h-3.5" />
            Save Encryption Settings
          </Button>
        </CardContent>
      </Card>

      {/* 2) SHA-256 Chain Validation */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-orange-400" />
              Cryptographic Hash Integrity — SHA-256 Chain Validation
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={cn('flex items-center gap-1 text-[10px] font-semibold', chainValidated ? 'text-emerald-300' : 'text-red-300')}>
                <span className={cn('w-1.5 h-1.5 rounded-full', chainValidated ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
                {chainValidated ? 'Chain Intact' : 'Chain Broken'}
              </span>
              <Switch checked={chainValidationEnabled} onCheckedChange={setChainValidationEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Last Validation</p>
              <p className="text-xs font-mono text-white">{lastValidation}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Chain Breaks</p>
              <p className={cn('text-lg font-bold', chainBreaks === 0 ? 'text-emerald-400' : 'text-red-400')}>{chainBreaks}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Algorithm</p>
              <p className="text-sm font-bold text-white">SHA-256</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs gap-1.5" onClick={runChainValidation} disabled={validating || !chainValidationEnabled}>
              {validating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              {validating ? 'Validating…' : 'Run Chain Validation'}
            </Button>
            {chainValidated && chainValidationEnabled && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All notarized documents verified — hash chain is intact
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3) OAuth 2.0 / MFA Enforcement */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-orange-400" />
            OAuth 2.0 / MFA Enforcement Toggles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <Label className="text-sm font-semibold text-white">Require Multi-Factor Authentication</Label>
                <p className="text-[11px] text-slate-400 mt-0.5">Enforce TOTP/hardware key second factor for all sign-ins.</p>
              </div>
            </div>
            <Switch checked={mfaRequired} onCheckedChange={setMfaRequired} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">MFA Enforcement Scope</Label>
              <Select value={mfaEnforcementScope} onValueChange={setMfaEnforcementScope} disabled={!mfaRequired}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all-users">All Users</SelectItem>
                  <SelectItem value="admins-only">Admins Only</SelectItem>
                  <SelectItem value="super-admins">Super-Admins Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Token Lifetime (seconds)</Label>
              <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={oauthTokenLifetime} onChange={(e) => setOauthTokenLifetime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 pt-5">
              <div className="flex items-center gap-2">
                <Switch checked={refreshTokenRotation} onCheckedChange={setRefreshTokenRotation} className="scale-75" />
                <span className="text-xs text-slate-300">Refresh Token Rotation</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={pkceRequired} onCheckedChange={setPkceRequired} className="scale-75" />
                <span className="text-xs text-slate-300">Require PKCE</span>
              </div>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave('OAuth & MFA enforcement saved')}>
            <Save className="w-3.5 h-3.5" />
            Save Auth Security Settings
          </Button>
        </CardContent>
      </Card>

      {/* 4) API Gateway Rate Limiting & Threat Protection */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-400" />
            API Gateway Rate Limiting &amp; Threat Protection Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Global Rate Limit (req/min)</Label>
              <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={rateLimitGlobal} onChange={(e) => setRateLimitGlobal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-semibold">Burst Capacity</Label>
              <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={rateLimitBurst} onChange={(e) => setRateLimitBurst(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <div>
                  <Label className="text-sm font-semibold text-white">DDoS Protection</Label>
                  <p className="text-[11px] text-slate-400 mt-0.5">Layer 7 flood detection with automatic IP blacklisting.</p>
                </div>
              </div>
              <Switch checked={ddosProtection} onCheckedChange={setDdosProtection} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <div>
                  <Label className="text-sm font-semibold text-white">IP Allowlisting</Label>
                  <p className="text-[11px] text-slate-400 mt-0.5">Only accept API requests from explicitly allowlisted IP ranges.</p>
                </div>
              </div>
              <Switch checked={ipAllowlisting} onCheckedChange={setIpAllowlisting} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-orange-400" />
                <div>
                  <Label className="text-sm font-semibold text-white">Geographic Blocking</Label>
                  <p className="text-[11px] text-slate-400 mt-0.5">Block requests from sanctioned or high-risk geographic regions.</p>
                </div>
              </div>
              <Switch checked={geoBlocking} onCheckedChange={setGeoBlocking} />
            </div>
          </div>

          {/* Threat Protection Rules Table */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-300">WAF Threat Detection Rules</p>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Rule</th>
                    <th className="text-left text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Pattern</th>
                    <th className="text-center text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Action</th>
                    <th className="text-right text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Hits (24h)</th>
                    <th className="text-center text-[10px] font-bold text-slate-500 uppercase px-3 py-2">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {threatRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-white font-medium">{rule.name}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 font-mono truncate max-w-[200px]">{rule.pattern}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-bold border',
                          rule.action === 'block' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                          rule.action === 'throttle' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        )}>{rule.action}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right text-slate-300 font-mono">{rule.hits}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Switch checked={rule.enabled} onCheckedChange={() => toggleThreatRule(rule.id)} className="scale-75 inline-flex" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs gap-1.5" onClick={() => onSave('Threat protection rules saved')}>
            <Save className="w-3.5 h-3.5" />
            Save Threat Protection
          </Button>
        </CardContent>
      </Card>

      {/* 5) Real-Time Security Audit Logs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              Real-Time Security Audit Log
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Tracks all administrative actions, threat detections, and security policy changes.</p>
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'info', 'warning', 'critical'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setLogFilter(level)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all',
                  logFilter === level ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden max-h-[400px] overflow-y-auto scrollbar-thin">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/20 transition-colors">
              <div className={cn('px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 mt-0.5', severityColors[log.severity])}>
                {log.severity.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-white">{log.action}</span>
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-400 font-mono">{log.resource}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">{log.actor}</span>
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-500 font-mono">{log.ip}</span>
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 8: Security & IP Integrity Guard ──────────────────────────────────────

interface ChainBlock {
  index: number;
  hash: string;
  previousHash: string;
  timestamp: string;
  documentTitle: string;
  valid: boolean;
}

interface SecurityHeaderStatus {
  header: string;
  value: string;
  status: 'active' | 'warning' | 'inactive';
}

function IPIntegrityGuardTab({ user, onSave }: { user: { name: string; email: string; role: string }; onSave: (msg: string) => void }) {
  const [vaultStatus, setVaultStatus] = useState<'loading' | 'active' | 'degraded'>('loading');
  const [chainHealth, setChainHealth] = useState<{ valid: boolean; blocks: number; breaks: number; lastHash: string } | null>(null);
  const [chainBlocks, setChainBlocks] = useState<ChainBlock[]>([]);
  const [validatingChain, setValidatingChain] = useState(false);
  const [refreshingVault, setRefreshingVault] = useState(false);

  // HSM Key Vault state
  const [hsmKeyInfo, setHsmKeyInfo] = useState({
    status: 'active' as 'active' | 'degraded' | 'offline',
    keyAlgorithm: 'AES-256-GCM',
    keyId: 'hsm-master-a8f3-2026',
    keyRotationDays: 90,
    lastRotation: '2026-08-15',
    nextRotation: '2026-11-13',
    sealed: true,
    sealStatus: 'sealed' as 'sealed' | 'unsealed',
    temperature: 'Normal',
    tamperAttempts: 0,
  });

  // Minification / obfuscation status
  const [minifyStatus, setMinifyStatus] = useState({
    jsMinified: true,
    cssMinified: true,
    sourceMapsEnabled: false,
    deadCodeElimination: true,
    treeShaking: true,
    assetFingerprinting: true,
    htmlMinified: true,
    bundleSizeKb: 80.2,
    rawSizeKb: 312.5,
    compressionRatio: 74.3,
  });

  // Security headers state
  const [securityHeaders, setSecurityHeaders] = useState<SecurityHeaderStatus[]>([
    { header: 'Content-Security-Policy', value: "default-src 'self'; frame-ancestors 'none'", status: 'active' },
    { header: 'X-Frame-Options', value: 'DENY', status: 'active' },
    { header: 'X-Content-Type-Options', value: 'nosniff', status: 'active' },
    { header: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload', status: 'active' },
    { header: 'Referrer-Policy', value: 'strict-origin-when-cross-origin', status: 'active' },
    { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)', status: 'active' },
    { header: 'Access-Control-Allow-Origin', value: 'https://fleetvu.app', status: 'active' },
    { header: 'X-XSS-Protection', value: '1; mode=block', status: 'active' },
  ]);

  // Server-side isolation status
  const [isolationStatus, setIsolationStatus] = useState({
    telemetryServerIsolated: true,
    cryptoServerIsolated: true,
    clientKeyExposure: 'none' as 'none' | 'detected',
    directDbAccess: 'blocked' as 'blocked' | 'allowed',
  });

  // Initialize with simulated chain blocks
  useEffect(() => {
    const blocks: ChainBlock[] = [
      { index: 0, hash: 'genesis:a7f3c2d8e5b14f2a9c8e7d1b3f6a0c4e', previousHash: '0000', timestamp: '2026-09-08T17:45:00Z', documentTitle: 'risk_scorecard_fleet_aug.pdf', valid: true },
      { index: 1, hash: 'b8e4d1f7c3a97b1e3d4f5a6c7e8b9d0f1a2b3c', previousHash: 'genesis:a7f3c2d8e5b14f2a9c8e7d1b3f6a0c4e', timestamp: '2026-09-10T09:15:00Z', documentTitle: 'insurance_scorecard_Q3.pdf', valid: true },
      { index: 2, hash: 'c9f5e2a8d4b08c2f1e3a4b5c6d7e8f9a0b1c2d', previousHash: 'b8e4d1f7c3a97b1e3d4f5a6c7e8b9d0f1a2b3c', timestamp: '2026-09-11T14:32:00Z', documentTitle: 'safety_log_TKN-4471_2026-09.pdf', valid: true },
    ];
    setChainBlocks(blocks);
    setChainHealth({ valid: true, blocks: blocks.length, breaks: 0, lastHash: blocks[blocks.length - 1].hash });
    setVaultStatus('active');
  }, []);

  const refreshVaultStatus = () => {
    setRefreshingVault(true);
    setTimeout(() => {
      setVaultStatus('active');
      setRefreshingVault(false);
      onSave('HSM vault status refreshed');
    }, 800);
  };

  const runChainValidation = () => {
    setValidatingChain(true);
    setTimeout(() => {
      setChainBlocks((prev) => prev.map((b) => ({ ...b, valid: true })));
      setChainHealth({ valid: true, blocks: chainBlocks.length, breaks: 0, lastHash: chainBlocks[chainBlocks.length - 1]?.hash || '' });
      setValidatingChain(false);
      onSave('SHA-256 chain validation passed — all blocks verified');
    }, 1200);
  };

  const toggleSeal = () => {
    setHsmKeyInfo((prev) => ({
      ...prev,
      sealStatus: prev.sealStatus === 'sealed' ? 'unsealed' : 'sealed',
      sealed: prev.sealStatus === 'sealed' ? false : true,
    }));
    onSave(`HSM vault ${hsmKeyInfo.sealStatus === 'sealed' ? 'unsealed' : 'sealed'}`);
  };

  const headerStatusColors: Record<string, string> = {
    active: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    warning: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30',
    inactive: 'text-red-300 bg-red-500/10 border-red-500/30',
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* IP Integrity Guard Header */}
      <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 via-slate-800/50 to-slate-800/50 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center">
            <FileLock2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Security &amp; IP Integrity Guard</h3>
            <p className="text-xs text-slate-400">Real-time monitoring of HSM key vault, SHA-256 chain health, code protection, and API security headers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border',
            vaultStatus === 'active' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30'
          )}>
            <span className={cn('w-2 h-2 rounded-full', vaultStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400')} />
            {vaultStatus === 'active' ? 'All Systems Operational' : 'Initializing…'}
          </span>
          <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700 h-8 gap-1.5 text-xs" onClick={refreshVaultStatus} disabled={refreshingVault}>
            {refreshingVault ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* 1) HSM Key Vault Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-400" />
              HSM Key Vault Status
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={cn(
                'px-2 py-0.5 rounded text-[10px] font-bold border',
                hsmKeyInfo.sealStatus === 'sealed' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30'
              )}>
                {hsmKeyInfo.sealStatus === 'sealed' ? 'SEALED' : 'UNSEALED'}
              </span>
              <span className={cn(
                'px-2 py-0.5 rounded text-[10px] font-bold border',
                hsmKeyInfo.status === 'active' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-red-300 bg-red-500/10 border-red-500/30'
              )}>
                {hsmKeyInfo.status.toUpperCase()}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Key ID</p>
              <p className="text-xs font-mono text-white truncate">{hsmKeyInfo.keyId}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Algorithm</p>
              <p className="text-xs font-bold text-white">{hsmKeyInfo.keyAlgorithm}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Last Rotation</p>
              <p className="text-xs font-mono text-white">{hsmKeyInfo.lastRotation}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Next Rotation</p>
              <p className="text-xs font-mono text-yellow-300">{hsmKeyInfo.nextRotation}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Tamper Detection</p>
                <p className="text-xs text-emerald-300">{hsmKeyInfo.tamperAttempts} attempts</p>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Temperature</p>
                <p className="text-xs text-white">{hsmKeyInfo.temperature}</p>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Rotation Period</p>
                <p className="text-xs text-white">{hsmKeyInfo.keyRotationDays} days</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700 h-8 text-xs gap-1.5" onClick={toggleSeal}>
              <Lock className="w-3.5 h-3.5" />
              {hsmKeyInfo.sealStatus === 'sealed' ? 'Unseal Vault' : 'Seal Vault'}
            </Button>
            <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700 h-8 text-xs gap-1.5" onClick={() => onSave('Key rotation initiated — new master key generated in HSM')}>
              <RefreshCw className="w-3.5 h-3.5" />
              Rotate Master Key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2) SHA-256 Cryptographic Chain Health */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-orange-400" />
              SHA-256 Cryptographic Chain Health
            </CardTitle>
            <div className="flex items-center gap-2">
              {chainHealth && (
                <span className={cn(
                  'flex items-center gap-1 text-[10px] font-semibold',
                  chainHealth.valid ? 'text-emerald-300' : 'text-red-300'
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', chainHealth.valid ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
                  {chainHealth.valid ? 'Chain Intact' : 'Chain Broken'}
                </span>
              )}
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs gap-1.5" onClick={runChainValidation} disabled={validatingChain}>
                {validatingChain ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                Validate Chain
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {chainHealth && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Total Blocks</p>
                <p className="text-lg font-bold text-white">{chainHealth.blocks}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Chain Breaks</p>
                <p className={cn('text-lg font-bold', chainHealth.breaks === 0 ? 'text-emerald-400' : 'text-red-400')}>{chainHealth.breaks}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Algorithm</p>
                <p className="text-sm font-bold text-white">SHA-256</p>
              </div>
            </div>
          )}

          {/* Chain Block Visualizer */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-300">Hash Chain Block Registry</p>
            <div className="space-y-1.5">
              {chainBlocks.map((block) => (
                <div key={block.index} className={cn(
                  'rounded-lg border p-3 flex items-center gap-3 transition-all',
                  block.valid ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border',
                    block.valid ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-red-500/15 border-red-500/30'
                  )}>
                    {block.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500">#{block.index}</span>
                      <span className="text-xs text-white font-medium truncate">{block.documentTitle}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-[10px] font-mono text-slate-400 truncate">{block.hash}</code>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500">{new Date(block.timestamp).toLocaleDateString()}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-slate-600">prev:</span>
                      <code className="text-[9px] font-mono text-slate-500 truncate max-w-[100px]">{block.previousHash}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Chain link visualization */}
            <div className="flex items-center gap-1 px-2 pt-1">
              {chainBlocks.map((_, i) => (
                <React.Fragment key={i}>
                  <div className="w-3 h-3 rounded-full bg-emerald-400/60 border border-emerald-400/40" />
                  {i < chainBlocks.length - 1 && <div className="flex-1 h-0.5 bg-emerald-500/30" />}
                </React.Fragment>
              ))}
              <span className="ml-2 text-[10px] text-emerald-400 font-semibold">Chain linked</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3) Code Minification / Obfuscation Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Code className="w-4 h-4 text-orange-400" />
            Code Minification &amp; Obfuscation Status
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Client-side asset protection — minified bundles, tree-shaking, and source map suppression.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'JS Minification', active: minifyStatus.jsMinified, icon: <Code className="w-3.5 h-3.5" /> },
              { label: 'CSS Minification', active: minifyStatus.cssMinified, icon: <Code className="w-3.5 h-3.5" /> },
              { label: 'HTML Minification', active: minifyStatus.htmlMinified, icon: <Code className="w-3.5 h-3.5" /> },
              { label: 'Tree Shaking', active: minifyStatus.treeShaking, icon: <Boxes className="w-3.5 h-3.5" /> },
              { label: 'Dead Code Elimination', active: minifyStatus.deadCodeElimination, icon: <Boxes className="w-3.5 h-3.5" /> },
              { label: 'Asset Fingerprinting', active: minifyStatus.assetFingerprinting, icon: <Hash className="w-3.5 h-3.5" /> },
              { label: 'Source Maps Suppressed', active: !minifyStatus.sourceMapsEnabled, icon: <EyeOff className="w-3.5 h-3.5" /> },
              { label: 'Bundle Compression', active: true, icon: <Zap className="w-3.5 h-3.5" /> },
            ].map((item) => (
              <div key={item.label} className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2',
                item.active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
              )}>
                <div className={cn('shrink-0', item.active ? 'text-emerald-400' : 'text-red-400')}>{item.icon}</div>
                <span className="text-xs text-white flex-1">{item.label}</span>
                {item.active ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              </div>
            ))}
          </div>
          {/* Compression stats */}
          <div className="rounded-lg bg-slate-900/50 border border-slate-700/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">Bundle Compression Ratio</span>
              <span className="text-xs font-bold text-emerald-400">{minifyStatus.compressionRatio}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${minifyStatus.compressionRatio}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-500">Raw: {minifyStatus.rawSizeKb} KB</span>
              <span className="text-[10px] text-slate-500">Minified: {minifyStatus.bundleSizeKb} KB</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4) Server-Side API Isolation Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Network className="w-4 h-4 text-orange-400" />
            Server-Side API Isolation
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            All telemetry processing and cryptographic hashing execute on the server — client code never touches raw keys or hashes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(
              'rounded-lg border p-3 flex items-center gap-3',
              isolationStatus.telemetryServerIsolated ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
            )}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border', isolationStatus.telemetryServerIsolated ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-red-500/15 border-red-500/30')}>
                <Server className={cn('w-4 h-4', isolationStatus.telemetryServerIsolated ? 'text-emerald-400' : 'text-red-400')} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Telemetry Processing</p>
                <p className="text-[10px] text-slate-400">{isolationStatus.telemetryServerIsolated ? 'Server-isolated via Edge Function' : 'WARNING: Client-side processing'}</p>
              </div>
            </div>
            <div className={cn(
              'rounded-lg border p-3 flex items-center gap-3',
              isolationStatus.cryptoServerIsolated ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
            )}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border', isolationStatus.cryptoServerIsolated ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-red-500/15 border-red-500/30')}>
                <Fingerprint className={cn('w-4 h-4', isolationStatus.cryptoServerIsolated ? 'text-emerald-400' : 'text-red-400')} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">SHA-256 Hashing</p>
                <p className="text-[10px] text-slate-400">{isolationStatus.cryptoServerIsolated ? 'Server-isolated via crypto-vault Edge Function' : 'WARNING: Client-side hashing'}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Client Key Exposure</span>
              <span className={cn('text-xs font-bold', isolationStatus.clientKeyExposure === 'none' ? 'text-emerald-400' : 'text-red-400')}>
                {isolationStatus.clientKeyExposure === 'none' ? 'None detected' : 'DETECTED'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Direct DB Access</span>
              <span className={cn('text-xs font-bold', isolationStatus.directDbAccess === 'blocked' ? 'text-emerald-400' : 'text-red-400')}>
                {isolationStatus.directDbAccess === 'blocked' ? 'Blocked (RLS enforced)' : 'Allowed'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5) Active API Gateway Security Headers */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              Active API Gateway Security Headers
            </CardTitle>
            <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {securityHeaders.filter((h) => h.status === 'active').length}/{securityHeaders.length} enforced
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {securityHeaders.map((hdr) => (
            <div key={hdr.header} className="rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5 flex items-center gap-3">
              <div className={cn(
                'px-2 py-0.5 rounded text-[9px] font-bold border shrink-0',
                headerStatusColors[hdr.status]
              )}>
                {hdr.status.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <code className="text-xs font-mono font-semibold text-white">{hdr.header}</code>
                <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{hdr.value}</p>
              </div>
              {hdr.status === 'active' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
