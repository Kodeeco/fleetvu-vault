'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Navigation,
  MapPin,
  Clock,
  Shield,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Route,
  Smartphone,
  Save,
  X,
  Gauge,
  LogIn,
  LogOut,
  Building2,
  Ban,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeofenceZone } from '@/components/hud/gps-map-panel';

export type ZoneType = 'terminal' | 'restricted' | 'route' | 'delivery_dock';

interface GeofenceCorridor {
  id: string;
  name: string;
  type: ZoneType;
  status: 'active' | 'paused';
  vehicleCount: number;
  radiusM: number;
  color: string;
  center: [number, number];
  triggerRules: {
    entryAlert: boolean;
    exitAlert: boolean;
    speedEnforcement: boolean;
  };
  assignment: 'all' | 'selected';
}

interface CheckInLog {
  id: string;
  driver: string;
  truckNumber: string;
  action: 'check-in' | 'check-out' | 'boundary-alert';
  location: string;
  timestamp: string;
  status: 'ok' | 'warning';
}

interface BoundaryRule {
  id: string;
  name: string;
  condition: string;
  alertType: 'enter' | 'exit' | 'speed';
  enabled: boolean;
}

const ZONE_TYPE_CONFIG: Record<ZoneType, { label: string; color: string; icon: React.ReactNode }> = {
  terminal: { label: 'Terminal', color: '#3B82F6', icon: <Building2 className="w-3 h-3" /> },
  restricted: { label: 'Restricted Zone', color: '#EF4444', icon: <Ban className="w-3 h-3" /> },
  route: { label: 'Route Corridor', color: '#22C55E', icon: <Route className="w-3 h-3" /> },
  delivery_dock: { label: 'Customer Delivery Dock', color: '#EAB308', icon: <MapPin className="w-3 h-3" /> },
};

const DEMO_CORRIDORS: GeofenceCorridor[] = [
  { id: 'c1', name: 'I-5 North Corridor', type: 'route', status: 'active', vehicleCount: 8, radiusM: 500, color: '#22C55E', center: [34.0522, -118.2437], triggerRules: { entryAlert: true, exitAlert: true, speedEnforcement: true }, assignment: 'all' },
  { id: 'c2', name: 'Port of LA Terminal', type: 'terminal', status: 'active', vehicleCount: 3, radiusM: 800, color: '#3B82F6', center: [33.7400, -118.2600], triggerRules: { entryAlert: true, exitAlert: true, speedEnforcement: false }, assignment: 'all' },
  { id: 'c3', name: 'Downtown Restricted Zone', type: 'restricted', status: 'active', vehicleCount: 0, radiusM: 300, color: '#EF4444', center: [34.0500, -118.2500], triggerRules: { entryAlert: true, exitAlert: false, speedEnforcement: false }, assignment: 'all' },
  { id: 'c4', name: 'I-10 East Haul Route', type: 'route', status: 'paused', vehicleCount: 5, radiusM: 500, color: '#EAB308', center: [33.9425, -117.3976], triggerRules: { entryAlert: false, exitAlert: true, speedEnforcement: true }, assignment: 'selected' },
];

const DEMO_CHECK_INS: CheckInLog[] = [
  { id: '1', driver: 'Marcus Webb', truckNumber: 'TRK-1042', action: 'check-in', location: 'Port of LA Terminal', timestamp: '08:42 AM', status: 'ok' },
  { id: '2', driver: 'Sarah Chen', truckNumber: 'TRK-2103', action: 'boundary-alert', location: 'Downtown Restricted Zone', timestamp: '09:15 AM', status: 'warning' },
  { id: '3', driver: 'James Rivera', truckNumber: 'TRK-0877', action: 'check-out', location: 'I-5 North Corridor — Exit 23', timestamp: '09:31 AM', status: 'ok' },
  { id: '4', driver: 'Emily Davis', truckNumber: 'TRK-3156', action: 'check-in', location: 'I-10 East Haul Route — Mile 47', timestamp: '10:05 AM', status: 'ok' },
  { id: '5', driver: 'Tom Anderson', truckNumber: 'TRK-4401', action: 'boundary-alert', location: 'Downtown Restricted Zone', timestamp: '10:28 AM', status: 'warning' },
  { id: '6', driver: 'Lisa Park', truckNumber: 'TRK-1290', action: 'check-in', location: 'Port of LA Terminal', timestamp: '11:02 AM', status: 'ok' },
];

