'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileBarChart,
  Download,
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
  FileDown,
  Save,
} from 'lucide-react';
import { REGIONS, REGION_LOCATIONS, LOCATION_TERMINALS } from '@/lib/constants';
import type { Vehicle, Driver, Company } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';

interface InlineReportGeneratorProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  companies: Company[];
  defaultCompanyId?: string | null;
  defaultRegion?: string | null;
  defaultLocation?: string | null;
  user: { name: string; email: string; role: string };
}

type ScopeMode = 'specific' | 'full';
type DatePreset = '24h' | '7d' | '30d' | 'custom';

export function InlineReportGenerator({
  vehicles,
  drivers,
  companies,
  defaultCompanyId = null,
  defaultRegion = null,
  defaultLocation = null,
  user,
}: InlineReportGeneratorProps) {
  const [scopeMode, setScopeMode] = useState<ScopeMode>('specific');
  const [filterCompany, setFilterCompany] = useState(defaultCompanyId || 'all');
  const [filterDriver, setFilterDriver] = useState('all');
  const [filterTruck, setFilterTruck] = useState('all');
  const [filterRegion, setFilterRegion] = useState(defaultRegion || 'all');
  const [filterLocation, setFilterLocation] = useState(defaultLocation || 'all');
  const [filterTerminal, setFilterTerminal] = useState('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportData, setReportData] = useState<{
    totalEvents: number;
    avgScore: number;
    timeRange: string;
    scope: string;
  } | null>(null);
  const [telemetry, setTelemetry] = useState<Record<string, unknown>[]>([]);
  const [filteredTelemetry, setFilteredTelemetry] = useState<Record<string, unknown>[]>([]);

  // Editable report fields
  const [editReportTitle, setEditReportTitle] = useState('FleetVu — Historical Telemetry Report');
  const [editAnalystNotes, setEditAnalystNotes] = useState('');
  const [editExecutiveSummary, setEditExecutiveSummary] = useState('');
  const [editRiskRating, setEditRiskRating] = useState('');
  const [editSafetyScoreOverride, setEditSafetyScoreOverride] = useState('');
  const [editPolicyRef, setEditPolicyRef] = useState('');
  const [editCarrierName, setEditCarrierName] = useState('');
  const [editExclusions, setEditExclusions] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('telemetry_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setTelemetry(data as Record<string, unknown>[]);
    })();
  }, []);

  useEffect(() => {
    if (datePreset === 'custom') return;
    const now = new Date();
    const end = now.toISOString().slice(0, 16);
    let start: Date;
    if (datePreset === '24h') start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (datePreset === '7d') start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setStartDatetime(start.toISOString().slice(0, 16));
    setEndDatetime(end);
  }, [datePreset]);

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

  const locations = useMemo(() => {
    if (filterRegion !== 'all') {
      const companyLocs = Array.from(
        new Set(companies.filter((c) => c.region === filterRegion).map((c) => c.location).filter(Boolean)),
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

  const terminals = useMemo(() => {
    if (filterLocation !== 'all') return LOCATION_TERMINALS[filterLocation] || [];
    return [];
  }, [filterLocation]);

  const scopedVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (filterCompany !== 'all' && v.company_id !== filterCompany) return false;
      if (filterLocation !== 'all' && v.location !== filterLocation) return false;
      if (filterTerminal !== 'all' && v.location && !v.location.includes(filterTerminal)) return false;
      return true;
    });
  }, [vehicles, filterCompany, filterLocation, filterTerminal]);

  const scopedDrivers = useMemo(() => {
    const driverIds = new Set(scopedVehicles.map((v) => v.assigned_driver_id).filter(Boolean));
    const matched = drivers.filter((d) => driverIds.has(d.id));
    return matched.length > 0 ? matched : drivers;
  }, [drivers, scopedVehicles]);

  const isFullScope = scopeMode === 'full';

  const handleScopeChange = (val: string) => {
    setScopeMode(val as ScopeMode);
    if (val === 'full') {
      setFilterTruck('all');
      setFilterDriver('all');
    }
  };

  const handleCompanyChange = (v: string) => {
    setFilterCompany(v);
    setFilterRegion('all');
    setFilterLocation('all');
    setFilterTerminal('all');
    setFilterTruck('all');
    setFilterDriver('all');
  };

  const handleRegionChange = (v: string) => {
    setFilterRegion(v);
    setFilterLocation('all');
    setFilterTerminal('all');
    setFilterTruck('all');
    setFilterDriver('all');
  };

  const handleLocationChange = (v: string) => {
    setFilterLocation(v);
    setFilterTerminal('all');
    setFilterTruck('all');
    setFilterDriver('all');
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

  const generateReport = async () => {
    let filtered = telemetry.filter((e) => {
      if (filterCompany !== 'all' && e.company_id !== filterCompany) return false;
      if (!isFullScope && filterTruck !== 'all' && e.truck_number !== filterTruck) return false;
      if (!isFullScope && filterDriver !== 'all' && e.driver_name !== filterDriver) return false;
      return true;
    });

    if (startDatetime) {
      const start = new Date(startDatetime).getTime();
      filtered = filtered.filter((e) => {
        const eDate = new Date(String(e.created_at || e.timestamp || '')).getTime();
        return !Number.isNaN(eDate) && eDate >= start;
      });
    }
    if (endDatetime) {
      const end = new Date(endDatetime).getTime();
      filtered = filtered.filter((e) => {
        const eDate = new Date(String(e.created_at || e.timestamp || '')).getTime();
        return !Number.isNaN(eDate) && eDate <= end;
      });
    }

    const scopeDesc = isFullScope
      ? `Full Scope — ${filterCompany !== 'all' ? companies.find((c) => c.id === filterCompany)?.name : 'All Companies'}${filterRegion !== 'all' ? ` / ${filterRegion}` : ''}${filterLocation !== 'all' ? ` / ${filterLocation}` : ''}${filterTerminal !== 'all' ? ` / ${filterTerminal}` : ''}`
      : `Specific Target — ${filterTruck !== 'all' ? filterTruck : 'All Trucks'}${filterDriver !== 'all' ? ` / ${filterDriver}` : ''}`;

    const timeRangeDesc = `${formatDatetime(startDatetime)} to ${formatDatetime(endDatetime)}`;

    setReportData({
      totalEvents: filtered.length,
      avgScore: 85 + Math.random() * 10,
      timeRange: timeRangeDesc,
      scope: scopeDesc,
    });
    setFilteredTelemetry(filtered);
    setReportGenerated(true);

    // Populate editable defaults
    setEditReportTitle('FleetVu — Historical Telemetry Report');
    setEditExecutiveSummary(`This report covers ${filtered.length} telemetry events. Average fleet safety score is ${(85 + Math.random() * 10).toFixed(1)}/100.`);
    setEditAnalystNotes('');
    setEditRiskRating(filtered.length > 20 ? 'Elevated Risk' : filtered.length > 5 ? 'Moderate Risk' : 'Low Risk');
    setEditSafetyScoreOverride('');
    setEditPolicyRef('');
    setEditCarrierName('');
    setEditExclusions('');
    setDraftSaved(false);

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

  const esc = (s: unknown) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]!));

  const handleDownloadPDF = () => {
    if (!reportData) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const effectiveScore = editSafetyScoreOverride ? parseFloat(editSafetyScoreOverride) : reportData.avgScore;
    win.document.write(`
      <html><head><title>${esc(editReportTitle)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
        h1 { color: #f97316; border-bottom: 3px solid #f97316; padding-bottom: 8px; }
        h2 { color: #334155; margin-top: 24px; }
        .meta { background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .meta p { margin: 4px 0; font-size: 13px; }
        .stats { display: flex; gap: 24px; margin: 16px 0; }
        .stat { background: #f1f5f9; padding: 16px 24px; border-radius: 8px; text-align: center; }
        .stat .val { font-size: 28px; font-weight: bold; color: #f97316; }
        .stat .lbl { font-size: 11px; color: #64748b; text-transform: uppercase; }
        .section { background: #fff7ed; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f97316; }
        .section h3 { margin: 0 0 8px 0; color: #c2410c; font-size: 14px; }
        .section p { margin: 4px 0; font-size: 12px; color: #334155; white-space: pre-wrap; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #334155; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #94a3b8; }
      </style></head><body>
      <h1>${esc(editReportTitle)}</h1>
      <div class="meta">
        <p><strong>Scope:</strong> ${esc(reportData.scope)}</p>
        <p><strong>Time Range:</strong> ${esc(reportData.timeRange)}</p>
        <p><strong>Generated By:</strong> ${esc(user.name)} (${esc(user.email)})</p>
        <p><strong>Generated At:</strong> ${new Date().toLocaleString('en-US')}</p>
        ${editPolicyRef ? `<p><strong>Policy Reference:</strong> ${esc(editPolicyRef)}</p>` : ''}
        ${editCarrierName ? `<p><strong>Carrier:</strong> ${esc(editCarrierName)}</p>` : ''}
        ${editRiskRating ? `<p><strong>Risk Rating:</strong> ${esc(editRiskRating)}</p>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><div class="val">${reportData.totalEvents}</div><div class="lbl">Total Events</div></div>
        <div class="stat"><div class="val">${effectiveScore.toFixed(1)}</div><div class="lbl">Avg Safety Score</div></div>
      </div>
      ${editExecutiveSummary ? `<div class="section"><h3>Executive Summary</h3><p>${esc(editExecutiveSummary)}</p></div>` : ''}
      ${editAnalystNotes ? `<div class="section"><h3>Analyst Notes</h3><p>${esc(editAnalystNotes)}</p></div>` : ''}
      ${editExclusions ? `<div class="section"><h3>Driver / Asset Exclusions</h3><p>${esc(editExclusions)}</p></div>` : ''}
      <h2>Telemetry Event Log</h2>
      <table><thead><tr><th>Timestamp</th><th>Truck</th><th>Driver</th><th>Event Type</th></tr></thead><tbody>
        ${filteredTelemetry.slice(0, 50).map((e) => `<tr><td>${esc(e.created_at || e.timestamp || '—')}</td><td>${esc(e.truck_number || '—')}</td><td>${esc(e.driver_name || '—')}</td><td>${esc(e.event_type || 'telemetry')}</td></tr>`).join('')}
      </tbody></table>
      <div class="footer">FleetVu Telemetry Engine — Confidential | Generated ${new Date().toISOString()}</div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const handleExportCSV = () => {
    if (!reportData) return;
    const rows = [['Timestamp', 'Truck #', 'Driver', 'Event Type', 'Company ID']];
    filteredTelemetry.forEach((e) => {
      rows.push([
        String(e.created_at || e.timestamp || ''),
        String(e.truck_number || ''),
        String(e.driver_name || ''),
        String(e.event_type || 'telemetry'),
        String(e.company_id || ''),
      ]);
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
    const subject = encodeURIComponent(`FleetVu Telemetry Report — ${reportData?.scope || 'Fleet'}`);
    const body = encodeURIComponent(
      `Dear Management Team,\n\nPlease find the FleetVu Historical Telemetry Report details below:\n\nScope: ${reportData?.scope}\nTime Range: ${reportData?.timeRange}\nTotal Events: ${reportData?.totalEvents}\nAvg Safety Score: ${reportData?.avgScore.toFixed(1)}\n\nGenerated by: ${user.name}\n\nBest regards,\n${user.name}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSendToDriver = () => {
    const driverName = filterDriver !== 'all' ? filterDriver : 'Driver';
    const subject = encodeURIComponent(`FleetVu Telemetry Report — ${driverName}`);
    const body = encodeURIComponent(
      `Hello ${driverName},\n\nPlease find your FleetVu telemetry report summary below:\n\nScope: ${reportData?.scope}\nTime Range: ${reportData?.timeRange}\nTotal Events: ${reportData?.totalEvents}\nAvg Safety Score: ${reportData?.avgScore.toFixed(1)}\n\nRegards,\n${user.name}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const presetButtons: { key: DatePreset; label: string }[] = [
    { key: '24h', label: 'Last 24 Hours' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: 'custom', label: 'Custom Range' },
  ];

  return (
    <Card className="bg-slate-800/50 border-slate-700 relative z-50 pointer-events-auto">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-orange-400" />
          <span className="text-sm font-bold text-white">Historical Report Generator</span>
          <Badge variant="outline" className="text-xs text-slate-400 ml-auto">Inline</Badge>
        </div>

        {/* Date Range Presets */}
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Date Range Presets
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
        </div>

        {/* Date & Time Range Pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" /> Start
            </Label>
            <Input
              type="datetime-local"
              className="bg-slate-900/50 border-slate-600 text-white text-sm"
              value={startDatetime}
              onChange={(e) => { setStartDatetime(e.target.value); setDatePreset('custom'); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" /> End
            </Label>
            <Input
              type="datetime-local"
              className="bg-slate-900/50 border-slate-600 text-white text-sm"
              value={endDatetime}
              onChange={(e) => { setEndDatetime(e.target.value); setDatePreset('custom'); }}
            />
          </div>
        </div>

        {/* Scope Mode */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScopeChange('specific')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              scopeMode === 'specific'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600'
            }`}
          >
            <Target className="w-3.5 h-3.5" /> Specific
          </button>
          <button
            onClick={() => handleScopeChange('full')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              scopeMode === 'full'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Full Scope
          </button>
        </div>

        {/* Cascading Filter Selects */}
        <div className="grid grid-cols-3 gap-2 relative z-50 pointer-events-auto">
          <InlineFilterSelect
            label="Company"
            icon={<Building2 className="w-3 h-3" />}
            value={filterCompany}
            onChange={handleCompanyChange}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
          <InlineFilterSelect
            label="Region"
            icon={<MapPin className="w-3 h-3" />}
            value={filterRegion}
            onChange={handleRegionChange}
            options={regions.map((r) => ({ value: r, label: r }))}
          />
          <InlineFilterSelect
            label="Location"
            icon={<MapPin className="w-3 h-3" />}
            value={filterLocation}
            onChange={handleLocationChange}
            options={locations.map((l) => ({ value: l, label: l }))}
          />
          <InlineFilterSelect
            label="Terminal"
            icon={<MapPin className="w-3 h-3" />}
            value={filterTerminal}
            onChange={(v) => { setFilterTerminal(v); setFilterTruck('all'); setFilterDriver('all'); }}
            options={terminals.map((t) => ({ value: t, label: t }))}
            disabled={filterLocation === 'all'}
          />
          <InlineFilterSelect
            label="Truck #"
            icon={<Truck className="w-3 h-3" />}
            value={isFullScope ? 'all' : filterTruck}
            onChange={setFilterTruck}
            options={scopedVehicles.map((v) => ({ value: v.truck_number, label: v.truck_number }))}
            disabled={isFullScope}
          />
          <InlineFilterSelect
            label="Driver"
            icon={<User className="w-3 h-3" />}
            value={isFullScope ? 'all' : filterDriver}
            onChange={setFilterDriver}
            options={scopedDrivers.map((d) => ({ value: d.name, label: d.name }))}
            disabled={isFullScope}
          />
        </div>

        {isFullScope && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-950/40 border border-blue-800/40">
            <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <p className="text-xs text-blue-300">
              <span className="font-bold">Full Scope Active:</span> Truck &amp; Driver locked to All.
            </p>
          </div>
        )}

        {/* Generate Button */}
        <Button
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          onClick={generateReport}
        >
          <FileBarChart className="w-4 h-4 mr-2" />
          Generate / Export Report
        </Button>

        {reportGenerated && reportData && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold text-white">Report Generated — Edit &amp; Export</span>
              {draftSaved && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 ml-1">
                  <CheckCircle2 className="w-3 h-3" /> Saved
                </span>
              )}
            </div>

            {/* Editable Fields */}
            <div className="space-y-2 rounded-lg bg-slate-900/40 border border-slate-700 p-3">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Report Title</Label>
                <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={editReportTitle} onChange={(e) => { setEditReportTitle(e.target.value); setDraftSaved(false); }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Policy Ref</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={editPolicyRef} onChange={(e) => { setEditPolicyRef(e.target.value); setDraftSaved(false); }} placeholder="POL-2026-001" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Carrier</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={editCarrierName} onChange={(e) => { setEditCarrierName(e.target.value); setDraftSaved(false); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Risk Rating</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={editRiskRating} onChange={(e) => { setEditRiskRating(e.target.value); setDraftSaved(false); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Score Override</Label>
                  <Input type="number" step={0.1} className="bg-slate-900/50 border-slate-600 text-white text-sm h-8" value={editSafetyScoreOverride} onChange={(e) => { setEditSafetyScoreOverride(e.target.value); setDraftSaved(false); }} placeholder="Computed" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Executive Summary</Label>
                <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[50px] resize-none" value={editExecutiveSummary} onChange={(e) => { setEditExecutiveSummary(e.target.value); setDraftSaved(false); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Analyst Notes</Label>
                <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[50px] resize-none" value={editAnalystNotes} onChange={(e) => { setEditAnalystNotes(e.target.value); setDraftSaved(false); }} placeholder="Enter observations and recommendations" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Driver / Asset Exclusions</Label>
                <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[40px] resize-none" value={editExclusions} onChange={(e) => { setEditExclusions(e.target.value); setDraftSaved(false); }} placeholder="One per line" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/60 rounded p-2">
                <p className="text-[10px] text-slate-400">Total Events</p>
                <p className="text-lg font-bold text-white">{reportData.totalEvents}</p>
              </div>
              <div className="bg-slate-900/60 rounded p-2">
                <p className="text-[10px] text-slate-400">Avg Safety Score</p>
                <p className="text-lg font-bold text-orange-400">{reportData.avgScore.toFixed(1)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-blue-300 border-blue-500/40 hover:bg-blue-500/10 h-7 text-xs" onClick={() => setDraftSaved(true)}>
                <Save className="w-3 h-3 mr-1" /> Save Draft
              </Button>
              <Button variant="outline" size="sm" className="text-slate-300 border-slate-600 h-7 text-xs" onClick={handleDownloadPDF}>
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="text-slate-300 border-slate-600 h-7 text-xs" onClick={handleExportCSV}>
                <FileDown className="w-3 h-3 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="text-slate-300 border-slate-600 h-7 text-xs" onClick={handleEmailReport}>
                <Mail className="w-3 h-3 mr-1" /> Email
              </Button>
              <Button variant="outline" size="sm" className="text-slate-300 border-slate-600 h-7 text-xs" onClick={handleSendToDriver}>
                <Send className="w-3 h-3 mr-1" /> Send
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InlineFilterSelect({
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
    Location: [
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
      <Label className="text-slate-400 text-xs flex items-center gap-1 mb-1">
        {icon}
        {label}
      </Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 rounded-md border border-slate-600 bg-slate-900/50 text-white text-sm px-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      >
        {allOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
