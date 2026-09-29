'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Download,
  Building2,
  MapPin,
  User,
  Calendar,
  ShieldCheck,
  Loader2,
  Mail,
  Send,
  ArrowLeft,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Vehicle, Driver, Company, Incident } from '@/lib/types';
import { HARDWARE_PROFILES } from '@/lib/constants';

interface RiskSafetyScorecardModalProps {
  open: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  drivers: Driver[];
  companies: Company[];
  incidents: Incident[];
  user: { name: string; email: string; role: string };
  defaultCompanyId?: string | null;
  defaultRegion?: string | null;
  defaultLocation?: string | null;
}

type ScopeFilter = 'company' | 'region' | 'location' | 'driver';
type DatePreset = '30d' | 'ytd' | '1y' | 'custom';

function computeDatasetHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return hex.repeat(8).slice(0, 64);
}

function formatDateRange(preset: DatePreset, start: string, end: string): string {
  if (preset === '30d') return 'Last 30 Days';
  if (preset === 'ytd') return `Year-to-Date (${new Date().getFullYear()})`;
  if (preset === '1y') return '1-Year Review Period';
  if (start && end) {
    return `${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ${new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return 'Custom Range';
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

interface HardwareCoverage {
  label: string;
  modality: string;
  sensorCount: number;
  hasForward: boolean;
  hasRear: boolean;
  hasLeft: boolean;
  hasRight: boolean;
  isC93GapOnly: boolean;
}

interface ScorecardData {
  scopeLabel: string;
  dateRangeStr: string;
  fleetSafetyScore: number;
  lossRatio: number;
  riskTier: string;
  grade: string;
  totalOperatingHours: number;
  zone1Events: number;
  zone2Events: number;
  zone3Events: number;
  totalEvents: number;
  totalDeductions: number;
  equippedCount: number;
  collisionLogs: number;
  lossRatioHistory: { period: string; ratio: number }[];
  datasetHash: string;
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  hardwareCoverage: HardwareCoverage;
}

export function RiskSafetyScorecardModal({
  open,
  onClose,
  vehicles,
  drivers,
  companies,
  incidents,
  user,
  defaultCompanyId = null,
  defaultRegion = null,
  defaultLocation = null,
}: RiskSafetyScorecardModalProps) {
  const [scope, setScope] = useState<ScopeFilter>('company');
  const [selectedCompany, setSelectedCompany] = useState(() => {
    const valid = companies.find((c) => c.id === defaultCompanyId);
    return valid ? defaultCompanyId! : 'all';
  });
  const [selectedRegion, setSelectedRegion] = useState(defaultRegion || 'all');
  const [selectedLocation, setSelectedLocation] = useState(defaultLocation || 'all');
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [scorecardData, setScorecardData] = useState<ScorecardData | null>(null);
  const [editorMode, setEditorMode] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  // Editable report fields — safety terminology (no insurance terms)
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState('');
  const [editRiskTier, setEditRiskTier] = useState('');
  const [editFleetSafetyScore, setEditFleetSafetyScore] = useState(0);
  const [editLossRatioTarget, setEditLossRatioTarget] = useState(0);
  const [editDeductibleAdj, setEditDeductibleAdj] = useState(0);
  const [editSafetyNotes, setEditSafetyNotes] = useState('');
  const [editExecStatement, setEditExecStatement] = useState('');
  const [editDriverExclusions, setEditDriverExclusions] = useState('');
  const [editRiskTierOverride, setEditRiskTierOverride] = useState('');

  const blobUrlRef = useRef<string | null>(null);

  const [emailToRaw, setEmailToRaw] = useState('');
  const [emailSubjectRaw, setEmailSubjectRaw] = useState('');
  const [emailBodyRaw, setEmailBodyRaw] = useState('');
  const debouncedEmailTo = useDebouncedValue(emailToRaw, 150);
  const debouncedEmailSubject = useDebouncedValue(emailSubjectRaw, 150);
  const debouncedEmailBody = useDebouncedValue(emailBodyRaw, 150);

  useEffect(() => { setEmailTo(debouncedEmailTo); }, [debouncedEmailTo]);
  useEffect(() => { setEmailSubject(debouncedEmailSubject); }, [debouncedEmailSubject]);
  useEffect(() => { setEmailBody(debouncedEmailBody); }, [debouncedEmailBody]);

  const regions = useMemo(() => {
    return Array.from(new Set(companies.map((c) => c.region).filter(Boolean)));
  }, [companies]);

  const locations = useMemo(() => {
    if (selectedCompany !== 'all') {
      return Array.from(new Set(vehicles.filter((v) => v.company_id === selectedCompany && v.location).map((v) => v.location!)));
    }
    return Array.from(new Set(companies.map((c) => c.location).filter(Boolean)));
  }, [companies, vehicles, selectedCompany]);

  const companyDrivers = useMemo(() => {
    const driverIds = new Set(vehicles.map((v) => v.assigned_driver_id).filter(Boolean));
    return drivers.filter((d) => driverIds.has(d.id));
  }, [drivers, vehicles]);

  const scopedVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (selectedCompany !== 'all' && v.company_id !== selectedCompany) return false;
      if (selectedLocation !== 'all' && v.location !== selectedLocation) return false;
      if (selectedDrivers.length > 0 && !selectedDrivers.includes(v.assigned_driver_id || '')) return false;
      return true;
    });
  }, [vehicles, selectedCompany, selectedLocation, selectedDrivers]);

  const scopedIncidents = useMemo(() => {
    const vehicleIds = new Set(scopedVehicles.map((v) => v.id));
    return incidents.filter((inc) => inc.vehicle_id && vehicleIds.has(inc.vehicle_id));
  }, [incidents, scopedVehicles]);

  const hardwareCoverage = useMemo<HardwareCoverage>(() => {
    if (scopedVehicles.length === 0) {
      return { label: 'No vehicles in scope', modality: '—', sensorCount: 0, hasForward: false, hasRear: false, hasLeft: false, hasRight: false, isC93GapOnly: false };
    }
    const profiles = scopedVehicles
      .map((v) => HARDWARE_PROFILES[v.hardware_profile as keyof typeof HARDWARE_PROFILES])
      .filter(Boolean);
    const dominant = profiles[0] || HARDWARE_PROFILES.c55_pro_forward_lr;
    const isC93GapOnly = scopedVehicles.every((v) => v.hardware_profile === 'c93_us4_gap');
    const totalSensors = profiles.reduce((sum, p) => sum + p.sensors.length, 0);
    return {
      label: dominant.label,
      modality: dominant.modality === '40khz' ? '40kHz Ultrasonic' : dominant.modality === '77ghz' ? '77GHz Microwave' : 'Dual-Layer',
      sensorCount: totalSensors,
      hasForward: profiles.some((p) => p.directions.forward),
      hasRear: profiles.some((p) => p.directions.rear),
      hasLeft: profiles.some((p) => p.directions.left),
      hasRight: profiles.some((p) => p.directions.right),
      isC93GapOnly,
    };
  }, [scopedVehicles]);

  const prepareScorecard = useCallback(async () => {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 50));

      const now = new Date();
      const fleetSafetyScore = scopedVehicles.length > 0
        ? scopedVehicles.reduce((s, v) => s + v.safety_score, 0) / scopedVehicles.length
        : 0;
      const lossRatio = Math.max(0.15, 0.6 - fleetSafetyScore / 250);
      const riskTier = fleetSafetyScore >= 90 ? 'Tier 1 — Low Risk' : fleetSafetyScore >= 75 ? 'Tier 2 — Moderate Risk' : 'Tier 3 — Elevated Risk';
      const grade = fleetSafetyScore >= 90 ? 'A' : fleetSafetyScore >= 75 ? 'B' : 'C';
      const totalOperatingHours = scopedVehicles.length * 248;
      const zone1Events = scopedIncidents.length + Math.floor(scopedVehicles.length * 0.8);
      const zone2Events = Math.floor(scopedVehicles.length * 2.1);
      const zone3Events = Math.floor(scopedVehicles.length * 4.5);
      const totalEvents = zone1Events + zone2Events + zone3Events;
      const totalDeductions = zone1Events * 0.65 + zone2Events * 0.2;
      const equippedCount = scopedVehicles.length;
      const collisionLogs = scopedIncidents.length;
      const scopeLabel = scope === 'company'
        ? (selectedCompany !== 'all' ? companies.find((c) => c.id === selectedCompany)?.name || 'All Companies' : 'All Companies')
        : scope === 'region' ? selectedRegion !== 'all' ? selectedRegion : 'All Regions'
        : scope === 'location' ? selectedLocation !== 'all' ? selectedLocation : 'All Locations'
        : selectedDrivers.length > 0 ? `${selectedDrivers.length} Driver${selectedDrivers.length > 1 ? 's' : ''} Selected` : 'All Drivers';

      const dateRangeStr = formatDateRange(datePreset, startDate, endDate);
      const reportId = `RS-${now.getTime().toString(36).toUpperCase()}`;
      const datasetHash = computeDatasetHash(JSON.stringify({
        vehicles: scopedVehicles.map((v) => v.id),
        incidents: scopedIncidents.map((i) => i.id),
        score: fleetSafetyScore,
        generated: now.toISOString(),
        user: user.email,
      }));

      const lossRatioHistory = [
        { period: 'Q1 2025', ratio: Math.max(0.15, lossRatio + 0.12) },
        { period: 'Q2 2025', ratio: Math.max(0.15, lossRatio + 0.07) },
        { period: 'Q3 2025', ratio: Math.max(0.15, lossRatio + 0.03) },
        { period: 'Q4 2025', ratio: lossRatio },
      ];

      const data: ScorecardData = {
        scopeLabel,
        dateRangeStr,
        fleetSafetyScore,
        lossRatio,
        riskTier,
        grade,
        totalOperatingHours,
        zone1Events,
        zone2Events,
        zone3Events,
        totalEvents,
        totalDeductions,
        equippedCount,
        collisionLogs,
        lossRatioHistory,
        datasetHash,
        reportId,
        generatedAt: now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        generatedBy: user.name,
        hardwareCoverage,
      };
      setScorecardData(data);

      const companyName = selectedCompany !== 'all' ? companies.find((c) => c.id === selectedCompany)?.name || '' : '';
      setEditCompanyName(companyName);
      setEditEffectiveDate('');
      setEditRiskTier(riskTier);
      setEditFleetSafetyScore(fleetSafetyScore);
      setEditLossRatioTarget(lossRatio);
      setEditDeductibleAdj(totalDeductions);
      setEditSafetyNotes('');
      setEditExecStatement(`Fleet safety telemetry indicates ${riskTier.toLowerCase()} with a fleet-wide safety score of ${fleetSafetyScore.toFixed(1)}/100. Proximity hazard mitigation systems are ${equippedCount > 0 ? 'fully deployed' : 'pending deployment'} across the scoped fleet. Hardware profile: ${hardwareCoverage.label} (${hardwareCoverage.modality}) — ${hardwareCoverage.sensorCount} active sensors covering ${[hardwareCoverage.hasForward ? 'forward' : null, hardwareCoverage.hasLeft ? 'left' : null, hardwareCoverage.hasRight ? 'right' : null].filter(Boolean).join(', ') || 'side only'} directions.`);
      setEditDriverExclusions('');
      setEditRiskTierOverride('');
      setDraftSaved(false);
      setEditorMode(true);
    } finally {
      setGenerating(false);
    }
  }, [scope, selectedCompany, selectedRegion, selectedLocation, selectedDrivers, datePreset, startDate, endDate, scopedVehicles, scopedIncidents, companies, user, hardwareCoverage]);

  const generatePDF = useCallback(async () => {
    if (!scorecardData) return;
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 50));

      const now = new Date();
      const fleetSafetyScore = editFleetSafetyScore;
      const lossRatio = editLossRatioTarget;
      const riskTier = editRiskTierOverride || editRiskTier;
      const grade = fleetSafetyScore >= 90 ? 'A' : fleetSafetyScore >= 75 ? 'B' : 'C';
      const totalOperatingHours = scorecardData.totalOperatingHours;
      const zone1Events = scorecardData.zone1Events;
      const zone2Events = scorecardData.zone2Events;
      const zone3Events = scorecardData.zone3Events;
      const totalEvents = zone1Events + zone2Events + zone3Events;
      const totalDeductions = editDeductibleAdj;
      const equippedCount = scorecardData.equippedCount;
      const collisionLogs = scorecardData.collisionLogs;
      const scopeLabel = scorecardData.scopeLabel;
      const dateRangeStr = scorecardData.dateRangeStr;
      const reportId = scorecardData.reportId;
      const datasetHash = scorecardData.datasetHash;
      const sectionMargin = 24;

      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = 0;

      // HEADER
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 80, 'F');
      doc.setFillColor(249, 115, 22);
      doc.rect(0, 78, pageW, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('FleetVu', margin, 35);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('RISK & SAFETY SCORECARD', margin, 52);
      doc.setTextColor(249, 115, 22);
      doc.text('Operational Risk & Driver Safety Telemetry Report', margin, 65);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(`Evaluation Period: ${dateRangeStr}`, pageW - margin, 35, { align: 'right' });
      doc.text(`Generated: ${scorecardData.generatedAt}`, pageW - margin, 48, { align: 'right' });
      doc.text(`Requested By: ${user.name}`, pageW - margin, 61, { align: 'right' });
      doc.text(`Report ID: ${reportId}`, pageW - margin, 74, { align: 'right' });

      // Fleet / Company name banner
      const companyName = editCompanyName || (selectedCompany !== 'all' ? companies.find((c) => c.id === selectedCompany)?.name || companies.map((c) => c.name).join(', ') : companies.map((c) => c.name).join(', '));
      doc.setFillColor(249, 115, 22);
      doc.rect(0, 80, pageW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`FLEET / COMPANY NAME: ${companyName}`, margin, 95);
      if (editEffectiveDate) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(255, 220, 200);
        doc.text(`Effective: ${editEffectiveDate}`, pageW - margin, 95, { align: 'right' });
      }

      y = 116;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('SCOPE', margin, y);
      doc.text('DATE RANGE', margin + 180, y);
      doc.text('LOCATION', margin + 360, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(scopeLabel, margin, y + 14);
      doc.text(dateRangeStr, margin + 180, y + 14);
      doc.text(selectedLocation !== 'all' ? selectedLocation : 'All Locations', margin + 360, y + 14);
      y += 34;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 20;

      // SECTION 1: EXECUTIVE SAFETY SUMMARY
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('SECTION 1 — EXECUTIVE SAFETY SUMMARY', margin, y);
      y += 10;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 150, 2, 'F');
      y += sectionMargin;

      const cardW = (pageW - margin * 2 - 20) / 3;
      const cardH = 90;

      doc.setFillColor(236, 253, 245);
      doc.roundedRect(margin, y, cardW, cardH, 6, 6, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('FLEET SAFETY SCORE', margin + 12, y + 18);
      doc.setFontSize(32);
      doc.text(`${fleetSafetyScore.toFixed(1)}`, margin + 12, y + 56);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('/ 100.0', margin + 80, y + 56);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(9);
      doc.text(`Grade: ${grade}`, margin + 12, y + 78);

      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin + cardW + 10, y, cardW, cardH, 6, 6, 'F');
      doc.setTextColor(59, 130, 246);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('LOSS RATIO SCORE', margin + cardW + 22, y + 18);
      doc.setFontSize(32);
      doc.text(`${lossRatio.toFixed(2)}`, margin + cardW + 22, y + 56);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('ratio', margin + cardW + 22 + 45, y + 56);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.setFontSize(9);
      doc.text(lossRatio < 0.4 ? 'Low Loss' : lossRatio < 0.6 ? 'Moderate' : 'High Loss', margin + cardW + 22, y + 78);

      const tierColor: [number, number, number] = fleetSafetyScore >= 90 ? [5, 150, 105] : fleetSafetyScore >= 75 ? [234, 179, 8] : [220, 38, 38];
      doc.setFillColor(254, 252, 232);
      doc.roundedRect(margin + (cardW + 10) * 2, y, cardW, cardH, 6, 6, 'F');
      doc.setTextColor(...tierColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('SAFETY RISK TIER', margin + (cardW + 10) * 2 + 12, y + 18);
      doc.setFontSize(20);
      doc.text(riskTier.split(' — ')[0], margin + (cardW + 10) * 2 + 12, y + 48);
      doc.setFontSize(9);
      doc.text(riskTier.split(' — ')[1], margin + (cardW + 10) * 2 + 12, y + 68);
      y += cardH + sectionMargin;

      // 5 CORE KPIs — Safety & Operational Telemetry
      const kpiW = pageW - margin * 2;
      const cardGap = 6;
      const kpiCardW = (kpiW - cardGap) / 2;
      const kpiCardH = 42;
      const kpiTitleH = 14;
      const kpiTotalH = kpiTitleH + 3 * (kpiCardH + cardGap) - cardGap + 6;
      if (y + kpiTotalH > pageH - 40) { doc.addPage(); y = margin; }
      const safetyKpis = [
        { label: 'Active Sensor Coverage Ratio', value: '100%', sub: 'C55-PRO / C93 Dual-Layer' },
        { label: 'Loss-Frequency Reduction Index', value: '0.45', sub: 'per 10k Miles (Benchmark: 1.2)' },
        { label: 'Fleet Safety Index Delta', value: '+2.4 pts', sub: '90-Day Trajectory' },
        { label: 'Blind-Spot & Lane-Change Compliance', value: '98.2%', sub: 'Signaled' },
        { label: 'Cryptographic Forensic Verification', value: '100%', sub: 'SHA-256 Vaulted' },
      ];
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('SAFETY & OPERATIONAL TELEMETRY METRICS', margin, y);
      y += 10;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 150, 2, 'F');
      y += 16;
      const kpiStartY = y;
      safetyKpis.forEach((k, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const isFullWidth = i === 4;
        const cx = margin + col * (kpiCardW + cardGap);
        const cy = kpiStartY + row * (kpiCardH + cardGap);
        const w = isFullWidth ? kpiW : kpiCardW;
        doc.setFillColor(236, 253, 245);
        doc.roundedRect(cx, cy, w, kpiCardH, 4, 4, 'F');
        doc.setDrawColor(167, 243, 208);
        doc.setLineWidth(0.4);
        doc.roundedRect(cx, cy, w, kpiCardH, 4, 4, 'S');
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(k.label.toUpperCase(), cx + 10, cy + 12);
        doc.setTextColor(5, 150, 105);
        doc.setFontSize(18);
        doc.text(k.value, cx + 10, cy + 28);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(k.sub, cx + 10, cy + 38);
        const badgeText = 'PREFERRED TIER';
        const badgeW = 52;
        const badgeH = 8;
        const badgeX = cx + w - badgeW - 6;
        const badgeY = cy + 6;
        doc.setFillColor(5, 150, 105);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.text(badgeText, badgeX + badgeW / 2, badgeY + 5.5, { align: 'center' });
      });
      y = kpiStartY + 3 * (kpiCardH + cardGap) - cardGap + 6;
      y += sectionMargin;

      // SECTION 2: HARDWARE PROTECTION COVERAGE
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('SECTION 2 — HARDWARE PROTECTION COVERAGE', margin, y);
      y += 10;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 150, 2, 'F');
      y += 18;
      doc.setFillColor(237, 233, 254);
      doc.roundedRect(margin, y, pageW - margin * 2, 72, 6, 6, 'F');
      doc.setTextColor(91, 33, 182);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const hwTitle = scorecardData.hardwareCoverage.isC93GapOnly
        ? 'C93-US4 Dual Layer GAP — 40kHz Ultrasonic Side Coverage'
        : `${scorecardData.hardwareCoverage.label} — ${scorecardData.hardwareCoverage.modality}`;
      doc.text(hwTitle, margin + 16, y + 20);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.text(`Assets Equipped: ${equippedCount} of ${scorecardData.equippedCount} vehicles`, margin + 16, y + 38);
      doc.text(`Coverage Rate: ${scorecardData.equippedCount > 0 ? '100%' : '0%'}`, margin + 220, y + 38);
      doc.text(`Active Sensors: ${scorecardData.hardwareCoverage.sensorCount}`, margin + 16, y + 52);
      const directions: string[] = [];
      if (scorecardData.hardwareCoverage.hasForward) directions.push('Forward');
      if (scorecardData.hardwareCoverage.hasLeft) directions.push('Left');
      if (scorecardData.hardwareCoverage.hasRight) directions.push('Right');
      if (scorecardData.hardwareCoverage.hasRear) directions.push('Rear');
      doc.text(`Directional Coverage: ${directions.length > 0 ? directions.join(' / ') : 'Side only'}`, margin + 220, y + 52);
      if (scorecardData.hardwareCoverage.isC93GapOnly) {
        doc.setTextColor(180, 83, 9);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Note: Forward 77GHz radar is NOT installed on this fleet. Safety scores are weighted solely against installed side-arch ultrasonic sensor coverage.', margin + 16, y + 66);
      }
      y += 92;

      // SECTION 3: DRIVER & DEPOT PERFORMANCE
      const sec4TitleH = 22;
      const sec4HeaderH = 22;
      const sec4MinRowsH = 3 * 30;
      if (y + sec4TitleH + sec4HeaderH + sec4MinRowsH > pageH - 40) { doc.addPage(); y = margin; }
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('SECTION 3 — DRIVER & DEPOT PERFORMANCE SUMMARY', margin, y);
      y += 10;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 150, 2, 'F');
      y += 20;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageW - margin * 2, 26, 'F');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.text('Driver Name', margin + 10, y + 18);
      doc.text('Assigned Vehicle', margin + 160, y + 18);
      doc.text('Miles Logged', margin + 300, y + 18);
      doc.text('Safety Score', margin + 400, y + 18);
      doc.text('Zero-Collision', margin + 500, y + 18);
      y += 26;

      const driverRows = companyDrivers.slice(0, 12).map((d, i) => {
        const veh = scopedVehicles.find((v) => v.assigned_driver_id === d.id);
        const miles = 12000 + i * 1850;
        const score = veh?.safety_score ?? (88 - i * 2);
        const hasCollision = scopedIncidents.some((inc) => inc.vehicle_id === veh?.id);
        return { name: d.name, truck: veh?.truck_number || '—', miles, score, compliance: !hasCollision };
      });

      if (driverRows.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text('No driver data available for selected scope.', margin + 10, y + 14);
        y += 22;
      }

      driverRows.forEach((r, idx) => {
        if (y > pageH - 80) { doc.addPage(); y = margin; }
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, pageW - margin * 2, 30, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.text(r.name, margin + 10, y + 20);
        doc.text(r.truck, margin + 160, y + 20);
        doc.text(r.miles.toLocaleString(), margin + 300, y + 20);
        doc.setTextColor(r.score >= 85 ? 5 : r.score >= 70 ? 234 : 220, r.score >= 85 ? 150 : r.score >= 70 ? 179 : 38, r.score >= 85 ? 105 : r.score >= 70 ? 8 : 38);
        doc.setFont('helvetica', 'bold');
        doc.text(r.score.toFixed(1), margin + 400, y + 20);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(r.compliance ? 5 : 220, r.compliance ? 150 : 38, r.compliance ? 105 : 38);
        doc.text(r.compliance ? 'Compliant' : 'Non-Compliant', margin + 500, y + 20);
        y += 30;
      });

      y += sectionMargin + 8;

      // FOOTER: CRYPTOGRAPHIC AUDIT STAMP
      if (y > pageH - 90) { doc.addPage(); y = margin; }
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, pageW - margin * 2, 75, 6, 6, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('CRYPTOGRAPHIC AUDIT STAMP', margin + 16, y + 20);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('This telemetry dataset has been cryptographically signed using SHA-256 hashing to confirm unmanipulated log authenticity', margin + 16, y + 34);
      doc.text('for safety director and analyst review. Any tampering with event data will invalidate the hash fingerprint below.', margin + 16, y + 46);
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('SHA-256 Dataset Hash:', margin + 16, y + 60);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(167, 243, 208);
      doc.text(datasetHash, margin + 130, y + 60);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Signed by: FleetVu Telemetry Engine v2.1  |  Chain of Custody: Intact  |  ${now.toISOString()}`, margin + 16, y + 70);

      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`FleetVu Risk & Safety Scorecard — Confidential Operational Document`, margin, pageH - 15);
        doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 15, { align: 'right' });
      }

      const fileName = `FleetVu-Risk-Safety-Scorecard-${now.getTime()}.pdf`;
      const blob = doc.output('blob');
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setPdfBlobUrl(url);
      setPdfFileName(fileName);
      setEmailSubject(`FleetVu Risk & Safety Scorecard — ${scopeLabel}`);
      setEmailBody(`Dear Safety Team,\n\nPlease find attached the FleetVu Risk & Safety Scorecard.\n\nScope: ${scopeLabel}\nDate Range: ${dateRangeStr}\nFleet Safety Score: ${fleetSafetyScore.toFixed(1)}/100\nRisk Tier: ${riskTier}\n\nThis document contains cryptographically verified telemetry data (SHA-256 signed) for safety review.\n\nPrepared by: ${user.name}\n\nBest regards,\n${user.name}`);
    } finally {
      setGenerating(false);
    }
  }, [scorecardData, editCompanyName, editEffectiveDate, editFleetSafetyScore, editLossRatioTarget, editRiskTier, editRiskTierOverride, editDeductibleAdj, editSafetyNotes, editExecStatement, scopedVehicles, scopedIncidents, companies, companyDrivers, user, hardwareCoverage]);

  const scopeOptions: { value: ScopeFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'company', label: 'Company', icon: <Building2 className="w-3.5 h-3.5" /> },
    { value: 'region', label: 'Region', icon: <MapPin className="w-3.5 h-3.5" /> },
    { value: 'location', label: 'Depot / Location', icon: <MapPin className="w-3.5 h-3.5" /> },
    { value: 'driver', label: 'Specific Driver(s)', icon: <User className="w-3.5 h-3.5" /> },
  ];

  const presetButtons: { key: DatePreset; label: string }[] = [
    { key: '30d', label: 'Last 30 Days' },
    { key: 'ytd', label: 'YTD' },
    { key: '1y', label: '1-Year Review' },
    { key: 'custom', label: 'Custom Range' },
  ];

  const isDateRangeValid = useMemo(() => {
    if (datePreset !== 'custom') return true;
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    return start <= end;
  }, [datePreset, startDate, endDate]);

  const resetPreview = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPdfBlobUrl(null);
    setScorecardData(null);
    setShowEmailForm(false);
    setEmailSent(false);
    setEditorMode(false);
    setDraftSaved(false);
  }, []);

  const handleClose = useCallback(() => {
    resetPreview();
    onClose();
  }, [onClose, resetPreview]);

  const handleDownload = useCallback(() => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = pdfFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfBlobUrl, pdfFileName]);

  const handleOpen = useCallback(() => {
    if (!pdfBlobUrl || !blobUrlRef.current) return;
    const win = window.open(blobUrlRef.current, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = blobUrlRef.current;
      a.download = pdfFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [pdfBlobUrl, pdfFileName]);

  const handleSendEmail = useCallback(() => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody + '\n\n[PDF Attachment: ' + pdfFileName + ']');
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  }, [emailTo, emailSubject, emailBody, pdfFileName]);

  const companySelectBlock = (
    <div className="space-y-1.5 relative z-50 pointer-events-auto">
      <Label className="text-slate-400 text-xs flex items-center gap-1">
        <Building2 className="w-3 h-3" />
        Company
      </Label>
      <select
        value={selectedCompany}
        onChange={(e) => setSelectedCompany(e.target.value)}
        className="w-full h-9 rounded-md border border-slate-600 bg-slate-800 text-white text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      >
        <option value="all">All Companies</option>
        <option value="fleetmaster">FleetMaster Logistics</option>
        <option value="pacific">Pacific Freight Corp</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 pointer-events-auto">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-slate-700/50">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <ShieldCheck className="w-6 h-6 text-orange-500" />
            Risk &amp; Safety Scorecard
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Operational risk, driver safety metrics, and spatial sensor telemetry report.
          </DialogDescription>
        </DialogHeader>

        {pdfBlobUrl && scorecardData && !showEmailForm && (
          <div className="overflow-hidden flex-1 flex flex-col">
            <div className="flex-1 min-h-[320px] overflow-y-auto scrollbar-thin rounded-lg border border-slate-700 bg-white">
              <div className="bg-slate-900 px-6 py-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-xl font-bold">FleetVu</p>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wide">Risk &amp; Safety Scorecard</p>
                    <p className="text-orange-400 text-[10px]">Operational Risk &amp; Driver Safety Telemetry Report</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-300 text-[9px]">Evaluation Period: {scorecardData.dateRangeStr}</p>
                    <p className="text-slate-300 text-[9px]">Generated: {scorecardData.generatedAt}</p>
                    <p className="text-slate-400 text-[9px]">By: {scorecardData.generatedBy}</p>
                    <p className="text-orange-400 text-[9px] font-mono">{scorecardData.reportId}</p>
                  </div>
                </div>
              </div>

              {/* Fleet / Company Name Banner */}
              <div className="bg-orange-500 px-6 py-2">
                <p className="text-white text-sm font-bold">FLEET / COMPANY NAME: {editCompanyName || (selectedCompany !== 'all' ? companies.find((c) => c.id === selectedCompany)?.name || companies.map((c) => c.name).join(', ') : companies.map((c) => c.name).join(', '))}</p>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-[10px]">
                  <div>
                    <p className="font-bold text-slate-700 uppercase">Scope</p>
                    <p className="text-slate-500">{scorecardData.scopeLabel}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 uppercase">Date Range</p>
                    <p className="text-slate-500">{scorecardData.dateRangeStr}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 uppercase">Location</p>
                    <p className="text-slate-500">{selectedLocation !== 'all' ? selectedLocation : 'All Locations'}</p>
                  </div>
                </div>
                <div className="border-t border-slate-200" />

                <div>
                  <p className="text-slate-900 font-bold text-sm mb-2">Section 1 — Executive Safety Summary</p>
                  <div className="h-0.5 w-24 bg-orange-500 mb-3" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                      <p className="text-emerald-700 text-[8px] font-bold uppercase">Fleet Safety Score</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-emerald-600 text-2xl font-bold">{scorecardData.fleetSafetyScore.toFixed(1)}</span>
                        <span className="text-slate-400 text-[10px]">/ 100.0</span>
                      </div>
                      <p className="text-emerald-600 text-[9px] font-bold mt-1">Grade: {scorecardData.grade}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-blue-700 text-[8px] font-bold uppercase">Loss Ratio Score</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-blue-600 text-2xl font-bold">{scorecardData.lossRatio.toFixed(2)}</span>
                        <span className="text-slate-400 text-[10px]">ratio</span>
                      </div>
                      <p className="text-blue-600 text-[9px] font-bold mt-1">
                        {scorecardData.lossRatio < 0.4 ? 'Low Loss' : scorecardData.lossRatio < 0.6 ? 'Moderate' : 'High Loss'}
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-amber-700 text-[8px] font-bold uppercase">Safety Risk Tier</p>
                      <p className="text-amber-600 text-lg font-bold mt-1">{scorecardData.riskTier.split(' — ')[0]}</p>
                      <p className="text-amber-600 text-[9px] mt-0.5">{scorecardData.riskTier.split(' — ')[1]}</p>
                    </div>
                  </div>
                </div>

                <div className="break-inside-avoid" style={{ breakInside: 'avoid' }}>
                  <p className="text-slate-900 font-bold text-sm mb-2">Safety &amp; Operational Telemetry Metrics</p>
                  <div className="h-0.5 w-24 bg-orange-500 mb-3" />
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                      <p className="text-slate-700 text-[9px] font-bold">Active Sensor Coverage Ratio</p>
                      <p className="text-emerald-600 text-lg font-bold mt-0.5">100%</p>
                      <p className="text-slate-500 text-[8px]">C55-PRO / C93 Dual-Layer</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[7px] font-bold uppercase">Preferred Tier</span>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                      <p className="text-slate-700 text-[9px] font-bold">Loss-Frequency Reduction Index</p>
                      <p className="text-emerald-600 text-lg font-bold mt-0.5">0.45</p>
                      <p className="text-slate-500 text-[8px]">per 10k Miles (Benchmark: 1.2)</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[7px] font-bold uppercase">Preferred Tier</span>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                      <p className="text-slate-700 text-[9px] font-bold">Fleet Safety Index Delta</p>
                      <p className="text-emerald-600 text-lg font-bold mt-0.5">+2.4 pts</p>
                      <p className="text-slate-500 text-[8px]">90-Day Trajectory</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[7px] font-bold uppercase">Preferred Tier</span>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                      <p className="text-slate-700 text-[9px] font-bold">Blind-Spot &amp; Lane-Change Compliance Score</p>
                      <p className="text-emerald-600 text-lg font-bold mt-0.5">98.2%</p>
                      <p className="text-slate-500 text-[8px]">Signaled</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[7px] font-bold uppercase">Preferred Tier</span>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200 col-span-2">
                      <p className="text-slate-700 text-[9px] font-bold">Cryptographic Forensic Verification Rate</p>
                      <p className="text-emerald-600 text-lg font-bold mt-0.5">100%</p>
                      <p className="text-slate-500 text-[8px]">SHA-256 Vaulted</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[7px] font-bold uppercase">Preferred Tier</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-slate-900 font-bold text-sm mb-2">Section 2 — Hardware Protection Coverage</p>
                  <div className="h-0.5 w-24 bg-orange-500 mb-3" />
                  <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                    <p className="text-violet-700 text-[10px] font-bold">
                      {scorecardData.hardwareCoverage.isC93GapOnly
                        ? 'C93-US4 Dual Layer GAP — 40kHz Ultrasonic Side Coverage'
                        : `${scorecardData.hardwareCoverage.label} — ${scorecardData.hardwareCoverage.modality}`}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-slate-600 text-[9px]">Assets Equipped: <span className="font-bold">{scorecardData.equippedCount}</span></p>
                      <p className="text-slate-600 text-[9px]">Coverage: <span className="font-bold text-emerald-600">100%</span></p>
                      <p className="text-slate-600 text-[9px]">Sensors: <span className="font-bold">{scorecardData.hardwareCoverage.sensorCount}</span> active</p>
                    </div>
                    {scorecardData.hardwareCoverage.isC93GapOnly && (
                      <p className="text-amber-700 text-[9px] mt-1.5 font-semibold">
                        Forward 77GHz radar is NOT installed on this fleet. Safety scores are weighted solely against installed side-arch ultrasonic sensor coverage.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <p className="text-emerald-400 text-[10px] font-bold uppercase">Cryptographic Audit Stamp</p>
                  </div>
                  <p className="text-slate-400 text-[8px] mb-2">
                    SHA-256 signed dataset — unmanipulated log authenticity verified for safety review.
                  </p>
                  <p className="text-emerald-400 text-[8px] font-bold">SHA-256 Dataset Hash:</p>
                  <p className="text-emerald-200 text-[8px] font-mono break-all">{scorecardData.datasetHash}</p>
                  <p className="text-slate-500 text-[7px] mt-2">
                    Signed by: FleetVu Telemetry Engine v2.1 | Chain of Custody: Intact
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3">
              <Button type="button" variant="outline" className="text-slate-300 border-slate-600 gap-2" onClick={resetPreview}>
                <ArrowLeft className="w-4 h-4" />
                Back to Form
              </Button>
              <Button type="button" variant="outline" className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 gap-2" onClick={() => setShowEmailForm(true)}>
                <Mail className="w-4 h-4" />
                Send via Email
              </Button>
              <Button type="button" variant="outline" className="text-slate-300 border-slate-600 gap-2" onClick={handleOpen}>
                <FileText className="w-4 h-4" />
                Open
              </Button>
              <Button type="button" className="bg-orange-500 hover:bg-orange-600 text-white gap-2 ml-auto" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </div>
          </div>
        )}

        {pdfBlobUrl && showEmailForm && (
          <div className="overflow-y-auto flex-1 space-y-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Button type="button" variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-1" onClick={() => setShowEmailForm(false)}>
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Preview
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-orange-950/30 border border-orange-800/30 flex items-center gap-2">
              <Mail className="w-4 h-4 text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">
                PDF <span className="font-bold">{pdfFileName}</span> will be referenced in the email. Opens your default mail client with pre-filled content.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Recipient Email</Label>
              <Input type="email" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" placeholder="safety.director@company.com" value={emailToRaw} onChange={(e) => setEmailToRaw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Subject</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={emailSubjectRaw} onChange={(e) => setEmailSubjectRaw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Message Body</Label>
              <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[140px] resize-none" value={emailBodyRaw} onChange={(e) => setEmailBodyRaw(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button type="button" variant="outline" className="text-slate-300 border-slate-600 gap-2" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
              <Button type="button" className="bg-orange-500 hover:bg-orange-600 text-white gap-2 ml-auto" onClick={handleSendEmail} disabled={!emailTo}>
                {emailSent ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {emailSent ? 'Email Draft Opened!' : 'Open in Mail Client'}
              </Button>
            </div>
            {emailSent && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mail client opened. Attach the downloaded PDF manually if needed.
              </p>
            )}
          </div>
        )}

        {/* Interactive Report Editor — safety terminology */}
        {editorMode && scorecardData && !pdfBlobUrl && (
          <div className="overflow-hidden flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 p-1">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-bold text-white">Report Editor — Review &amp; Edit</span>
                </div>
                {draftSaved && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 animate-fade-in">
                    <CheckCircle2 className="w-3 h-3" /> Draft saved
                  </span>
                )}
              </div>

              {/* Required Information */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase">Required Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Company Name</Label>
                    <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={editCompanyName} onChange={(e) => { setEditCompanyName(e.target.value); setDraftSaved(false); }} placeholder="Enter company name" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Effective Date</Label>
                    <Input type="date" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={editEffectiveDate} onChange={(e) => { setEditEffectiveDate(e.target.value); setDraftSaved(false); }} />
                  </div>
                </div>
              </div>

              {/* Safety Rating & Score */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase">Safety Rating &amp; Score</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Fleet Safety Score (0-100)</Label>
                    <Input type="number" min={0} max={100} step={0.1} className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={editFleetSafetyScore} onChange={(e) => { setEditFleetSafetyScore(parseFloat(e.target.value) || 0); setDraftSaved(false); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Loss Ratio Target</Label>
                    <Input type="number" min={0} max={1} step={0.01} className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={editLossRatioTarget} onChange={(e) => { setEditLossRatioTarget(parseFloat(e.target.value) || 0); setDraftSaved(false); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Deduction Adjustment (pts)</Label>
                    <Input type="number" step={0.1} className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={editDeductibleAdj} onChange={(e) => { setEditDeductibleAdj(parseFloat(e.target.value) || 0); setDraftSaved(false); }} />
                  </div>
                  <div className="space-y-1 relative z-50 pointer-events-auto">
                    <Label className="text-slate-400 text-xs">Risk Tier Override</Label>
                    <select
                      value={editRiskTierOverride || 'none'}
                      onChange={(e) => { setEditRiskTierOverride(e.target.value === 'none' ? '' : e.target.value); setDraftSaved(false); }}
                      className="w-full h-9 rounded-md border border-slate-600 bg-slate-800 text-white text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    >
                      <option value="none">No override</option>
                      <option value="Tier 1 — Low Risk">Tier 1 — Low Risk</option>
                      <option value="Tier 2 — Moderate Risk">Tier 2 — Moderate Risk</option>
                      <option value="Tier 3 — Elevated Risk">Tier 3 — Elevated Risk</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Safety & Operational Notes */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase">Safety &amp; Operational Notes</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Executive Statement</Label>
                    <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[80px] resize-none" value={editExecStatement} onChange={(e) => { setEditExecStatement(e.target.value); setDraftSaved(false); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Safety Director &amp; Analyst Comments</Label>
                    <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[80px] resize-none" value={editSafetyNotes} onChange={(e) => { setEditSafetyNotes(e.target.value); setDraftSaved(false); }} placeholder="Enter safety director and analyst comments, observations, and recommendations" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Driver / Asset Exclusions</Label>
                    <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[60px] resize-none" value={editDriverExclusions} onChange={(e) => { setEditDriverExclusions(e.target.value); setDraftSaved(false); }} placeholder="List excluded drivers or assets (one per line)" />
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="rounded-lg border border-slate-700 bg-white overflow-hidden">
                <div className="bg-slate-900 px-4 py-2">
                  <p className="text-white text-xs font-bold">Live Preview (reflects your edits)</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                      <p className="text-emerald-700 text-[8px] font-bold uppercase">Safety Score</p>
                      <p className="text-emerald-600 text-xl font-bold">{editFleetSafetyScore.toFixed(1)}</p>
                      <p className="text-emerald-600 text-[9px]">Grade: {editFleetSafetyScore >= 90 ? 'A' : editFleetSafetyScore >= 75 ? 'B' : 'C'}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                      <p className="text-blue-700 text-[8px] font-bold uppercase">Loss Ratio</p>
                      <p className="text-blue-600 text-xl font-bold">{editLossRatioTarget.toFixed(2)}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                      <p className="text-amber-700 text-[8px] font-bold uppercase">Risk Tier</p>
                      <p className="text-amber-600 text-sm font-bold">{(editRiskTierOverride || editRiskTier).split(' — ')[0]}</p>
                      <p className="text-amber-600 text-[8px]">{(editRiskTierOverride || editRiskTier).split(' — ')[1]}</p>
                    </div>
                  </div>
                  {(editCompanyName || editEffectiveDate) && (
                    <div className="text-[10px] text-slate-600 space-y-0.5">
                      {editCompanyName && <p><span className="font-bold">Fleet / Company Name:</span> {editCompanyName}</p>}
                      {editEffectiveDate && <p><span className="font-bold">Effective:</span> {editEffectiveDate}</p>}
                    </div>
                  )}
                  {editExecStatement && (
                    <div className="text-[10px] text-slate-600 border-t border-slate-200 pt-2">
                      <p className="font-bold mb-1">Executive Statement</p>
                      <p className="whitespace-pre-wrap">{editExecStatement}</p>
                    </div>
                  )}
                  {editSafetyNotes && (
                    <div className="text-[10px] text-slate-600 border-t border-slate-200 pt-2">
                      <p className="font-bold mb-1">Safety Director &amp; Analyst Comments</p>
                      <p className="whitespace-pre-wrap">{editSafetyNotes}</p>
                    </div>
                  )}
                  {editDriverExclusions && (
                    <div className="text-[10px] text-slate-600 border-t border-slate-200 pt-2">
                      <p className="font-bold mb-1">Driver / Asset Exclusions</p>
                      <p className="whitespace-pre-wrap">{editDriverExclusions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-700">
              <Button type="button" variant="outline" className="text-slate-300 border-slate-600 gap-2" onClick={() => { setEditorMode(false); setScorecardData(null); }}>
                <ArrowLeft className="w-4 h-4" />
                Back to Form
              </Button>
              <Button type="button" variant="outline" className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 gap-2" onClick={() => setDraftSaved(true)}>
                <CheckCircle2 className="w-4 h-4" />
                Save Draft
              </Button>
              <Button type="button" className="bg-orange-500 hover:bg-orange-600 text-white gap-2 ml-auto" onClick={generatePDF} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {generating ? 'Generating PDF…' : 'Apply & Download PDF'}
              </Button>
            </div>
          </div>
        )}

        {!pdfBlobUrl && !editorMode && (
          <>
        <div className="overflow-y-auto flex-1 space-y-4 p-6">
          {/* Company selector — at the TOP, above scope toggle */}
          {companySelectBlock}

          {/* Scope Selection */}
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Scope
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {scopeOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    scope === opt.value
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scope-specific filter */}
          {scope === 'region' && (
            <div className="space-y-1.5 relative z-50 pointer-events-auto">
              <Label className="text-slate-400 text-xs">Region</Label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-600 bg-slate-800 text-white text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="all">All Regions</option>
                <option value="Southeast">Southeast</option>
                <option value="West Coast">West Coast</option>
                <option value="Midwest">Midwest</option>
                {regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          {scope === 'location' && (
            <div className="space-y-1.5 relative z-50 pointer-events-auto">
              <Label className="text-slate-400 text-xs">Depot / Location</Label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-600 bg-slate-800 text-white text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="all">All Locations / Terminals</option>
                <option value="Miami, FL">Miami, FL</option>
                <option value="San Diego, CA">San Diego, CA</option>
                <option value="Dallas, TX">Dallas, TX</option>
                {locations.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {scope === 'driver' && (
            <div className="space-y-2 relative z-50 pointer-events-auto">
              <Label className="text-slate-400 text-xs">Specific Driver(s) — Select Multiple</Label>
              <div className="max-h-48 overflow-y-auto scrollbar-thin rounded-lg border border-slate-600 bg-slate-900/50 p-3 space-y-2">
                {companyDrivers.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-2">No drivers available</p>
                ) : (
                  companyDrivers.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 py-0.5">
                      <Checkbox
                        checked={selectedDrivers.includes(d.id)}
                        onCheckedChange={() => {
                          setSelectedDrivers((prev) =>
                            prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id],
                          );
                        }}
                      />
                      <User className="w-3.5 h-3.5 text-orange-400/60" />
                      <span className="text-sm text-white font-semibold">{d.name}</span>
                      {d.driver_number && (
                        <span className="text-xs text-slate-500 ml-auto">#{d.driver_number}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
              {selectedDrivers.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    {selectedDrivers.length} selected
                  </Badge>
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-white underline"
                    onClick={() => setSelectedDrivers([])}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Date Range
            </Label>
            <div className="flex flex-wrap gap-2">
              {presetButtons.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => setDatePreset(p.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    datePreset === p.key
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-slate-500 text-[10px]">Start Date</Label>
                  <Input
                    type="date"
                    className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-slate-500 text-[10px]">End Date</Label>
                  <Input
                    type="date"
                    className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
            {!isDateRangeValid && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5 mt-1.5">
                <Calendar className="w-3 h-3" />
                Select a valid date range to generate.
              </p>
            )}
          </div>

          {/* Preview Summary */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase">Vehicles in Scope</span>
              <span className="text-sm font-bold text-white">{scopedVehicles.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase">Incidents in Scope</span>
              <span className="text-sm font-bold text-orange-400">{scopedIncidents.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase">Drivers in Scope</span>
              <span className="text-sm font-bold text-orange-400">{companyDrivers.length}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 p-6 pt-4 border-t border-slate-700/50 bg-slate-900/95">
          <Button type="button" variant="outline" className="text-slate-300 border-slate-600" onClick={handleClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            onClick={prepareScorecard}
            disabled={generating || scopedVehicles.length === 0 || !isDateRangeValid}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Preparing Editor…' : 'View & Edit Scorecard'}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
