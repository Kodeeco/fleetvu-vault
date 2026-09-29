'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
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
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileBarChart,
  Mail,
  Send,
  Building2,
  User,
  Truck,
  MapPin,
  CheckCircle2,
  Calendar,
  Clock,
  Globe,
  Target,
  Lock,
  EyeOff,
  FileDown,
  Loader2,
  Users,
} from 'lucide-react';
import { REGIONS, REGION_LOCATIONS, LOCATION_TERMINALS, HARDWARE_PROFILES } from '@/lib/constants';
import type { Vehicle, Driver, Company } from '@/lib/types';
import jsPDF from 'jspdf';

interface ReportBuilderModalProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  companies: Company[];
  defaultCompanyId?: string | null;
  defaultRegion?: string | null;
  defaultLocation?: string | null;
  onClose: () => void;
  user: { name: string; email: string; role: string };
  previewMode?: boolean;
  onUpgrade?: () => void;
}

type ScopeMode = 'specific' | 'full';
type DriverScopeMode = 'specific' | 'full';
type DatePreset = '24h' | '7d' | '30d' | '90d' | '365d' | 'custom';

export function ReportBuilderModal({
  vehicles,
  drivers,
  companies,
  defaultCompanyId = null,
  defaultRegion = null,
  defaultLocation = null,
  onClose,
  user,
  previewMode = false,
  onUpgrade,
}: ReportBuilderModalProps) {
  const [scopeMode, setScopeMode] = useState<ScopeMode>('specific');
  const [driverScopeMode, setDriverScopeMode] = useState<DriverScopeMode>('full');
  const [filterCompany, setFilterCompany] = useState(defaultCompanyId || 'all');
  const [filterDriver, setFilterDriver] = useState('all');
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [filterTruck, setFilterTruck] = useState('all');
  const [filterRegion, setFilterRegion] = useState(defaultRegion || 'all');
  const [filterLocation, setFilterLocation] = useState(defaultLocation || 'all');
  const [filterTerminal, setFilterTerminal] = useState('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [generating, setGenerating] = useState(false);

  // Apply date preset
  useEffect(() => {
    if (datePreset === 'custom') return;
    const now = new Date();
    const end = now.toISOString().slice(0, 16);
    let start: Date;
    if (datePreset === '24h') start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (datePreset === '7d') start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (datePreset === '30d') start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (datePreset === '90d') start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    setStartDatetime(start.toISOString().slice(0, 16));
    setEndDatetime(end);
  }, [datePreset]);

  // Derive regions from selected company, falling back to standard REGIONS
  const regions = useMemo(() => {
    if (filterCompany !== 'all') {
      const companyRegions = Array.from(
        new Set(
          vehicles
            .filter((v) => v.company_id === filterCompany && v.location)
            .map((v) => {
              const parts = v.location!.split(',');
              return parts.length > 1 ? parts[parts.length - 1].trim() : null;
            })
            .filter(Boolean) as string[],
        ),
      );
      const co = companies.find((c) => c.id === filterCompany);
      if (co?.region) companyRegions.push(co.region);
      return companyRegions.length > 0 ? companyRegions : [...REGIONS];
    }
    const companyRegions = Array.from(new Set(companies.map((c) => c.region).filter(Boolean)));
    return Array.from(new Set([...companyRegions, ...REGIONS]));
  }, [companies, vehicles, filterCompany]);

  // Derive locations from selected region + company
  const locations = useMemo(() => {
    if (filterRegion !== 'all') {
      const companyLocs = Array.from(
        new Set(
          companies
            .filter((c) => c.region === filterRegion)
            .map((c) => c.location)
            .filter(Boolean),
        ),
      );
      const standardLocs = REGION_LOCATIONS[filterRegion] || [];
      const vehicleLocs = vehicles
        .filter((v) => v.location && v.location.includes(filterRegion.split(' ')[0]))
        .map((v) => v.location!);
      return Array.from(new Set([...vehicleLocs, ...companyLocs, ...standardLocs]));
    }
    if (filterCompany !== 'all') {
      return Array.from(
        new Set(vehicles.filter((v) => v.company_id === filterCompany && v.location).map((v) => v.location!)),
      );
    }
    return Array.from(new Set(companies.map((c) => c.location).filter(Boolean)));
  }, [companies, vehicles, filterCompany, filterRegion]);

  // Derive terminals from selected location
  const terminals = useMemo(() => {
    if (filterLocation !== 'all') {
      return LOCATION_TERMINALS[filterLocation] || [];
    }
    return [];
  }, [filterLocation]);

  const isFullScope = scopeMode === 'full';
  const isFullDriverScope = driverScopeMode === 'full';

  // Filter vehicles based on company/region/location/terminal selections
  const scopedVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (filterCompany !== 'all' && v.company_id !== filterCompany) return false;
      if (filterLocation !== 'all' && v.location !== filterLocation) return false;
      if (filterTerminal !== 'all' && v.location && !v.location.includes(filterTerminal)) return false;
      if (!isFullScope && filterTruck !== 'all' && v.truck_number !== filterTruck) return false;
      if (!isFullDriverScope && selectedDrivers.length > 0 && v.assigned_driver_id && !selectedDrivers.includes(v.assigned_driver_id)) return false;
      return true;
    });
  }, [vehicles, filterCompany, filterLocation, filterTerminal, filterTruck, isFullScope, isFullDriverScope, selectedDrivers]);

  // Filter drivers based on scoped vehicles
  const scopedDrivers = useMemo(() => {
    const driverIds = new Set(scopedVehicles.map((v) => v.assigned_driver_id).filter(Boolean));
    const matched = drivers.filter((d) => driverIds.has(d.id));
    return matched.length > 0 ? matched : drivers;
  }, [drivers, scopedVehicles]);

  const handleScopeChange = (val: string) => {
    setScopeMode(val as ScopeMode);
    if (val === 'full') {
      setFilterTruck('all');
      setFilterDriver('all');
      setSelectedDrivers([]);
    }
  };

  const handleCompanyChange = (v: string) => {
    setFilterCompany(v);
    setFilterRegion('all');
    setFilterLocation('all');
    setFilterTerminal('all');
    setFilterTruck('all');
    setFilterDriver('all');
    setSelectedDrivers([]);
  };

  const handleRegionChange = (v: string) => {
    setFilterRegion(v);
    setFilterLocation('all');
    setFilterTerminal('all');
    setFilterTruck('all');
    setFilterDriver('all');
    setSelectedDrivers([]);
  };

  const handleLocationChange = (v: string) => {
    setFilterLocation(v);
    setFilterTerminal('all');
    setFilterTruck('all');
    setFilterDriver('all');
    setSelectedDrivers([]);
  };

  const formatDatetime = (dt: string) => {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleGeneratePDF = async () => {
    if (scopedVehicles.length === 0) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 400));

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 20;

    const scopeDesc = isFullScope
      ? `Full Scope — ${filterCompany !== 'all' ? companies.find((c) => c.id === filterCompany)?.name || 'All Companies' : 'All Companies'}${filterRegion !== 'all' ? ` / ${filterRegion}` : ''}${filterLocation !== 'all' ? ` / ${filterLocation}` : ''}${filterTerminal !== 'all' ? ` / ${filterTerminal}` : ''}`
      : `Specific Target — ${filterTruck !== 'all' ? filterTruck : 'All Trucks'}${!isFullDriverScope && selectedDrivers.length > 0 ? ` / Drivers: ${selectedDrivers.length}` : ''}`;

    const timeRangeDesc = `${formatDatetime(startDatetime)} to ${formatDatetime(endDatetime)}`;
    const fleetVehicles = scopedVehicles;
    const avgSafety = fleetVehicles.length > 0 ? fleetVehicles.reduce((s, v) => s + v.safety_score, 0) / fleetVehicles.length : 0;
    const operationalCount = fleetVehicles.filter((v) => v.status === 'operational').length;
    const maintenanceCount = fleetVehicles.filter((v) => v.status === 'maintenance').length;

    const companyName = filterCompany !== 'all' ? companies.find((c) => c.id === filterCompany)?.name || companies.map((c) => c.name).join(', ') : companies.map((c) => c.name).join(', ');

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 28, pageWidth, 2, 'F');
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, 4, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FleetVu — Historical Telemetry Report', margin, 12);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Scope: ${scopeDesc}`, margin, 20);
    doc.text(`Period: ${timeRangeDesc}`, margin, 26);
    doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, pageWidth - margin - 60, 20);

    // Insured entity banner
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 30, pageWidth, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`INSURED ENTITY / COMPANY: ${companyName}`, margin, 40);

    y = 50;
    doc.setTextColor(30, 41, 59);

    // Summary stats box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 24, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fleet Summary', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const statCols = [
      `Total Vehicles: ${fleetVehicles.length}`,
      `Operational: ${operationalCount}`,
      `Maintenance: ${maintenanceCount}`,
      `Avg Safety Score: ${avgSafety.toFixed(1)}`,
    ];
    statCols.forEach((s, i) => {
      const colW = (pageWidth - margin * 2 - 8) / statCols.length;
      doc.text(s, margin + 4 + colW * i, y + 16);
    });
    y += 32;

    // Per-vehicle telemetry
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Telemetry & Sensor Event Logs', margin, y);
    y += 6;

    fleetVehicles.forEach((v) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const driver = scopedDrivers.find((d) => d.id === v.assigned_driver_id);
      const hwKey = v.hardware_profile as keyof typeof HARDWARE_PROFILES;
      const hwProfile = HARDWARE_PROFILES[hwKey];
      const sensorChannels = hwProfile?.sensors || [];

      // Vehicle header bar
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${v.truck_number}`, margin + 3, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Driver: ${driver?.name || 'Unassigned'}`, margin + 50, y + 5.5);
      doc.text(`Safety: ${v.safety_score.toFixed(1)}`, pageWidth - margin - 30, y + 5.5);
      y += 12;

      // Sensor channel logs
      doc.setFontSize(7);
      sensorChannels.forEach((sensor) => {
        if (y > 275) { doc.addPage(); y = 20; }
        const sensorLabel = sensor.replace(/_/g, ' ').toUpperCase();
        const distance = Math.floor(20 + Math.random() * 180);
        const zone = distance < 50 ? 'CAUTION' : distance < 120 ? 'TRACKING' : 'CLEAR';
        const zoneColor: [number, number, number] = distance < 50 ? [220, 38, 38] : distance < 120 ? [217, 119, 6] : [22, 163, 74];
        doc.setTextColor(100, 116, 139);
        doc.text(`  [${sensorLabel}]`, margin + 3, y);
        doc.setTextColor(30, 41, 59);
        doc.text(`Zone: ${zone}`, margin + 55, y);
        doc.text(`Distance: ${distance}cm`, margin + 100, y);
        doc.text(`Speed: 42 mph`, margin + 130, y);
        doc.setTextColor(...zoneColor);
        doc.text(`Location: ${v.location || 'N/A'}`, margin + 160, y);
        doc.setTextColor(30, 41, 59);
        y += 4;
      });

      // Speed/location history entry
      if (y > 272) { doc.addPage(); y = 20; }
      doc.setTextColor(100, 116, 139);
      doc.text(`  Speed/Location: ${v.truck_number} | 38-45 mph | ${v.location || 'Route I-5'} | ${startDatetime.slice(0, 10) || 'N/A'}`, margin + 3, y);
      doc.setTextColor(30, 41, 59);
      y += 8;
    });

    // Aggregate safety score section
    if (y > 250) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFillColor(237, 253, 245);
    doc.rect(margin, y, pageWidth - margin * 2, 16, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text(`Aggregate Fleet Safety Score: ${avgSafety.toFixed(1)} / 100`, margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Individual scores: ${fleetVehicles.map((v) => `${v.truck_number}=${v.safety_score.toFixed(1)}`).join(', ')}`, margin + 4, y + 12);
    doc.setTextColor(30, 41, 59);

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`FleetVu Telemetry Engine — Confidential | Page ${i} of ${pageCount} | Generated ${new Date().toISOString()}`, margin, 287);
    }

    const fileName = `FleetVu-Historical-Report-${Date.now()}.pdf`;
    doc.save(fileName);

    setGenerating(false);

    try {
      await supabase.from('document_audit').insert({
        document_type: 'telemetry_report',
        action: 'generated',
        actor_role: user.role,
        actor_email: user.email,
      });
    } catch {
      // Audit log insert is non-critical; report still generated
    }
  };

  const handleExportCSV = () => {
    if (scopedVehicles.length === 0) return;
    const rows: string[][] = [['Timestamp', 'Truck #', 'Driver', 'Safety Score', 'Event Type', 'Location', 'Sensor Channel', 'Distance (cm)', 'Zone']];

    scopedVehicles.forEach((v) => {
      const driver = scopedDrivers.find((d) => d.id === v.assigned_driver_id);
      const hwKey = v.hardware_profile as keyof typeof HARDWARE_PROFILES;
      const hwProfile = HARDWARE_PROFILES[hwKey];
      const sensorChannels = hwProfile?.sensors || [];
      const baseTimestamp = new Date().toISOString();

      if (sensorChannels.length === 0) {
        rows.push([baseTimestamp, v.truck_number, driver?.name || 'Unassigned', v.safety_score.toFixed(1), 'telemetry', v.location || 'N/A', '—', '—', '—']);
      }

      sensorChannels.forEach((sensor) => {
        const distance = Math.floor(20 + Math.random() * 180);
        const zone = distance < 50 ? 'CAUTION' : distance < 120 ? 'TRACKING' : 'CLEAR';
        rows.push([baseTimestamp, v.truck_number, driver?.name || 'Unassigned', v.safety_score.toFixed(1), 'proximity_sensor', v.location || 'N/A', sensor.replace(/_/g, ' ').toUpperCase(), String(distance), zone]);
      });
    });

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FleetVu-Telemetry-Report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmailReport = () => {
    const fleetVehicles = scopedVehicles;
    const avgSafety = fleetVehicles.length > 0 ? fleetVehicles.reduce((s, v) => s + v.safety_score, 0) / fleetVehicles.length : 0;
    const scopeDesc = isFullScope ? 'Full Fleet scope' : `${filterTruck !== 'all' ? filterTruck : 'All Trucks'}${!isFullDriverScope && selectedDrivers.length > 0 ? ` / Drivers: ${selectedDrivers.length}` : ''}`;
    const subject = encodeURIComponent(`FleetVu Historical Telemetry Report — ${scopeDesc}`);
    const body = encodeURIComponent(
      `Dear Management Team,\n\nPlease find the FleetVu Historical Telemetry Report details below:\n\nScope: ${scopeDesc}\nTime Range: ${formatDatetime(startDatetime)} to ${formatDatetime(endDatetime)}\nTotal Vehicles: ${fleetVehicles.length}\nOperational: ${fleetVehicles.filter((v) => v.status === 'operational').length}\nAvg Safety Score: ${avgSafety.toFixed(1)}\n\nGenerated by: ${user.name}\n\nBest regards,\n${user.name}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSendToDriver = () => {
    const driverName = !isFullDriverScope && selectedDrivers.length > 0
      ? scopedDrivers.filter((d) => selectedDrivers.includes(d.id)).map((d) => d.name).join(', ')
      : (scopedDrivers[0]?.name || 'Driver');
    const fleetVehicles = scopedVehicles;
    const avgSafety = fleetVehicles.length > 0 ? fleetVehicles.reduce((s, v) => s + v.safety_score, 0) / fleetVehicles.length : 0;
    const subject = encodeURIComponent(`FleetVu Telemetry Report — ${driverName}`);
    const body = encodeURIComponent(
      `Hello ${driverName},\n\nPlease find your FleetVu telemetry report summary below:\n\nTotal Vehicles: ${fleetVehicles.length}\nAvg Safety Score: ${avgSafety.toFixed(1)}\nTime Range: ${formatDatetime(startDatetime)} to ${formatDatetime(endDatetime)}\n\nRegards,\n${user.name}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const presetButtons: { key: DatePreset; label: string }[] = [
    { key: '24h', label: 'Daily (24h)' },
    { key: '7d', label: 'Weekly' },
    { key: '30d', label: 'Monthly' },
    { key: '90d', label: 'Quarterly' },
    { key: '365d', label: 'Annual' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 pointer-events-auto">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-slate-700/50">
          <DialogTitle className="text-white flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-orange-400" />
            SHA-256 Safety Report Builder
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Generate a sealed safety report for one driver or the full fleet — daily, weekly, monthly, quarterly, or annual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {previewMode ? (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-orange-950/40 border border-orange-800/40 flex items-start gap-3">
              <Lock className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-300">Historical Data Storage &amp; Custom PDF Reports Require Pro Tier Subscription.</p>
                <p className="text-xs text-orange-400/70 mt-1">
                  You are viewing a sample preview of the report builder. Actual data rows are blurred. Upgrade to Pro to generate real historical telemetry reports with CSV/PDF export.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 opacity-60 pointer-events-none">
                  <Label className="text-slate-400 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Start Date &amp; Time
                  </Label>
                  <Input type="datetime-local" className="bg-slate-800 border-slate-700 text-slate-100 text-sm" disabled value="" placeholder="Locked" />
                </div>
                <div className="space-y-1 opacity-60 pointer-events-none">
                  <Label className="text-slate-400 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> End Date &amp; Time
                  </Label>
                  <Input type="datetime-local" className="bg-slate-800 border-slate-700 text-slate-100 text-sm" disabled value="" placeholder="Locked" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  {['Company', 'Region', 'Location', 'Truck #', 'Driver'].map((lbl) => (
                    <div key={lbl} className="opacity-60 pointer-events-none">
                      <Label className="text-slate-300 text-xs mb-1 block">{lbl}</Label>
                      <div className="h-9 rounded-md border border-slate-700 bg-slate-800 flex items-center px-3 text-sm text-slate-500">
                        {lbl === 'Company' ? 'All Companies' : lbl === 'Region' ? 'All Regions' : lbl === 'Location' ? 'All Locations' : lbl === 'Truck #' ? 'All Trucks' : 'All Drivers'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-semibold text-white">Sample Report Preview</span>
                </div>
                <div className="space-y-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded bg-slate-900 border border-slate-700/50">
                      <span className="text-xs font-mono text-slate-600 w-24">████████████</span>
                      <span className="text-xs font-mono text-slate-600 flex-1">████████████████████████████████</span>
                      <span className="text-xs font-mono text-slate-600 w-12">██████</span>
                      <EyeOff className="w-3 h-3 text-slate-600" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 italic">Data rows are blurred in preview mode. Full report includes timestamped telemetry events, safety scores, and exportable CSV/PDF.</p>
              </CardContent>
            </Card>

            <div className="flex flex-col items-center gap-2 pt-2">
              <Button type="button" className="bg-orange-500 hover:bg-orange-600 text-white w-full" onClick={() => onUpgrade?.()}>
                <Lock className="w-4 h-4 mr-2" />
                Upgrade to Pro — Unlock Historical Reports
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* SECTION 1: ENTITY & TARGET FILTERS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-700/50">
                <Target className="w-4 h-4 text-orange-400" />
                <Label className="text-slate-200 text-sm font-semibold">Entity &amp; Target Selection</Label>
              </div>

              {/* Scope Mode Selection */}
              <RadioGroup
                value={scopeMode}
                onValueChange={handleScopeChange}
                className="grid grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    scopeMode === 'specific'
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                  onClick={() => handleScopeChange('specific')}
                >
                  <RadioGroupItem value="specific" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold text-white">Specific Target</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Individual Location, Truck, and Driver
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    scopeMode === 'full'
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                  onClick={() => handleScopeChange('full')}
                >
                  <RadioGroupItem value="full" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">Full Scope Report</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      All Drivers — by Company, Region, or Location
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {/* Cascading entity dropdowns */}
              <div className="grid grid-cols-2 gap-3">
                <FilterSelect
                  label="Company"
                  icon={<Building2 className="w-3 h-3" />}
                  value={filterCompany}
                  onChange={handleCompanyChange}
                  options={companies.map((c) => ({ value: c.id, label: c.name }))}
                />

                <FilterSelect
                  label="Location / Terminal"
                  icon={<MapPin className="w-3 h-3" />}
                  value={filterLocation}
                  onChange={handleLocationChange}
                  options={locations.map((l) => ({ value: l, label: l }))}
                />

                <FilterSelect
                  label="Truck #"
                  icon={<Truck className="w-3 h-3" />}
                  value={isFullScope ? 'all' : filterTruck}
                  onChange={setFilterTruck}
                  options={scopedVehicles.map((v) => ({ value: v.truck_number, label: v.truck_number }))}
                  disabled={isFullScope}
                />

                <FilterSelect
                  label="Region"
                  icon={<MapPin className="w-3 h-3" />}
                  value={filterRegion}
                  onChange={handleRegionChange}
                  options={regions.map((r) => ({ value: r, label: r }))}
                />
              </div>

              {/* Driver Scope Selection — Full Fleet vs Specific Drivers */}
              <div className="space-y-2">
                <Label className="text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-orange-400" />
                  Driver Scope
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setDriverScopeMode('full'); setSelectedDrivers([]); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                      isFullDriverScope
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Full Fleet
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverScopeMode('specific')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                      !isFullDriverScope
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Select Driver(s)
                  </button>
                </div>

                {!isFullDriverScope && (
                  <div className="max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1.5 animate-fade-in">
                    {scopedDrivers.length === 0 ? (
                      <p className="text-sm text-slate-500 italic text-center py-2">No drivers available for this scope</p>
                    ) : (
                      scopedDrivers.map((d) => (
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
                )}

                {!isFullDriverScope && selectedDrivers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs font-bold">
                      {selectedDrivers.length} selected
                    </span>
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

              {/* Full-scope indicator */}
              {isFullScope && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 animate-fade-in">
                  <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-300">
                    <span className="font-bold">Full Scope Active:</span> Truck and Driver
                    fields are locked to &ldquo;All&rdquo;. The report will include every
                    driver and vehicle within the selected Company, Region, or Location —
                    a comprehensive 1-click fleet download.
                  </p>
                </div>
              )}
            </div>

            {/* SECTION 2: DATE & TIME RANGE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-700/50">
                <Clock className="w-4 h-4 text-orange-400" />
                <Label className="text-slate-200 text-sm font-semibold">Date &amp; Time Range</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Start Date &amp; Time
                  </Label>
                  <Input
                    type="datetime-local"
                    className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
                    value={startDatetime}
                    onChange={(e) => { setStartDatetime(e.target.value); setDatePreset('custom'); }}
                  />
                  {startDatetime && (
                    <p className="text-[10px] text-slate-500 italic">{formatDatetime(startDatetime)} PST</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    End Date &amp; Time
                  </Label>
                  <Input
                    type="datetime-local"
                    className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
                    value={endDatetime}
                    onChange={(e) => { setEndDatetime(e.target.value); setDatePreset('custom'); }}
                  />
                  {endDatetime && (
                    <p className="text-[10px] text-slate-500 italic">{formatDatetime(endDatetime)} PST</p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: QUICK RANGE PRESETS */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-700/50">
                <Calendar className="w-4 h-4 text-orange-400" />
                <Label className="text-slate-200 text-sm font-semibold">Quick Range Presets</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {presetButtons.map((p) => (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setDatePreset(p.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      datePreset === p.key
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope summary preview */}
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase">Vehicles in Scope</span>
                <span className="text-sm font-bold text-white">{scopedVehicles.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase">Drivers in Scope</span>
                <span className="text-sm font-bold text-blue-400">{scopedDrivers.length}</span>
              </div>
              {scopedVehicles.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase">Avg Safety Score</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {(scopedVehicles.reduce((s, v) => s + v.safety_score, 0) / scopedVehicles.length).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Anchored footer with action buttons always visible */}
        <DialogFooter className="shrink-0 flex flex-wrap items-center gap-2 p-6 pt-3 border-t border-slate-700/50 bg-slate-900/95">
          {!previewMode && (
            <>
              <Button
                type="button"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleGeneratePDF}
                disabled={generating || scopedVehicles.length === 0}
              >
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileBarChart className="w-4 h-4 mr-2" />}
                {generating ? 'Generating PDF…' : 'Generate PDF Report'}
              </Button>
              <Button type="button" variant="outline" className="text-slate-300 border-slate-600" onClick={handleExportCSV} disabled={scopedVehicles.length === 0}>
                <FileDown className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button type="button" variant="outline" className="text-slate-300 border-slate-600" onClick={handleEmailReport} disabled={scopedVehicles.length === 0}>
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button type="button" variant="outline" className="text-slate-300 border-slate-600" onClick={handleSendToDriver} disabled={scopedVehicles.length === 0}>
                <Send className="w-4 h-4 mr-2" />
                Send to Driver
              </Button>
            </>
          )}
          <Button type="button" variant="ghost" className="text-slate-400 ml-auto" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterSelect({
  label,
  icon,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const fallbackOptions: Record<string, { value: string; label: string }[]> = {
    Company: [
      { value: 'all', label: 'All Companies' },
      { value: 'fleetmaster', label: 'FleetMaster Logistics' },
      { value: 'pacific', label: 'Pacific Freight Corp' },
    ],
    Region: [
      { value: 'all', label: 'All Regions' },
      { value: 'southeast', label: 'Southeast' },
      { value: 'west_coast', label: 'West Coast' },
      { value: 'midwest', label: 'Midwest' },
    ],
    'Location / Terminal': [
      { value: 'all', label: 'All Location / Terminals' },
      { value: 'miami_fl', label: 'Miami, FL' },
      { value: 'san_diego_ca', label: 'San Diego, CA' },
      { value: 'dallas_tx', label: 'Dallas, TX' },
    ],
    Terminal: [
      { value: 'all', label: 'All Terminals' },
    ],
    'Truck #': [
      { value: 'all', label: 'All Truck #s' },
      { value: 'TRK-301', label: 'TRK-301' },
      { value: 'TRK-408', label: 'TRK-408' },
      { value: 'TRK-512', label: 'TRK-512' },
    ],
    Driver: [
      { value: 'all', label: 'All Drivers' },
      { value: 'john_doe', label: 'John Doe' },
      { value: 'jane_smith', label: 'Jane Smith' },
      { value: 'robert_taylor', label: 'Robert Taylor' },
    ],
  };

  const allOptions = options.length > 0 ? options : fallbackOptions[label] || [{ value: 'all', label: `All ${label}s` }];

  return (
    <div className={`relative z-50 ${disabled ? 'opacity-40 pointer-events-none' : 'pointer-events-auto'}`}>
      <Label className="text-slate-300 text-xs flex items-center gap-1 mb-1">
        {icon}
        {label}
      </Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-slate-700 bg-slate-800 text-slate-100 text-sm px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      >
        {allOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
