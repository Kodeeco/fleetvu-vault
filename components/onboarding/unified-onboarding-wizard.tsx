'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  Truck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Crown,
  MapPin,
  Radio,
  Lock,
  TrendingUp,
  Send,
  Plus,
  X,
  Shield,
  AlertCircle,
  ImagePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  validateStep,
  validateField,
  type OnboardingStep,
  type UnifiedOnboardingData,
  type OnboardingTransactionResult,
} from '@/lib/onboarding';
import { FleetVuErrorBoundary } from '@/components/error-boundary';

interface FeatureEntitlements {
  radar: boolean;
  gps: boolean;
  vault: boolean;
  risk_scoring: boolean;
}

const DEFAULT_DATA: UnifiedOnboardingData = {
  organizationName: '',
  primaryLocation: '',
  region: 'West Coast',
  planTier: 'pro',
  industry: '',
  fleetSizeEstimate: 0,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactRole: 'super_admin',
  corporateTitle: '',
  fleetLocations: [],
  entitlements: { radar: true, gps: true, vault: false, risk_scoring: false },
  welcomeMessage: '',
  initialVehicleCount: 0,
};

const FEATURE_META: Record<
  keyof FeatureEntitlements,
  { label: string; icon: typeof Radio; desc: string }
> = {
  radar: { label: 'Sensor Radar', icon: Radio, desc: '77GHz radar visualization & telemetry' },
  gps: { label: 'GPS Tracking', icon: MapPin, desc: 'Real-time fleet GPS & geofencing' },
  vault: { label: 'Forensic Vault', icon: Lock, desc: 'Encrypted incident evidence storage' },
  risk_scoring: { label: 'Risk Scoring', icon: TrendingUp, desc: 'Actuarial risk models & insurance scorecards' },
};

const STEPS: Array<{ id: OnboardingStep; label: string; icon: typeof Building2 }> = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'contact', label: 'Contact', icon: Users },
  { id: 'fleet', label: 'Fleet', icon: Truck },
  { id: 'review', label: 'Review', icon: Shield },
];

export interface UnifiedOnboardingWizardProps {
  actor: { email: string; role: string; name?: string };
  onComplete?: (result: OnboardingTransactionResult & { data: UnifiedOnboardingData }) => void;
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
      <AlertCircle className="h-3 w-3" />
      {message}
    </div>
  );
}

