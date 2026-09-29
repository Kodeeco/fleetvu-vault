'use client';

import React, { useState } from 'react';
import { Truck, Users, MapPin, Shield, AlertTriangle, CheckCircle2, Radio, Download, Smartphone, FileDown } from 'lucide-react';
import type { Vehicle, Driver, Incident } from '@/lib/types';
import { HARDWARE_PROFILES } from '@/lib/constants';
import type { HardwareProfileKey } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CompanyAssetDirectoryProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  incidents: Incident[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onPdfReport?: (vehicle: Vehicle) => void;
  onMobileSync?: (vehicle: Vehicle) => void;
}

type Tab = 'trucks' | 'drivers';

function statusBadge(status: string) {
  if (status === 'operational') return <Badge className="bg-emerald-600 text-white text-[9px]">Operational</Badge>;
  if (status === 'maintenance') return <Badge className="bg-yellow-600 text-white text-[9px]">Maintenance</Badge>;
  return <Badge className="bg-red-600 text-white text-[9px]">Inoperable</Badge>;
}

function safetyScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function getHardwareLabel(key: string): string {
  const profile = HARDWARE_PROFILES[key as HardwareProfileKey];
  return profile?.label || 'Unknown Kit';
}

export function CompanyAssetDirectory({ vehicles, drivers, incidents, onSelectVehicle, onPdfReport, onMobileSync }: CompanyAssetDirectoryProps) {
  const [tab, setTab] = useState<Tab>('trucks');

  const activeDrivers = drivers.filter((d) => d.status === 'active').length;
  const driversWithAlerts = drivers.filter((d) => {
    return incidents.some((inc) => inc.driver_id === d.id && new Date(inc.created_at) > new Date(Date.now() - 30 * 86400000));
  });

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden flex flex-col">
      {/* Tab header */}
      <div className="flex items-center border-b border-slate-700 bg-slate-900/40">
        <button
          onClick={() => setTab('trucks')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === 'trucks'
              ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-500/5'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          Trucks
          <span className="text-xs text-slate-500 font-normal">({vehicles.length})</span>
        </button>
        <button
          onClick={() => setTab('drivers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === 'drivers'
              ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-500/5'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Drivers
          <span className="text-xs text-slate-500 font-normal">({drivers.length})</span>
        </button>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto overflow-y-auto max-h-[420px] scrollbar-thin">
        {tab === 'trucks' && (
          <table className="w-full text-sm min-w-[640px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900/80 backdrop-blur text-slate-400 text-[10px] uppercase tracking-wide border-b border-slate-700">
                <th className="text-left py-2 px-3 font-semibold">Truck ID</th>
                <th className="text-left py-2 px-3 font-semibold">Chassis</th>
                <th className="text-left py-2 px-3 font-semibold">Telemetry Kit</th>
                <th className="text-left py-2 px-3 font-semibold">Assigned Driver</th>
                <th className="text-left py-2 px-3 font-semibold">Status</th>
                <th className="text-right py-2 px-3 font-semibold">Safety Rating</th>
                <th className="text-right py-2 px-3 font-semibold pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-6">No vehicles in fleet</td>
                </tr>
              )}
              {vehicles.map((v) => {
                const driver = drivers.find((d) => d.id === v.assigned_driver_id);
                return (
                  <tr
                    key={v.id}
                    onClick={() => onSelectVehicle(v)}
                    className="border-b border-slate-700/40 hover:bg-orange-500/10 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-orange-400/60 group-hover:text-orange-400" />
                        <span className="font-bold text-white text-sm">{v.truck_number}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-xs">{v.chassis_type.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs text-blue-300 flex items-center gap-1">
                        <Radio className="w-3 h-3 text-blue-400/60" />
                        {getHardwareLabel(v.hardware_profile)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 text-xs">
                      {driver?.name || <span className="text-slate-500 italic">Unassigned</span>}
                    </td>
                    <td className="py-2.5 px-3">{statusBadge(v.status)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        className={`inline-flex items-center gap-1 font-bold text-sm ${safetyScoreColor(v.safety_score)} hover:underline`}
                      >
                        {v.safety_score.toFixed(1)}
                        <Shield className="w-3 h-3 opacity-60" />
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          onClick={() => onPdfReport?.(v)}
                          title="Download PDF Report"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => onMobileSync?.(v)}
                          title="Live Mobile Sync"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          Sync
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'drivers' && (
          <table className="w-full text-sm min-w-[560px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900/80 backdrop-blur text-slate-400 text-[10px] uppercase tracking-wide border-b border-slate-700">
                <th className="text-left py-2 px-3 font-semibold">Driver Name</th>
                <th className="text-left py-2 px-3 font-semibold">License / ID</th>
                <th className="text-left py-2 px-3 font-semibold">Assigned Vehicle</th>
                <th className="text-left py-2 px-3 font-semibold">Training</th>
                <th className="text-right py-2 px-3 font-semibold">Risk Score</th>
                <th className="text-center py-2 px-3 font-semibold">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500 py-6">No drivers in fleet</td>
                </tr>
              )}
              {drivers.map((d) => {
                const assignedVehicle = vehicles.find((v) => v.assigned_driver_id === d.id);
                const driverIncidents = incidents.filter((inc) => inc.driver_id === d.id);
                const riskScore = driverIncidents.length > 0
                  ? Math.max(30, 90 - driverIncidents.length * 15)
                  : 90 + Math.floor(Math.random() * 0);
                const hasAlerts = driverIncidents.some((inc) => new Date(inc.created_at) > new Date(Date.now() - 30 * 86400000));
                const trainingComplete = d.status === 'active';

                return (
                  <tr
                    key={d.id}
                    onClick={() => assignedVehicle && onSelectVehicle(assignedVehicle)}
                    className={`border-b border-slate-700/40 hover:bg-orange-500/10 transition-colors group ${!assignedVehicle ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-blue-400/60 group-hover:text-blue-400" />
                        <span className="font-bold text-white text-sm">{d.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-xs">
                      {d.driver_number || d.license_class || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 text-xs">
                      {assignedVehicle ? (
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3 text-orange-400/60" />
                          {assignedVehicle.truck_number}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {trainingComplete ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-400">
                          <AlertTriangle className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-bold text-sm ${safetyScoreColor(riskScore)}`}>
                        {riskScore.toFixed(0)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {hasAlerts ? (
                        <Badge className="bg-red-600 text-white text-[9px]">{driverIncidents.length}</Badge>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
