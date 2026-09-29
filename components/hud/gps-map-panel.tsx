'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Guard Leaflet Canvas renderer — tab switches can leave `_ctx` undefined and crash on clearRect. */
function patchLeafletCanvasSafety(): void {
  const Canvas = (L as unknown as {
    Canvas?: {
      prototype: {
        _clear?: (this: { _ctx?: CanvasRenderingContext2D | null }) => void;
        _draw?: (this: { _ctx?: CanvasRenderingContext2D | null }) => void;
        _updatePaths?: (this: { _ctx?: CanvasRenderingContext2D | null }) => void;
        __fvSafePatch?: boolean;
      };
    };
  }).Canvas;
  const proto = Canvas?.prototype;
  if (!proto || proto.__fvSafePatch) return;

  const wrap =
    (fn?: (this: { _ctx?: CanvasRenderingContext2D | null }) => void) =>
    function (this: { _ctx?: CanvasRenderingContext2D | null }) {
      if (!this._ctx) return;
      try {
        return fn?.apply(this, arguments as unknown as []);
      } catch {
        // Ignore teardown races while the map container is unmounting.
      }
    };

  if (proto._clear) proto._clear = wrap(proto._clear);
  if (proto._draw) proto._draw = wrap(proto._draw);
  if (proto._updatePaths) proto._updatePaths = wrap(proto._updatePaths);
  proto.__fvSafePatch = true;
}

patchLeafletCanvasSafety();

export interface GPSMapVehicle {
  id: string;
  truckNumber: string;
  lat: number;
  lng: number;
  status: string;
  selected?: boolean;
  driverName?: string;
  speedMph?: number;
  location?: string;
  planTier?: string;
}

export interface GeofenceZone {
  id: string;
  name: string;
  color: string;
  center: [number, number];
  radiusM: number;
}

interface GPSMapPanelProps {
  latitude: number;
  longitude: number;
  vehicles: GPSMapVehicle[];
  selectedVehicle?: GPSMapVehicle | null;
  selectedPlanTier?: string;
  isTeaser?: boolean;
  className?: string;
  onBasicTierMapClick?: () => void;
  geofenceZones?: GeofenceZone[];
  compact?: boolean;
  onExpandToggle?: (expanded: boolean) => void;
  onFullscreen?: () => void;
}

const DEFAULT_GEOFENCE_ZONES: GeofenceZone[] = [
  { id: 'z1', name: 'I-5 North Corridor', color: '#22C55E', center: [34.0522, -118.2437], radiusM: 500 },
  { id: 'z2', name: 'Port of LA Terminal', color: '#3B82F6', center: [33.7400, -118.2600], radiusM: 800 },
  { id: 'z3', name: 'Downtown Restricted Zone', color: '#EF4444', center: [34.0500, -118.2500], radiusM: 300 },
];

function isBasicTier(tier?: string): boolean {
  if (!tier) return true;
  return tier.toLowerCase() === 'basic';
}

function statusColor(status: string): string {
  if (status === 'operational') return '#22C55E';
  if (status === 'maintenance') return '#EAB308';
  return '#EF4444';
}

function createTruckIcon(color: string, isFocused: boolean): L.DivIcon {
  const ring = isFocused ? '<div style="position:absolute;inset:0;border-radius:50%;border:2px solid #F97316;opacity:0.6;animation:gps-ping 1.5s ease-out infinite"></div>' : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:28px;height:28px">${ring}<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform:scale(${isFocused ? 1.3 : 1});transition:transform 0.2s ease"><rect x="2" y="8" width="16" height="12" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/><rect x="18" y="11" width="8" height="9" rx="1" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="8" cy="22" r="2.5" fill="#1E293B" stroke="#fff" stroke-width="1"/><circle cx="22" cy="22" r="2.5" fill="#1E293B" stroke="#fff" stroke-width="1"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createLabelIcon(truckNumber: string, isFocused: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="transform:translateX(-50%);white-space:nowrap"><div style="background:rgba(15,23,42,0.8);border:1px solid rgba(71,85,105,0.4);border-radius:3px;padding:1px 5px;font-family:Inter,sans-serif;font-size:${isFocused ? 11 : 9}px;font-weight:${isFocused ? 700 : 400};color:${isFocused ? '#fff' : 'rgba(255,255,255,0.7)'}">${truckNumber}</div></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, -16],
  });
}

// Tile layer configs
type MapStyleId = 'dark' | 'light' | 'satellite';

const TILE_LAYERS: Record<MapStyleId, { url: string; attribution: string; maxZoom: number; className: string }> = {
  dark: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    className: 'gps-tile-dark',
  },
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    className: 'gps-tile-light',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 19,
    className: 'gps-tile-satellite',
  },
};

