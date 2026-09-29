'use client';

import React from 'react';
import { Shield, TrendingUp, Radio, Truck, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Company, Vehicle, Driver, Incident } from '@/lib/types';
import { HARDWARE_PROFILES } from '@/lib/constants';

interface CompanySafetyHeaderProps {
  company: Company;
  vehicles: Vehicle[];
  drivers: Driver[];
  incidents: Incident[];
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-500/15 border-emerald-500/30';
  if (score >= 70) return 'bg-yellow-500/15 border-yellow-500/30';
  return 'bg-red-500/15 border-red-500/30';
}

function scoreBadge(score: number): { label: string; className: string } {
  if (score >= 85) return { label: 'LOW RISK', className: 'bg-emerald-600 text-white' };
  if (score >= 70) return { label: 'MODERATE RISK', className: 'bg-yellow-600 text-white' };
  return { label: 'HIGH RISK', className: 'bg-red-600 text-white' };
}

export function CompanySafetyHeader({ company, vehicles, drivers, incidents }: CompanySafetyHeaderProps) {
  const companyVehicles = vehicles.filter((v) => v.company_id === company.id);
  const companyDrivers = drivers.filter((d) => d.company_id === company.id);
  const companyIncidents = incidents.filter((inc) => inc.company_id === company.id);

  const safetyScore = companyVehicles.length > 0
    ? companyVehicles.reduce((s, v) => s + v.safety_score, 0) / companyVehicles.length
    : 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentIncidents = companyIncidents.filter((inc) => new Date(inc.created_at) >= thirtyDaysAgo);

  const operationalCount = companyVehicles.filter((v) => v.status === 'operational').length;
  const sensorCompliance = companyVehicles.length > 0
    ? Math.round((operationalCount / companyVehicles.length) * 100)
    : 0;

  const activeDrivers = companyDrivers.filter((d) => d.status === 'active').length;
  const badge = scoreBadge(safetyScore);

  const kpis = [
    {
      label: 'Company Safety Score',
      value: safetyScore.toFixed(1),
      suffix: '/ 100',
      icon: <Shield className="w-5 h-5" />,
      color: scoreColor(safetyScore),
      bg: scoreBg(safetyScore),
      extra: (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.className}`}>
          {badge.label}
        </span>
      ),
    },
    {
      label: 'Incidents (30 Days)',
      value: String(recentIncidents.length),
      suffix: recentIncidents.length === 0 ? 'Fender-Well Events' : 'Recent Events',
      icon: recentIncidents.length === 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />,
      color: recentIncidents.length === 0 ? 'text-emerald-400' : 'text-yellow-400',
      bg: recentIncidents.length === 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-yellow-500/15 border-yellow-500/30',
      extra: (
        <span className="text-[9px] text-slate-400">
          {companyIncidents.length} all-time
        </span>
      ),
    },
    {
      label: 'Sensor Compliance',
      value: String(sensorCompliance),
      suffix: '% Hardware Active',
      icon: <Radio className="w-5 h-5" />,
      color: sensorCompliance >= 90 ? 'text-emerald-400' : sensorCompliance >= 70 ? 'text-yellow-400' : 'text-red-400',
      bg: sensorCompliance >= 90 ? 'bg-emerald-500/15 border-emerald-500/30' : sensorCompliance >= 70 ? 'bg-yellow-500/15 border-yellow-500/30' : 'bg-red-500/15 border-red-500/30',
      extra: (
        <span className="text-[9px] text-slate-400">
          {operationalCount}/{companyVehicles.length} operational
        </span>
      ),
    },
    {
      label: 'Active Fleet',
      value: String(companyVehicles.length),
      suffix: `Vehicles · ${activeDrivers} Drivers`,
      icon: <Truck className="w-5 h-5" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/15 border-blue-500/30',
      extra: (
        <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
          <Users className="w-2.5 h-2.5" />
          {companyDrivers.length} total drivers
        </span>
      ),
    },
  ];

  return (
    <div className="px-4 pt-3 pb-2">
      {/* Company title bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <Truck className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{company.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{company.region}</span>
              <span className="text-slate-600">·</span>
              <span>{company.location}</span>
              <span className="text-slate-600">·</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                company.plan_tier === 'proplus' ? 'bg-orange-600 text-white' :
                company.plan_tier === 'pro' ? 'bg-blue-600 text-white' :
                'bg-slate-600 text-slate-200'
              }`}>
                {company.plan_tier === 'proplus' ? 'Pro+' : company.plan_tier}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          <span>Fleet Safety Index Active</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={`rounded-xl border ${kpi.bg} p-3 flex items-center gap-3 transition-all hover:scale-[1.02] duration-200`}
          >
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} border ${kpi.bg.split(' ')[1]} flex items-center justify-center ${kpi.color} shrink-0`}>
              {kpi.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1">
                <p className={`text-xl font-bold ${kpi.color} tabular-nums`}>{kpi.value}</p>
                <span className="text-[10px] text-slate-500 truncate">{kpi.suffix}</span>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide truncate">{kpi.label}</p>
              <div className="mt-0.5">{kpi.extra}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
