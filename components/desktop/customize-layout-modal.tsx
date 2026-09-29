'use client';

import React from 'react';
import { useApp, type DashboardLayout, type WidgetId, ALL_WIDGETS, DEFAULT_WIDGET_ORDER } from '@/lib/app-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  Radio,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  FileText,
  KeyRound,
  Maximize2,
  Monitor,
  TrendingUp,
  Eye,
  LayoutGrid,
  Lock,
} from 'lucide-react';

interface CustomizeLayoutModalProps {
  open: boolean;
  onClose: () => void;
}

const AUDITOR_RESTRICTED_WIDGETS: WidgetId[] = ['radar', 'gpsMap'];

export function CustomizeLayoutModal({ open, onClose }: CustomizeLayoutModalProps) {
  const { fleet, setDashboardLayout, user } = useApp();
  const layout = fleet.dashboardLayout;
  const isAuditor = user?.role === 'auditor';

  const toggle = (key: keyof DashboardLayout) => (checked: boolean) => {
    setDashboardLayout({ [key]: checked } as Partial<DashboardLayout>);
  };

  const toggleWidget = (wid: WidgetId) => (checked: boolean) => {
    const vis = { ...layout.widgetVisibility, [wid]: checked };
    setDashboardLayout({ widgetVisibility: vis });
  };

  const isWidgetVisible = (wid: WidgetId) => layout.widgetVisibility?.[wid] !== false;

  const toggleSensor = (dir: 'forward' | 'left' | 'right' | 'rear') => (checked: boolean) => {
    setDashboardLayout({
      sensorCards: { ...layout.sensorCards, [dir]: checked },
    });
  };

  const toggleTeaser = (key: 'forensicVault' | 'incidentReconstruction' | 'actuarialReport') => (checked: boolean) => {
    setDashboardLayout({
      featureTeasers: { ...layout.featureTeasers, [key]: checked },
    });
  };

  const setRadarZoom = (mode: 'standard' | 'expanded') => () => {
    setDashboardLayout({ radarZoom: mode });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Monitor className="w-5 h-5 text-orange-400" />
            Customize Dashboard Layout
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Toggle workspace modules on or off. Preferences are saved to your session and remembered across reloads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto">
          {/* Dashboard Widget Visibility */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-orange-400" />
              Dashboard Widgets
            </p>
            <div className="pl-6 space-y-2 max-h-[240px] overflow-y-auto scrollbar-thin pr-2">
              {DEFAULT_WIDGET_ORDER.map((wid) => {
                const widget = ALL_WIDGETS.find((w) => w.id === wid);
                if (!widget) return null;
                const restricted = isAuditor && AUDITOR_RESTRICTED_WIDGETS.includes(wid);
                return (
                  <div key={wid} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Eye className={`w-3.5 h-3.5 shrink-0 ${restricted ? 'text-red-500/50' : isWidgetVisible(wid) ? 'text-orange-400' : 'text-slate-600'}`} />
                      <div className="min-w-0">
                        <Label className={`text-xs truncate block ${restricted ? 'text-slate-500' : 'text-slate-200'}`}>{widget.label}</Label>
                        {restricted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400/80 font-semibold mt-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            Disabled by Security Policy
                          </span>
                        ) : (
                          <p className="text-[10px] text-slate-500 truncate">{widget.description}</p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={restricted ? false : isWidgetVisible(wid)}
                      onCheckedChange={restricted ? () => {} : toggleWidget(wid)}
                      disabled={restricted}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <Divider />

          {/* GPS Tracking Map */}
          <div className={`flex items-center justify-between gap-3 ${isAuditor ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className={`w-4 h-4 shrink-0 ${isAuditor ? 'text-red-500/50' : 'text-green-400'}`} />
              <div className="min-w-0">
                <Label className={`text-sm truncate block ${isAuditor ? 'text-slate-500' : 'text-slate-200'}`}>GPS Tracking Map</Label>
                {isAuditor ? (
                  <span className="inline-flex items-center gap-1 text-xs text-red-400/80 font-semibold mt-0.5">
                    <Lock className="w-3 h-3" />
                    Disabled by Security Policy
                  </span>
                ) : (
                  <p className="text-xs text-slate-500 truncate">Show or hide the GPS widget panel</p>
                )}
              </div>
            </div>
            <Switch
              checked={isAuditor ? false : layout.gpsMapVisible}
              onCheckedChange={isAuditor ? () => {} : toggle('gpsMapVisible')}
              disabled={isAuditor}
            />
          </div>

          <Divider />

          {/* Sensor Perimeter Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Radio className={`w-4 h-4 ${isAuditor ? 'text-red-500/50' : 'text-orange-400'}`} />
                Sensor Perimeter Cards
              </p>
              {isAuditor && (
                <span className="inline-flex items-center gap-1 text-[10px] text-red-400/80 font-semibold">
                  <Lock className="w-2.5 h-2.5" />
                  Disabled by Security Policy
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 pl-6">
              <ToggleRow icon={<ArrowUp className="w-4 h-4 text-orange-400" />} label="Forward Telemetry" checked={isAuditor ? false : layout.sensorCards.forward} onCheckedChange={toggleSensor('forward')} compact disabled={isAuditor} />
              <ToggleRow icon={<ArrowLeft className="w-4 h-4 text-blue-400" />} label="Left Telemetry" checked={isAuditor ? false : layout.sensorCards.left} onCheckedChange={toggleSensor('left')} compact disabled={isAuditor} />
              <ToggleRow icon={<ArrowRight className="w-4 h-4 text-blue-400" />} label="Right Telemetry" checked={isAuditor ? false : layout.sensorCards.right} onCheckedChange={toggleSensor('right')} compact disabled={isAuditor} />
              <ToggleRow icon={<ArrowDown className="w-4 h-4 text-green-400" />} label="Rear Telemetry" checked={isAuditor ? false : layout.sensorCards.rear} onCheckedChange={toggleSensor('rear')} compact disabled={isAuditor} />
            </div>
          </div>

          <Divider />

          {/* Teaser Banners & Telemetry Badges visibility */}
          <ToggleRow
            icon={<FileText className="w-4 h-4 text-orange-400" />}
            label="Teaser &amp; Feature Banners"
            description="Show or hide all teaser / blueprint callout cards"
            checked={layout.teaserBannersVisible}
            onCheckedChange={toggle('teaserBannersVisible')}
          />

          <ToggleRow
            icon={<Radio className="w-4 h-4 text-blue-400" />}
            label="Telemetry Distance Badges"
            description="Show or hide per-vehicle distance overlay badges"
            checked={layout.telemetryBadgesVisible}
            onCheckedChange={toggle('telemetryBadgesVisible')}
          />

          <Divider />

          {/* Feature Teasers & Blueprint Badges */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" />
              Feature Teasers &amp; Blueprint Badges
            </p>
            <div className="pl-6 space-y-3">
              <ToggleRow
                icon={<KeyRound className="w-4 h-4 text-purple-400" />}
                label="Forensic Vault Teaser"
                description="Cryptographic SHA-256 event log verification card"
                checked={layout.featureTeasers.forensicVault}
                onCheckedChange={toggleTeaser('forensicVault')}
              />
              <ToggleRow
                icon={<FileText className="w-4 h-4 text-orange-400" />}
                label="Incident Vector Reconstruction Teaser"
                description="Collision reconstruction diagram blueprint card"
                checked={layout.featureTeasers.incidentReconstruction}
                onCheckedChange={toggleTeaser('incidentReconstruction')}
              />
              <ToggleRow
                icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                label="Actuarial Risk Report Teaser"
                description="Insurance risk reduction & carrier discount card"
                checked={layout.featureTeasers.actuarialReport}
                onCheckedChange={toggleTeaser('actuarialReport')}
              />
            </div>
          </div>

          <Divider />

          {/* Radar Zoom / Scale Preset */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-orange-400" />
              Vehicle Radar Zoom / Scale Preset
            </p>
            <div className="pl-6 grid grid-cols-2 gap-3">
              <button
                onClick={setRadarZoom('standard')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  layout.radarZoom === 'standard'
                    ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                    : 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-bold">Standard</p>
                <p className="text-xs text-slate-500 mt-0.5">Default radar view</p>
              </button>
              <button
                onClick={setRadarZoom('expanded')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  layout.radarZoom === 'expanded'
                    ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                    : 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-bold">Expanded Center Mode</p>
                <p className="text-xs text-slate-500 mt-0.5">2-inch+ enlarged truck schematic</p>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
  compact,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${compact ? 'gap-2' : 'gap-3'} ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <Label className={`text-sm truncate block ${disabled ? 'text-slate-500' : 'text-slate-200'}`}>{label}</Label>
          {description && <p className="text-xs text-slate-500 truncate">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={disabled ? () => {} : onCheckedChange} disabled={disabled} />
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-700/60" />;
}