export function GPSMapPanel({
  latitude,
  longitude,
  vehicles,
  selectedVehicle,
  selectedPlanTier,
  isTeaser = false,
  className,
  onBasicTierMapClick,
  geofenceZones,
  compact = false,
  onExpandToggle,
  onFullscreen,
}: GPSMapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const labelsRef = useRef<Map<string, L.Marker>>(new Map());
  const circlesRef = useRef<L.Circle[]>([]);
  const [mapStyle, setMapStyle] = useState<MapStyleId>('dark');
  const [showGeofences, setShowGeofences] = useState(true);
  const [ready, setReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const zones = geofenceZones && geofenceZones.length > 0 ? geofenceZones : DEFAULT_GEOFENCE_ZONES;
  const basicTier = isBasicTier(selectedPlanTier);

  const toggleExpand = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandToggle?.(next);
    requestAnimationFrame(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        recenter();
      }
    });
  }, [isExpanded, onExpandToggle]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      if (vehicles.length > 0) {
        const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        map.setView([latitude, longitude], 6);
      }
    } catch {
      // Map may be mid-teardown when switching Dashboard ↔ Incidents / Vault Reports
    }
  }, [vehicles, ready, latitude, longitude]);

  // --- Initialize map ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    patchLeafletCanvasSafety();

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
      // SVG renderer avoids Canvas clearRect crashes when the panel unmounts on tab change
      preferCanvas: false,
    });

    const tileConfig = TILE_LAYERS[mapStyle];
    tileLayerRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      className: tileConfig.className,
    }).addTo(map);

    map.on('click', () => {
      if (basicTier && onBasicTierMapClick) onBasicTierMapClick();
    });

    mapRef.current = map;
    setReady(true);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    const ro = new ResizeObserver((entries) => {
      if (disposed) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (disposed) return;
        const m = mapRef.current;
        if (!m) return;
        const entry = entries[entries.length - 1];
        const w = entry?.contentRect?.width ?? 0;
        const h = entry?.contentRect?.height ?? 0;
        if (w < 10 || h < 10) return;
        try {
          m.invalidateSize({ animate: false });
        } catch {
          // Swallow clearRect / teardown races
        }
      }, 150);
    });
    ro.observe(containerRef.current);

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      try {
        map.stop();
        markersRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        markersRef.current.clear();
        labelsRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        labelsRef.current.clear();
        circlesRef.current.forEach((c) => {
          try { c.remove(); } catch { /* ignore */ }
        });
        circlesRef.current = [];
        tileLayerRef.current = null;
        map.remove();
      } catch {
        // Ignore Leaflet teardown errors
      }
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Style switch ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      const tileConfig = TILE_LAYERS[mapStyle];
      tileLayerRef.current = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        className: tileConfig.className,
      }).addTo(map);
      tileLayerRef.current.bringToBack();
    } catch {
      // ignore mid-unmount
    }
  }, [mapStyle, ready]);

  // --- Geofence circles ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    try {
      circlesRef.current.forEach((c) => c.remove());
      circlesRef.current = [];

      if (!showGeofences) return;

      for (const z of zones) {
        const circle = L.circle(z.center, {
          radius: z.radiusM,
          fillColor: z.color,
          fillOpacity: 0.1,
          color: z.color,
          opacity: 0.85,
          weight: 2,
        }).addTo(map);

        circle.bindTooltip(`<strong style="color:${z.color}">${z.name}</strong><br/><span style="font-size:11px;color:#94a3b8">Radius: ${z.radiusM}m</span>`, {
          sticky: true,
          className: 'gps-geofence-tooltip',
        });

        circlesRef.current.push(circle);
      }
    } catch {
      // ignore mid-unmount
    }
  }, [zones, showGeofences, ready]);

  // --- Marker sync ---
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    try {
      const existing = markersRef.current;
      const existingLabels = labelsRef.current;
      const seen = new Set<string>();

      for (const v of vehicles) {
        seen.add(v.id);
        const isFocused = selectedVehicle?.id === v.id;
        const latlng: L.LatLngExpression = [v.lat, v.lng];
        const color = statusColor(v.status);

        let marker = existing.get(v.id);
        let label = existingLabels.get(v.id);

        if (!marker) {
          marker = L.marker(latlng, { icon: createTruckIcon(color, isFocused) }).addTo(map);
          const infoHtml = `
          <div style="min-width:200px;background:rgba(15,23,42,0.95);border:1px solid rgba(249,115,22,0.4);border-radius:8px;padding:10px 12px;box-shadow:0 4px 20px rgba(0,0,0,0.5)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <strong style="color:#fff;font-size:14px">${v.truckNumber}</strong>
              <span style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};display:inline-block"></span>
            </div>
            ${v.driverName ? `<div style="font-size:12px;color:#cbd5e1;margin-bottom:3px">Driver: ${v.driverName}</div>` : ''}
            ${v.speedMph !== undefined ? `<div style="font-size:12px;color:#F97316;font-weight:600;margin-bottom:3px">Speed: ${v.speedMph} MPH</div>` : ''}
            <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">GPS: ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}</div>
            ${v.location ? `<div style="font-size:11px;color:#94a3b8">Location: ${v.location}</div>` : ''}
          </div>
        `;
          marker.bindPopup(infoHtml, { className: 'gps-popup', maxWidth: 260 });

          existing.set(v.id, marker);

          label = L.marker(latlng, { icon: createLabelIcon(v.truckNumber, isFocused), interactive: false }).addTo(map);
          existingLabels.set(v.id, label);
        } else {
          marker.setLatLng(latlng);
          label?.setLatLng(latlng);
          marker.setIcon(createTruckIcon(color, isFocused));
          label?.setIcon(createLabelIcon(v.truckNumber, isFocused));
        }
      }

      existing.forEach((m, id) => {
        if (!seen.has(id)) {
          m.remove();
          existing.delete(id);
          existingLabels.get(id)?.remove();
          existingLabels.delete(id);
        }
      });
    } catch {
      // ignore mid-unmount
    }
  }, [vehicles, selectedVehicle, ready]);

  useEffect(() => {
    syncMarkers();
  }, [syncMarkers]);

  // --- Fly to selected vehicle ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedVehicle) return;
    try {
      map.flyTo([selectedVehicle.lat, selectedVehicle.lng], 14, { duration: 0.8 });
    } catch {
      // ignore
    }
  }, [selectedVehicle, ready]);

  // --- Fit bounds on vehicle set change ---
  const vehicleBoundsKey = vehicles.map((v) => v.id).join(',');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || vehicles.length === 0 || selectedVehicle) return;
    try {
      const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, vehicleBoundsKey]);

  const minHeight = compact && !isExpanded ? 220 : 520;

  return (
    <div className={`relative flex flex-col ${className || ''}`} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden', position: 'relative', minHeight: isExpanded ? 520 : Math.max(minHeight, 200) }}>
      <style>{`
        @keyframes gps-ping {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .gps-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .gps-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .gps-popup .leaflet-popup-tip {
          background: rgba(15,23,42,0.95) !important;
        }
        .gps-geofence-tooltip {
          background: rgba(15,23,42,0.92) !important;
          border: 1px solid rgba(71,85,105,0.4) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
          color: #fff !important;
          font-size: 12px !important;
        }
        .leaflet-container {
          background: #0f1929 !important;
          font-family: Inter, sans-serif !important;
        }
        .gps-tile-dark .leaflet-tile {
          filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.8);
        }
        .gps-tile-light .leaflet-tile {
          filter: none;
        }
        .gps-tile-satellite .leaflet-tile {
          filter: none;
        }
        .leaflet-control-attribution {
          background: rgba(15,23,42,0.7) !important;
          color: #64748b !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a {
          color: #94a3b8 !important;
        }
        .leaflet-bar a {
          background: rgba(15,23,42,0.9) !important;
          color: #cbd5e1 !important;
          border-color: rgba(71,85,105,0.4) !important;
        }
        .leaflet-bar a:hover {
          background: rgba(30,41,59,0.95) !important;
          color: #fff !important;
        }
      `}</style>

      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: isExpanded ? 520 : Math.max(minHeight, 200), flex: '1 1 auto', overflow: 'hidden', position: 'relative' }} />

      {/* Map Style Toggle — Dark / Light / Satellite */}
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1 bg-slate-900/90 backdrop-blur-md rounded-lg p-1 border border-slate-700 shadow-lg">
        {(['dark', 'light', 'satellite'] as MapStyleId[]).map((style) => (
          <button
            key={style}
            onClick={() => setMapStyle(style)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all capitalize ${
              mapStyle === style
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {style}
          </button>
        ))}
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            title="Fullscreen"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
            Full
          </button>
        )}
      </div>

      {/* Expand/Collapse Toggle */}
      {compact && onExpandToggle && (
        <button
          onClick={toggleExpand}
          className="absolute top-2 left-2 z-[1001] flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-slate-700 shadow-lg text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          title={isExpanded ? 'Collapse map' : 'Expand map'}
        >
          {isExpanded ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Shrink
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Expand
            </>
          )}
        </button>
      )}

      {/* Geofence Toggle + Re-center */}
      {(!compact || isExpanded) && (
        <div className={`absolute top-2 left-2 z-[1000] flex items-center gap-2 ${compact && onExpandToggle ? 'mt-9' : ''}`}>
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-slate-700 shadow-lg">
            <button
              onClick={() => setShowGeofences(!showGeofences)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 hover:text-white transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${showGeofences ? 'bg-green-400' : 'bg-slate-600'}`} />
              Geofences
            </button>
          </div>
          <button
            onClick={recenter}
            className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-slate-700 shadow-lg text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Auto-center on fleet"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Center
          </button>
        </div>
      )}

      {isTeaser && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm rounded-lg pointer-events-none z-[1002]" />
      )}
    </div>
  );
}
