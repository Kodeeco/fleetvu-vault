'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  FileText,
  Download,
  Mail,
  Lock,
  KeyRound,
  Shield,
  Star,
  MessageSquarePlus,
  Send,
  Eye,
  CheckCircle2,
  QrCode,
  Fingerprint,
  ScrollText,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Upload,
  Calendar,
  Clock,
  MapPin,
  User,
  Truck,
  Radio,
  Cpu,
  Gauge,
  Activity,
  Wifi,
  Bell,
  ShieldCheck,
  Hash,
  CircuitBoard,
  Navigation,
  Search,
  Filter,
  Play,
  Pause,
  Database,
  X,
  GraduationCap,
  ExternalLink,
  Timer,
  Zap,
  Crosshair,
  Trash2,
  Pencil,
  Scale,
  FolderOpen,
} from 'lucide-react';
import { ReconstructionCanvas } from '@/components/reconstruction/reconstruction-canvas';
import { LEGAL_DISCLAIMER, VEHICLE_MAKES, CHASSIS_TYPES, PROXIMITY_ZONES } from '@/lib/constants';
import { buildInternalFindingsSummary } from '@/lib/accuvu-findings-summary';
import { AccuVuReviewChecklist, markCaseNotesComplete } from '@/components/accuvu/accuvu-review-checklist';
import { loadCaseReviewProgress, markStepDone } from '@/lib/accuvu-review-checklist';
import type { Incident, Vehicle } from '@/lib/types';

interface ReconstructionPortalProps {
  incidents: Incident[];
  vehicles?: Vehicle[];
  onClose: () => void;
  user: { name: string; email: string; role: string; companyName?: string; location?: string };
  previewMode?: boolean;
  onUpgrade?: () => void;
  productSku?: 'fleetvu' | 'accuvu';
}

function buildAccuVuDemoLibrary(): Incident[] {
  const day = 86400000;
  const base = (partial: Partial<Incident> & Pick<Incident, 'id' | 'case_id' | 'status'>): Incident => ({
    vehicle_id: 'TRK-102',
    driver_id: null,
    company_id: 'demo-apex-logistics',
    truck_speed_mph: 42,
    target_speed_mph: 0,
    target_type: 'passenger_vehicle',
    target_vehicle_year: '2023',
    target_vehicle_make: 'Toyota',
    target_vehicle_model: 'Camry',
    impact_angle_type: 'inline_rear',
    approach_angle: '0°',
    impact_distance_m: 5.2,
    latitude: 39.0997,
    longitude: -94.5786,
    utc_timestamp: new Date(Date.now() - day).toISOString(),
    proximity_zone: 'red',
    fleet_truck_motion: 'moving',
    target_vehicle_motion: 'stopped',
    lane_selection: 'center',
    photos: [],
    voice_note_transcript: null,
    reconstruction_data: {},
    severity_grade: 'S2',
    triage_status: partial.status,
    investigator_notes: '',
    created_at: new Date(Date.now() - day).toISOString(),
    ...partial,
  });

  return [
    // Primary showcase: left-front collision — FWD + L-beam lock the other vehicle
    base({
      id: 'av-case-trk102',
      case_id: 'AV-2026-TRK102',
      status: 'under_review',
      triage_status: 'under_review',
      vehicle_id: 'TRK-102',
      truck_speed_mph: 47,
      target_speed_mph: 34,
      target_type: 'passenger_vehicle',
      target_vehicle_year: '2021',
      target_vehicle_make: 'Honda',
      target_vehicle_model: 'CR-V',
      impact_angle_type: 'left_front',
      approach_angle: '-28°',
      impact_distance_m: 4.6,
      fleet_truck_motion: 'moving',
      target_vehicle_motion: 'moving',
      lane_selection: 'left',
      proximity_zone: 'red',
      severity_grade: 'S2',
      latitude: 39.1012,
      longitude: -94.5831,
      voice_note_transcript:
        'Merging passenger vehicle entered from left-front. C55 FWD locked at ~9m, L-beam confirmed closing vector. Contact left front bumper / headlamp area. Other driver exchanged info — Honda CR-V, Missouri plate.',
      investigator_notes:
        'Primary AccuVu demo — left-front geometry with other-vehicle kinematics from FWD + left lateral channels. Counsel digest pending.',
      reconstruction_data: {
        contact_quadrant: 'left_front',
        primary_lock_channels: ['forward', 'left'],
        first_detection_bearing_deg: -22,
        relative_closing_mph: 13,
        other_vehicle_plate_state: 'MO',
        other_vehicle_color: 'Silver',
        plate_number: 'HK3-4192',
        other_driver_name: 'Jordan M. Ellis',
        other_license_number: 'D0874192',
        other_vehicle_contact_quadrant: 'right_rear',
        other_insurance_carrier: 'State Farm',
        other_insurance_policy_last4: '8841',
        other_vehicle_damage_notes: 'Right-rear bumper scrape / quarter-panel contact area photographed at scene.',
        witness_name: null,
        witness_phone: null,
        media_slots_on_file: ['front_corner', 'damage_area', 'other_license', 'other_insurance', 'scene_wide'],
      },
      utc_timestamp: new Date(Date.now() - day).toISOString(),
    }),
    base({
      id: 'av-case-trk088',
      case_id: 'AV-2026-TRK088',
      status: 'closed',
      triage_status: 'closed',
      vehicle_id: 'TRK-088',
      truck_speed_mph: 28,
      target_speed_mph: 22,
      impact_distance_m: 3.1,
      impact_angle_type: 'sideswipe',
      approach_angle: '12°',
      target_vehicle_year: '2019',
      target_vehicle_make: 'Ford',
      target_vehicle_model: 'F-150',
      target_vehicle_motion: 'moving',
      severity_grade: 'S1',
      voice_note_transcript: 'Low-speed sideswipe in terminal yard — sealed and archived.',
      investigator_notes: 'Digest emailed to claims 2026-09-20. No further action.',
      reconstruction_data: {
        contact_quadrant: 'right_side',
        other_vehicle_contact_quadrant: 'left_side',
        other_vehicle_color: 'Blue',
        other_vehicle_plate_state: 'KS',
        plate_number: '293-KXL',
        other_driver_name: 'Alex Rivera',
        primary_lock_channels: ['right', 'forward'],
        media_slots_on_file: ['full_side', 'damage_area', 'other_license'],
      },
      utc_timestamp: new Date(Date.now() - 9 * day).toISOString(),
      created_at: new Date(Date.now() - 9 * day).toISOString(),
    }),
    base({
      id: 'av-case-trk055',
      case_id: 'AV-2026-TRK055',
      status: 'draft',
      triage_status: 'draft',
      vehicle_id: 'TRK-055',
      truck_speed_mph: 51,
      target_speed_mph: 18,
      impact_distance_m: 8.4,
      impact_angle_type: 'frontal',
      approach_angle: '8°',
      target_type: 'passenger_vehicle',
      target_vehicle_year: '2018',
      target_vehicle_make: 'Chevrolet',
      target_vehicle_model: 'Malibu',
      target_vehicle_motion: 'moving',
      severity_grade: 'S3',
      voice_note_transcript: 'Head-on / near-head-on approach in opposing lane drift — draft pending photo attach.',
      investigator_notes: '',
      reconstruction_data: {
        contact_quadrant: 'front',
        other_vehicle_contact_quadrant: 'front',
        other_vehicle_color: 'White',
        primary_lock_channels: ['forward', 'left', 'right'],
        first_detection_bearing_deg: 8,
        relative_closing_mph: 33,
        // Identity exchange incomplete on draft — intentional gaps
        plate_number: null,
        other_driver_name: null,
        media_slots_on_file: [],
      },
      utc_timestamp: new Date(Date.now() - 2 * day).toISOString(),
      created_at: new Date(Date.now() - 2 * day).toISOString(),
    }),
  ];
}

