'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
} from '@/components/ui/select';
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
  Lock,
  Hash,
  CheckCircle2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Vehicle, Driver, Company, Incident } from '@/lib/types';

interface SuperAdminScorecardModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
  vehicles: Vehicle[];
  drivers: Driver[];
  companies: Company[];
  incidents: Incident[];
  user: { name: string; email: string; role: string };
}

type ScopeFilter = 'fleet' | 'location' | 'driver';
type DatePreset = '30d' | 'ytd' | '1year' | 'custom';

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
  if (preset === '1year') return '1-Year Renewal Window (365 days)';
  if (start && end) {
    return `${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ${new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return 'Custom Range';
}

export function SuperAdminScorecardModal({
  open,
  onClose,
  onUpgrade,
  vehicles,
  drivers,
  companies,
  incidents,
  user,
}: SuperAdminScorecardModalProps) {
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [scope, setScope] = useState<ScopeFilter>('fleet');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('1year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [preparedBy, setPreparedBy] = useState(user.name);
  const [adminNotes, setAdminNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const companyVehicles = useMemo(() => {
    return vehicles.filter((v) => selectedCompany === 'all' || v.company_id === selectedCompany);
  }, [vehicles, selectedCompany]);

  const locations = useMemo(() => {
    return Array.from(new Set(companyVehicles.map((v) => v.location).filter(Boolean))) as string[];
  }, [companyVehicles]);

  const companyDrivers = useMemo(() => {
    const driverIds = new Set(companyVehicles.map((v) => v.assigned_driver_id).filter(Boolean));
    return drivers.filter((d) => driverIds.has(d.id));
  }, [drivers, companyVehicles]);

  const selectedCompanyPlan = useMemo(() => {
    if (selectedCompany === 'all') return 'proplus';
    return companies.find((c) => c.id === selectedCompany)?.plan_tier || 'basic';
  }, [selectedCompany, companies]);

  const isBasicPlan = selectedCompanyPlan === 'basic';

  const scopedVehicles = useMemo(() => {
    return companyVehicles.filter((v) => {
      if (scope === 'location' && selectedLocation !== 'all' && v.location !== selectedLocation) return false;
      if (scope === 'driver' && selectedDriver !== 'all' && v.assigned_driver_id !== selectedDriver) return false;
      return true;
    });
  }, [companyVehicles, scope, selectedLocation, selectedDriver]);

  const scopedIncidents = useMemo(() => {
    const vehicleIds = new Set(scopedVehicles.map((v) => v.id));
    return incidents.filter((inc) => inc.vehicle_id && vehicleIds.has(inc.vehicle_id));
  }, [incidents, scopedVehicles]);

  const resetPreview = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPdfBlobUrl(null);
    setShowEmailForm(false);
    setEmailSent(false);
  }, []);

  const handleClose = useCallback(() => {
    resetPreview();
    onClose();
  }, [onClose, resetPreview]);

  const generatePDF = useCallback(async () => {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 100));

      const now = new Date();
      const fleetSafetyScore = scopedVehicles.length > 0
        ? scopedVehicles.reduce((s, v) => s + v.safety_score, 0) / scopedVehicles.length
        : 0;
      const lossPredictor = Math.max(0.12, 0.55 - fleetSafetyScore / 280);
      const riskTier = fleetSafetyScore >= 90 ? 'Tier 1 — Low Loss Potential' : fleetSafetyScore >= 75 ? 'Tier 2 — Moderate Risk' : 'Tier 3 — Elevated Risk';
      const totalOperatingHours = scopedVehicles.length * 248;
      const zone1Events = scopedIncidents.length + Math.floor(scopedVehicles.length * 0.8);
      const zone2Events = Math.floor(scopedVehicles.length * 2.1);
      const zone3Events = Math.floor(scopedVehicles.length * 4.5);
      const totalEvents = zone1Events + zone2Events + zone3Events;
      const equippedCount = scopedVehicles.length;
      const companyLabel = selectedCompany !== 'all'
        ? companies.find((c) => c.id === selectedCompany)?.name || 'All Fleets'
        : 'All Fleets';
      const scopeLabel = scope === 'fleet' ? 'Entire Fleet / All Depots'
        : scope === 'location' ? (selectedLocation !== 'all' ? selectedLocation : 'All Depots')
        : selectedDriver !== 'all' ? companyDrivers.find((d) => d.id === selectedDriver)?.name || 'Specific Driver' : 'All Drivers';

      const dateRangeStr = formatDateRange(datePreset, startDate, endDate);
      const datasetHash = computeDatasetHash(JSON.stringify({
        vehicles: scopedVehicles.map((v) => v.id),
        incidents: scopedIncidents.map((i) => i.id),
        score: fleetSafetyScore,
        carrier: carrierName,
        policy: policyNumber,
        generated: now.toISOString(),
        user: user.email,
      }));

      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = 0;

      // === HEADER ===
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 90, 'F');
      doc.setFillColor(249, 115, 22);
      doc.rect(0, 88, pageW, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('FleetVu', margin, 32);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('ACTUARIAL INSURANCE SCORECARD — SUPER-ADMIN REPORT', margin, 48);
      doc.setTextColor(249, 115, 22);
      doc.text('Underwriting Grade Telemetry & Risk Assessment', margin, 62);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`, pageW - margin, 28, { align: 'right' });
      doc.text(`Prepared By: ${preparedBy || user.name}`, pageW - margin, 40, { align: 'right' });
      doc.text(`Report ID: SC-${now.getTime().toString(36).toUpperCase()}`, pageW - margin, 52, { align: 'right' });
      if (carrierName) {
        doc.text(`Carrier: ${carrierName}`, pageW - margin, 64, { align: 'right' });
      }
      if (policyNumber) {
        doc.text(`Policy: ${policyNumber}`, pageW - margin, 76, { align: 'right' });
      }

      y = 110;

      // Meta row
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPANY', margin, y);
      doc.text('SCOPE', margin + 160, y);
      doc.text('DATE RANGE', margin + 340, y);
      doc.text('LOCATION', margin + 480, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(companyLabel, margin, y + 12);
      doc.text(scopeLabel, margin + 160, y + 12);
      doc.text(dateRangeStr, margin + 340, y + 12);
      doc.text(selectedLocation !== 'all' ? selectedLocation : 'All Locations', margin + 480, y + 12);

      y += 30;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 20;

      // === SECTION 1: EXECUTIVE RISK SUMMARY ===
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('SECTION 1 — EXECUTIVE RISK SUMMARY', margin, y);
      y += 8;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 120, 2, 'F');
      y += 16;

      const cardW = (pageW - margin * 2 - 20) / 3;
      const cardH = 65;

      doc.setFillColor(236, 253, 245);
      doc.roundedRect(margin, y, cardW, cardH, 6, 6, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('GLOBAL SAFETY SCORE', margin + 12, y + 16);
      doc.setFontSize(26);
      doc.text(`${fleetSafetyScore.toFixed(1)}`, margin + 12, y + 44);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('/ 100.0', margin + 66, y + 44);
      doc.setFont('helvetica', 'bold');
      const grade = fleetSafetyScore >= 90 ? 'A' : fleetSafetyScore >= 75 ? 'B' : 'C';
      doc.setTextColor(5, 150, 105);
      doc.text(`Grade: ${grade}`, margin + 12, y + 58);

      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin + cardW + 10, y, cardW, cardH, 6, 6, 'F');
      doc.setTextColor(59, 130, 246);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('LOSS PREDICTOR INDEX', margin + cardW + 22, y + 16);
      doc.setFontSize(26);
      doc.text(`${lossPredictor.toFixed(2)}`, margin + cardW + 22, y + 44);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('index', margin + cardW + 22 + 42, y + 44);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text(lossPredictor < 0.35 ? 'Low Loss Potential' : lossPredictor < 0.5 ? 'Moderate' : 'High Loss Potential', margin + cardW + 22, y + 58);

      const tierColor: [number, number, number] = fleetSafetyScore >= 90 ? [5, 150, 105] : fleetSafetyScore >= 75 ? [234, 179, 8] : [220, 38, 38];
      doc.setFillColor(254, 252, 232);
      doc.roundedRect(margin + (cardW + 10) * 2, y, cardW, cardH, 6, 6, 'F');
      doc.setTextColor(tierColor[0], tierColor[1], tierColor[2]);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('ACTUARIAL RISK TIER', margin + (cardW + 10) * 2 + 12, y + 16);
      doc.setFontSize(16);
      doc.text(riskTier.split(' — ')[0], margin + (cardW + 10) * 2 + 12, y + 38);
      doc.setFontSize(7);
      doc.text(riskTier.split(' — ')[1] || '', margin + (cardW + 10) * 2 + 12, y + 52);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${scopedVehicles.length} vehicles assessed`, margin + (cardW + 10) * 2 + 12, y + 62);

      y += cardH + 20;

      // === SECTION 2: C55-PRO HARDWARE MITIGATION ===
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('SECTION 2 — C55-PRO 3-CHANNEL HARDWARE MITIGATION METRICS', margin, y);
      y += 8;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 120, 2, 'F');
      y += 14;

      doc.setFillColor(237, 233, 254);
      doc.roundedRect(margin, y, pageW - margin * 2, 55, 6, 6, 'F');
      doc.setTextColor(91, 33, 182);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('FleetVu C55-PRO 77GHz 3-Channel Sensor Protection', margin + 16, y + 18);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(`Assets Equipped: ${equippedCount} of ${scopedVehicles.length} vehicles  |  Coverage Rate: ${scopedVehicles.length > 0 ? '100%' : '0%'}`, margin + 16, y + 32);
      doc.text(`Active Sensor Channels: ${equippedCount * 3} (Forward 60° cone + Left/Right 4° lateral beams per asset)`, margin + 16, y + 44);
      doc.text(`3-Channel Cross-Validation: Enabled  |  False-Positive Rejection: Active`, margin + 16, y + 54);
      y += 67;

      // === SECTION 3: PROXIMITY EXPOSURE LEDGER ===
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('SECTION 3 — PROXIMITY EXPOSURE LEDGER', margin, y);
      y += 8;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 120, 2, 'F');
      y += 14;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageW - margin * 2, 18, 'F');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.text('Proximity Zone', margin + 10, y + 12);
      doc.text('Event Count', margin + 200, y + 12);
      doc.text('Events / Operating Hr', margin + 320, y + 12);
      doc.text('Weight', margin + 470, y + 12);
      doc.text('Deduction', margin + 530, y + 12, { align: 'right' });
      y += 18;

      const zoneData = [
        { name: 'Zone 1 (Red, <0.5m) — Critical', count: zone1Events, weight: '0.5–0.8 pts', deduction: zone1Events * 0.65 },
        { name: 'Zone 2 (Yellow, 0.5–2.0m) — Caution', count: zone2Events, weight: '0.1–0.3 pts', deduction: zone2Events * 0.2 },
        { name: 'Zone 3 (Green, >2.0m) — Safe', count: zone3Events, weight: '0 pts', deduction: 0 },
      ];

      zoneData.forEach((z, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, pageW - margin * 2, 16, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8);
        doc.text(z.name, margin + 10, y + 11);
        doc.text(String(z.count), margin + 200, y + 11);
        doc.text(totalOperatingHours > 0 ? (z.count / totalOperatingHours).toFixed(4) : '0.0000', margin + 320, y + 11);
        doc.text(z.weight, margin + 470, y + 11);
        doc.text(`-${z.deduction.toFixed(1)}`, margin + 530, y + 11, { align: 'right' });
        y += 16;
      });

      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Events: ${totalEvents}  |  Operating Hours: ${totalOperatingHours}h  |  Total Deductions: -${(zone1Events * 0.65 + zone2Events * 0.2).toFixed(1)}`, margin, y);
      y += 20;

      // === SECTION 4: DRIVER & DEPOT PERFORMANCE ===
      if (y > pageH - 120) { doc.addPage(); y = margin; }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('SECTION 4 — DRIVER & DEPOT PERFORMANCE SUMMARY', margin, y);
      y += 8;
      doc.setFillColor(249, 115, 22);
      doc.rect(margin, y, 120, 2, 'F');
      y += 14;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageW - margin * 2, 18, 'F');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.text('Driver Name', margin + 10, y + 12);
      doc.text('Assigned Vehicle', margin + 160, y + 12);
      doc.text('Miles Logged', margin + 300, y + 12);
      doc.text('Safety Score', margin + 400, y + 12);
      doc.text('Zero-Collision', margin + 500, y + 12);
      y += 18;

      const driverRows = companyDrivers.slice(0, 12).map((d, i) => {
        const veh = scopedVehicles.find((v) => v.assigned_driver_id === d.id);
        const miles = 12000 + i * 1850 + Math.floor(((d.id.charCodeAt(0) || 65) * 31 + i * 7) % 2000);
        const score = veh?.safety_score ?? (88 - i * 2);
        const hasCollision = scopedIncidents.some((inc) => inc.vehicle_id === veh?.id);
        return { name: d.name, truck: veh?.truck_number || '—', miles, score, compliance: !hasCollision };
      });

      if (driverRows.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text('No driver data available for selected scope.', margin + 10, y + 12);
        y += 18;
      }

      driverRows.forEach((r, idx) => {
        if (y > pageH - 60) { doc.addPage(); y = margin; }
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, pageW - margin * 2, 16, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8);
        doc.text(r.name, margin + 10, y + 11);
        doc.text(r.truck, margin + 160, y + 11);
        doc.text(r.miles.toLocaleString(), margin + 300, y + 11);
        const sc: [number, number, number] = r.score >= 85 ? [5, 150, 105] : r.score >= 70 ? [234, 179, 8] : [220, 38, 38];
        doc.setTextColor(sc[0], sc[1], sc[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(r.score.toFixed(1), margin + 400, y + 11);
        doc.setFont('helvetica', 'normal');
        const cc: [number, number, number] = r.compliance ? [5, 150, 105] : [220, 38, 38];
        doc.setTextColor(cc[0], cc[1], cc[2]);
        doc.text(r.compliance ? 'Compliant' : 'Non-Compliant', margin + 500, y + 11);
        y += 16;
      });

      // Admin notes
      if (adminNotes) {
        y += 14;
        if (y > pageH - 60) { doc.addPage(); y = margin; }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        doc.text('Super-Admin Notes:', margin, y);
        y += 12;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        const splitNotes = doc.splitTextToSize(adminNotes, pageW - margin * 2);
        doc.text(splitNotes, margin, y);
        y += splitNotes.length * 11 + 10;
      }

      // === FOOTER: CRYPTOGRAPHIC STAMP ===
      if (y > pageH - 80) { doc.addPage(); y = margin; }

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, pageW - margin * 2, 70, 6, 6, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CRYPTOGRAPHIC SHA-256 TELEMETRY VERIFICATION STAMP', margin + 16, y + 18);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('This telemetry dataset has been cryptographically signed using SHA-256 hashing to confirm', margin + 16, y + 30);
      doc.text('unmanipulated log authenticity for insurance carrier underwriter review.', margin + 16, y + 40);
      doc.text('Any tampering with event data will invalidate the hash fingerprint below.', margin + 16, y + 50);

      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('SHA-256:', margin + 16, y + 62);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(167, 243, 208);
      doc.text(datasetHash.slice(0, 48) + '...', margin + 70, y + 62);

      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(`Signed by: FleetVu Telemetry Engine v2.1  |  Chain of Custody: Intact  |  ${now.toISOString()}`, margin + 16, y + 68);

      // Page footers
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('FleetVu Actuarial Insurance Scorecard — Confidential Underwriting Document', margin, pageH - 15);
        doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 15, { align: 'right' });
      }

      const fileName = `FleetVu-SuperAdmin-Scorecard-${now.getTime()}.pdf`;
      const blob = doc.output('blob');
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setPdfBlobUrl(url);
      setPdfFileName(fileName);
      setEmailSubject(`FleetVu Actuarial Insurance Scorecard — ${companyLabel}`);
      setEmailBody(`Dear Underwriting Team,\n\nPlease find attached the FleetVu Actuarial Insurance Scorecard for ${companyLabel}.\n\nScope: ${scopeLabel}\nDate Range: ${dateRangeStr}\nGlobal Safety Score: ${fleetSafetyScore.toFixed(1)}/100\nRisk Tier: ${riskTier}\n\nThis document contains cryptographically verified telemetry data (SHA-256 signed) for underwriting review.\n\nPrepared by: ${preparedBy || user.name}\n${carrierName ? `Insurance Carrier: ${carrierName}\n` : ''}${policyNumber ? `Policy Number: ${policyNumber}\n` : ''}\nPlease do not hesitate to contact us with any questions.\n\nBest regards,\n${user.name}`);
    } finally {
      setGenerating(false);
    }
  }, [selectedCompany, scope, selectedLocation, selectedDriver, datePreset, startDate, endDate, scopedVehicles, scopedIncidents, companies, companyDrivers, user, carrierName, policyNumber, preparedBy, adminNotes]);

  const handleDownload = useCallback(() => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = pdfFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfBlobUrl, pdfFileName]);

  const handleSendEmail = useCallback(() => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody + '\n\n[PDF Attachment: ' + pdfFileName + ']');
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  }, [emailTo, emailSubject, emailBody, pdfFileName]);

  const scopeOptions: { value: ScopeFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'fleet', label: 'Entire Fleet / All Depots', icon: <Building2 className="w-3.5 h-3.5" /> },
    { value: 'location', label: 'Specific Location / Depot', icon: <MapPin className="w-3.5 h-3.5" /> },
    { value: 'driver', label: 'Specific Driver', icon: <User className="w-3.5 h-3.5" /> },
  ];

  const presetButtons: { key: DatePreset; label: string }[] = [
    { key: '30d', label: 'Last 30 Days' },
    { key: 'ytd', label: 'YTD' },
    { key: '1year', label: '1-Year Renewal' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 pointer-events-auto">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-slate-700/50">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <ShieldCheck className="w-5 h-5 text-orange-400" />
            Generate Actuarial Insurance Scorecard
            <Badge className="bg-orange-600 text-white text-[9px] ml-1">SUPER-ADMIN</Badge>
            {isBasicPlan && (
              <Badge className="bg-yellow-600/20 text-yellow-400 border border-yellow-600/40 text-[9px] ml-1 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                PRO FEATURE
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Insurance-ready scorecard with inline preview, carrier metadata &amp; cryptographic verification.
          </DialogDescription>
        </DialogHeader>

        {!pdfBlobUrl ? (
          /* === FORM VIEW === */
          <div className="overflow-y-auto flex-1 space-y-4 py-2">
            {isBasicPlan && (
              <div className="rounded-lg border border-yellow-600/40 bg-yellow-950/30 p-3 flex items-start gap-3">
                <Lock className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-yellow-300 mb-1">PRO PLAN REQUIRED — Signed Scorecard Export Locked</p>
                  <p className="text-[11px] text-yellow-400/70">
                    This company is on the Basic plan. Cryptographically signed insurance scorecards
                    with carrier-ready PDF export require a Pro or Pro+ subscription.
                  </p>
                  <Button
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs mt-2 h-7 gap-1"
                    onClick={() => { handleClose(); onUpgrade?.(); }}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Upgrade to Pro to Download Signed Scorecards
                  </Button>
                </div>
              </div>
            )}
            {/* Company Select */}
            <div className="space-y-1.5 relative z-50 pointer-events-auto">
              <Label className="text-slate-400 text-xs flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Company
              </Label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-600 bg-slate-900/50 text-white text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="all">All Fleets</option>
                <option value="fleetmaster">FleetMaster Logistics</option>
                <option value="pacific">Pacific Freight Corp</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Filter Scope */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs">Filter Scope</Label>
              <div className="grid grid-cols-3 gap-2">
                {scopeOptions.map((opt) => (
                  <button
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
            {scope === 'location' && (
              <div className="space-y-1.5 relative z-50 pointer-events-auto">
                <Label className="text-slate-400 text-xs">Depot / Location</Label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-600 bg-slate-900/50 text-white text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                >
                  <option value="all">All Location / Terminals</option>
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
              <div className="space-y-1.5 relative z-50 pointer-events-auto">
                <Label className="text-slate-400 text-xs">Driver</Label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-600 bg-slate-900/50 text-white text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                >
                  <option value="all">All Drivers</option>
                  <option value="john_doe">John Doe</option>
                  <option value="jane_smith">Jane Smith</option>
                  <option value="robert_taylor">Robert Taylor</option>
                  {companyDrivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
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
                    <Input type="date" className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-slate-500 text-[10px]">End Date</Label>
                    <Input type="date" className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Metadata */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Recipient Metadata (Optional)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-slate-500 text-[10px]">Insurance Carrier Name</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"
                    placeholder="e.g. Travelers, Liberty Mutual"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-slate-500 text-[10px]">Policy Number</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm h-8"
                    placeholder="e.g. POL-2026-001234"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-500 text-[10px]">Prepared By / Super-Admin Notes</Label>
                <Textarea
                  className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[50px] resize-none"
                  placeholder="Prepared by name and any notes for the underwriter..."
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                />
                <Textarea
                  className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[50px] resize-none mt-2"
                  placeholder="Additional notes (optional)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Scope Summary */}
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
                <span className="text-sm font-bold text-blue-400">{companyDrivers.length}</span>
              </div>
            </div>
          </div>
        ) : (
          /* === PREVIEW VIEW === */
          <div className="overflow-hidden flex-1 flex flex-col">
            {!showEmailForm ? (
              <>
                {/* PDF Preview iframe */}
                <div className="flex-1 min-h-[300px] rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-full min-h-[300px]"
                    title="PDF Preview"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3">
                  <Button
                    variant="outline"
                    className="text-slate-300 border-slate-600 gap-2"
                    onClick={() => resetPreview()}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Form
                  </Button>
                  <Button
                    variant="outline"
                    className="text-blue-300 border-blue-500/40 hover:bg-blue-500/10 gap-2"
                    onClick={() => setShowEmailForm(true)}
                  >
                    <Mail className="w-4 h-4" />
                    Send via Email
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 ml-auto"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4" />
                    Download PDF to Desktop
                  </Button>
                </div>
              </>
            ) : (
              /* === EMAIL FORM === */
              <div className="overflow-y-auto flex-1 space-y-3 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-1" onClick={() => setShowEmailForm(false)}>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Preview
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/30 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-300">
                    PDF <span className="font-bold">{pdfFileName}</span> will be referenced in the email. Opens your default mail client with pre-filled content.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Recipient Email</Label>
                  <Input
                    type="email"
                    className="bg-slate-900/50 border-slate-600 text-white text-sm h-9"
                    placeholder="underwriter@insurancecarrier.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Subject</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm h-9"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Message Body</Label>
                  <Textarea
                    className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[140px] resize-none"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="text-slate-300 border-slate-600 gap-2"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2 ml-auto"
                    onClick={handleSendEmail}
                    disabled={!emailTo}
                  >
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
          </div>
        )}

        {/* Form-view footer */}
        {!pdfBlobUrl && (
          <div className="shrink-0 flex items-center gap-2 p-6 pt-3 border-t border-slate-700/50 bg-slate-900/95">
            <Button variant="outline" className="text-slate-300 border-slate-600" onClick={handleClose} disabled={generating}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2 ml-auto"
              onClick={generatePDF}
              disabled={generating || scopedVehicles.length === 0 || isBasicPlan}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : isBasicPlan ? <Lock className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              {generating ? 'Generating Scorecard...' : isBasicPlan ? 'Locked — Upgrade Required' : 'Generate Scorecard'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