const DEMO_RULES: BoundaryRule[] = [
  { id: 'r1', name: 'Restricted Zone Entry Alert', condition: 'Vehicle enters Downtown Restricted Zone', alertType: 'enter', enabled: true },
  { id: 'r2', name: 'Terminal Check-Out Reminder', condition: 'Vehicle exits Port of LA Terminal after 4pm', alertType: 'exit', enabled: true },
  { id: 'r3', name: 'Corridor Speed Limit (65mph)', condition: 'Speed exceeds 65mph on I-5 North Corridor', alertType: 'speed', enabled: true },
  { id: 'r4', name: 'After-Hours Terminal Lock', condition: 'Vehicle enters terminal after 8pm', alertType: 'enter', enabled: false },
];

function corridorToZone(c: GeofenceCorridor): GeofenceZone {
  return { id: c.id, name: c.name, color: c.color, center: c.center, radiusM: c.radiusM };
}

export function GeofenceManagementModal({
  open,
  onClose,
  vehicleCount,
  onCorridorsChange,
}: {
  open: boolean;
  onClose: () => void;
  vehicleCount: number;
  onCorridorsChange?: (zones: GeofenceZone[]) => void;
}) {
  const [corridors, setCorridors] = useState<GeofenceCorridor[]>(DEMO_CORRIDORS);
  const [rules, setRules] = useState<BoundaryRule[]>(DEMO_RULES);
  const [activeTab, setActiveTab] = useState('corridors');
  const [showCreator, setShowCreator] = useState(false);

  const syncZones = (list: GeofenceCorridor[]) => {
    onCorridorsChange?.(list.filter((c) => c.status === 'active').map(corridorToZone));
  };

  const toggleCorridorStatus = (id: string) => {
    setCorridors((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, status: c.status === 'active' ? ('paused' as const) : ('active' as const) } : c,
      );
      syncZones(next);
      return next;
    });
  };

  const deleteCorridor = (id: string) => {
    setCorridors((prev) => {
      const next = prev.filter((c) => c.id !== id);
      syncZones(next);
      return next;
    });
  };

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  const handleSaveCorridor = (corridor: GeofenceCorridor) => {
    setCorridors((prev) => {
      const next = [...prev, corridor];
      syncZones(next);
      return next;
    });
    setShowCreator(false);
  };

  const activeCount = corridors.filter((c) => c.status === 'active').length;
  const alertCount = DEMO_CHECK_INS.filter((c) => c.status === 'warning').length;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-orange-400" />
              Geofencing &amp; Route Management
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Live active corridors, driver check-in logs, and boundary rules across {vehicleCount} fleet vehicles.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 mb-1">
            <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-2.5 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Active Corridors</p>
              <p className="text-lg font-bold text-green-400">{activeCount}</p>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-2.5 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Boundary Alerts</p>
              <p className="text-lg font-bold text-orange-400">{alertCount}</p>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-2.5 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Tracked Vehicles</p>
              <p className="text-lg font-bold text-blue-400">{vehicleCount}</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="bg-slate-900/50 border border-slate-700 grid grid-cols-3">
              <TabsTrigger value="corridors" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
                <Route className="w-3.5 h-3.5 mr-1.5" /> Corridors
              </TabsTrigger>
              <TabsTrigger value="checkins" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
                <Smartphone className="w-3.5 h-3.5 mr-1.5" /> Driver Check-Ins
              </TabsTrigger>
              <TabsTrigger value="rules" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
                <Shield className="w-3.5 h-3.5 mr-1.5" /> Boundary Rules
              </TabsTrigger>
            </TabsList>

            <TabsContent value="corridors" className="flex-1 overflow-y-auto scrollbar-thin mt-2 space-y-2">
              {corridors.map((corridor) => {
                const typeCfg = ZONE_TYPE_CONFIG[corridor.type];
                return (
                  <div
                    key={corridor.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-700/50 hover:border-slate-600 transition-colors"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: corridor.color, boxShadow: `0 0 8px ${corridor.color}80` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">{corridor.name}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] px-1.5 py-0 border flex items-center gap-1',
                            corridor.type === 'route' && 'border-green-500/40 text-green-400',
                            corridor.type === 'terminal' && 'border-blue-500/40 text-blue-400',
                            corridor.type === 'restricted' && 'border-red-500/40 text-red-400',
                            corridor.type === 'delivery_dock' && 'border-yellow-500/40 text-yellow-400',
                          )}
                        >
                          {typeCfg.icon}
                          {typeCfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {corridor.radiusM}m radius
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5" />
                          {corridor.vehicleCount} vehicles
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          {corridor.triggerRules.entryAlert && <LogIn className="w-2.5 h-2.5 text-green-400" />}
                          {corridor.triggerRules.exitAlert && <LogOut className="w-2.5 h-2.5 text-blue-400" />}
                          {corridor.triggerRules.speedEnforcement && <Gauge className="w-2.5 h-2.5 text-orange-400" />}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleCorridorStatus(corridor.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all',
                          corridor.status === 'active'
                            ? 'bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/25'
                            : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700',
                        )}
                      >
                        {corridor.status === 'active' ? 'Active' : 'Paused'}
                      </button>
                      <button
                        onClick={() => deleteCorridor(corridor.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setShowCreator(true)}
                className="w-full p-2.5 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-orange-400 hover:border-orange-500/50 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Geofence Corridor
              </button>
            </TabsContent>

            <TabsContent value="checkins" className="flex-1 overflow-y-auto scrollbar-thin mt-2 space-y-1.5">
              {DEMO_CHECK_INS.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                    log.status === 'warning'
                      ? 'bg-orange-950/30 border-orange-800/40'
                      : 'bg-slate-900/40 border-slate-700/50',
                  )}
                >
                  <div className="flex-shrink-0">
                    {log.status === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                    ) : log.action === 'check-in' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate">{log.driver}</p>
                      <span className="text-[10px] text-slate-500 font-mono">{log.truckNumber}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {log.action.replace('-', ' ')} — {log.location}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">{log.timestamp}</span>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="rules" className="flex-1 overflow-y-auto scrollbar-thin mt-2 space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-700/50"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                      rule.enabled ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700/50 text-slate-500',
                    )}
                  >
                    {rule.alertType === 'enter' ? (
                      <MapPin className="w-4 h-4" />
                    ) : rule.alertType === 'exit' ? (
                      <Navigation className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{rule.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{rule.condition}</p>
                    <Badge
                      variant="outline"
                      className="mt-1 text-[9px] px-1.5 py-0 border-slate-600 text-slate-400 capitalize"
                    >
                      {rule.alertType} alert
                    </Badge>
                  </div>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5',
                      rule.enabled ? 'bg-orange-500' : 'bg-slate-600',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        rule.enabled ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          <div className="pt-2 border-t border-slate-700 flex justify-end">
            <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CorridorCreatorModal
        open={showCreator}
        onClose={() => setShowCreator(false)}
        onSave={handleSaveCorridor}
        existingCount={corridors.length}
      />
    </>
  );
}

// ---- Corridor Creator Sub-Modal ----

function CorridorCreatorModal({
  open,
  onClose,
  onSave,
  existingCount,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (corridor: GeofenceCorridor) => void;
  existingCount: number;
}) {
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('terminal');
  const [radiusM, setRadiusM] = useState(500);
  const [assignment, setAssignment] = useState<'all' | 'selected'>('all');
  const [entryAlert, setEntryAlert] = useState(true);
  const [exitAlert, setExitAlert] = useState(true);
  const [speedEnforcement, setSpeedEnforcement] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const radiusLabel = radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)} km` : `${radiusM} m`;
  const radiusMiles = (radiusM / 1609.34).toFixed(2);

  const handleSave = () => {
    if (!name.trim()) return;
    const cfg = ZONE_TYPE_CONFIG[zoneType];
    const corridor: GeofenceCorridor = {
      id: `c${Date.now()}`,
      name: name.trim(),
      type: zoneType,
      status: isActive ? 'active' : 'paused',
      vehicleCount: 0,
      radiusM,
      color: cfg.color,
      center: [34.0522 + (Math.random() - 0.5) * 0.06, -118.2437 + (Math.random() - 0.5) * 0.06],
      triggerRules: {
        entryAlert,
        exitAlert,
        speedEnforcement,
      },
      assignment,
    };
    onSave(corridor);
    // Reset form
    setName('');
    setZoneType('terminal');
    setRadiusM(500);
    setAssignment('all');
    setEntryAlert(true);
    setExitAlert(true);
    setSpeedEnforcement(false);
    setIsActive(true);
  };

  const canSave = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-400" />
            Create Geofence Corridor
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Define a new geofence zone, assign trigger rules, and sync it to the live fleet map.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 py-2">
          {/* Corridor Name */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Corridor / Zone Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. San Diego Terminal 4"
              className="bg-slate-900/60 border-slate-700 text-white text-sm"
            />
          </div>

          {/* Zone Type */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Zone Type</Label>
            <Select value={zoneType} onValueChange={(v) => setZoneType(v as ZoneType)}>
              <SelectTrigger className="bg-slate-900/60 border-slate-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {(Object.keys(ZONE_TYPE_CONFIG) as ZoneType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {ZONE_TYPE_CONFIG[key].icon}
                      {ZONE_TYPE_CONFIG[key].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boundary Geometry — Radius Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Boundary Radius</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-orange-400">{radiusLabel}</span>
                <span className="text-[10px] text-slate-500">({radiusMiles} mi)</span>
              </div>
            </div>
            <input
              type="range"
              min={100}
              max={5000}
              step={50}
              value={radiusM}
              onChange={(e) => setRadiusM(parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>100m</span>
              <span>1km</span>
              <span>2.5km</span>
              <span>5km</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: ZONE_TYPE_CONFIG[zoneType].color, boxShadow: `0 0 8px ${ZONE_TYPE_CONFIG[zoneType].color}80` }}
              />
              <span className="text-[10px] text-slate-400">
                Circular boundary centered on map. For route corridors, the radius defines the corridor width from center line.
              </span>
            </div>
          </div>

          {/* Target Vehicle / Driver Assignment */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Target Vehicle / Driver Assignment</Label>
            <Select value={assignment} onValueChange={(v) => setAssignment(v as 'all' | 'selected')}>
              <SelectTrigger className="bg-slate-900/60 border-slate-700 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-green-400" />
                    All Active Fleet Assets
                  </span>
                </SelectItem>
                <SelectItem value="selected">
                  <span className="flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-blue-400" />
                    Specific Driver Groups
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {assignment === 'selected' && (
              <p className="text-[10px] text-slate-500">
                Driver group selection will be available after corridor creation. Assigned drivers will receive boundary alerts on their mobile app.
              </p>
            )}
          </div>

          {/* Trigger Rules */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Trigger Rules</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 cursor-pointer hover:border-slate-600 transition-colors">
                <Checkbox
                  checked={entryAlert}
                  onCheckedChange={(v) => setEntryAlert(!!v)}
                  className="border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <LogIn className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-bold text-white">Entry Alert</span>
                <span className="text-[10px] text-slate-500 ml-auto">Notify when vehicle enters zone</span>
              </label>
              <label className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 cursor-pointer hover:border-slate-600 transition-colors">
                <Checkbox
                  checked={exitAlert}
                  onCheckedChange={(v) => setExitAlert(!!v)}
                  className="border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <LogOut className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold text-white">Exit Alert</span>
                <span className="text-[10px] text-slate-500 ml-auto">Notify when vehicle exits zone</span>
              </label>
              <label className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 cursor-pointer hover:border-slate-600 transition-colors">
                <Checkbox
                  checked={speedEnforcement}
                  onCheckedChange={(v) => setSpeedEnforcement(!!v)}
                  className="border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <Gauge className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-white">Speed Limit Enforcement</span>
                <span className="text-[10px] text-slate-500 ml-auto">Alert if speed exceeds limit in zone</span>
              </label>
            </div>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-700/50">
            <div>
              <p className="text-xs font-bold text-white">Corridor Status</p>
              <p className="text-[10px] text-slate-500">
                {isActive ? 'Active — alerts and map overlay enabled immediately' : 'Paused — created but not yet monitoring'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-bold', isActive ? 'text-green-400' : 'text-slate-500')}>
                {isActive ? 'Active' : 'Paused'}
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          {/* Summary Preview */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Name:</span>
              <span className="text-white font-bold">{name.trim() || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Type:</span>
              <span className="text-white font-bold flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ZONE_TYPE_CONFIG[zoneType].color }}
                />
                {ZONE_TYPE_CONFIG[zoneType].label}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Radius:</span>
              <span className="text-orange-400 font-bold">{radiusLabel} ({radiusMiles} mi)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Assignment:</span>
              <span className="text-white font-bold">{assignment === 'all' ? 'All Fleet Assets' : 'Specific Groups'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Rules:</span>
              <span className="text-white font-bold">
                {[
                  entryAlert && 'Entry',
                  exitAlert && 'Exit',
                  speedEnforcement && 'Speed',
                ].filter(Boolean).join(', ') || 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Status:</span>
              <span className={cn('font-bold', isActive ? 'text-green-400' : 'text-slate-400')}>
                {isActive ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" /> Cancel
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={handleSave}
            disabled={!canSave}
          >
            <Save className="w-4 h-4 mr-1.5" /> Save Corridor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