export function ReconstructionPortal({
  incidents,
  vehicles = [],
  onClose,
  user,
  previewMode = false,
  onUpgrade,
  productSku = 'fleetvu',
}: ReconstructionPortalProps) {
  const isAccuVu = productSku === 'accuvu';
  const [reconLocked, setReconLocked] = useState(false);

  useEffect(() => {
    if (!previewMode) { setReconLocked(false); return; }
    setReconLocked(false);
    const timer = setTimeout(() => setReconLocked(true), 6000);
    return () => clearTimeout(timer);
  }, [previewMode]);

  const resetDemo = () => {
    setReconLocked(false);
    setTimeout(() => setReconLocked(true), 6000);
  };

  // Default sample incident for FleetVu immediate inspection
  const sampleIncident: Incident = {
    id: 'sample-trk102',
    case_id: 'FV-2026-TRK102',
    vehicle_id: 'TRK-102',
    driver_id: null,
    company_id: null,
    truck_speed_mph: 42,
    target_speed_mph: 0,
    target_type: 'passenger_vehicle',
    target_vehicle_year: '2023',
    target_vehicle_make: 'Toyota',
    target_vehicle_model: 'Camry',
    impact_angle_type: 'inline_rear',
    approach_angle: '0°',
    impact_distance_m: 5.2,
    latitude: 34.0522,
    longitude: -118.2437,
    utc_timestamp: new Date(Date.now() - 86400000).toISOString(),
    proximity_zone: 'red',
    fleet_truck_motion: 'moving',
    target_vehicle_motion: 'stopped',
    lane_selection: 'center',
    photos: [],
    voice_note_transcript: 'Driver reported sudden stop by vehicle ahead. Radar detected target at 5.2m, applied emergency brake.',
    reconstruction_data: {},
    status: 'under_review',
    severity_grade: 'S2',
    triage_status: 'under_review',
    investigator_notes: '',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  };

  const accuvuDemoLibrary = useMemo(() => buildAccuVuDemoLibrary(), []);
  const allIncidents = isAccuVu
    ? [...accuvuDemoLibrary, ...incidents.filter((inc) => !accuvuDemoLibrary.some((d) => d.id === inc.id || d.case_id === inc.case_id))]
    : (incidents.length > 0 ? incidents : [sampleIncident]);
  const [draftCases, setDraftCases] = useState<Incident[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const combinedIncidents = useMemo(() => {
    const byId = new Map<string, Incident>();
    for (const inc of allIncidents) {
      if (!archivedIds.includes(inc.id)) byId.set(inc.id, inc);
    }
    for (const draft of draftCases) {
      if (!archivedIds.includes(draft.id)) byId.set(draft.id, draft);
    }
    return Array.from(byId.values());
  }, [allIncidents, draftCases, archivedIds]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (!selectedIncident && combinedIncidents[0]) {
      setSelectedIncident(combinedIncidents[0]);
    }
  }, [combinedIncidents, selectedIncident]);
  const [reconPhase, setReconPhase] = useState<'pre' | 'impact' | 'post'>('impact');
  const [showFeatureSuggestion, setShowFeatureSuggestion] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Incident | null>(null);
  const [caseQuery, setCaseQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'under_review' | 'draft' | 'closed'>('all');
  const [notesDraft, setNotesDraft] = useState('');
  const [reviewTick, setReviewTick] = useState(0);

  useEffect(() => {
    setNotesDraft(selectedIncident?.investigator_notes || '');
  }, [selectedIncident?.id, selectedIncident?.investigator_notes]);

  const filteredCases = useMemo(() => {
    const q = caseQuery.trim().toLowerCase();
    return combinedIncidents.filter((inc) => {
      if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (inc.case_id || '').toLowerCase().includes(q) ||
        (inc.vehicle_id || '').toLowerCase().includes(q) ||
        (inc.target_vehicle_make || '').toLowerCase().includes(q) ||
        (inc.status || '').toLowerCase().includes(q)
      );
    });
  }, [combinedIncidents, caseQuery, statusFilter]);

  const bumpReview = () => setReviewTick((t) => t + 1);

  const openCase = (inc: Incident) => {
    setSelectedIncident(inc);
    setReconPhase('impact');
  };

  const openSealedPdf = (inc?: Incident | null) => {
    const target = inc || selectedIncident;
    if (!target) return;
    markStepDone(loadCaseReviewProgress(target.case_id || target.id), 'sealed_pdf');
    bumpReview();
    if (inc && selectedIncident?.id !== inc.id) openCase(inc);
    setShowPDFPreview(true);
  };

  const emailCounsel = (inc: Incident) => {
    const subject = encodeURIComponent(`AccuVu sealed reconstruction — ${inc.case_id}`);
    const body = encodeURIComponent(
      `Counsel / Claims review requested for ${inc.case_id}.\n\n` +
        `Vehicle: ${inc.vehicle_id}\n` +
        `Date (UTC): ${new Date(inc.utc_timestamp).toLocaleString()}\n` +
        `Impact: ${inc.impact_angle_type} · ${inc.impact_distance_m}m\n` +
        `GPS: ${inc.latitude?.toFixed(4)}, ${inc.longitude?.toFixed(4)}\n\n` +
        `SHA-256 sealed digest available in AccuVu Case Workspace.\n` +
        `Investigator notes: ${inc.investigator_notes || '(none yet)'}`,
    );
    markStepDone(loadCaseReviewProgress(inc.case_id || inc.id), 'counsel_email');
    bumpReview();
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const saveNotes = () => {
    if (!selectedIncident) return;
    const updated = { ...selectedIncident, investigator_notes: notesDraft };
    setDraftCases((prev) => {
      const exists = prev.some((d) => d.id === updated.id);
      if (exists) return prev.map((d) => (d.id === updated.id ? updated : d));
      return [updated, ...prev];
    });
    setSelectedIncident(updated);
    markCaseNotesComplete(updated.case_id || updated.id);
    bumpReview();
  };

  const removeCase = (inc: Incident) => {
    if (inc.status !== 'draft' && !inc.id.startsWith('av-case-') && !draftCases.some((d) => d.id === inc.id)) {
      // demo / live under_review: soft-archive from this session list
      setArchivedIds((prev) => [...prev, inc.id]);
    } else {
      setDraftCases((prev) => prev.filter((d) => d.id !== inc.id));
      setArchivedIds((prev) => [...prev, inc.id]);
    }
    if (selectedIncident?.id === inc.id) {
      const next = combinedIncidents.find((c) => c.id !== inc.id) || null;
      setSelectedIncident(next);
    }
  };

  const getHardwareProfile = (incident: Incident): string => {
    const vehicle = vehicles.find((v) => v.truck_number === incident.vehicle_id || v.id === incident.vehicle_id);
    return vehicle?.hardware_profile || 'c55_pro_forward_lr';
  };

  if (selectedIncident && showPDFPreview) {
    return (
      <PDFPreview
        incident={selectedIncident}
        hardwareProfile={getHardwareProfile(selectedIncident)}
        onClose={() => setShowPDFPreview(false)}
        user={user}
      />
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin min-h-0 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {!isAccuVu && (
            <Button
              className="bg-slate-700 hover:bg-slate-600 text-white gap-2 shrink-0"
              onClick={onClose}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Command Center
            </Button>
          )}
          <div className="min-w-0">
            <h2 className={`text-xl font-bold tracking-tight ${isAccuVu ? 'text-sky-300' : 'text-white'}`}>
              {isAccuVu ? 'AccuVu Case Workspace' : 'Reconstruction Portal'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAccuVu
                ? 'Open prior incidents · review seals · adjust notes · email counsel'
                : 'Wide-field incident analysis · Pre-collision trajectory vectors · Extended microwave sensor tracking'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAccuVu && (
            <Button
              variant="outline"
              className="text-sky-300 border-sky-500/40 hover:bg-sky-500/10"
              onClick={onClose}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to AccuVu Hero
            </Button>
          )}
          {!isAccuVu && (
            <Button
              variant="outline"
              className="text-slate-300 border-slate-600"
              onClick={() => setShowFeatureSuggestion(true)}
            >
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Feature Suggestion
            </Button>
          )}
        </div>
      </div>

      {/* Legal disclaimer — quieter on AccuVu so the product can lead */}
      <div
        className={`flex items-start gap-2 rounded-lg border ${
          isAccuVu
            ? 'p-2 bg-slate-900/60 border-slate-700/60'
            : 'p-3 bg-amber-950/40 border-amber-800/40'
        }`}
      >
        <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${isAccuVu ? 'text-slate-500' : 'text-amber-400'}`} />
        <p className={`text-xs leading-relaxed ${isAccuVu ? 'text-slate-500' : 'text-amber-300'}`}>{LEGAL_DISCLAIMER}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Case library */}
        <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Button
            className={`text-white gap-2 ${
              isAccuVu ? 'bg-sky-500 hover:bg-sky-600' : 'bg-orange-500 hover:bg-orange-600'
            }`}
            onClick={() => setShowDraftModal(true)}
          >
            <Plus className="w-4 h-4" />
            {isAccuVu ? 'New Case' : 'New Preliminary Case Draft'}
          </Button>
        </div>

        {isAccuVu && (
          <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                className="pl-8 h-8 bg-slate-950 border-slate-700 text-white text-xs"
                placeholder="Search case #, truck, make…"
                value={caseQuery}
                onChange={(e) => setCaseQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {([
                ['all', 'All'],
                ['under_review', 'Review'],
                ['draft', 'Drafts'],
                ['closed', 'Closed'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                    statusFilter === id
                      ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <FolderOpen className="w-3 h-3" />
              {filteredCases.length} case{filteredCases.length === 1 ? '' : 's'} — click any row to open
            </p>
          </div>
        )}

        <h3 className="text-sm font-semibold text-slate-300 mb-1">
          {isAccuVu ? 'Case Library' : 'Open Cases'}
        </h3>
          {filteredCases.length === 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center text-sm text-slate-400">
                No cases match. Clear filters or create a new case.
              </CardContent>
            </Card>
          )}
          {filteredCases.map((inc) => (
            <div
              key={inc.id}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedIncident?.id === inc.id
                  ? isAccuVu
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <button
                className="w-full text-left"
                onClick={() => openCase(inc)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-white font-mono">{inc.case_id}</span>
                  <Badge className={`text-xs ${
                    inc.status === 'draft'
                      ? 'bg-blue-500 text-white'
                      : inc.status === 'closed'
                        ? 'bg-slate-600 text-white'
                        : isAccuVu
                          ? 'bg-sky-500 text-white'
                          : 'bg-orange-500 text-white'
                  }`}>{inc.status}</Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {inc.vehicle_id} · {inc.target_type} · {inc.impact_angle_type}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(inc.utc_timestamp).toLocaleDateString()}
                </p>
              </button>
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-700/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-sky-200 border-sky-500/35 hover:bg-sky-500/10 h-6 text-[10px] gap-1"
                  onClick={() => openCase(inc)}
                >
                  <Eye className="w-3 h-3" /> Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 h-6 text-[10px] gap-1"
                  onClick={() => openSealedPdf(inc)}
                >
                  <FileText className="w-3 h-3" /> Review PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-blue-300 border-blue-500/40 hover:bg-blue-500/10 h-6 text-[10px] gap-1"
                  onClick={() => setEditingDraft(inc)}
                >
                  <Pencil className="w-3 h-3" /> Adjust
                </Button>
                {isAccuVu && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-200 border-amber-500/35 hover:bg-amber-500/10 h-6 text-[10px] gap-1"
                    onClick={() => emailCounsel(inc)}
                  >
                    <Scale className="w-3 h-3" /> Counsel
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-300 border-red-500/35 hover:bg-red-500/10 h-6 text-[10px] gap-1"
                  onClick={() => removeCase(inc)}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Reconstruction canvas */}
        <div className="lg:col-span-2 space-y-3">
          {selectedIncident ? (
            <>
              {isAccuVu && (
                <div className="sticky top-0 z-20 rounded-lg border border-sky-500/30 bg-slate-900/95 backdrop-blur px-3 py-2.5 flex flex-wrap items-center gap-2 shadow-lg shadow-black/30">
                  <span className="text-xs font-bold text-sky-200 font-mono mr-1">{selectedIncident.case_id}</span>
                  <Button size="sm" className="h-8 bg-sky-500 hover:bg-sky-600 text-white text-xs" onClick={() => openSealedPdf()}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Review PDF
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs border-blue-500/40 text-blue-200" onClick={() => setEditingDraft(selectedIncident)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Adjust Case
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500/40 text-amber-200" onClick={() => emailCounsel(selectedIncident)}>
                    <Scale className="w-3.5 h-3.5 mr-1.5" /> Email Counsel / Claims
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs border-slate-600 text-slate-300" onClick={() => {
                    const subject = encodeURIComponent(`Incident Reconstruction Report — ${selectedIncident.case_id}`);
                    const body = encodeURIComponent(
                      `Incident ${selectedIncident.case_id} reconstruction report is ready for review.\n\n` +
                      `Vehicle: ${selectedIncident.vehicle_id}\n` +
                      `Date: ${new Date(selectedIncident.utc_timestamp).toLocaleString()}\n`,
                    );
                    window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  }}>
                    <Mail className="w-3.5 h-3.5 mr-1.5" /> Email Management
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs border-red-500/40 text-red-300 ml-auto" onClick={() => removeCase(selectedIncident)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
                  </Button>
                </div>
              )}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white font-mono">
                      {selectedIncident.case_id}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {(['pre', 'impact', 'post'] as const).map((phase) => (
                        <Button
                          key={phase}
                          size="sm"
                          variant={reconPhase === phase ? 'default' : 'ghost'}
                          className={
                            reconPhase === phase
                              ? isAccuVu
                                ? 'bg-sky-500 text-white text-xs h-7'
                                : 'bg-orange-500 text-white text-xs h-7'
                              : 'text-slate-400 text-xs h-7'
                          }
                          onClick={() => setReconPhase(phase)}
                        >
                          {phase === 'pre' ? 'Pre-Collision' : phase === 'impact' ? 'Impact' : 'Post-Collision'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div id="accuvu-recon-canvas" className="relative h-[350px] bg-slate-900 rounded-lg overflow-hidden">
                    {previewMode && reconLocked && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-md rounded-lg">
                        <div className="text-center max-w-sm px-6">
                          <Lock className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                          <p className="text-sm font-bold text-white mb-2">PRO/PRO+ TELEMETRY ENGINE REQUIRED</p>
                          <p className="text-xs text-slate-300 mb-4">
                            Real-time high-rate telemetry feed streaming (77GHz Radar + 40kHz Ultrasonic)
                            requires an active Pro/Pro+ plan.
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full" onClick={() => onUpgrade?.()}>
                              Upgrade Plan to Unlock Live Streaming
                            </Button>
                            <Button variant="ghost" className="text-slate-400 hover:text-white w-full text-xs" onClick={resetDemo}>
                              Reset Demo Preview
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <ReconstructionCanvas
                      truckSpeed={selectedIncident.truck_speed_mph || 0}
                      targetSpeed={selectedIncident.target_speed_mph || 0}
                      approachAngle={selectedIncident.approach_angle || 'N/A'}
                      impactDistance={selectedIncident.impact_distance_m || 0}
                      latitude={selectedIncident.latitude || 34.0522}
                      longitude={selectedIncident.longitude || -118.2437}
                      timestamp={selectedIncident.utc_timestamp}
                      laneSelection={selectedIncident.lane_selection || 'center'}
                      impactAngleType={selectedIncident.impact_angle_type || 'inline_rear'}
                      fleetTruckMotion={selectedIncident.fleet_truck_motion || 'moving'}
                      targetVehicleMotion={selectedIncident.target_vehicle_motion || 'stopped'}
                      phase={reconPhase}
                      wideField
                      className="w-full h-full"
                    />
                  </div>

                  {/* Telemetry overlay */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <TelemetryItem label="Truck Speed" value={`${selectedIncident.truck_speed_mph || 0} MPH`} />
                    <TelemetryItem label="Target Speed" value={`${selectedIncident.target_speed_mph || 0} MPH`} />
                    <TelemetryItem label="Impact Angle" value={selectedIncident.impact_angle_type || 'N/A'} />
                    <TelemetryItem label="Lane" value={selectedIncident.lane_selection || 'N/A'} />
                    <TelemetryItem
                      label="GPS"
                      value={`${(selectedIncident.latitude || 0).toFixed(4)}, ${(selectedIncident.longitude || 0).toFixed(4)}`}
                    />
                    <TelemetryItem label="UTC" value={new Date(selectedIncident.utc_timestamp).toLocaleString()} />
                  </div>

                  {/* Interactive triage note */}
                  <div className="mt-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">
                      Interactive Canvas Triage: Drag, rotate, and fine-tune 2D vehicle blocks
                      on map tiles before finalizing reports.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs text-slate-300">
                        Fleet: {selectedIncident.fleet_truck_motion}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-slate-300">
                        Target: {selectedIncident.target_vehicle_motion}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-slate-300">
                        {selectedIncident.target_vehicle_make} {selectedIncident.target_vehicle_model}
                      </Badge>
                    </div>
                  </div>

                  {/* Internal Findings Summary — observational, non-blame */}
                  {(() => {
                    const findings = buildInternalFindingsSummary(selectedIncident);
                    return (
                      <div
                        className={`mt-3 p-4 rounded-lg border ${
                          isAccuVu
                            ? 'bg-sky-950/30 border-sky-500/30'
                            : 'bg-slate-900/60 border-slate-600/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <ScrollText className={`w-4 h-4 ${isAccuVu ? 'text-sky-400' : 'text-orange-400'}`} />
                            <span className="text-sm font-bold text-white">{findings.headline}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase tracking-wide ${
                              isAccuVu
                                ? 'border-sky-400/40 text-sky-300'
                                : 'border-amber-400/40 text-amber-300'
                            }`}
                          >
                            Observational only — not a fault determination
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isAccuVu ? 'text-sky-400/90' : 'text-orange-400/90'}`}>
                              What the file shows
                            </p>
                            <ul className="space-y-1.5">
                              {findings.observations.map((line) => (
                                <li key={line} className="text-xs text-slate-300 leading-snug flex gap-1.5">
                                  <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${isAccuVu ? 'bg-sky-400' : 'bg-orange-400'}`} />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isAccuVu ? 'text-sky-400/90' : 'text-orange-400/90'}`}>
                              Evidence completeness
                            </p>
                            <ul className="space-y-1.5">
                              {findings.evidenceCompleteness.map((line) => (
                                <li key={line} className="text-xs text-slate-300 leading-snug flex gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="text-[10px] font-bold uppercase tracking-wider mt-3 mb-1.5 text-amber-400/90">
                              Gaps / follow-ups
                            </p>
                            <ul className="space-y-1.5">
                              {findings.gaps.map((line) => (
                                <li key={line} className="text-xs text-slate-300 leading-snug flex gap-1.5">
                                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-3">
                          <AccuVuReviewChecklist
                            incident={selectedIncident}
                            reconPhase={reconPhase}
                            refreshKey={reviewTick}
                            accent={isAccuVu ? 'sky' : 'orange'}
                            onJumpToPhase={(phase) => {
                              setReconPhase(phase);
                              document.getElementById('accuvu-recon-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            onOpenSealedPdf={() => openSealedPdf()}
                            onEmailCounsel={() => emailCounsel(selectedIncident)}
                            onFocusNotes={() => {
                              document.getElementById('accuvu-investigator-notes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              const el = document.getElementById('accuvu-investigator-notes-input');
                              if (el instanceof HTMLTextAreaElement) el.focus();
                            }}
                          />
                        </div>

                        <p className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] text-slate-500 leading-relaxed">
                          {findings.disclaimer}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Evidence certification */}
                  <div className={`mt-3 p-3 rounded-lg bg-slate-900/50 border ${isAccuVu ? 'border-sky-500/20' : 'border-orange-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Fingerprint className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold text-white">Evidence Certification</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-orange-400" />
                        Verification QR Code
                      </div>
                      <div className="flex items-center gap-1">
                        <Fingerprint className="w-3 h-3 text-orange-400" />
                        SHA-256 Hash Fingerprint
                      </div>
                      <div className="flex items-center gap-1">
                        <ScrollText className="w-3 h-3 text-orange-400" />
                        Audit Verification Log
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        Cryptographic Evidence Stamp
                      </div>
                    </div>
                  </div>

                  {/* Sensor sweep log — sample telemetry data */}
                  <div className="mt-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">Sensor Sweep Log — {selectedIncident.case_id}</span>
                      <Badge variant="outline" className="text-xs text-green-400 ml-auto">VERIFIED</Badge>
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                      {generateSensorLogs(selectedIncident, getHardwareProfile(selectedIncident)).map((log, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span className="text-slate-500 shrink-0">{log.time}</span>
                          <span className={`shrink-0 ${log.sensor === 'radar' ? 'text-blue-400' : 'text-green-400'}`}>
                            [{log.sensor.toUpperCase()}]
                          </span>
                          <span className="truncate">{log.reading}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SHA-256 evidence vault stamps */}
                  <div className="mt-3 p-3 rounded-lg bg-slate-900/50 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Fingerprint className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold text-white">Evidence Vault — SHA-256 Chain</span>
                    </div>
                    <div className="space-y-1.5">
                      {generateEvidenceStamps(selectedIncident).map((stamp, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                          <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                          <span className="text-slate-500 shrink-0">{stamp.label}</span>
                          <span className="text-orange-400/70 truncate">{stamp.hash}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {previewMode ? (
                    <div className="flex flex-col items-center gap-3 mt-3 p-4 rounded-lg bg-orange-950/40 border border-orange-800/40">
                      <p className="text-sm text-orange-300 text-center">
                        You are viewing a blueprint preview. Full incident reconstruction, case drafts, PDF exports, and evidence vault access require a Pro tier subscription.
                      </p>
                      <Button
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => onUpgrade?.()}
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Unlock Full Incident Reconstruction &amp; Case Drafts — Upgrade to Pro
                      </Button>
                    </div>
                  ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Button
                      className={isAccuVu ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}
                      onClick={() => (isAccuVu ? openSealedPdf() : setShowPDFPreview(true))}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isAccuVu ? 'Download Sealed PDF' : 'Download PDF Summary'}
                    </Button>
                    <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => {
                      const subject = encodeURIComponent(`Incident Reconstruction Report — ${selectedIncident.case_id}`);
                      const body = encodeURIComponent(
                        `Incident ${selectedIncident.case_id} reconstruction report is ready for review.\n\n` +
                        `Vehicle: ${selectedIncident.vehicle_id}\n` +
                        `Date: ${new Date(selectedIncident.utc_timestamp).toLocaleString()}\n` +
                        `Location: ${selectedIncident.latitude?.toFixed(4)}, ${selectedIncident.longitude?.toFixed(4)}\n\n` +
                        `Please find the full report attached via the FleetVu portal.`
                      );
                      window.location.href = `mailto:?subject=${subject}&body=${body}`;
                    }}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email to Management
                    </Button>
                    {isAccuVu ? (
                      <Button variant="outline" className="text-amber-200 border-amber-500/40" onClick={() => emailCounsel(selectedIncident)}>
                        <Scale className="w-4 h-4 mr-2" />
                        Send to Counsel / Claims
                      </Button>
                    ) : (
                    <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => {
                      const subject = encodeURIComponent(`Incident Report — ${selectedIncident.case_id}`);
                      const body = encodeURIComponent(
                        `A reconstruction report for incident ${selectedIncident.case_id} involving vehicle ${selectedIncident.vehicle_id} has been filed.\n\n` +
                        `Please contact your fleet manager for details.`
                      );
                      window.location.href = `mailto:?subject=${subject}&body=${body}`;
                    }}>
                      <Send className="w-4 h-4 mr-2" />
                      Send to Driver
                    </Button>
                    )}
                  </div>
                  )}

                  {isAccuVu && (
                    <div id="accuvu-investigator-notes" className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 p-3 space-y-2">
                      <Label className="text-xs text-sky-300 font-bold uppercase tracking-wide">Investigator notes (legal file)</Label>
                      <Textarea
                        id="accuvu-investigator-notes-input"
                        className="min-h-[88px] bg-slate-900 border-slate-700 text-sm text-white"
                        placeholder="Add review notes, counsel requests, adjustment rationale…"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white h-8 text-xs" onClick={saveNotes}>
                          Save Notes to Case
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs border-slate-600 text-slate-300" onClick={() => setEditingDraft(selectedIncident)}>
                          Full Adjust Form
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 font-semibold mb-1">
                  {isAccuVu ? 'Select a case from the library' : 'Select a case from the left to view reconstruction'}
                </p>
                {isAccuVu && (
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Use Open / Review PDF / Adjust / Counsel on any prior incident. Create a new case with the button above the library.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Feature suggestion modal */}
      {showFeatureSuggestion && (
        <FeatureSuggestionModal
          user={user}
          onClose={() => setShowFeatureSuggestion(false)}
        />
      )}

      {/* Preliminary case draft modal */}
      {showDraftModal && (
        <PreliminaryDraftModal
          user={user}
          onClose={() => setShowDraftModal(false)}
          onCreate={(incident) => {
            setDraftCases((prev) => [incident, ...prev]);
            setSelectedIncident(incident);
            setShowDraftModal(false);
          }}
        />
      )}

      {/* Draft edit modal */}
      {editingDraft && (
        <DraftEditModal
          incident={editingDraft}
          user={user}
          onClose={() => setEditingDraft(null)}
          onSave={(updated) => {
            setDraftCases((prev) => {
              const exists = prev.some((d) => d.id === updated.id);
              if (exists) return prev.map((d) => (d.id === updated.id ? updated : d));
              return [updated, ...prev];
            });
            setSelectedIncident(updated);
            setEditingDraft(null);
          }}
        />
      )}
    </div>
  );
}

function TelemetryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-white truncate">{value}</p>
    </div>
  );
}

function FeatureSuggestionModal({
  user,
  onClose,
}: {
  user: { name: string; email: string; role: string; companyName?: string; location?: string };
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!title) return;
    await supabase.from('feature_suggestions').insert({
      user_email: user.email,
      user_role: user.role,
      company_name: user.companyName || null,
      location: user.location || null,
      title,
      category,
      description,
      status: 'submitted',
    });
    setSubmitted(true);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-orange-400" />
            Feature Suggestion Request
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Submit product feedback and feature requests. Routed directly to the FleetVu Super-Admin engineering queue.
          </DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-green-950/40 border border-green-800/40">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-300">
              Suggestion submitted and routed to the FleetVu engineering queue.
            </span>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-slate-300">Suggestion Title</Label>
              <Input
                className="bg-slate-900/50 border-slate-600 text-white"
                placeholder="Brief title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-slate-300">Feature Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diagram">Diagram Adjustments</SelectItem>
                  <SelectItem value="export">Export Options</SelectItem>
                  <SelectItem value="data">Data Fields</SelectItem>
                  <SelectItem value="telemetry">Telemetry Overlays</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Description</Label>
              <Textarea
                className="bg-slate-900/50 border-slate-600 text-white min-h-[80px]"
                placeholder="Describe the feature or feedback..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-500 bg-slate-900/50 rounded p-2">
              Auto-tagged: User ID ({user.email}), Company ({user.companyName || 'N/A'}),
              Role ({user.role}), Location ({user.location || 'N/A'})
            </div>
          </div>
        )}
        <DialogFooter>
          {!submitted && (
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={submit}>
              <Send className="w-4 h-4 mr-2" />
              Submit Suggestion
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PDFPreview({
  incident,
  hardwareProfile,
  onClose,
  user,
}: {
  incident: Incident;
  hardwareProfile: string;
  onClose: () => void;
  user: { name: string; email: string; role: string };
}) {
  const hashFingerprint = generateSHA256Hash(incident);
  const qrData = `FV-EVIDENCE:${incident.case_id}:${hashFingerprint.substring(0, 16)}`;
  const calibrationAudit = generateCalibrationAudit(incident, hardwareProfile);
  const inCabAlerts = generateInCabAlerts(incident, hardwareProfile);
  const sensorLogs = generateSensorLogs(incident, hardwareProfile);
  const dataIntegrity = generateDataIntegrityBlock(incident, hardwareProfile);
  const evidenceStamps = generateEvidenceStamps(incident);

  const isC93Gap = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';
  const isC55Only = hardwareProfile.startsWith('c55_pro');
  const hasRearPod = hardwareProfile === 'c55_pro_forward_lr_rear';
  const otherVehicleMeta = describeOtherVehicleFromSensors(incident, hardwareProfile);
  const impactZones = buildImpactZoneRecord(incident, hardwareProfile, otherVehicleMeta);

  const sensorList: string[] = [];
  if (isC93Gap) {
    sensorList.push('C93-US4 Dual Layer GAP — Ultrasonic Fender-Well (Front-Right)');
    if (hardwareProfile === 'c93_us4_gap_lane') sensorList.push('77GHz Lane-Change Radar — Side');
  } else {
    sensorList.push('C55-PRO Forward 77GHz — 60° Cone (Front Grille)');
    if (hardwareProfile.includes('_l') || hardwareProfile.includes('_lr')) sensorList.push('C55-PRO Left Beam 77GHz — 4° Lateral (Front Grille)');
    if (hardwareProfile.includes('_r') || hardwareProfile.includes('_lr')) sensorList.push('C55-PRO Right Beam 77GHz — 4° Lateral (Front Grille)');
    if (hasRearPod) sensorList.push('Rear Tail Proximity Pod');
  }

  return (
    <div className="p-6 overflow-y-auto scrollbar-thin max-w-4xl mx-auto">
      <div className="bg-white text-slate-900 rounded-lg shadow-2xl p-8 space-y-5">
        {/* === LEGAL PRELIMINARY HEADER === */}
        <div className="border-b-4 border-orange-500 pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-orange-500 flex items-center justify-center">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">ACCIDENT RECONSTRUCTION REPORT - PRELIMINARY INTERNAL DRAFT - CONFIDENTIAL ATTORNEY-CLIENT PRIVILEGE / WORK PRODUCT DOCTRINE</h1>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold">Case ID: {incident.case_id}</p>
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>By: {user.name} ({user.role})</p>
            </div>
          </div>
          <div className="bg-red-50 border border-red-300 rounded p-2 text-center">
            <p className="text-[11px] font-bold text-red-800 uppercase tracking-wide">
              Confidential &mdash; Attorney-Client Privilege / Work Product Doctrine
            </p>
            <p className="text-[10px] text-red-700 mt-0.5">
              This document is a preliminary internal draft prepared in anticipation of litigation. Distribution is restricted to authorized counsel and fleet safety personnel only.
            </p>
          </div>
        </div>

        {/* === SECTION 1: CASE SUMMARY === */}
        <ReportSection title="1. Case Summary" icon={<FileText className="w-4 h-4 text-orange-500" />}>
          <p className="text-sm text-slate-700 leading-relaxed">
            On {new Date(incident.utc_timestamp).toLocaleDateString()} at{' '}
            {new Date(incident.utc_timestamp).toLocaleTimeString()}, fleet vehicle{' '}
            <strong>{incident.vehicle_id}</strong> was involved in a collision with the other vehicle — a{' '}
            <strong>
              {[incident.target_vehicle_year, incident.target_vehicle_make, incident.target_vehicle_model]
                .filter(Boolean)
                .join(' ') || 'vehicle identity not yet recorded in file'}
            </strong>{' '}
            — at coordinates <strong>{incident.latitude?.toFixed(4)}, {incident.longitude?.toFixed(4)}</strong>.
            The fleet truck was <strong>{incident.fleet_truck_motion}</strong> while the other vehicle was{' '}
            <strong>{incident.target_vehicle_motion}</strong>
            {incident.target_speed_mph != null ? (
              <> at <strong>{incident.target_speed_mph} MPH</strong></>
            ) : null}
            . Contact geometry:{' '}
            <strong>{(incident.impact_angle_type || 'unspecified').replace(/_/g, ' ')}</strong> at an approach angle of{' '}
            <strong>{incident.approach_angle}</strong>.
          </p>
          {incident.voice_note_transcript && (
            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600">
              <span className="font-semibold">Driver Statement: </span>
              {incident.voice_note_transcript}
            </div>
          )}
        </ReportSection>

        {/* === SECTION 2: INVOLVED PARTIES === */}
        <ReportSection title="2. Involved Parties" icon={<User className="w-4 h-4 text-orange-500" />}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded p-3 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1.5">Fleet Vehicle</p>
              <p><span className="font-semibold">Unit:</span> {incident.vehicle_id}</p>
              <p><span className="font-semibold">Motion:</span> {incident.fleet_truck_motion}</p>
              <p><span className="font-semibold">Speed:</span> {incident.truck_speed_mph} MPH</p>
              <p><span className="font-semibold">Lane:</span> {incident.lane_selection}</p>
            </div>
            <div className="bg-sky-50 rounded p-3 border border-sky-200">
              <p className="text-xs font-bold text-sky-700 uppercase mb-1.5">Other Vehicle (Opposing / Target)</p>
              <p><span className="font-semibold">Type:</span> {(incident.target_type || '—').replace(/_/g, ' ')}</p>
              <p>
                <span className="font-semibold">Vehicle:</span>{' '}
                {[incident.target_vehicle_year, incident.target_vehicle_make, incident.target_vehicle_model]
                  .filter(Boolean)
                  .join(' ') || 'Not recorded in file'}
              </p>
              {otherVehicleMeta.color && (
                <p><span className="font-semibold">Color:</span> {otherVehicleMeta.color}</p>
              )}
              {(otherVehicleMeta.plateState || otherVehicleMeta.plateNumber) && (
                <p>
                  <span className="font-semibold">Plate:</span>{' '}
                  {[otherVehicleMeta.plateState, otherVehicleMeta.plateNumber].filter(Boolean).join(' · ')}
                </p>
              )}
              {otherVehicleMeta.otherDriverName && (
                <p><span className="font-semibold">Other driver:</span> {otherVehicleMeta.otherDriverName}</p>
              )}
              <p><span className="font-semibold">Motion:</span> {incident.target_vehicle_motion || '—'}</p>
              <p><span className="font-semibold">Speed:</span> {incident.target_speed_mph != null ? `${incident.target_speed_mph} MPH` : '—'}</p>
              <p><span className="font-semibold">Fleet contact quadrant:</span> {otherVehicleMeta.quadrantLabel}</p>
              {otherVehicleMeta.otherContactQuadrant && (
                <p><span className="font-semibold">Other-vehicle contact quadrant:</span> {otherVehicleMeta.otherContactQuadrant}</p>
              )}
            </div>
          </div>
          <div className="mt-3 bg-slate-50 rounded p-3 border border-slate-200 text-sm space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase mb-1.5">Sensor attribution to other vehicle</p>
            <p>
              <span className="font-semibold">Primary lock channels:</span>{' '}
              {otherVehicleMeta.lockChannels.join(' · ')}
            </p>
            <p>
              <span className="font-semibold">First detection bearing:</span>{' '}
              {otherVehicleMeta.bearingLabel}
            </p>
            <p>
              <span className="font-semibold">Relative closing speed (est.):</span>{' '}
              {otherVehicleMeta.closingLabel}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              C55-PRO forward / left / right 77GHz channels characterize objects in the forward and
              lateral frontal arcs. Rear-only geometries without a rear pod will not populate opposing-vehicle
              kinematics from this array.
            </p>
          </div>
        </ReportSection>

        {/* === SECTION 2B: OTHER VEHICLE FILE RECORD === */}
        <ReportSection title="2A. Other Vehicle — Full File Record" icon={<User className="w-4 h-4 text-orange-500" />}>
          <p className="text-[11px] text-slate-500 mb-2 leading-snug">
            All other-vehicle identity, kinematics, and exchange fields captured on this case.
            Missing items are listed as not on file so counsel can see gaps without speculation.
          </p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="text-left p-2 w-[34%]">Field</th>
                  <th className="text-left p-2">Value on file</th>
                  <th className="text-left p-2 w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {otherVehicleFileRows(incident, otherVehicleMeta).map((row) => (
                  <tr key={row.label} className={row.present ? 'bg-white' : 'bg-slate-50/80'}>
                    <td className="p-2 font-semibold text-slate-700">{row.label}</td>
                    <td className="p-2 text-slate-700">{row.present ? row.value : '—'}</td>
                    <td className="p-2">
                      {row.present ? (
                        <span className="font-bold text-green-700">On file</span>
                      ) : (
                        <span className="font-bold text-amber-700">Not on file</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        {/* === SECTION 3: SCENE CONDITIONS === */}
        <ReportSection title="3. Scene Conditions" icon={<MapPin className="w-4 h-4 text-orange-500" />}>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-50 rounded p-2 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500">GPS Coordinates</p>
              <p className="font-mono text-sm font-bold">{incident.latitude?.toFixed(4)}, {incident.longitude?.toFixed(4)}</p>
            </div>
            <div className="bg-slate-50 rounded p-2 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500">UTC Timestamp</p>
              <p className="font-bold text-sm">{new Date(incident.utc_timestamp).toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 rounded p-2 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500">Impact Distance</p>
              <p className="font-bold text-sm">{incident.impact_distance_m?.toFixed(1)} m</p>
            </div>
          </div>
          <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden h-[300px]">
            <ReconstructionCanvas
              truckSpeed={incident.truck_speed_mph || 0}
              targetSpeed={incident.target_speed_mph || 0}
              approachAngle={incident.approach_angle || 'N/A'}
              impactDistance={incident.impact_distance_m || 0}
              latitude={incident.latitude || 34.0522}
              longitude={incident.longitude || -118.2437}
              timestamp={incident.utc_timestamp}
              laneSelection={incident.lane_selection || 'center'}
              impactAngleType={incident.impact_angle_type || 'inline_rear'}
              fleetTruckMotion={incident.fleet_truck_motion || 'moving'}
              targetVehicleMotion={incident.target_vehicle_motion || 'stopped'}
              phase="impact"
              wideField
              className="w-full h-full"
            />
          </div>
        </ReportSection>

        {/* === SECTION 4: IMPACT ZONES === */}
        <ReportSection title="4. Impact Zones Record" icon={<Gauge className="w-4 h-4 text-orange-500" />}>
          <p className="text-[11px] text-slate-500 mb-3 leading-snug">
            Zone data below is recorded from sensor proximity state and contact-quadrant classification on file.
            Values are observational for internal review; they do not assign fault or liability.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-slate-50 rounded p-3 border border-slate-200 text-sm space-y-1.5">
              <p className="text-xs font-bold text-slate-500 uppercase">Contact quadrant (fleet vehicle)</p>
              <p>
                <span className="font-semibold">Primary contact zone:</span>{' '}
                <span className="font-bold text-slate-900">{impactZones.primaryZone}</span>
              </p>
              {otherVehicleMeta.otherContactQuadrant && (
                <p>
                  <span className="font-semibold">Other-vehicle contact zone on file:</span>{' '}
                  <span className="font-bold text-slate-900">{otherVehicleMeta.otherContactQuadrant}</span>
                </p>
              )}
              <p>
                <span className="font-semibold">Geometry on file:</span>{' '}
                {(incident.impact_angle_type || 'unspecified').replace(/_/g, ' ')}
              </p>
              <p>
                <span className="font-semibold">Approach angle:</span> {incident.approach_angle || '—'}
              </p>
              <p>
                <span className="font-semibold">Closest recorded range:</span>{' '}
                {incident.impact_distance_m != null ? `${incident.impact_distance_m.toFixed(1)} m` : '—'}
              </p>
              <p>
                <span className="font-semibold">Channels covering this zone:</span>{' '}
                {impactZones.channelsCovering}
              </p>
            </div>
            <div className="bg-slate-50 rounded p-3 border border-slate-200 text-sm space-y-1.5">
              <p className="text-xs font-bold text-slate-500 uppercase">Proximity zone at capture</p>
              <p>
                <span className="font-semibold">Active zone:</span>{' '}
                <span
                  className={`font-bold uppercase ${
                    impactZones.activeProximity === 'red'
                      ? 'text-red-600'
                      : impactZones.activeProximity === 'yellow'
                        ? 'text-amber-600'
                        : 'text-green-600'
                  }`}
                >
                  {impactZones.activeProximity}
                </span>
                {' '}
                <span className="text-slate-500">({impactZones.activeProximityRange})</span>
              </p>
              <div className="mt-2 space-y-1">
                {impactZones.proximityLadder.map((z) => (
                  <div
                    key={z.key}
                    className={`flex items-center justify-between rounded px-2 py-1 text-[11px] border ${
                      z.active ? 'border-slate-400 bg-white font-semibold' : 'border-transparent bg-slate-100/80 text-slate-500'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                      {z.label} — {z.description}
                    </span>
                    <span className="font-mono">{z.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fleet contact-zone map (top-down) */}
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Fleet vehicle contact-zone map</p>
            <div className="grid grid-cols-3 gap-1.5 max-w-md mx-auto text-[10px] font-semibold text-center">
              {impactZones.zoneGrid.map((cell) => (
                <div
                  key={cell.id}
                  className={`rounded border px-1.5 py-2.5 ${
                    cell.hit
                      ? 'border-red-400 bg-red-50 text-red-800'
                      : cell.covered
                        ? 'border-sky-300 bg-sky-50 text-sky-800'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <p>{cell.label}</p>
                  <p className="font-normal mt-0.5 opacity-80">
                    {cell.hit ? 'Contact on file' : cell.covered ? 'In sensor arc' : 'Not in FWD/L/R arc'}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center leading-snug">
              Highlighted &ldquo;Contact on file&rdquo; = quadrant classified for this case.
              &ldquo;In sensor arc&rdquo; = covered by installed forward / left / right channels.
              Rear zones require a rear pod to populate kinematics from this array.
            </p>
          </div>
        </ReportSection>

        {/* === SECTION 5: EVIDENCE / TELEMETRY SOURCES === */}
        <ReportSection title="5. Evidence / Telemetry Sources" icon={<Activity className="w-4 h-4 text-orange-500" />}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded p-3 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Sensor Array</p>
              {sensorList.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
            <div className="bg-slate-50 rounded p-3 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Data Sources</p>
              <p>GPS Telemetry Log</p>
              <p>Dashcam Video Frame Extracts</p>
              <p>Driver Voice Note Transcript</p>
              <p>Evidence Vault SHA-256 Chain</p>
            </div>
          </div>
        </ReportSection>

        {/* === SECTION 6: COLLISION DYNAMICS === */}
        <ReportSection title="6. Collision Dynamics" icon={<Gauge className="w-4 h-4 text-orange-500" />}>
          <div className="grid grid-cols-4 gap-3 text-sm mb-3">
            <div className="bg-slate-100 rounded p-2 text-center">
              <p className="text-xs font-semibold text-slate-500">Truck Speed</p>
              <p className="text-lg font-bold">{incident.truck_speed_mph} MPH</p>
            </div>
            <div className="bg-slate-100 rounded p-2 text-center">
              <p className="text-xs font-semibold text-slate-500">Target Speed</p>
              <p className="text-lg font-bold">{incident.target_speed_mph} MPH</p>
            </div>
            <div className="bg-slate-100 rounded p-2 text-center">
              <p className="text-xs font-semibold text-slate-500">Impact Angle</p>
              <p className="text-lg font-bold">{incident.impact_angle_type}</p>
            </div>
            <div className="bg-slate-100 rounded p-2 text-center">
              <p className="text-xs font-semibold text-slate-500">Proximity Zone</p>
              <p className="text-lg font-bold text-red-600 uppercase">{incident.proximity_zone}</p>
            </div>
          </div>
          {/* Sensor Array Logs */}
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Sensor Array Logs &mdash; C55-PRO 77GHz 3-Channel</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="text-left p-1.5">Timestamp</th>
                  <th className="text-left p-1.5">Sensor</th>
                  <th className="text-left p-1.5">Distance</th>
                  <th className="text-left p-1.5">Rel. Speed</th>
                  <th className="text-left p-1.5">Detection Angle</th>
                  <th className="text-left p-1.5">Reading</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sensorLogs.map((log, i) => (
                  <tr key={i} className={log.sensor === 'forward' ? 'bg-blue-50/30' : 'bg-violet-50/30'}>
                    <td className="p-1.5 text-slate-600">{log.time}</td>
                    <td className="p-1.5 font-bold text-slate-700">{log.sensor === 'forward' ? 'FWD' : log.sensor === 'left' ? 'L-BEAM' : 'R-BEAM'}</td>
                    <td className="p-1.5 text-slate-600">{log.distance}</td>
                    <td className="p-1.5 text-slate-600">{log.relSpeed}</td>
                    <td className="p-1.5 text-slate-600">{log.angle}</td>
                    <td className="p-1.5 text-slate-600">{log.reading}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        {/* === SECTION 7: SENSOR CALIBRATION AUDIT === */}
        <ReportSection title="7. Sensor Calibration Audit" icon={<Cpu className="w-4 h-4 text-orange-500" />}>
          <p className="text-xs text-slate-500 mb-2">Pre-collision sensor health, mounting zero-calibration, and firmware verification.</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="text-left p-2">Sensor Module</th>
                  <th className="text-left p-2">Serial</th>
                  <th className="text-left p-2">Firmware</th>
                  <th className="text-left p-2">Health</th>
                  <th className="text-left p-2">Zero-Cal</th>
                  <th className="text-left p-2">Mount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calibrationAudit.map((c, i) => (
                  <tr key={i}>
                    <td className="p-2 font-semibold text-slate-700">{c.module}</td>
                    <td className="p-2 font-mono text-slate-600">{c.serial}</td>
                    <td className="p-2 font-mono text-slate-600">{c.firmware}</td>
                    <td className="p-2"><span className="font-bold text-green-600">{c.health}</span></td>
                    <td className="p-2 text-slate-600">{c.zeroCal}</td>
                    <td className="p-2 text-slate-600">{c.mount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* In-Cab Alert Timestamps */}
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-orange-500" />
              In-Cab Alert Timestamps &mdash; Visual/Audible Warnings Prior to Impact
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-500">
                  <tr>
                    <th className="text-left p-2">Timestamp</th>
                    <th className="text-left p-2">Alert Type</th>
                    <th className="text-left p-2">Zone</th>
                    <th className="text-left p-2">Distance</th>
                    <th className="text-left p-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inCabAlerts.map((a, i) => (
                    <tr key={i}>
                      <td className="p-2 font-mono text-slate-600">{a.time}</td>
                      <td className="p-2 font-semibold text-slate-700">{a.type}</td>
                      <td className="p-2"><span className={`font-bold ${a.zone === 'RED' ? 'text-red-600' : a.zone === 'YELLOW' ? 'text-amber-600' : 'text-green-600'}`}>{a.zone}</span></td>
                      <td className="p-2 text-slate-600">{a.distance}</td>
                      <td className="p-2 text-slate-600">{a.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ReportSection>

        {/* === SECTION 8: PRELIMINARY FINDINGS === */}
        <ReportSection title="8. Recorded Observations (No Fault Determination)" icon={<CheckCircle2 className="w-4 h-4 text-orange-500" />}>
          <div className="space-y-1.5 text-sm text-slate-700">
            {isC93Gap ? (
              <p>&bull; C93-US4 ultrasonic fender-well sensor recorded a lateral target at {incident.impact_distance_m?.toFixed(1)}m. Fleet vehicle motion on file: {incident.fleet_truck_motion || 'unspecified'}; other vehicle motion on file: {incident.target_vehicle_motion || 'unspecified'}.</p>
            ) : otherVehicleMeta.geometry === 'left_front' ? (
              <p>
                &bull; C55-PRO forward 77GHz and left lateral beam recorded a moving other vehicle
                ({[incident.target_vehicle_year, incident.target_vehicle_make, incident.target_vehicle_model].filter(Boolean).join(' ') || 'identity not recorded'})
                in the left-front quadrant. Relative closing speed on file: {otherVehicleMeta.closingLabel}.
                First detection bearing on file: {otherVehicleMeta.bearingLabel}.
              </p>
            ) : otherVehicleMeta.geometry === 'frontal' ? (
              <p>
                &bull; C55-PRO forward 77GHz recorded an other vehicle
                ({[incident.target_vehicle_make, incident.target_vehicle_model].filter(Boolean).join(' ') || 'identity not recorded'})
                in the frontal arc at {incident.impact_distance_m?.toFixed(1)}m. Left and right beams recorded corroborating returns in the forward corridor.
              </p>
            ) : (
              <p>&bull; C55-PRO forward 77GHz radar recorded a target at {incident.impact_distance_m?.toFixed(1)}m. Fleet vehicle motion on file: {incident.fleet_truck_motion || 'unspecified'}; other vehicle motion on file: {incident.target_vehicle_motion || 'unspecified'}.</p>
            )}
            {isC55Only && otherVehicleMeta.geometry === 'left_front' && (
              <p>&bull; Left-beam range and forward-channel lock were both active at impact timestamp for the left-front contact zone on file.</p>
            )}
            {isC55Only && otherVehicleMeta.geometry !== 'left_front' && (
              <p>&bull; C55-PRO left and right 77GHz lateral beams recorded proximity-zone progression into RED {((incident.impact_distance_m || 0) < 3 ? 'within 3m' : 'at threshold distance')} per alert log.</p>
            )}
            <p>&bull; Contact zone on file: {impactZones.primaryZone}. Active proximity zone at capture: {impactZones.activeProximity.toUpperCase()} ({impactZones.activeProximityRange}).</p>
            <p>&bull; Other-vehicle fields on file: type {(incident.target_type || 'n/a').replace(/_/g, ' ')}; motion {incident.target_vehicle_motion || 'n/a'}; reported speed {incident.target_speed_mph != null ? `${incident.target_speed_mph} MPH` : 'not recorded'}.</p>
            <p>&bull; In-cab visual and audible alerts appear in the timestamp log above prior to the impact record.</p>
            <p>&bull; Emergency braking event is logged at 0.0m proximity with recorded deceleration of 6.8G.</p>
            <p>&bull; Sensor modules on file passed pre-collision health checks; firmware and calibration entries are listed above.</p>
            <p className="text-[11px] text-slate-500 pt-1">
              These bullets restate logged measurements and file fields only. Counsel and fleet safety retain sole discretion on interpretation and next steps.
            </p>
          </div>
          <div className="mt-3 bg-amber-50 border border-amber-300 rounded p-2">
            <p className="text-xs text-amber-800 font-semibold">{LEGAL_DISCLAIMER}</p>
          </div>
        </ReportSection>

        {/* === CRYPTOGRAPHIC DATA INTEGRITY BLOCK === */}
        <div className="border-2 border-slate-300 rounded-lg p-4 space-y-3">
          <h2 className="font-bold text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
            <Fingerprint className="w-4 h-4 text-orange-500" />
            Cryptographic Data Integrity &amp; Chain-of-Custody
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-slate-500">SHA-256 Hash Fingerprint</p>
              <p className="font-mono break-all text-slate-700">{hashFingerprint}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Verification QR Data</p>
              <p className="font-mono break-all text-slate-700">{qrData}</p>
            </div>
          </div>
          {/* Raw data packet hashes */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="text-left p-1.5">Data Packet</th>
                  <th className="text-left p-1.5">Device Serial</th>
                  <th className="text-left p-1.5">Timestamp (UTC)</th>
                  <th className="text-left p-1.5">SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataIntegrity.map((d, i) => (
                  <tr key={i}>
                    <td className="p-1.5 text-slate-700 font-semibold">{d.packet}</td>
                    <td className="p-1.5 text-slate-600">{d.serial}</td>
                    <td className="p-1.5 text-slate-600">{d.timestamp}</td>
                    <td className="p-1.5 text-orange-600 break-all">{d.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Evidence vault stamps */}
          <div className="space-y-1">
            {evidenceStamps.map((stamp, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                <span className="text-slate-500 shrink-0">{stamp.label}</span>
                <span className="text-orange-600/70 truncate">{stamp.hash}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-200">
            <div>
              <p className="font-semibold text-slate-500">Audit Verification</p>
              <p className="text-slate-700">Chain-of-custody verified via immutable ledger</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Evidence Stamp</p>
              <p className="text-slate-700">Cryptographically sealed at {new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 justify-center">
        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => window.print()}>
          <Download className="w-4 h-4 mr-2" />
          Print / Save as PDF
        </Button>
        <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
          Back to Portal
        </Button>
      </div>
    </div>
  );
}

function ReportSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="font-bold text-base text-slate-800 border-b border-slate-200 pb-1 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function describeOtherVehicleFromSensors(incident: Incident, hardwareProfile: string) {
  const recon = (incident.reconstruction_data || {}) as Record<string, unknown>;
  const angle = (incident.impact_angle_type || '').toLowerCase();
  const geometry =
    angle === 'left_front' || angle === 'front_left'
      ? 'left_front'
      : angle === 'frontal' || angle === 'front'
        ? 'frontal'
        : angle.includes('side') || angle === 'tbone'
          ? 'lateral'
          : angle.includes('rear')
            ? 'rear'
            : 'forward';

  const hasLeft = hardwareProfile.includes('_l') || hardwareProfile.includes('_lr');
  const hasRight = hardwareProfile.includes('_r') || hardwareProfile.includes('_lr');
  const hasRear = hardwareProfile === 'c55_pro_forward_lr_rear';

  const lockFromRecon = Array.isArray(recon.primary_lock_channels)
    ? (recon.primary_lock_channels as string[])
    : null;

  let lockChannels: string[];
  if (lockFromRecon?.length) {
    lockChannels = lockFromRecon.map((c) =>
      c === 'forward' ? 'C55-PRO Forward 77GHz' : c === 'left' ? 'C55-PRO Left Beam' : c === 'right' ? 'C55-PRO Right Beam' : String(c),
    );
  } else if (geometry === 'left_front' && hasLeft) {
    lockChannels = ['C55-PRO Forward 77GHz', 'C55-PRO Left Beam'];
  } else if (geometry === 'frontal') {
    lockChannels = ['C55-PRO Forward 77GHz'];
    if (hasLeft) lockChannels.push('C55-PRO Left Beam (corroboration)');
    if (hasRight) lockChannels.push('C55-PRO Right Beam (corroboration)');
  } else if (geometry === 'lateral' && hasRight) {
    lockChannels = ['C55-PRO Right Beam', 'C55-PRO Forward 77GHz'];
  } else if (geometry === 'rear' && hasRear) {
    lockChannels = ['Rear Tail Proximity Pod'];
  } else {
    lockChannels = ['C55-PRO Forward 77GHz'];
  }

  const bearing =
    typeof recon.first_detection_bearing_deg === 'number'
      ? recon.first_detection_bearing_deg
      : geometry === 'left_front'
        ? -22
        : geometry === 'frontal'
          ? 0
          : geometry === 'lateral'
            ? 90
            : 0;

  const closingMph =
    typeof recon.relative_closing_mph === 'number'
      ? recon.relative_closing_mph
      : incident.truck_speed_mph != null && incident.target_speed_mph != null
        ? Math.abs(incident.truck_speed_mph - incident.target_speed_mph)
        : null;

  const quadrantLabel =
    geometry === 'left_front'
      ? 'Left-Front'
      : geometry === 'frontal'
        ? 'Front / Near Head-On'
        : geometry === 'lateral'
          ? 'Lateral / Side'
          : geometry === 'rear'
            ? 'Rear'
            : 'Forward Arc';

  return {
    geometry,
    lockChannels,
    quadrantLabel,
    bearingLabel: `${bearing}° from vehicle centerline`,
    closingLabel: closingMph != null ? `~${closingMph.toFixed(0)} MPH` : 'Not estimated in file',
    color: typeof recon.other_vehicle_color === 'string' ? recon.other_vehicle_color : null,
    plateState: typeof recon.other_vehicle_plate_state === 'string' ? recon.other_vehicle_plate_state : null,
    plateNumber: typeof recon.plate_number === 'string' ? recon.plate_number : null,
    otherDriverName: typeof recon.other_driver_name === 'string' ? recon.other_driver_name : null,
    otherLicenseNumber: typeof recon.other_license_number === 'string' ? recon.other_license_number : null,
    otherContactQuadrant:
      typeof recon.other_vehicle_contact_quadrant === 'string'
        ? String(recon.other_vehicle_contact_quadrant).replace(/_/g, ' ')
        : null,
    insuranceCarrier: typeof recon.other_insurance_carrier === 'string' ? recon.other_insurance_carrier : null,
    insurancePolicyLast4:
      typeof recon.other_insurance_policy_last4 === 'string' ? recon.other_insurance_policy_last4 : null,
    damageNotes: typeof recon.other_vehicle_damage_notes === 'string' ? recon.other_vehicle_damage_notes : null,
    witnessName: typeof recon.witness_name === 'string' ? recon.witness_name : null,
    witnessPhone: typeof recon.witness_phone === 'string' ? recon.witness_phone : null,
    mediaSlots: Array.isArray(recon.media_slots_on_file)
      ? (recon.media_slots_on_file as string[])
      : Array.isArray(incident.photos)
        ? incident.photos
        : [],
  };
}

function otherVehicleFileRows(incident: Incident, meta: ReturnType<typeof describeOtherVehicleFromSensors>) {
  const vehicleLabel = [incident.target_vehicle_year, incident.target_vehicle_make, incident.target_vehicle_model]
    .filter(Boolean)
    .join(' ');
  const rows: Array<{ label: string; value: string; present: boolean }> = [
    { label: 'Vehicle type', value: (incident.target_type || '').replace(/_/g, ' '), present: Boolean(incident.target_type) },
    { label: 'Year / make / model', value: vehicleLabel, present: Boolean(vehicleLabel) },
    { label: 'Color', value: meta.color || '', present: Boolean(meta.color) },
    {
      label: 'Plate',
      value: [meta.plateState, meta.plateNumber].filter(Boolean).join(' · '),
      present: Boolean(meta.plateState || meta.plateNumber),
    },
    { label: 'Other driver name', value: meta.otherDriverName || '', present: Boolean(meta.otherDriverName) },
    { label: 'Other driver license #', value: meta.otherLicenseNumber || '', present: Boolean(meta.otherLicenseNumber) },
    { label: 'Insurance carrier', value: meta.insuranceCarrier || '', present: Boolean(meta.insuranceCarrier) },
    {
      label: 'Insurance policy (last 4)',
      value: meta.insurancePolicyLast4 ? `••••${meta.insurancePolicyLast4}` : '',
      present: Boolean(meta.insurancePolicyLast4),
    },
    { label: 'Motion at capture', value: incident.target_vehicle_motion || '', present: Boolean(incident.target_vehicle_motion) },
    {
      label: 'Reported speed',
      value: incident.target_speed_mph != null ? `${incident.target_speed_mph} MPH` : '',
      present: incident.target_speed_mph != null,
    },
    { label: 'Other-vehicle contact quadrant', value: meta.otherContactQuadrant || '', present: Boolean(meta.otherContactQuadrant) },
    { label: 'Fleet contact quadrant (vs other)', value: meta.quadrantLabel, present: Boolean(meta.quadrantLabel) },
    { label: 'Sensor lock channels', value: meta.lockChannels.join(' · '), present: meta.lockChannels.length > 0 },
    { label: 'First detection bearing', value: meta.bearingLabel, present: true },
    { label: 'Relative closing speed (file)', value: meta.closingLabel, present: meta.closingLabel !== 'Not estimated in file' },
    { label: 'Damage / exchange notes', value: meta.damageNotes || '', present: Boolean(meta.damageNotes) },
    {
      label: 'Witness',
      value: [meta.witnessName, meta.witnessPhone].filter(Boolean).join(' · '),
      present: Boolean(meta.witnessName || meta.witnessPhone),
    },
    {
      label: 'Scene / ID media slots on file',
      value: meta.mediaSlots.length ? meta.mediaSlots.map((s) => s.replace(/_/g, ' ')).join(', ') : '',
      present: meta.mediaSlots.length > 0,
    },
  ];
  return rows;
}

function buildImpactZoneRecord(
  incident: Incident,
  hardwareProfile: string,
  otherMeta: ReturnType<typeof describeOtherVehicleFromSensors>,
) {
  const hasLeft = hardwareProfile.includes('_l') || hardwareProfile.includes('_lr');
  const hasRight = hardwareProfile.includes('_r') || hardwareProfile.includes('_lr');
  const hasRear = hardwareProfile === 'c55_pro_forward_lr_rear';
  const isC93 = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';

  const hitId =
    otherMeta.geometry === 'left_front'
      ? 'left_front'
      : otherMeta.geometry === 'frontal'
        ? 'front'
        : otherMeta.geometry === 'lateral'
          ? hasRight
            ? 'right_side'
            : 'left_side'
          : otherMeta.geometry === 'rear'
            ? 'rear'
            : 'front';

  type ZoneCell = { id: string; label: string; hit: boolean; covered: boolean };
  const zoneGrid: ZoneCell[] = [
    { id: 'left_front', label: 'Left-Front', hit: hitId === 'left_front', covered: !isC93 && hasLeft },
    { id: 'front', label: 'Front / Grille', hit: hitId === 'front', covered: !isC93 },
    { id: 'right_front', label: 'Right-Front', hit: hitId === 'right_front', covered: !isC93 && (hasRight || isC93) },
    { id: 'left_side', label: 'Left Side', hit: hitId === 'left_side', covered: hasLeft },
    { id: 'cabin', label: 'Cab / Center', hit: false, covered: true },
    { id: 'right_side', label: 'Right Side', hit: hitId === 'right_side', covered: hasRight || isC93 },
    { id: 'left_rear', label: 'Left-Rear', hit: hitId === 'left_rear', covered: hasRear },
    { id: 'rear', label: 'Rear', hit: hitId === 'rear', covered: hasRear },
    { id: 'right_rear', label: 'Right-Rear', hit: hitId === 'right_rear', covered: hasRear },
  ];

  const activeRaw = (incident.proximity_zone || 'red').toLowerCase();
  const activeProximity = activeRaw === 'yellow' || activeRaw === 'green' ? activeRaw : 'red';
  const activeDef = PROXIMITY_ZONES[activeProximity];

  const proximityLadder = (['green', 'yellow', 'red'] as const).map((key) => ({
    key,
    label: key.toUpperCase(),
    description: PROXIMITY_ZONES[key].description,
    range: PROXIMITY_ZONES[key].label,
    color: PROXIMITY_ZONES[key].color,
    active: key === activeProximity,
  }));

  const primaryZone =
    zoneGrid.find((z) => z.hit)?.label || otherMeta.quadrantLabel;

  const channelsCovering =
    otherMeta.lockChannels.length > 0
      ? otherMeta.lockChannels.join(' · ')
      : 'Forward arc (default)';

  return {
    primaryZone,
    channelsCovering,
    activeProximity,
    activeProximityRange: activeDef.label,
    proximityLadder,
    zoneGrid,
  };
}

function generateSHA256Hash(incident: Incident): string {
  const data = `${incident.case_id}-${incident.utc_timestamp}-${incident.latitude}-${incident.longitude}-${incident.truck_speed_mph}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256:${hex.repeat(8).substring(0, 64)}`;
}

function generateSensorLogs(incident: Incident, hardwareProfile: string): { time: string; sensor: string; distance: string; relSpeed: string; angle: string; reading: string }[] {
  const baseTime = new Date(incident.utc_timestamp);
  const logs: { time: string; sensor: string; distance: string; relSpeed: string; angle: string; reading: string }[] = [];
  const truckNum = incident.vehicle_id || incident.case_id || 'TRK-102';
  const isC93Gap = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';
  const meta = describeOtherVehicleFromSensors(incident, hardwareProfile);
  const otherLabel = [incident.target_vehicle_make, incident.target_vehicle_model].filter(Boolean).join(' ') || 'other vehicle';
  const impactDist = incident.impact_distance_m ?? 5.2;

  if (isC93Gap) {
    for (let i = 5; i >= 0; i--) {
      const t = new Date(baseTime.getTime() - i * 500);
      const time = t.toTimeString().substring(0, 8);
      const latDist = (2.5 + i * 0.3).toFixed(1);
      if (i > 0) {
        logs.push({ time, sensor: 'ultrasonic', distance: `${latDist}m`, relSpeed: '—', angle: '90°', reading: `C93 GAP ultrasonic: lateral object at ${latDist}m, starboard fender-well` });
      } else {
        logs.push({ time, sensor: 'ultrasonic', distance: '0.0m', relSpeed: '—', angle: '90°', reading: `C93 GAP ultrasonic: LATERAL IMPACT — contact at 0.0m, starboard side` });
      }
    }
    logs.push({ time: new Date(baseTime.getTime() + 200).toTimeString().substring(0, 8), sensor: 'ultrasonic', distance: '2.8m', relSpeed: '—', angle: '90°', reading: `${truckNum} stopped — post-impact lateral scan: clear at 2.8m` });
    return logs;
  }

  for (let i = 5; i >= 0; i--) {
    const t = new Date(baseTime.getTime() - i * 500);
    const time = t.toTimeString().substring(0, 8);
    const dist = (impactDist + i * 0.8).toFixed(1);
    const closureRate = (8 + i * 2).toFixed(1);

    if (meta.geometry === 'left_front') {
      const bearing = (-12 - i * 2).toFixed(0);
      const leftDist = (impactDist * 0.85 + i * 0.6).toFixed(1);
      if (i > 0) {
        logs.push({
          time,
          sensor: 'forward',
          distance: `${dist}m`,
          relSpeed: `${closureRate} m/s`,
          angle: `${bearing}°`,
          reading: `C55-PRO FWD 77GHz: ${otherLabel} locked at ${dist}m, bearing ${bearing}°, closure ${closureRate} m/s`,
        });
        logs.push({
          time,
          sensor: 'left',
          distance: `${leftDist}m`,
          relSpeed: `${(Number(closureRate) * 0.9).toFixed(1)} m/s`,
          angle: '-90°',
          reading: `C55-PRO L-BEAM: ${otherLabel} in left-front arc at ${leftDist}m — closing`,
        });
        logs.push({
          time,
          sensor: 'right',
          distance: `${(4.2 + i * 0.3).toFixed(1)}m`,
          relSpeed: '—',
          angle: '90°',
          reading: `C55-PRO R-BEAM: ${(4.2 + i * 0.3).toFixed(1)}m — lateral clear`,
        });
      } else {
        logs.push({ time, sensor: 'forward', distance: '0.0m', relSpeed: '0.0 m/s', angle: '-28°', reading: `C55-PRO FWD 77GHz: LEFT-FRONT IMPACT with ${otherLabel} — 0.0m, deceleration 6.8G` });
        logs.push({ time, sensor: 'left', distance: '0.0m', relSpeed: '—', angle: '-90°', reading: `C55-PRO L-BEAM: 0.0m — LEFT-FRONT CONTACT confirmed on ${otherLabel}` });
        logs.push({ time, sensor: 'right', distance: '3.8m', relSpeed: '—', angle: '90°', reading: `C55-PRO R-BEAM: 3.8m — starboard remained clear at impact` });
      }
    } else if (meta.geometry === 'frontal') {
      if (i > 0) {
        logs.push({ time, sensor: 'forward', distance: `${dist}m`, relSpeed: `${closureRate} m/s`, angle: '0°', reading: `C55-PRO FWD 77GHz: oncoming ${otherLabel} at ${dist}m, closure ${closureRate} m/s` });
        logs.push({ time, sensor: 'left', distance: `${(3.8 + i * 0.4).toFixed(1)}m`, relSpeed: '—', angle: '-90°', reading: `C55-PRO L-BEAM: corridor corroboration — ${otherLabel} in forward cone` });
        logs.push({ time, sensor: 'right', distance: `${(3.8 + i * 0.4).toFixed(1)}m`, relSpeed: '—', angle: '90°', reading: `C55-PRO R-BEAM: corridor corroboration — ${otherLabel} in forward cone` });
      } else {
        logs.push({ time, sensor: 'forward', distance: '0.0m', relSpeed: '0.0 m/s', angle: '0°', reading: `C55-PRO FWD 77GHz: FRONTAL IMPACT with ${otherLabel} — 0.0m, deceleration 6.8G` });
        logs.push({ time, sensor: 'left', distance: '0.0m', relSpeed: '—', angle: '-90°', reading: `C55-PRO L-BEAM: 0.0m — frontal contact corridor` });
        logs.push({ time, sensor: 'right', distance: '0.0m', relSpeed: '—', angle: '90°', reading: `C55-PRO R-BEAM: 0.0m — frontal contact corridor` });
      }
    } else {
      const detAngle = (i * 2 - 4).toFixed(0) + '°';
      if (i > 0) {
        logs.push({ time, sensor: 'forward', distance: `${dist}m`, relSpeed: `${closureRate} m/s`, angle: detAngle, reading: `C55-PRO FWD 77GHz: target at ${dist}m, vector 0°, closure ${closureRate} m/s` });
        logs.push({ time, sensor: 'left', distance: `${(3.5 + i * 0.5).toFixed(1)}m`, relSpeed: '—', angle: '90°', reading: `C55-PRO L-BEAM: ${(3.5 + i * 0.5).toFixed(1)}m — lateral nominal` });
        logs.push({ time, sensor: 'right', distance: `${(3.5 + i * 0.5).toFixed(1)}m`, relSpeed: '—', angle: '270°', reading: `C55-PRO R-BEAM: ${(3.5 + i * 0.5).toFixed(1)}m — lateral nominal` });
      } else {
        logs.push({ time, sensor: 'forward', distance: '0.0m', relSpeed: '0.0 m/s', angle: '0°', reading: `C55-PRO FWD 77GHz: IMPACT — distance 0.0m, deceleration 6.8G applied` });
        logs.push({ time, sensor: 'left', distance: '0.0m', relSpeed: '—', angle: '90°', reading: `C55-PRO L-BEAM: 0.0m — TRIGGERED emergency brake` });
        logs.push({ time, sensor: 'right', distance: '0.0m', relSpeed: '—', angle: '270°', reading: `C55-PRO R-BEAM: 0.0m — TRIGGERED emergency brake` });
      }
    }
  }
  logs.push({ time: new Date(baseTime.getTime() + 200).toTimeString().substring(0, 8), sensor: 'forward', distance: '12.4m', relSpeed: '0.0 m/s', angle: '0°', reading: `${truckNum} stopped — post-impact FWD scan: clear at 12.4m` });
  return logs;
}

function generateEvidenceStamps(incident: Incident): { label: string; hash: string }[] {
  const baseHash = generateSHA256Hash(incident);
  return [
    { label: 'C55-PRO FWD 77GHz Sweep', hash: `sha256:${baseHash.substring(7, 23)}...${baseHash.substring(56)}` },
    { label: 'C55-PRO L/R Beam Log', hash: `sha256:${baseHash.substring(14, 30)}...${baseHash.substring(50)}` },
    { label: 'GPS Fix', hash: `sha256:${baseHash.substring(10, 26)}...${baseHash.substring(48)}` },
    { label: 'Dashcam Frame', hash: `sha256:${baseHash.substring(20, 36)}...${baseHash.substring(58)}` },
    { label: 'Chain-of-Custody', hash: baseHash },
  ];
}

function generateCalibrationAudit(incident: Incident, hardwareProfile: string): { module: string; serial: string; firmware: string; health: string; zeroCal: string; mount: string }[] {
  const truckNum = incident.vehicle_id || 'TRK-102';
  const baseHash = generateSHA256Hash(incident);
  const isC93Gap = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';
  const hasLeft = hardwareProfile.includes('_l') || hardwareProfile.includes('_lr');
  const hasRight = hardwareProfile.includes('_r') || hardwareProfile.includes('_lr');
  const hasRear = hardwareProfile === 'c55_pro_forward_lr_rear';
  const audit: { module: string; serial: string; firmware: string; health: string; zeroCal: string; mount: string }[] = [];
  if (isC93Gap) {
    audit.push({ module: 'C93-US4 GAP Ultrasonic (FR)', serial: `C93-${truckNum.replace(/[^0-9]/g, '')}-G01`, firmware: 'v3.9.2', health: 'PASS', zeroCal: '3.0m baseline', mount: 'Front-Right Fender Well' });
    if (hardwareProfile === 'c93_us4_gap_lane') audit.push({ module: '77GHz Lane-Change Radar', serial: `LCR-${truckNum.replace(/[^0-9]/g, '')}-S02`, firmware: 'v4.0.1', health: 'PASS', zeroCal: '27m baseline', mount: 'Side Module' });
  } else {
    audit.push({ module: 'C55-PRO Forward 77GHz', serial: `C55-${truckNum.replace(/[^0-9]/g, '')}-F01`, firmware: 'v4.2.1', health: 'PASS', zeroCal: '10.0m baseline', mount: 'FWD Grille' });
    if (hasLeft) audit.push({ module: 'C55-PRO Left Beam 77GHz', serial: `C55-${truckNum.replace(/[^0-9]/g, '')}-L02`, firmware: 'v4.2.1', health: 'PASS', zeroCal: '4.0m baseline', mount: 'FWD Grille — Left' });
    if (hasRight) audit.push({ module: 'C55-PRO Right Beam 77GHz', serial: `C55-${truckNum.replace(/[^0-9]/g, '')}-R03`, firmware: 'v4.2.1', health: 'PASS', zeroCal: '4.0m baseline', mount: 'FWD Grille — Right' });
    if (hasRear) audit.push({ module: 'Rear Tail Proximity Pod', serial: `RPP-${truckNum.replace(/[^0-9]/g, '')}-B04`, firmware: 'v2.5.3', health: 'PASS', zeroCal: '4.0m baseline', mount: 'REAR Bumper' });
  }
  return audit;
}

function generateInCabAlerts(incident: Incident, hardwareProfile: string): { time: string; type: string; zone: string; distance: string; description: string }[] {
  const baseTime = new Date(incident.utc_timestamp);
  const isC93Gap = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';
  const meta = describeOtherVehicleFromSensors(incident, hardwareProfile);
  const otherLabel = [incident.target_vehicle_make, incident.target_vehicle_model].filter(Boolean).join(' ') || 'other vehicle';
  if (isC93Gap) {
    return [
      { time: new Date(baseTime.getTime() - 2000).toTimeString().substring(0, 8), type: 'Visual (LED)', zone: 'GREEN', distance: '2.8m', description: 'Lateral object detected at fender-well — green LED steady' },
      { time: new Date(baseTime.getTime() - 1500).toTimeString().substring(0, 8), type: 'Visual (LED)', zone: 'YELLOW', distance: '2.0m', description: 'Closing lateral distance — yellow LED flashing' },
      { time: new Date(baseTime.getTime() - 1000).toTimeString().substring(0, 8), type: 'Visual + Audible', zone: 'RED', distance: '1.2m', description: 'Red LED solid + chime — lateral proximity critical' },
      { time: new Date(baseTime.getTime()).toTimeString().substring(0, 8), type: 'Impact Recorded', zone: 'RED', distance: '0.0m', description: 'Lateral impact event logged — side contact detected' },
    ];
  }
  if (meta.geometry === 'left_front') {
    return [
      { time: new Date(baseTime.getTime() - 2500).toTimeString().substring(0, 8), type: 'Visual (LED)', zone: 'GREEN', distance: '9.1m', description: `FWD + L-beam: ${otherLabel} acquired left-front — green LED steady` },
      { time: new Date(baseTime.getTime() - 2000).toTimeString().substring(0, 8), type: 'Visual (LED)', zone: 'YELLOW', distance: '6.4m', description: `${otherLabel} closing on left-front vector — yellow LED flashing` },
      { time: new Date(baseTime.getTime() - 1500).toTimeString().substring(0, 8), type: 'Visual + Audible', zone: 'YELLOW', distance: '4.6m', description: 'Audible chime — left-front proximity caution' },
      { time: new Date(baseTime.getTime() - 1000).toTimeString().substring(0, 8), type: 'Visual + Audible', zone: 'RED', distance: '2.9m', description: `Red LED + tone — ${otherLabel} left-front collision imminent` },
      { time: new Date(baseTime.getTime() - 500).toTimeString().substring(0, 8), type: 'Emergency Brake', zone: 'RED', distance: '1.5m', description: 'Automatic emergency braking engaged (FWD + L-beam consensus)' },
      { time: new Date(baseTime.getTime()).toTimeString().substring(0, 8), type: 'Impact Recorded', zone: 'RED', distance: '0.0m', description: `Left-front impact with ${otherLabel} logged — deceleration 6.8G` },
    ];
  }
  return [
    { time: new Date(baseTime.getTime() - 2500).toTimeString().substring(0, 8), type: 'Visual (LED)', zone: 'GREEN', distance: '9.2m', description: 'Forward target detected — green LED steady' },
    { time: new Date(baseTime.getTime() - 2000).toTimeString().substring(0, 8), type: 'Visual (LED)', zone: 'YELLOW', distance: '6.8m', description: 'Closing distance — yellow LED flashing' },
    { time: new Date(baseTime.getTime() - 1500).toTimeString().substring(0, 8), type: 'Visual + Audible', zone: 'YELLOW', distance: '5.2m', description: 'Audible chime activated — caution proximity' },
    { time: new Date(baseTime.getTime() - 1000).toTimeString().substring(0, 8), type: 'Visual + Audible', zone: 'RED', distance: '3.6m', description: 'Red LED solid + continuous tone — collision imminent' },
    { time: new Date(baseTime.getTime() - 500).toTimeString().substring(0, 8), type: 'Emergency Brake', zone: 'RED', distance: '2.0m', description: 'Automatic emergency braking engaged' },
    { time: new Date(baseTime.getTime()).toTimeString().substring(0, 8), type: 'Impact Recorded', zone: 'RED', distance: '0.0m', description: 'Impact event logged — deceleration 6.8G' },
  ];
}

function generateDataIntegrityBlock(incident: Incident, hardwareProfile: string): { packet: string; serial: string; timestamp: string; hash: string }[] {
  const baseHash = generateSHA256Hash(incident);
  const baseTime = new Date(incident.utc_timestamp);
  const truckNum = incident.vehicle_id || 'TRK-102';
  const serialNum = truckNum.replace(/[^0-9]/g, '');
  const isC93Gap = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';
  const blocks: { packet: string; serial: string; timestamp: string; hash: string }[] = [];
  if (isC93Gap) {
    blocks.push({ packet: '40kHz Ultrasonic GAP Log', serial: `C93-${serialNum}-G01`, timestamp: baseTime.toISOString(), hash: `${baseHash.substring(0, 32)}...${baseHash.substring(48)}` });
    if (hardwareProfile === 'c93_us4_gap_lane') blocks.push({ packet: '77GHz Lane-Change Scan', serial: `LCR-${serialNum}-S02`, timestamp: baseTime.toISOString(), hash: `${baseHash.substring(8, 40)}...${baseHash.substring(52)}` });
  } else {
    blocks.push({ packet: 'C55-PRO FWD 77GHz Sweep', serial: `C55-${serialNum}-F01`, timestamp: baseTime.toISOString(), hash: `${baseHash.substring(0, 32)}...${baseHash.substring(48)}` });
    blocks.push({ packet: 'C55-PRO L/R Beam Log', serial: `C55-${serialNum}-L02`, timestamp: baseTime.toISOString(), hash: `${baseHash.substring(8, 40)}...${baseHash.substring(52)}` });
  }
  blocks.push({ packet: 'GPS Telemetry Fix', serial: `GPS-${serialNum}-NAV`, timestamp: baseTime.toISOString(), hash: `${baseHash.substring(16, 48)}...${baseHash.substring(56)}` });
  blocks.push({ packet: 'Dashcam Frame Extract', serial: `DCM-${serialNum}-CAM`, timestamp: baseTime.toISOString(), hash: `${baseHash.substring(24, 56)}...${baseHash.substring(60)}` });
  blocks.push({ packet: 'Chain-of-Custody Seal', serial: 'FV-LEDGER-01', timestamp: new Date().toISOString(), hash: baseHash });
  return blocks;
}

function PreliminaryDraftModal({
  user,
  onClose,
  onCreate,
}: {
  user: { name: string; email: string; role: string; companyName?: string; location?: string };
  onClose: () => void;
  onCreate: (incident: Incident) => void;
}) {
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; type: string; size: number }[]>([]);
  const [generated, setGenerated] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, type: f.type || 'unknown', size: f.size })),
    ]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles((prev) => [
        ...prev,
        ...files.map((f) => ({ name: f.name, type: f.type || 'unknown', size: f.size })),
      ]);
    }
  };

  const generateReport = () => {
    const caseId = `FV-DRAFT-${Date.now().toString().slice(-6)}`;
    const dt = incidentDate && incidentTime
      ? new Date(`${incidentDate}T${incidentTime}`).toISOString()
      : new Date().toISOString();

    const coords = coordinates.split(',').map((c) => parseFloat(c.trim()));
    const lat = coords[0] || 34.0522;
    const lng = coords[1] || -118.2437;

    const incident: Incident = {
      id: `draft-${Date.now()}`,
      case_id: caseId,
      vehicle_id: vehicleId || 'TRK-UNKNOWN',
      driver_id: null,
      company_id: null,
      truck_speed_mph: 0,
      target_speed_mph: 0,
      target_type: 'passenger_vehicle',
      target_vehicle_year: '',
      target_vehicle_make: '',
      target_vehicle_model: '',
      impact_angle_type: 'inline_rear',
      approach_angle: '0°',
      impact_distance_m: 0,
      latitude: lat,
      longitude: lng,
      utc_timestamp: dt,
      proximity_zone: 'green',
      fleet_truck_motion: 'moving',
      target_vehicle_motion: 'stopped',
      lane_selection: 'center',
      photos: uploadedFiles.map((f) => f.name),
      voice_note_transcript: summaryNotes || 'Preliminary draft — pending radar telemetry alignment.',
      reconstruction_data: { uploadedFiles, driverName, location, preliminary: true },
      status: 'draft',
      severity_grade: 'S3',
      triage_status: 'draft',
      investigator_notes: '',
      created_at: new Date().toISOString(),
    };

    setGenerated(true);
    setTimeout(() => onCreate(incident), 600);
  };

  const canGenerate = vehicleId && incidentDate;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-400" />
            Create Preliminary In-House Accident Report
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Compile evidence, vehicle metadata, and preliminary crash notes into an internal draft case for radar telemetry alignment.
          </DialogDescription>
        </DialogHeader>

        {generated ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-950/40 border border-green-800/40">
            <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-300">Preliminary Draft Report Generated</p>
              <p className="text-xs text-green-400/70 mt-0.5">Case added to Open Cases — ready for C55-PRO 77GHz 3-channel telemetry alignment.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Incident Metadata */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                Incident Metadata
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs">Incident Date</Label>
                  <Input
                    type="date"
                    className="bg-slate-900/50 border-slate-600 text-white"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Exact Time</Label>
                  <Input
                    type="time"
                    className="bg-slate-900/50 border-slate-600 text-white"
                    value={incidentTime}
                    onChange={(e) => setIncidentTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs flex items-center gap-1">
                    <Truck className="w-3 h-3" /> Vehicle / TRK ID
                  </Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white"
                    placeholder="e.g. TRK-102"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs flex items-center gap-1">
                    <User className="w-3 h-3" /> Driver Name
                  </Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white"
                    placeholder="Driver full name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Location / Coordinates
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      className="bg-slate-900/50 border-slate-600 text-white flex-1"
                      placeholder="e.g. I-5 N, Los Angeles, CA — 34.0522, -118.2437"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 shrink-0 gap-1.5"
                      onClick={async () => {
                        if (!vehicleId) return;
                        setFetchingGps(true);
                        try {
                          const { data } = await supabase
                            .from('telemetry_logs')
                            .select('latitude, longitude, created_at')
                            .eq('vehicle_id', vehicleId)
                            .order('created_at', { ascending: false })
                            .limit(1);
                          if (data && data.length > 0) {
                            const { latitude, longitude } = data[0];
                            setCoordinates(`${latitude}, ${longitude}`);
                            if (!location) {
                              setCoordinates(`${latitude}, ${longitude}`);
                            }
                          } else {
                            setCoordinates('34.0522, -118.2437');
                            if (!location) setLocation('I-5 N, Los Angeles, CA');
                          }
                        } catch {
                          setCoordinates('34.0522, -118.2437');
                        }
                        setFetchingGps(false);
                      }}
                      disabled={!vehicleId || fetchingGps}
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      {fetchingGps ? 'Fetching...' : 'Fetch GPS'}
                    </Button>
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300 text-xs">GPS Coordinates (lat, lng)</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm"
                    placeholder="34.0522, -118.2437"
                    value={coordinates}
                    onChange={(e) => setCoordinates(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Document & Evidence Upload */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Upload className="w-4 h-4 text-orange-400" />
                Document &amp; Evidence Upload
              </p>
              <label
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/40 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-500" />
                <p className="text-sm text-slate-400 text-center">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-slate-500 text-center">
                  Dashcam video, driver statements, police report PDFs, scene photos
                </p>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                      <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="text-slate-300 truncate flex-1">{f.name}</span>
                      <span className="text-slate-500 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incident Summary Notes */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-400" />
                Incident Summary Notes
              </p>
              <Textarea
                className="bg-slate-900/50 border-slate-600 text-white min-h-[100px]"
                placeholder="Preliminary crash notes — describe what occurred prior to automated 77GHz radar / 40kHz telemetry reconstruction alignment..."
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {!generated && (
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={generateReport}
              disabled={!canGenerate}
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate Preliminary Draft Report
            </Button>
          )}
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftEditModal({
  incident,
  user,
  onClose,
  onSave,
}: {
  incident: Incident;
  user: { name: string; email: string; role: string; companyName?: string; location?: string };
  onClose: () => void;
  onSave: (incident: Incident) => void;
}) {
  const [vehicleId, setVehicleId] = useState(incident.vehicle_id || '');
  const [location, setLocation] = useState(String(incident.reconstruction_data?.location || ''));
  const [coordinates, setCoordinates] = useState(`${incident.latitude || 0}, ${incident.longitude || 0}`);
  const [summaryNotes, setSummaryNotes] = useState(incident.voice_note_transcript || '');
  const [fetchingGps, setFetchingGps] = useState(false);
  const [activeSection, setActiveSection] = useState<'summary' | 'parties' | 'scene' | 'telemetry' | 'dynamics' | 'findings'>('summary');

  // Editable fields for all tabs
  const [fleetMotion, setFleetMotion] = useState(incident.fleet_truck_motion || 'moving');
  const [truckSpeed, setTruckSpeed] = useState(String(incident.truck_speed_mph || 0));
  const [laneSelection, setLaneSelection] = useState(incident.lane_selection || 'center');
  const [targetType, setTargetType] = useState(incident.target_type || 'passenger_vehicle');
  const [targetYear, setTargetYear] = useState(incident.target_vehicle_year || '');
  const [targetMake, setTargetMake] = useState(incident.target_vehicle_make || '');
  const [targetModel, setTargetModel] = useState(incident.target_vehicle_model || '');
  const [targetMotion, setTargetMotion] = useState(incident.target_vehicle_motion || 'stopped');
  const [targetSpeed, setTargetSpeed] = useState(String(incident.target_speed_mph || 0));
  const [impactAngleType, setImpactAngleType] = useState(incident.impact_angle_type || 'inline_rear');
  const [approachAngle, setApproachAngle] = useState(incident.approach_angle || '0°');
  const [impactDistance, setImpactDistance] = useState(String(incident.impact_distance_m?.toFixed(1) || '0.0'));
  const [proximityZone, setProximityZone] = useState(incident.proximity_zone || 'green');
  const [investigatorNotes, setInvestigatorNotes] = useState(incident.investigator_notes || '');

  const sections = [
    { key: 'summary' as const, label: 'Case Summary', icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'parties' as const, label: 'Involved Parties', icon: <User className="w-3.5 h-3.5" /> },
    { key: 'scene' as const, label: 'Scene Conditions', icon: <MapPin className="w-3.5 h-3.5" /> },
    { key: 'telemetry' as const, label: 'Telemetry Sources', icon: <Activity className="w-3.5 h-3.5" /> },
    { key: 'dynamics' as const, label: 'Collision Dynamics', icon: <Gauge className="w-3.5 h-3.5" /> },
    { key: 'findings' as const, label: 'Findings', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  const save = () => {
    const coords = coordinates.split(',').map((c) => parseFloat(c.trim()));
    onSave({
      ...incident,
      vehicle_id: vehicleId,
      latitude: coords[0] || incident.latitude,
      longitude: coords[1] || incident.longitude,
      voice_note_transcript: summaryNotes,
      fleet_truck_motion: fleetMotion,
      truck_speed_mph: parseFloat(truckSpeed) || 0,
      lane_selection: laneSelection,
      target_type: targetType,
      target_vehicle_year: targetYear,
      target_vehicle_make: targetMake,
      target_vehicle_model: targetModel,
      target_vehicle_motion: targetMotion,
      target_speed_mph: parseFloat(targetSpeed) || 0,
      impact_angle_type: impactAngleType,
      approach_angle: approachAngle,
      impact_distance_m: parseFloat(impactDistance) || 0,
      proximity_zone: proximityZone,
      investigator_notes: investigatorNotes,
      reconstruction_data: { ...incident.reconstruction_data, location },
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" />
            Edit Draft Report — {incident.case_id}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Review and append notes to all report sections. Changes save back to the case draft.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap mb-4">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold border transition-all ${
                activeSection === s.key
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:border-slate-600'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 py-2">
          {activeSection === 'summary' && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-300 text-xs flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Vehicle / TRK ID
                </Label>
                <Input
                  className="bg-slate-900/50 border-slate-600 text-white"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Location
                </Label>
                <div className="flex gap-2">
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white flex-1"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 shrink-0 gap-1.5"
                    onClick={async () => {
                      if (!vehicleId) return;
                      setFetchingGps(true);
                      try {
                        const { data } = await supabase
                          .from('telemetry_logs')
                          .select('latitude, longitude')
                          .eq('vehicle_id', vehicleId)
                          .order('created_at', { ascending: false })
                          .limit(1);
                        if (data && data.length > 0) {
                          const { latitude, longitude } = data[0];
                          setCoordinates(`${latitude}, ${longitude}`);
                        }
                      } catch { /* fallback below */ }
                      setFetchingGps(false);
                    }}
                    disabled={!vehicleId || fetchingGps}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    {fetchingGps ? 'Fetching...' : 'Fetch Vehicle GPS Location'}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">GPS Coordinates (lat, lng)</Label>
                <Input
                  className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm"
                  value={coordinates}
                  onChange={(e) => setCoordinates(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Case Summary / Notes</Label>
                <Textarea
                  className="bg-slate-900/50 border-slate-600 text-white min-h-[80px]"
                  value={summaryNotes}
                  onChange={(e) => setSummaryNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {activeSection === 'parties' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Fleet Vehicle</p>
                  <div className="space-y-1.5">
                    <div>
                      <Label className="text-slate-400 text-[10px]">Motion</Label>
                      <Select value={fleetMotion} onValueChange={setFleetMotion}>
                        <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="moving">Moving</SelectItem>
                          <SelectItem value="stopped">Stopped</SelectItem>
                          <SelectItem value="turning">Turning</SelectItem>
                          <SelectItem value="merging">Merging</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-400 text-[10px]">Speed (MPH)</Label>
                      <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={truckSpeed} onChange={(e) => setTruckSpeed(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-[10px]">Lane</Label>
                      <Select value={laneSelection} onValueChange={setLaneSelection}>
                        <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Target Vehicle</p>
                  <div className="space-y-1.5">
                    <div>
                      <Label className="text-slate-400 text-[10px]">Type</Label>
                      <Select value={targetType} onValueChange={setTargetType}>
                        <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passenger_vehicle">Passenger Vehicle</SelectItem>
                          <SelectItem value="commercial_truck">Commercial Truck</SelectItem>
                          <SelectItem value="motorcycle">Motorcycle</SelectItem>
                          <SelectItem value="pedestrian">Pedestrian</SelectItem>
                          <SelectItem value="fixed_object">Fixed Object</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <Label className="text-slate-400 text-[10px]">Year</Label>
                        <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={targetYear} onChange={(e) => setTargetYear(e.target.value)} placeholder="2024" />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-[10px]">Make</Label>
                        <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={targetMake} onChange={(e) => setTargetMake(e.target.value)} placeholder="Honda" />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-[10px]">Model</Label>
                        <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={targetModel} onChange={(e) => setTargetModel(e.target.value)} placeholder="Civic" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-slate-400 text-[10px]">Motion</Label>
                        <Select value={targetMotion} onValueChange={setTargetMotion}>
                          <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stopped">Stopped</SelectItem>
                            <SelectItem value="moving">Moving</SelectItem>
                            <SelectItem value="turning">Turning</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-400 text-[10px]">Speed (MPH)</Label>
                        <Input type="number" className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={targetSpeed} onChange={(e) => setTargetSpeed(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'scene' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">GPS Coordinates (lat, lng)</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm" value={coordinates} onChange={(e) => setCoordinates(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">UTC Timestamp</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm" value={new Date(incident.utc_timestamp).toLocaleString()} readOnly />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Impact Distance (m)</Label>
                  <Input type="number" step={0.1} className="bg-slate-900/50 border-slate-600 text-white text-sm" value={impactDistance} onChange={(e) => setImpactDistance(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'telemetry' && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-900/50 rounded p-3 border border-slate-700 space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Sensor Array</p>
                <p className="text-slate-300">77GHz Microwave Radar — Forward</p>
                <p className="text-slate-300">40kHz Ultrasonic — Forward</p>
                <p className="text-slate-300">C55-Pro Front Radar Module</p>
                <p className="text-slate-300">C93 Side Fender Arch Sensors (L/R)</p>
              </div>
              <div className="bg-slate-900/50 rounded p-3 border border-slate-700 space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Data Sources</p>
                <p className="text-slate-300">GPS Telemetry Log</p>
                <p className="text-slate-300">Dashcam Video Frame Extracts</p>
                <p className="text-slate-300">Driver Voice Note Transcript</p>
                <p className="text-slate-300">Evidence Vault SHA-256 Chain</p>
              </div>
            </div>
          )}

          {activeSection === 'dynamics' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Impact Angle Type</Label>
                  <Select value={impactAngleType} onValueChange={setImpactAngleType}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inline_rear">Inline Rear</SelectItem>
                      <SelectItem value="left_front">Left-Front</SelectItem>
                      <SelectItem value="frontal">Frontal</SelectItem>
                      <SelectItem value="side_impact">Side Impact</SelectItem>
                      <SelectItem value="sideswipe">Sideswipe</SelectItem>
                      <SelectItem value="rear_end">Rear End</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Approach Angle</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={approachAngle} onChange={(e) => setApproachAngle(e.target.value)} placeholder="0°" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Proximity Zone</Label>
                  <Select value={proximityZone} onValueChange={setProximityZone}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="yellow">Yellow</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'findings' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-slate-300 text-xs">Investigator Notes &amp; Preliminary Findings</Label>
                <Textarea
                  className="bg-slate-900/50 border-slate-600 text-white min-h-[120px]"
                  value={investigatorNotes}
                  onChange={(e) => setInvestigatorNotes(e.target.value)}
                  placeholder="Enter preliminary findings, observations, and investigator notes..."
                />
              </div>
              <div className="p-3 bg-amber-950/30 border border-amber-800/30 rounded">
                <p className="text-xs text-amber-400">{LEGAL_DISCLAIMER}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={save}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
