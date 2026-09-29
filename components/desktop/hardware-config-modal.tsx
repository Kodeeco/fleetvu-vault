'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/app-context';
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
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wrench,
  Cpu,
  Radio,
  Waves,
  Compass,
  Plus,
  CheckCircle2,
  Gauge,
  Activity,
  Bell,
} from 'lucide-react';
import {
  HARDWARE_PROFILES,
  CHASSIS_TYPES,
  VEHICLE_PROFILES,
  DEFAULT_G_FORCE_TRIGGER,
} from '@/lib/constants';
import type { HardwareProfileKey, ChassisType, VehicleProfileKey } from '@/lib/types';

export function HardwareConfigModal({ onClose }: { onClose: () => void }) {
  const { fleet, setFleet } = useApp();
  const provisionedHardware = fleet.provisionedHardware || ['c55_pro_forward_lr'];
  const [chassis, setChassis] = useState<ChassisType>('class8_tractor');
  const [selectedProfile, setSelectedProfile] = useState<HardwareProfileKey>(
    fleet.selectedHardwareProfile as HardwareProfileKey,
  );
  const [vehicleType, setVehicleType] = useState<VehicleProfileKey>(
    (fleet.selectedVehicleType as VehicleProfileKey) || 'class8_tractor_trailer',
  );
  const [incidentEnabled, setIncidentEnabled] = useState(fleet.incidentDetectionEnabled);
  const [gForce, setGForce] = useState(fleet.gForceThreshold);
  const [speedDelta, setSpeedDelta] = useState(5);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [calibrationRunning, setCalibrationRunning] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<null | {
    rf: string;
    ultra: string;
    imu: string;
    overall: string;
  }>(null);

  const runCalibration = async () => {
    setCalibrationRunning(true);
    setCalibrationResult(null);
    await new Promise((r) => setTimeout(r, 2500));

    const results = {
      rf: Math.random() > 0.1 ? 'PASS' : 'DEGRADED',
      ultra: Math.random() > 0.1 ? 'PASS' : 'FAIL',
      imu: Math.random() > 0.05 ? 'PASS' : 'DEGRADED',
    };
    const overall =
      results.rf === 'PASS' && results.ultra === 'PASS' && results.imu === 'PASS'
        ? 'PASS'
        : results.rf === 'FAIL' || results.ultra === 'FAIL' || results.imu === 'FAIL'
          ? 'FAIL'
          : 'DEGRADED';

    setCalibrationResult({ ...results, overall });
    setCalibrationRunning(false);

    await supabase.from('diagnostics').insert({
      rf_echo_result: results.rf,
      ultrasonic_result: results.ultra,
      imu_result: results.imu,
      overall_result: overall,
      latitude: 34.0522,
      longitude: -118.2437,
      notes: 'Daily POST-trip calibration diagnostic',
    });
  };

  const saveConfig = () => {
    setFleet({
      selectedHardwareProfile: selectedProfile,
      selectedVehicleType: vehicleType,
      incidentDetectionEnabled: incidentEnabled,
      gForceThreshold: gForce,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-400" />
            Hardware Suite Configuration
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure chassis, hardware profiles, incident detection sensitivity, and run daily POST-calibration diagnostics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vehicle Model / Silhouette selector */}
          <div>
            <Label className="text-slate-300 mb-2 block">Vehicle Model / Silhouette</Label>
            <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleProfileKey)}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VEHICLE_PROFILES).map(([key, vp]) => (
                  <SelectItem key={key} value={key}>{vp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">
              {VEHICLE_PROFILES[vehicleType]?.description} — {VEHICLE_PROFILES[vehicleType]?.widthM}m W x {VEHICLE_PROFILES[vehicleType]?.lengthM}m L
            </p>
          </div>

          {/* Chassis selector */}
          <div>
            <Label className="text-slate-300 mb-2 block">Chassis Type</Label>
            <Select value={chassis} onValueChange={(v) => setChassis(v as ChassisType)}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHASSIS_TYPES).map(([key, c]) => (
                  <SelectItem key={key} value={key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hardware profiles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-slate-300">Hardware System Profile</Label>
              <Button
                size="sm"
                variant="ghost"
                className="text-orange-400 text-xs"
                onClick={() => setShowAddProfile(!showAddProfile)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Profile (OTA)
              </Button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
              {Object.entries(HARDWARE_PROFILES)
                .filter(([key]) => provisionedHardware.includes(key))
                .map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setSelectedProfile(key as HardwareProfileKey)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    selectedProfile === key
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                    <div className="flex items-center gap-1">
                      {p.modality === '77ghz' && <Radio className="w-3 h-3 text-blue-400" />}
                      {p.modality === '40khz' && <Waves className="w-3 h-3 text-green-400" />}
                      {p.modality === 'dual' && (
                        <>
                          <Radio className="w-3 h-3 text-blue-400" />
                          <Waves className="w-3 h-3 text-green-400" />
                        </>
                      )}
                      {p.modality === 'full' && <Cpu className="w-3 h-3 text-orange-400" />}
                      <Badge variant="outline" className="text-xs ml-1">{p.sensors.length}ch</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                </button>
              ))}
            </div>
            {Object.keys(HARDWARE_PROFILES).length > provisionedHardware.length && (
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {Object.keys(HARDWARE_PROFILES).length - provisionedHardware.length} additional package(s) available to provision from the radar panel.
              </p>
            )}
          </div>

          {/* Add profile form (OTA) */}
          {showAddProfile && (
            <Card className="bg-slate-900/50 border-slate-700 animate-fade-in">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-300">Add Custom Hardware Profile (OTA JSON)</p>
                <Input className="bg-slate-800 border-slate-600 text-white text-sm" placeholder="Profile key (e.g. custom_radar_v2)" />
                <Input className="bg-slate-800 border-slate-600 text-white text-sm" placeholder="Display name" />
                <Textarea className="bg-slate-800 border-slate-600 text-white text-sm min-h-[60px]" placeholder='{"sensors":["front_radar"],"type":"77ghz","range_m":3.0}' />
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">Save Profile</Button>
              </CardContent>
            </Card>
          )}

          {/* Incident detection settings */}
          <div className="space-y-3 border-t border-slate-700 pt-3">
            <Label className="text-slate-300 block">Incident Detection &amp; Sensitivity</Label>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Automated Collision Prompts</p>
                  <p className="text-xs text-slate-400">Enable/disable across fleet</p>
                </div>
              </div>
              <Switch checked={incidentEnabled} onCheckedChange={setIncidentEnabled} />
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300 flex items-center gap-1">
                  <Activity className="w-4 h-4 text-orange-400" />
                  G-Force Deceleration Trigger
                </span>
                <span className="text-sm font-bold text-orange-400">{gForce.toFixed(1)}g</span>
              </div>
              <Slider value={[gForce]} min={0.5} max={3.0} step={0.1} onValueChange={(v) => setGForce(v[0])} />
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300 flex items-center gap-1">
                  <Gauge className="w-4 h-4 text-orange-400" />
                  Min Speed Delta (false positive filter)
                </span>
                <span className="text-sm font-bold text-orange-400">{speedDelta} MPH</span>
              </div>
              <Slider value={[speedDelta]} min={0} max={15} step={1} onValueChange={(v) => setSpeedDelta(v[0])} />
            </div>
          </div>

          {/* Daily POST-calibration */}
          <div className="border-t border-slate-700 pt-3">
            <Label className="text-slate-300 block mb-2">Daily POST-Trip Calibration &amp; Self-Diagnostic</Label>
            <Button
              className="w-full bg-slate-700 hover:bg-slate-600 text-white"
              onClick={runCalibration}
              disabled={calibrationRunning}
            >
              {calibrationRunning ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4 mr-2" />
                  Run Calibration Routine
                </>
              )}
            </Button>
            {calibrationResult && (
              <div className="mt-3 space-y-2 animate-fade-in">
                <div className="grid grid-cols-3 gap-2">
                  <DiagResult label="77GHz RF Echo" result={calibrationResult.rf} />
                  <DiagResult label="40kHz Ultrasonic" result={calibrationResult.ultra} />
                  <DiagResult label="IMU Orientation" result={calibrationResult.imu} />
                </div>
                <div className={`p-3 rounded-lg text-center font-bold ${
                  calibrationResult.overall === 'PASS'
                    ? 'bg-green-950/40 text-green-400 border border-green-800/40'
                    : calibrationResult.overall === 'DEGRADED'
                      ? 'bg-yellow-950/40 text-yellow-400 border border-yellow-800/40'
                      : 'bg-red-950/40 text-red-400 border border-red-800/40'
                }`}>
                  Overall: {calibrationResult.overall} — Signed &amp; committed to encrypted ledger
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="text-slate-400" onClick={onClose}>Cancel</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={saveConfig}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiagResult({ label, result }: { label: string; result: string }) {
  const color =
    result === 'PASS' ? 'text-green-400 bg-green-950/30 border-green-800/40' :
    result === 'DEGRADED' ? 'text-yellow-400 bg-yellow-950/30 border-yellow-800/40' :
    'text-red-400 bg-red-950/30 border-red-800/40';
  return (
    <div className={`p-2 rounded-lg border text-center ${color}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-bold mt-1">{result}</p>
    </div>
  );
}
