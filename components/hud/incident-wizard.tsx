'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Car,
  Truck,
  Building,
  ArrowRight,
  ArrowLeft,
  Check,
  Mic,
  MicOff,
  Send,
  ImageIcon,
  CarFront,
  FileText,
  MapPin,
  Gauge,
  Clock,
  Navigation,
  User,
  IdCard,
  Users,
} from 'lucide-react';
import {
  PHOTO_SLOTS,
  DOCUMENT_PHOTO_SLOTS,
  TARGET_TYPES,
  IMPACT_ANGLES,
  LANES,
  VEHICLE_MAKES,
  VEHICLE_YEARS,
  LEGAL_DISCLAIMER,
} from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/app-context';
import { resolveCompanyLogoUrl } from '@/lib/company-branding';
import {
  type CapturedEvidence,
  buildIncidentFileName,
  fileToCapturedEvidence,
  fileToDataUrlCompressed,
  sha256OfJson,
  uploadIncidentEvidence,
} from '@/lib/incident-evidence';

const STEP_LABELS = [
  'Photos',
  'Vehicle',
  'License',
  'Witnesses',
  'Impact',
  'Submit',
] as const;

interface IncidentWizardProps {
  onClose: () => void;
  currentGps: { lat: number; lng: number };
  currentSpeed: number;
}