function UnifiedOnboardingWizardInner({ actor, onComplete }: UnifiedOnboardingWizardProps) {
  const [step, setStep] = useState<OnboardingStep>('company');
  const [data, setData] = useState<UnifiedOnboardingData>(DEFAULT_DATA);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [locationDraft, setLocationDraft] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const patch = useCallback((partial: Partial<UnifiedOnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const onBlurField = useCallback(
    (field: keyof UnifiedOnboardingData, value: unknown) => {
      const err = validateField(field, value, step === 'review' ? 'company' : step);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next[field] = err;
        else delete next[field];
        return next;
      });
    },
    [step],
  );

  const canAdvance = useMemo(() => {
    if (step === 'review') return true;
    const checkData =
      step === 'fleet'
        ? {
            ...data,
            fleetLocations:
              data.fleetLocations.length > 0
                ? data.fleetLocations
                : data.primaryLocation
                  ? [data.primaryLocation]
                  : [],
          }
        : data;
    return validateStep(step, checkData).valid;
  }, [step, data]);

  const goNext = () => {
    const checkData =
      step === 'fleet'
        ? {
            ...data,
            fleetLocations:
              data.fleetLocations.length > 0
                ? data.fleetLocations
                : data.primaryLocation
                  ? [data.primaryLocation]
                  : [],
          }
        : data;

    const result = validateStep(step, checkData);
    if (!result.valid) {
      setFieldErrors(result.errors);
      return;
    }

    if (step === 'fleet' && data.fleetLocations.length === 0 && data.primaryLocation) {
      patch({ fleetLocations: [data.primaryLocation] });
    }

    setFieldErrors({});
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };

  const addLocation = () => {
    const loc = locationDraft.trim();
    if (!loc) return;
    if (data.fleetLocations.includes(loc)) {
      setLocationDraft('');
      return;
    }
    patch({ fleetLocations: [...data.fleetLocations, loc] });
    setLocationDraft('');
  };

  const removeLocation = (loc: string) => {
    patch({ fleetLocations: data.fleetLocations.filter((l) => l !== loc) });
  };

  const onLogoPick = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSubmitError('Logo must be an image (PNG or SVG preferred for dark Vault UI).');
      return;
    }
    if (file.size > 2_000_000) {
      setSubmitError('Logo must be 2MB or smaller.');
      return;
    }
    setSubmitError(null);
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async () => {
    const fleetLocations =
      data.fleetLocations.length > 0
        ? data.fleetLocations
        : data.primaryLocation
          ? [data.primaryLocation]
          : [];

    const payload: UnifiedOnboardingData = { ...data, fleetLocations };
    const validation = validateStep('review', payload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      setSubmitError('Please resolve validation errors before deploying.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      let logoPayload: { base64: string; mimeType: string; fileName?: string } | null = null;
      if (logoFile && logoPreview) {
        logoPayload = {
          base64: logoPreview,
          mimeType: logoFile.type || 'image/png',
          fileName: logoFile.name,
        };
      }

      const res = await fetch('/api/onboarding/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: payload,
          actor,
          sendWelcomeEmail: true,
          logo: logoPayload,
        }),
      });
      const result = (await res.json()) as OnboardingTransactionResult;
      if (!result.success) {
        setSubmitError(result.error || 'Onboarding failed');
        return;
      }
      onComplete?.({ ...result, data: payload });
      setData(DEFAULT_DATA);
      setLogoFile(null);
      setLogoPreview(null);
      setStep('company');
      if (!result.emailDispatched) {
        setSubmitError(
          'Company deployed, but the welcome email did not confirm dispatch. Check SMTP / welcome@fleetvu.org and resend if needed.',
        );
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error during onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        {/* Step rail — merged Company / Contact / Fleet */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = i < stepIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (i <= stepIndex) setStep(s.id);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-orange-500/20 text-orange-300'
                    : done
                      ? 'text-green-400 hover:bg-slate-900'
                      : 'text-slate-500'
                }`}
              >
                {done && !active ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {s.label}
                {i < STEPS.length - 1 && (
                  <ChevronRight className="ml-1 hidden h-3.5 w-3.5 text-slate-700 sm:inline" />
                )}
              </button>
            );
          })}
        </div>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              {step === 'company' && (
                <>
                  <Building2 className="h-5 w-5 text-orange-400" /> Corporate Entity
                </>
              )}
              {step === 'contact' && (
                <>
                  <Users className="h-5 w-5 text-orange-400" /> Fleet Director / Primary Contact
                </>
              )}
              {step === 'fleet' && (
                <>
                  <Truck className="h-5 w-5 text-orange-400" /> Fleet Structure & Entitlements
                </>
              )}
              {step === 'review' && (
                <>
                  <Shield className="h-5 w-5 text-orange-400" /> Hierarchy Review & Deploy
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 'company' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Organization Name</Label>
                    <Input
                      value={data.organizationName}
                      onChange={(e) => patch({ organizationName: e.target.value })}
                      onBlur={(e) => onBlurField('organizationName', e.target.value)}
                      placeholder="e.g. Apex Logistics"
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                    <FieldError message={fieldErrors.organizationName} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Primary Location</Label>
                    <Input
                      value={data.primaryLocation}
                      onChange={(e) => patch({ primaryLocation: e.target.value })}
                      onBlur={(e) => onBlurField('primaryLocation', e.target.value)}
                      placeholder="e.g. Houston, TX"
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                    <FieldError message={fieldErrors.primaryLocation} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Region</Label>
                    <Select
                      value={data.region}
                      onValueChange={(v) => patch({ region: v as UnifiedOnboardingData['region'] })}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900">
                        {['West Coast', 'Midwest', 'East Coast', 'South', 'Unspecified'].map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Plan Tier</Label>
                    <Select
                      value={data.planTier}
                      onValueChange={(v) => patch({ planTier: v as UnifiedOnboardingData['planTier'] })}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900">
                        <SelectItem value="basic">Basic — $0/mo</SelectItem>
                        <SelectItem value="pro">Pro — $9.95/mo</SelectItem>
                        <SelectItem value="proplus">Pro+ — $19.95/mo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Industry (optional)</Label>
                    <Input
                      value={data.industry || ''}
                      onChange={(e) => patch({ industry: e.target.value })}
                      placeholder="e.g. Long-haul freight"
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Estimated Fleet Size</Label>
                    <Input
                      type="number"
                      min={0}
                      value={data.fleetSizeEstimate ?? 0}
                      onChange={(e) => patch({ fleetSizeEstimate: Number(e.target.value) || 0 })}
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <Label className="mb-1.5 flex items-center gap-2 text-slate-300">
                    <ImagePlus className="h-4 w-4 text-amber-400" />
                    Company logo (Vault app header)
                  </Label>
                  <p className="mb-3 text-[11px] text-slate-500 leading-relaxed">
                    Upload a white / light wordmark on transparent background. It appears at the top of
                    the driver Vault lock screen — same placement as the SCFuels prototype.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-slate-600 bg-black/80 px-3">
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="max-h-12 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-600">Preview on dark</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="max-w-xs cursor-pointer border-slate-700 bg-slate-900 text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-amber-500/20 file:px-2 file:py-1 file:text-amber-200"
                        onChange={(e) => {
                          onLogoPick(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      {logoFile && (
                        <button
                          type="button"
                          onClick={clearLogo}
                          className="text-left text-[11px] text-slate-500 hover:text-red-300"
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 'contact' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Contact Name</Label>
                    <Input
                      value={data.contactName}
                      onChange={(e) => patch({ contactName: e.target.value })}
                      onBlur={(e) => onBlurField('contactName', e.target.value)}
                      placeholder="e.g. John Martinez"
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                    <FieldError message={fieldErrors.contactName} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Contact Email</Label>
                    <Input
                      type="email"
                      value={data.contactEmail}
                      onChange={(e) => patch({ contactEmail: e.target.value })}
                      onBlur={(e) => onBlurField('contactEmail', e.target.value)}
                      placeholder="e.g. jmartinez@apexlogistics.com"
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                    <FieldError message={fieldErrors.contactEmail} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Phone (optional)</Label>
                    <Input
                      value={data.contactPhone || ''}
                      onChange={(e) => patch({ contactPhone: e.target.value })}
                      onBlur={(e) => onBlurField('contactPhone', e.target.value)}
                      placeholder="e.g. (713) 555-0100"
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                    <FieldError message={fieldErrors.contactPhone} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-slate-300">Contact Role</Label>
                    <Select
                      value={data.contactRole}
                      onValueChange={(v) =>
                        patch({ contactRole: v as UnifiedOnboardingData['contactRole'] })
                      }
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900">
                        <SelectItem value="super_admin">
                          <span className="flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-violet-400" /> Super-Admin (Multi-Location)
                          </span>
                        </SelectItem>
                        <SelectItem value="location_admin">
                          <span className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-blue-400" /> Location Admin (Single Site)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-slate-300">Corporate Title (optional)</Label>
                  <Input
                    value={data.corporateTitle || ''}
                    onChange={(e) => patch({ corporateTitle: e.target.value })}
                    placeholder="e.g. VP of Fleet Safety"
                    className="border-slate-700 bg-slate-950 text-white"
                  />
                </div>
              </>
            )}

            {step === 'fleet' && (
              <>
                <div>
                  <Label className="mb-1.5 block text-slate-300">Fleet Locations</Label>
                  <div className="flex gap-2">
                    <Input
                      value={locationDraft}
                      onChange={(e) => setLocationDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addLocation();
                        }
                      }}
                      placeholder="Add depot / terminal city…"
                      className="border-slate-700 bg-slate-950 text-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addLocation}
                      className="border-slate-700 text-slate-200"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.fleetLocations.length
                      ? data.fleetLocations
                      : data.primaryLocation
                        ? [data.primaryLocation]
                        : []
                    ).map((loc) => (
                      <Badge
                        key={loc}
                        variant="outline"
                        className="gap-1 border-orange-500/30 bg-orange-500/10 text-orange-200"
                      >
                        <MapPin className="h-3 w-3" />
                        {loc}
                        {data.fleetLocations.includes(loc) && (
                          <button type="button" onClick={() => removeLocation(loc)} className="ml-1">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                  <FieldError message={fieldErrors.fleetLocations} />
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                    Feature Entitlements
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(FEATURE_META) as (keyof FeatureEntitlements)[]).map((key) => {
                      const meta = FEATURE_META[key];
                      const Icon = meta.icon;
                      const on = data.entitlements[key];
                      return (
                        <div
                          key={key}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                            on ? 'border-orange-500/40 bg-orange-500/5' : 'border-slate-700 bg-slate-950'
                          }`}
                          onClick={() =>
                            patch({
                              entitlements: { ...data.entitlements, [key]: !on },
                            })
                          }
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`h-4 w-4 ${on ? 'text-orange-400' : 'text-slate-500'}`} />
                            <div>
                              <div className={`text-sm font-medium ${on ? 'text-white' : 'text-slate-400'}`}>
                                {meta.label}
                              </div>
                              <div className="text-xs text-slate-500">{meta.desc}</div>
                            </div>
                          </div>
                          <Switch
                            checked={on}
                            onCheckedChange={(v) =>
                              patch({ entitlements: { ...data.entitlements, [key]: v } })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <Label className="mb-1.5 block text-slate-300">
                    Personalized Welcome Message (optional)
                  </Label>
                  <Textarea
                    value={data.welcomeMessage || ''}
                    onChange={(e) => patch({ welcomeMessage: e.target.value })}
                    placeholder="Welcome to FleetVu! We're excited to partner…"
                    className="min-h-[80px] border-slate-700 bg-slate-950 text-white"
                  />
                </div>
              </>
            )}

            {step === 'review' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hierarchy
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-white">
                      <Building2 className="h-4 w-4 text-orange-400" />
                      <strong>{data.organizationName || '—'}</strong>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {data.planTier.toUpperCase()}
                      </Badge>
                      {logoPreview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt=""
                          className="ml-auto h-5 w-auto max-w-[80px] object-contain opacity-90"
                        />
                      )}
                    </div>
                    <div className="ml-6 flex items-center gap-2 text-slate-300">
                      <Users className="h-4 w-4 text-violet-400" />
                      {data.contactName || '—'} &lt;{data.contactEmail || '—'}&gt;
                      <Badge
                        variant="outline"
                        className={
                          data.contactRole === 'super_admin'
                            ? 'border-violet-500/40 text-violet-300'
                            : 'border-blue-500/40 text-blue-300'
                        }
                      >
                        {data.contactRole === 'super_admin' ? 'Fleet Director' : 'Location Admin'}
                      </Badge>
                    </div>
                    {(data.fleetLocations.length
                      ? data.fleetLocations
                      : [data.primaryLocation]
                    ).map((loc) => (
                      <div key={loc} className="ml-12 flex items-center gap-2 text-slate-400">
                        <Truck className="h-3.5 w-3.5 text-slate-500" />
                        Fleet site: {loc}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-xs text-orange-200 space-y-1.5">
                  <p>
                    Deploy creates the company, fleet director, activation key, and setup token.
                    {logoPreview
                      ? ' Customer logo brands the Vault lock screen and HUD header.'
                      : ' Add a logo on the Company step to brand the Vault header (like SCFuels).'}
                  </p>
                  <p>
                    <strong>Welcome email is always sent</strong> from{' '}
                    <strong>welcome@fleetvu.org</strong>
                    {data.contactEmail ? (
                      <>
                        {' '}
                        to <strong>{data.contactEmail}</strong>
                      </>
                    ) : null}{' '}
                    with the 72-hour setup link — that is the standard onboarding handoff.
                  </p>
                  <p className="text-orange-300/80">On failure, all inserts are rolled back.</p>
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {submitError}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={stepIndex === 0 || submitting}
                className="text-slate-300"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>

              {step !== 'review' ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={!canAdvance}
                  className="bg-orange-500 font-semibold text-white hover:bg-orange-600"
                >
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-orange-500 px-6 font-semibold text-white hover:bg-orange-600"
                >
                  {submitting ? (
                    'Deploying…'
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Deploy Client & Send Setup Link
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live preview */}
      <div className="col-span-1">
        <Card className="sticky top-24 border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <Shield className="h-4 w-4 text-orange-400" /> Setup Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="mb-2 flex items-center gap-2">
                {data.contactRole === 'super_admin' ? (
                  <Crown className="h-4 w-4 text-violet-400" />
                ) : (
                  <MapPin className="h-4 w-4 text-blue-400" />
                )}
                <Badge
                  variant="outline"
                  className={
                    data.contactRole === 'super_admin'
                      ? 'border-violet-500/40 text-violet-300'
                      : 'border-blue-500/40 text-blue-300'
                  }
                >
                  {data.contactRole === 'super_admin' ? 'Super-Admin' : 'Location Admin'}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                {data.contactRole === 'super_admin'
                  ? 'Fleet director with multi-location setup access across the corporate entity.'
                  : 'Location admin locked to the assigned primary site.'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Entitled Features
              </div>
              {(Object.keys(data.entitlements) as (keyof FeatureEntitlements)[])
                .filter((k) => data.entitlements[k])
                .map((k) => {
                  const meta = FEATURE_META[k];
                  const Icon = meta.icon;
                  return (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-300">{meta.label}</span>
                    </div>
                  );
                })}
            </div>

            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <div className="font-semibold text-emerald-300 mb-0.5">Welcome email (always on)</div>
              Sent via <strong>welcome@fleetvu.org</strong> · 72-hour setup link
              {data.contactEmail ? ` → ${data.contactEmail}` : ' → primary contact'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function UnifiedOnboardingWizard(props: UnifiedOnboardingWizardProps) {
  return (
    <FleetVuErrorBoundary name="UnifiedOnboardingWizard">
      <UnifiedOnboardingWizardInner {...props} />
    </FleetVuErrorBoundary>
  );
}
