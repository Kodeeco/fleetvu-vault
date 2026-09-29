'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Shield, Radio, User, Cpu, Activity, ArrowLeft, Wrench } from 'lucide-react';
import type { Vehicle, Driver } from '@/lib/types';
import { HARDWARE_PROFILES } from '@/lib/constants';
import type { HardwareProfileKey } from '@/lib/types';
import dynamic from 'next/dynamic';

const GPSMapPanelDynamic = dynamic(
  () => import('@/components/hud/gps-map-panel').then((m) => m.GPSMapPanel),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-900 animate-pulse rounded-lg" /> },
);

interface LocationAssetViewProps {
  locationName: string;
  companyName: string;
  vehicles: Vehicle[];
  drivers: Driver[];
  mapCenter: { lat: number; lng: number };
  mapVehicles: Array<{ id: string; truckNumber: string; lat: number; lng: number; status: string; selected?: boolean; driverName?: string; speedMph?: number; location?: string; planTier?: string }>;
  selectedVehicle: Vehicle | null;
  onSelectVehicle: (v: Vehicle) => void;
  onBackToOverview: () => void;
}

function safetyScoreBadge(score: number) {
  if (score >= 85) return <Badge className="bg-emerald-600 text-white">Green</Badge>;
  if (score >= 70) return <Badge className="bg-yellow-600 text-white">Yellow</Badge>;
  return <Badge className="bg-red-600 text-white">Red</Badge>;
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

function statusBadge(status: string) {
  if (status === 'operational') return <Badge className="bg-emerald-600 text-white">Operational</Badge>;
  if (status === 'maintenance') return <Badge className="bg-yellow-600 text-white">Maintenance</Badge>;
  return <Badge className="bg-red-600 text-white">Inoperable</Badge>;
}

export function LocationAssetView({
  locationName,
  companyName,
  vehicles,
  drivers,
  mapCenter,
  mapVehicles,
  selectedVehicle,
  onSelectVehicle,
  onBackToOverview,
}: LocationAssetViewProps) {
  const activeAssetCount = vehicles.filter((v) => v.status === 'operational').length;
  const avgSafetyScore = vehicles.length > 0
    ? vehicles.reduce((sum, v) => sum + v.safety_score, 0) / vehicles.length
    : 0;
  const operationalCount = vehicles.filter((v) => v.status === 'operational').length;
  const hardwareHealthRate = vehicles.length > 0
    ? Math.round((operationalCount / vehicles.length) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Back button */}
      <div className="flex items-center gap-3 px-4 pt-3">
        <Button
          variant="outline"
          className="text-orange-400 border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 gap-1.5 h-8 text-xs font-semibold"
          onClick={onBackToOverview}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Overview
        </Button>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-500">{companyName}</span>
          <span className="text-slate-600">/</span>
          <span className="text-white font-semibold">{locationName}</span>
        </div>
      </div>

      {/* Top Metrics Header */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-orange-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Location</span>
            </div>
            <p className="text-sm font-bold text-white truncate">{locationName}</p>
            <p className="text-[10px] text-slate-500 truncate">{companyName}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Active Assets</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{activeAssetCount}</p>
            <p className="text-[10px] text-slate-500">{vehicles.length} total assigned</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Safety Score</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${safetyScoreColor(avgSafetyScore)}`}>
              {avgSafetyScore.toFixed(1)}
            </p>
            <p className="text-[10px] text-slate-500">Location average</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Hardware Health</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{hardwareHealthRate}%</p>
            <p className="text-[10px] text-slate-500">{operationalCount}/{vehicles.length} operational</p>
          </div>
        </div>
      </div>

      {/* GPS Map + Asset Table */}
      <div className="flex-1 p-4 pt-3 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* GPS Map — 3/5 width */}
          <div className="xl:col-span-3 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-white">{locationName} — Live GPS Tracking</span>
              </div>
              {selectedVehicle && (
                <Badge className="bg-green-600 text-white text-[10px] animate-pulse">LIVE: {selectedVehicle.truck_number}</Badge>
              )}
            </div>
            <div className="h-[380px]">
              <GPSMapPanelDynamic
                latitude={mapCenter.lat}
                longitude={mapCenter.lng}
                vehicles={mapVehicles}
                selectedVehicle={mapVehicles.find((mv) => mv.id === selectedVehicle?.id) || null}
                isTeaser={false}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Asset Table — 2/5 width */}
          <div className="xl:col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2 bg-slate-900/40">
              <Cpu className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-white">Asset Command Directory</span>
              <Badge variant="outline" className="ml-auto text-xs">{vehicles.length} Trucks</Badge>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                  <tr className="border-b border-slate-700 text-[9px] uppercase tracking-wide text-slate-500">
                    <th className="text-left px-3 py-2 font-medium">Truck ID</th>
                    <th className="text-left px-2 py-2 font-medium hidden lg:table-cell">Hardware</th>
                    <th className="text-left px-2 py-2 font-medium">Driver</th>
                    <th className="text-left px-2 py-2 font-medium hidden xl:table-cell">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Safety</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => {
                    const driver = drivers.find((d) => d.id === v.assigned_driver_id);
                    const isSelected = selectedVehicle?.id === v.id;
                    return (
                      <tr
                        key={v.id}
                        onClick={() => onSelectVehicle(v)}
                        className={`border-b border-slate-700/40 cursor-pointer transition-colors group ${
                          isSelected ? 'bg-orange-500/20' : 'hover:bg-orange-500/10'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3 h-3 text-orange-400 shrink-0" />
                            <span className="font-bold text-white">{v.truck_number}</span>
                          </div>
                          <span className="text-[9px] text-slate-500 block truncate max-w-[120px]">{v.location || '—'}</span>
                        </td>
                        <td className="px-2 py-2.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            <Radio className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="text-[10px] text-slate-300 truncate max-w-[100px]">{getHardwareLabel(v.hardware_profile)}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          {driver ? (
                            <div>
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-[10px] text-slate-200 truncate max-w-[90px]">{driver.name}</span>
                              </div>
                              {driver.license_class && (
                                <span className="text-[9px] text-slate-500 block pl-4">{driver.license_class}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 hidden xl:table-cell">{statusBadge(v.status)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`font-bold tabular-nums ${safetyScoreColor(v.safety_score)}`}>
                              {v.safety_score.toFixed(1)}
                            </span>
                            {safetyScoreBadge(v.safety_score)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500 text-xs">
                        <Wrench className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                        No trucks assigned to this location yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