export function IncidentWizard({ onClose, currentGps, currentSpeed }: IncidentWizardProps) {
  const { user } = useApp();
  const brandLogo = resolveCompanyLogoUrl(user);
  const [screen, setScreen] = useState(1);
  const [evidence, setEvidence] = useState<Record<string, CapturedEvidence>>({});
  const [targetType, setTargetType] = useState<string>('');
  const [vehicleYear, setVehicleYear] = useState<string>('');
  const [vehicleMake, setVehicleMake] = useState<string>('');
  const [vehicleModel, setVehicleModel] = useState<string>('');
  const [impactAngle, setImpactAngle] = useState<string>('');
  const [fleetMotion, setFleetMotion] = useState<string>('');
  const [targetMotion, setTargetMotion] = useState<string>('');
  const [lane, setLane] = useState<string>('');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [caseId, setCaseId] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [otherDriverName, setOtherDriverName] = useState('');
  const [otherLicenseNumber, setOtherLicenseNumber] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [witnessPhone, setWitnessPhone] = useState('');
  const [witnessNotes, setWitnessNotes] = useState('');
  const recognitionRef = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<{ key: string; label: string } | null>(null);

  const TOTAL_STEPS = 6;
  const scenePhotoCount = PHOTO_SLOTS.filter((s) => evidence[s.key]).length;
  const canProceedScreen1 = scenePhotoCount >= 2;
  const canProceedScreen2 =
    targetType === 'fixed_object' ||
    (Boolean(targetType) && Boolean(vehicleYear) && Boolean(vehicleMake) && Boolean(vehicleModel) && plateNumber.trim().length >= 3);
  const canProceedScreen3 =
    targetType === 'fixed_object' ||
    (otherDriverName.trim().length >= 2 &&
      otherLicenseNumber.trim().length >= 2 &&
      Boolean(evidence.other_license));
  const canProceedScreen4 = true; // witnesses optional
  const canProceedScreen5 = Boolean(impactAngle && fleetMotion && targetMotion && lane);

  const openCameraForSlot = (key: string, label: string) => {
    pendingSlotRef.current = { key, label };
    fileInputRef.current?.click();
  };

  const onCameraFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    const pending = pendingSlotRef.current;
    pendingSlotRef.current = null;
    if (!file || !pending) return;
    try {
      const captured = await fileToCapturedEvidence(pending.key, pending.label, file);
      setEvidence((prev) => {
        const old = prev[pending.key];
        if (old?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(old.previewUrl);
        return { ...prev, [pending.key]: captured };
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not capture photo');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      const rec = recognitionRef.current as { stop?: () => void } | null;
      rec?.stop?.();
    } else {
      setVoiceTranscript('');
      setIsRecording(true);
      try {
        const SpeechRecognition =
          (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => unknown })
            .webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition() as {
            continuous: boolean;
            interimResults: boolean;
            onresult: (event: {
              resultIndex: number;
              results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>;
            }) => void;
            onend: () => void;
            start: () => void;
            stop: () => void;
          };
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.onresult = (event) => {
            let chunk = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              chunk += event.results[i][0]?.transcript || '';
            }
            const next = chunk.trim();
            if (!next) return;
            setVoiceTranscript((prev) => (prev ? `${prev} ${next}` : next));
          };
          recognition.onend = () => setIsRecording(false);
          recognition.start();
          recognitionRef.current = recognition;
        } else {
          setVoiceTranscript('Speech recognition not available in this browser. Type your statement below.');
          setIsRecording(false);
        }
      } catch {
        setIsRecording(false);
      }
    }
  };

  const generateCaseId = () => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `FV-${ts}-${rand}`;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const id = generateCaseId();
    const submittedAt = new Date();
    const reportFileName = buildIncidentFileName({
      companyName: user?.companyName,
      driverName: user?.name,
      caseId: id,
      submittedAt,
    });
    setCaseId(id);
    setFileName(reportFileName);

    const make = VEHICLE_MAKES[vehicleMake];
    const modelData = make?.models[vehicleModel];
    const targetDims = modelData
      ? { width: modelData.width, length: modelData.length }
      : { width: 1.9, length: 4.8 };

    // Upload / seal each captured photo
    const mediaManifest: Array<{
      slotKey: string;
      label: string;
      sha256: string;
      storagePath: string | null;
      dataUrl?: string;
      capturedAt: string;
      mimeType: string;
      byteSize: number;
    }> = [];

    for (const item of Object.values(evidence)) {
      let storagePath: string | null = null;
      let dataUrl: string | undefined;
      try {
        const uploaded = await uploadIncidentEvidence({
          companyId: user?.companyId || null,
          caseId: id,
          evidence: item,
        });
        storagePath = uploaded.storagePath;
        await supabase.from('incident_media').insert({
          case_id: id,
          company_id: user?.companyId || null,
          slot_key: item.slotKey,
          label: item.label,
          storage_path: storagePath,
          sha256: item.sha256,
          mime_type: item.file.type,
          byte_size: item.file.size,
          captured_at: item.capturedAt,
        });
      } catch {
        // Storage bucket may not exist yet — keep compressed image in case package
        dataUrl = await fileToDataUrlCompressed(item.file);
      }
      mediaManifest.push({
        slotKey: item.slotKey,
        label: item.label,
        sha256: item.sha256,
        storagePath,
        dataUrl,
        capturedAt: item.capturedAt,
        mimeType: item.file.type,
        byteSize: item.file.size,
      });
    }

    // Attach recent vault sensor window (pre-incident), if available for this company
    let sensorWindow: unknown[] = [];
    try {
      if (user?.companyId) {
        const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('vault_event_blocks')
          .select('block_seq, created_at, company_id, payload_hash, event_type, summary')
          .eq('company_id', user.companyId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(40);
        sensorWindow = data || [];
      }
    } catch {
      sensorWindow = [];
    }

    const reconstructionData = {
      truckSpeed: currentSpeed,
      targetSpeed: targetType === 'fixed_object' ? 0 : null,
      approachAngle: impactAngle,
      impactDistance: null,
      latitude: currentGps.lat,
      longitude: currentGps.lng,
      lane,
      impactAngleType: impactAngle,
      fleetTruckMotion: fleetMotion,
      targetVehicleMotion: targetMotion,
      targetDims,
      plate_number: plateNumber || null,
      other_driver_name: otherDriverName || null,
      other_license_number: otherLicenseNumber || null,
      witness_name: witnessName || null,
      witness_phone: witnessPhone || null,
      witness_notes: witnessNotes || null,
      driver_name: user?.name || null,
      driver_id: user?.driverId || user?.driverNumber || null,
      truck_number: user?.truckNumber || null,
      company_name: user?.companyName || null,
      depot: user?.depot || user?.location || null,
      sensor_hardware: user?.sensorHardware || 'C55-Pro',
      submitted_from: 'fleetvu_vault_mobile',
      incident_title: reportFileName,
      report_file_name: reportFileName,
      submitted_at: submittedAt.toISOString(),
      received_at: submittedAt.toISOString(),
      media: mediaManifest.map(({ dataUrl: _d, ...rest }) => rest),
      media_inline: mediaManifest
        .filter((m) => m.dataUrl)
        .map((m) => ({ slotKey: m.slotKey, sha256: m.sha256, dataUrl: m.dataUrl })),
      sensor_window_pre_incident: sensorWindow,
      gps_source: 'device_live',
    };

    const packageHash = await sha256OfJson({
      caseId: id,
      reportFileName,
      reconstructionData: {
        ...reconstructionData,
        media_inline: undefined,
      },
      mediaSha256: mediaManifest.map((m) => m.sha256),
    });

    try {
      const { error: insertErr } = await supabase.from('incidents').insert({
        case_id: id,
        company_id: user?.companyId || null,
        driver_id: user?.driverId || null,
        truck_speed_mph: currentSpeed,
        target_speed_mph: targetType === 'fixed_object' ? 0 : null,
        approach_angle: impactAngle,
        impact_distance_m: null,
        latitude: currentGps.lat,
        longitude: currentGps.lng,
        proximity_zone: 'red',
        target_type: targetType,
        target_vehicle_year: vehicleYear || null,
        target_vehicle_make: vehicleMake || null,
        target_vehicle_model: vehicleModel || null,
        impact_angle_type: impactAngle,
        fleet_truck_motion: fleetMotion,
        target_vehicle_motion: targetMotion,
        lane_selection: lane,
        photos: mediaManifest.map((m) => m.slotKey),
        voice_note_transcript: voiceTranscript,
        reconstruction_data: {
          ...reconstructionData,
          package_sha256: packageHash,
          status_label: 'completed_report',
        },
        status: 'submitted',
      });

      if (insertErr) throw new Error(insertErr.message);

      // Portal toast for company admins (customer tenant only)
      try {
        const key = `fleetvu_incident_alert_${user?.companyId || 'unknown'}`;
        const prev = JSON.parse(localStorage.getItem(key) || '[]') as unknown[];
        prev.unshift({
          caseId: id,
          fileName: reportFileName,
          at: submittedAt.toISOString(),
          driverName: user?.name,
          truckNumber: user?.truckNumber,
          lat: currentGps.lat,
          lng: currentGps.lng,
          read: false,
        });
        localStorage.setItem(key, JSON.stringify(prev.slice(0, 20)));
        window.dispatchEvent(
          new CustomEvent('fleetvu:incident-alert', {
            detail: { caseId: id, companyId: user?.companyId, fileName: reportFileName },
          }),
        );
      } catch {
        /* ignore */
      }

      await supabase.from('audit_logs').insert({
        actor_role: user?.role || 'driver',
        actor_email: user?.email || 'unknown',
        action_type: 'incident_submitted',
        entity_type: 'incident',
        new_state: {
          case_id: id,
          report_file_name: reportFileName,
          package_sha256: packageHash,
          media_count: mediaManifest.length,
          driver_name: user?.name,
          truck_number: user?.truckNumber,
          company_id: user?.companyId,
          portal_destination: 'accident_reconstruction',
        },
      });

      await supabase.from('document_audit').insert({
        case_id: id,
        document_type: 'incident_report',
        action: 'created',
        actor_role: user?.role || 'driver',
        actor_email: user?.email,
      });

      try {
        await fetch('/api/sync/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: [
              {
                id: `inc_${id}`,
                channel: 'incident',
                companyId: user?.companyId || null,
                deviceId:
                  typeof window !== 'undefined'
                    ? window.localStorage.getItem('fleetvu_device_id') || 'mobile'
                    : 'mobile',
                payload: {
                  caseId: id,
                  reportFileName,
                  packageSha256: packageHash,
                  driverName: user?.name,
                  driverId: user?.driverId || user?.driverNumber,
                  truckNumber: user?.truckNumber,
                  companyName: user?.companyName,
                  latitude: currentGps.lat,
                  longitude: currentGps.lng,
                  speedMph: currentSpeed,
                  status: 'submitted',
                  destination: 'customer_reconstruction_portal',
                  notifyFleetVuGlobalAdmin: false,
                  legalIsolation: 'customer_tenant_exclusive',
                  actorEmail: user?.email,
                  actorRole: user?.role || 'driver',
                  platform: 'mobile',
                  appVersion: '1.0.0',
                },
                clientTimestampMs: Date.now(),
                status: 'pending',
                attempts: 0,
                lastError: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch {
        /* sync best-effort */
      }

      try {
        const { dispatchCustomerIncidentAlert } = await import('@/lib/incident-alerts');
        await dispatchCustomerIncidentAlert({
          caseId: id,
          companyId: user?.companyId || null,
          companyName: user?.companyName || null,
          driverName: user?.name || null,
          driverId: user?.driverId || user?.driverNumber || null,
          truckNumber: user?.truckNumber || null,
          latitude: currentGps.lat,
          longitude: currentGps.lng,
          speedMph: currentSpeed,
          submittedAt: submittedAt.toISOString(),
          reportFileName,
          packageSha256: packageHash,
        });
      } catch {
        /* alert best-effort */
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6">
        {brandLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brandLogo}
            alt={user?.companyName || 'Company'}
            className="h-8 w-auto max-w-[180px] object-contain mb-4 opacity-90"
          />
        )}
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4">
          <Check className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Report Completed &amp; Sent</h2>
        <p className="text-slate-300 mb-1 text-center text-sm">
          {user?.companyName
            ? `Logged to the ${user.companyName} Accident module.`
            : 'Your incident file is logged in your company Accident module.'}
        </p>
        <p className="text-orange-400 mb-2 text-center font-mono text-xs break-all px-2">{fileName}</p>
        <p className="text-slate-400 mb-4 text-center text-sm">
          Case ID: <span className="text-orange-400 font-mono font-bold">{caseId}</span>
        </p>
        <p className="text-sm text-slate-400 mb-6 text-center max-w-md">
          Company Super Admin / Admin has been alerted (portal + email when configured).
        </p>
        <div className="bg-slate-800 rounded-lg p-4 mb-6 w-full max-w-sm">
          <div className="flex items-center gap-2 text-slate-300 text-sm py-1">
            <MapPin className="w-3 h-3 text-orange-400" />
            GPS: {currentGps.lat.toFixed(5)}, {currentGps.lng.toFixed(5)}
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-sm py-1">
            <Gauge className="w-3 h-3 text-orange-400" />
            Speed: {currentSpeed} MPH
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-sm py-1">
            <Camera className="w-3 h-3 text-orange-400" />
            Evidence photos: {Object.keys(evidence).length}
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-sm py-1">
            <Clock className="w-3 h-3 text-orange-400" />
            Sent: {new Date().toLocaleString()}
          </div>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onCameraFile(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {brandLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogo}
                alt={user?.companyName || 'Company'}
                className="h-4 w-auto max-w-[100px] object-contain"
              />
            )}
            <h2 className="text-lg font-bold text-white truncate">Report Incident</h2>
          </div>
          <p className="text-xs text-slate-400">
            Step {screen} of {TOTAL_STEPS} — {STEP_LABELS[screen - 1]}
          </p>
        </div>
        <Button size="sm" variant="ghost" className="text-slate-400 shrink-0" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <Progress value={(screen / TOTAL_STEPS) * 100} className="h-1 bg-slate-700" />
      <div className="px-4 pt-1.5 flex justify-between gap-1">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className={`text-[9px] font-semibold uppercase tracking-wide truncate ${
              i + 1 === screen ? 'text-orange-400' : i + 1 < screen ? 'text-slate-500' : 'text-slate-700'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      {submitError && (
        <div className="mx-4 mt-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {submitError}
        </div>
      )}

      {/* Screen content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {/* SCREEN 1: Photo Capture */}
        {screen === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Capture Photos</h3>
              <p className="text-sm text-slate-400">
                Minimum 2 photos required. GPS telemetry auto-captured.
              </p>
            </div>

            {/* Auto-captured telemetry */}
            <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-4">
              <Navigation className="w-5 h-5 text-orange-400" />
              <div className="flex-1 text-xs text-slate-300">
                <div>GPS: {currentGps.lat.toFixed(4)}, {currentGps.lng.toFixed(4)}</div>
                <div>Speed: {currentSpeed} MPH · UTC: {new Date().toISOString().split('T')[1]?.split('.')[0]}</div>
              </div>
              <Badge className="bg-green-600">Auto-Captured</Badge>
            </div>

            {/* Photo slots — opens device camera */}
            <div className="grid grid-cols-2 gap-3">
              {PHOTO_SLOTS.map((slot) => {
                const icon =
                  slot.icon === 'car-front' ? <CarFront className="w-8 h-8" /> :
                  slot.icon === 'car-back' ? <Car className="w-8 h-8 rotate-180" /> :
                  slot.icon === 'car-side' ? <Car className="w-8 h-8" /> :
                  <ImageIcon className="w-8 h-8" />;
                const captured = evidence[slot.key];
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => openCameraForSlot(slot.key, slot.label)}
                    className={`relative aspect-[4/3] rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all overflow-hidden ${
                      captured
                        ? 'border-green-500 bg-green-950/30'
                        : 'border-dashed border-slate-600 bg-slate-800/50 hover:border-orange-500'
                    }`}
                  >
                    {captured ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={captured.previewUrl} alt={slot.label} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                        <Check className="w-8 h-8 text-green-400 relative z-10" />
                        <span className="text-xs text-green-400 font-semibold relative z-10">{slot.label}</span>
                        <span className="text-[10px] text-slate-200 relative z-10">Tap to retake</span>
                      </>
                    ) : (
                      <>
                        <div className="text-slate-500">{icon}</div>
                        <Camera className="w-5 h-5 text-orange-400" />
                        <span className="text-xs text-slate-400 font-medium text-center px-2">{slot.label}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {scenePhotoCount}/4 photos · {canProceedScreen1 ? 'Ready' : 'Need 2 minimum'}
              </span>
              <Button
                disabled={!canProceedScreen1}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => setScreen(2)}
              >
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <button
              type="button"
              onClick={() => openCameraForSlot('scene_wide', 'Wide Scene Overview')}
              className={`w-full p-3 rounded-xl border border-dashed flex items-center justify-center gap-2 ${
                evidence.scene_wide ? 'border-green-500 bg-green-950/20' : 'border-slate-700 bg-slate-800/40'
              }`}
            >
              <Camera className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-slate-300">
                {evidence.scene_wide ? 'Wide scene captured' : 'Optional: wide scene overview'}
              </span>
            </button>
          </div>
        )}

        {/* SCREEN 2: Third-Party Vehicle + Plate */}
        {screen === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Other Vehicle</h3>
              <p className="text-sm text-slate-400">Select type, then capture plate and vehicle details.</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {TARGET_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTargetType(t.key)}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    targetType === t.key
                      ? 'border-orange-500 bg-orange-950/30'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  {t.key === 'passenger' ? <Car className="w-6 h-6 text-slate-300" /> :
                   t.key === 'commercial' ? <Truck className="w-6 h-6 text-slate-300" /> :
                   <Building className="w-6 h-6 text-slate-300" />}
                  <span className="text-xs text-slate-300 text-center">{t.label}</span>
                </button>
              ))}
            </div>

            {targetType && targetType !== 'fixed_object' && (
              <div className="space-y-3 animate-fade-in">
                <div>
                  <Label className="text-slate-300">License Plate</Label>
                  <Input
                    className="bg-slate-800 border-slate-700 text-white uppercase tracking-wider font-mono"
                    placeholder="ABC-1234"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Vehicle Year</Label>
                  <Select value={vehicleYear} onValueChange={setVehicleYear}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_YEARS.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Make</Label>
                  <Select value={vehicleMake} onValueChange={setVehicleMake}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select make" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(VEHICLE_MAKES).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Model</Label>
                  <Select value={vehicleModel} onValueChange={setVehicleModel} disabled={!vehicleMake}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleMake && Object.keys(VEHICLE_MAKES[vehicleMake].models).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {targetType === 'fixed_object' && (
              <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-400">
                Fixed Object selected — other-party vehicle fields skipped.
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" className="text-slate-400" onClick={() => setScreen(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                disabled={!canProceedScreen2}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => setScreen(3)}
              >
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* SCREEN 3: Other driver license */}
        {screen === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Other Driver / License &amp; Insurance</h3>
              <p className="text-sm text-slate-400">
                Enter name and license #, then photograph the license (required) and insurance card
                (recommended).
              </p>
            </div>
            {targetType === 'fixed_object' ? (
              <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-400">No other driver for fixed-object impacts.</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-slate-300 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Full Name</Label>
                  <Input className="bg-slate-800 border-slate-700 text-white" value={otherDriverName} onChange={(e) => setOtherDriverName(e.target.value)} placeholder="Other driver legal name" />
                </div>
                <div>
                  <Label className="text-slate-300 flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5" /> Driver License #</Label>
                  <Input className="bg-slate-800 border-slate-700 text-white font-mono" value={otherLicenseNumber} onChange={(e) => setOtherLicenseNumber(e.target.value.toUpperCase())} placeholder="License number" />
                </div>
                {DOCUMENT_PHOTO_SLOTS.filter((s) => s.key === 'other_license' || s.key === 'other_insurance').map((slot) => (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => openCameraForSlot(slot.key, slot.label)}
                    className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 ${
                      evidence[slot.key] ? 'border-green-500 bg-green-950/20' : 'border-slate-600 bg-slate-800/50'
                    }`}
                  >
                    <Camera className="w-5 h-5 text-orange-400" />
                    <span className="text-sm text-slate-200">
                      {evidence[slot.key] ? `${slot.label} captured` : `Tap to photograph ${slot.label}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="ghost" className="text-slate-400" onClick={() => setScreen(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button disabled={!canProceedScreen3} className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setScreen(4)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* SCREEN 4: Witnesses */}
        {screen === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Witnesses</h3>
              <p className="text-sm text-slate-400">Optional — add any witness name and phone, then continue.</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-slate-300 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Witness Name</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" value={witnessName} onChange={(e) => setWitnessName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label className="text-slate-300">Witness Phone</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" value={witnessPhone} onChange={(e) => setWitnessPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label className="text-slate-300">Notes</Label>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white min-h-[70px]"
                  value={witnessNotes}
                  onChange={(e) => setWitnessNotes(e.target.value)}
                  placeholder="What did they see?"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" className="text-slate-400" onClick={() => setScreen(3)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button disabled={!canProceedScreen4} className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setScreen(5)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* SCREEN 5: Impact Mechanics */}
        {screen === 5 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Impact Mechanics</h3>
              <p className="text-sm text-slate-400">Select impact angle and motion states.</p>
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block">Impact Angle</Label>
              <div className="grid grid-cols-3 gap-2">
                {IMPACT_ANGLES.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setImpactAngle(a.key)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      impactAngle === a.key
                        ? 'border-orange-500 bg-orange-950/30'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs text-slate-200 font-medium">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 mb-2 block">Fleet Truck</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['stopped', 'moving'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setFleetMotion(m)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        fleetMotion === m
                          ? m === 'stopped' ? 'border-red-500 bg-red-950/30' : 'border-green-500 bg-green-950/30'
                          : 'border-slate-700 bg-slate-800/50'
                      }`}
                    >
                      <span className="text-xs text-slate-200 font-medium capitalize">{m}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Target Vehicle</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['stopped', 'moving'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTargetMotion(m)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        targetMotion === m
                          ? m === 'stopped' ? 'border-red-500 bg-red-950/30' : 'border-green-500 bg-green-950/30'
                          : 'border-slate-700 bg-slate-800/50'
                      }`}
                    >
                      <span className="text-xs text-slate-200 font-medium capitalize">{m}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block">Lane Selection</Label>
              <div className="grid grid-cols-4 gap-2">
                {LANES.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => setLane(l.key)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      lane === l.key
                        ? 'border-orange-500 bg-orange-950/30'
                        : 'border-slate-700 bg-slate-800/50'
                    }`}
                  >
                    <span className="text-xs text-slate-200 font-medium">{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" className="text-slate-400" onClick={() => setScreen(4)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                disabled={!canProceedScreen5}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => setScreen(6)}
              >
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* SCREEN 6: Voice Notes & Submit */}
        {screen === 6 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Statement &amp; Submit</h3>
              <p className="text-sm text-slate-400">Optional voice note, then submit to your company reconstruction module.</p>
            </div>

            <button
              onClick={toggleRecording}
              className={`w-full p-6 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                isRecording
                  ? 'border-red-500 bg-red-950/30 animate-pulse'
                  : 'border-slate-700 bg-slate-800/50 hover:border-orange-500'
              }`}
            >
              {isRecording ? <MicOff className="w-10 h-10 text-red-400" /> : <Mic className="w-10 h-10 text-orange-400" />}
              <span className="text-sm font-semibold text-white">
                {isRecording ? 'Recording... Tap to Stop' : 'Tap to Speak Statement'}
              </span>
            </button>

            {voiceTranscript && (
              <div className="bg-slate-800 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-semibold text-slate-300">Transcript</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{voiceTranscript}</p>
              </div>
            )}

            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder:text-slate-500 min-h-[80px]"
              placeholder="Or type your statement here..."
              value={voiceTranscript}
              onChange={(e) => setVoiceTranscript(e.target.value)}
            />

            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-amber-400 leading-relaxed">
                {LEGAL_DISCLAIMER}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" className="text-slate-400" onClick={() => setScreen(5)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                disabled={submitting}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold"
                onClick={handleSubmit}
              >
                {submitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    SUBMIT TO COMPANY PORTAL
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
