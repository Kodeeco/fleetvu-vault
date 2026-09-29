'use client';

/**
 * Customer Web Portal — LIVE mirror of the driver's Vault Command HUD.
 * Compact chrome + adjustable FORWARD / LEFT / RIGHT ranges (no REAR).
 * Vault Event Stream lives in the center column (BOLT layout).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Truck, Wifi } from 'lucide-react';
import type { Driver, Vehicle, VehicleProfileKey } from '@/lib/types';
import { HARDWARE_PROFILES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { RadarVisualizer, type RadarControls } from '@/components/hud/radar-visualizer';

interface CustomerLiveVehicleMirrorProps {
  vehicle: Vehicle;
  drivers: Driver[];
  controls: RadarControls;
}

const EDGE_THRESHOLD_M = 4.1;

export function CustomerLiveVehicleMirror({
  vehicle,
  drivers,
  controls,
}: CustomerLiveVehicleMirrorProps) {
  const [clock, setClock] = useState(() => new Date());
  const [speedMph] = useState(2);

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const driver = useMemo(
    () => drivers.find((d) => d.id === vehicle.assigned_driver_id) || null,
    [drivers, vehicle.assigned_driver_id],
  );

  const activeSensors = useMemo(() => {
    const hwKey = vehicle.hardware_profile as keyof typeof HARDWARE_PROFILES;
    // Force 3-channel C55 view — never expose REAR on customer LIVE mirror
    const sensors = HARDWARE_PROFILES[hwKey]?.sensors || ['front_radar', 'side_radar_left', 'side_radar_right'];
    return sensors.filter((s) => !s.includes('rear'));
  }, [vehicle.hardware_profile]);

  const leftEdge = controls.leftDistance > EDGE_THRESHOLD_M;
  const rightEdge = controls.rightDistance > EDGE_THRESHOLD_M;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#050b14]">
      {/* Compact LIVE chrome — no redundant GPS / MPH / Safety Score */}
      <header className="shrink-0 border-b border-slate-800 bg-[#081018] px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-white">
              Vault FleetVu{' '}
              <span className="font-semibold text-slate-300">
                | {driver?.name || 'Unassigned'} | Truck #{vehicle.truck_number}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge className="animate-pulse border-0 bg-emerald-600 px-1.5 py-0 text-[9px] font-black text-white">
              • LIVE
            </Badge>
            <Wifi className="h-3 w-3 text-emerald-400" />
            <Lock className="h-3 w-3 text-slate-500" />
            <span className="font-mono text-[9px] text-slate-500">
              {clock.toLocaleTimeString([], { hour12: false })}
            </span>
          </div>
        </div>
      </header>

      {/* Radar — primary focus */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#050c16]">
        <RadarVisualizer
          vehicleType={vehicle.chassis_type as VehicleProfileKey}
          speedMph={speedMph}
          activeSensors={activeSensors}
          hardwareProfile={
            vehicle.hardware_profile?.startsWith('c55')
              ? vehicle.hardware_profile.replace(/_rear$/, '').replace('forward_lr_rear', 'forward_lr')
              : 'c55_pro_forward_lr'
          }
          expandedMode
          safetyScore={vehicle.safety_score}
          location={vehicle.location || undefined}
          controls={controls}
        />
      </div>

      {/* Adjustable 3-channel ranges — FORWARD / LEFT / RIGHT only */}
      <div className="shrink-0 space-y-2 border-t border-slate-800 bg-[#081018] px-3 py-2.5">
        <AdjustableRange
          label="FRWD"
          value={controls.forwardDistance}
          max={10}
          min={0.5}
          onChange={controls.setForwardDistance}
          edge={false}
        />
        <AdjustableRange
          label="LEFT"
          value={controls.leftDistance}
          max={8}
          min={0}
          onChange={controls.setLeftDistance}
          edge={leftEdge}
        />
        <AdjustableRange
          label="RIGHT"
          value={controls.rightDistance}
          max={8}
          min={0}
          onChange={controls.setRightDistance}
          edge={rightEdge}
        />
      </div>
    </div>
  );
}

function AdjustableRange({
  label,
  value,
  max,
  min,
  onChange,
  edge,
}: {
  label: string;
  value: number;
  max: number;
  min: number;
  onChange: React.Dispatch<React.SetStateAction<number>>;
  edge: boolean;
}) {
  const status =
    label === 'FRWD'
      ? value <= 2.5
        ? { text: 'CAUTION', cls: 'bg-amber-500/20 text-amber-300' }
        : { text: 'CLEAR', cls: 'bg-emerald-500/20 text-emerald-400' }
      : edge
        ? { text: 'EDGE', cls: 'bg-cyan-500/20 text-cyan-300' }
        : value <= 2.0
          ? { text: 'CAUTION', cls: 'bg-amber-500/20 text-amber-300' }
          : { text: 'CLEAR', cls: 'bg-emerald-500/20 text-emerald-400' };

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 ${
        edge ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-700/60 bg-slate-900/50'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        <div className="flex items-center gap-1.5">
          {edge && (
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase text-cyan-300">
              EDGE
            </span>
          )}
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${status.cls}`}>
            {status.text}
          </span>
          <span className="font-mono text-sm font-black tabular-nums text-orange-300">
            {value.toFixed(1)}m
          </span>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={0.1}
        className="w-full"
      />
    </div>
  );
}

/** Empty state when no truck selected */
export function CustomerLiveVehicleEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#050b14] px-6 text-center">
      <Truck className="h-12 w-12 text-slate-600" />
      <p className="text-sm font-bold text-slate-300">Select a vehicle for LIVE sensor view</p>
      <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">
        Opens the same truck / radar feed the driver sees in FleetVu Vault Mobile. Adjust FORWARD,
        LEFT, and RIGHT ranges live.
      </p>
    </div>
  );
}
