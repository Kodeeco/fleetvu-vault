'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';

import { Radio, ArrowUp, ArrowLeft, ArrowRight, ArrowDown, Waves } from 'lucide-react';
import type { VehicleProfileKey } from '@/lib/types';
import { EDGE_FILTER_THRESHOLD_M } from '@/lib/edge-filter';

let _cabImg: HTMLImageElement | null = null;
let _cabImgLoading = false;
function getCabImage(): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  if (_cabImg) return _cabImg;
  if (_cabImgLoading) return null;
  _cabImgLoading = true;
  const img = new window.Image();
  img.src = '/Truck2.png';
  img.onload = () => { _cabImg = img; _cabImgLoading = false; };
  img.onerror = () => { _cabImgLoading = false; };
  return null;
}

type SensorDir = 'forward' | 'left' | 'right' | 'rear';

interface RangeConfig {
  forward: number;
  left: number;
  right: number;
  rear: number;
}

interface RadarVisualizerProps {
  vehicleType?: VehicleProfileKey;
  speedMph?: number;
  activeSensors: string[];
  hardwareProfile?: string;
  safetyScore?: number;
  location?: string;
  expandedMode?: boolean;
  showCanvasOverlays?: boolean;
  controls?: RadarControls;
}

export interface RadarControls {
  forwardDistance: number;
  setForwardDistance: React.Dispatch<React.SetStateAction<number>>;
  leftDistance: number;
  setLeftDistance: React.Dispatch<React.SetStateAction<number>>;
  rightDistance: number;
  setRightDistance: React.Dispatch<React.SetStateAction<number>>;
  rearDistance: number;
  setRearDistance: React.Dispatch<React.SetStateAction<number>>;
  gapRange: number;
  setGapRange: React.Dispatch<React.SetStateAction<number>>;
  laneChangeRange: number;
  setLaneChangeRange: React.Dispatch<React.SetStateAction<number>>;
}

export function useRadarControls() {
  const [forwardDistance, setForwardDistance] = useState(10.0);
  const [leftDistance, setLeftDistance] = useState(1.0);
  const [rightDistance, setRightDistance] = useState(1.0);
  const [rearDistance, setRearDistance] = useState(4);
  const [gapRange, setGapRange] = useState(1.5);
  const [laneChangeRange, setLaneChangeRange] = useState(27);
  return {
    forwardDistance, setForwardDistance,
    leftDistance, setLeftDistance,
    rightDistance, setRightDistance,
    rearDistance, setRearDistance,
    gapRange, setGapRange,
    laneChangeRange, setLaneChangeRange,
  };
}

const LOCKED_PX_PER_M = 30;

function statusLabel(dist: number, isLateral: boolean): { text: string; bg: string; text_color: string } {
  // Unified thresholds — CRITICAL < 1.0m, CAUTION 1.0–2.5m, CLEAR > 2.5m
  // EDGE (> 4.1m) is handled separately via isEdgeActive badge
  if (dist < 1.0) return { text: 'CRITICAL', bg: 'bg-red-500/20', text_color: 'text-red-400' };
  if (dist < 2.5) return { text: 'CAUTION', bg: 'bg-yellow-500/20', text_color: 'text-yellow-400' };
  return { text: 'CLEAR', bg: 'bg-green-500/20', text_color: 'text-green-400' };
}

export function RadarControlBar({
  controls,
  activeSensors,
  hardwareProfile,
}: {
  controls: RadarControls;
  activeSensors: string[];
  hardwareProfile?: string;
}) {
  const isC93Gap = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';
  const isLaneChange = activeSensors.some((s) => s === 'side_radar_left' || s === 'side_radar_right');

  const sensorDirs: Record<SensorDir, boolean> = {
    forward: activeSensors.some((s) => s === 'front_radar'),
    left: activeSensors.some((s) => s === 'left_radar' || s === 'side_radar_left' || s === 'side_ultrasonic_left'),
    right: activeSensors.some(
      (s) => s === 'right_radar' || s === 'side_radar_right' || s === 'side_ultrasonic_right' || s.startsWith('front_right_ultrasonic'),
    ),
    rear: activeSensors.some((s) => s === 'rear_radar'),
  };

  const distMap: Record<SensorDir, number> = {
    forward: controls.forwardDistance,
    left: controls.leftDistance,
    right: controls.rightDistance,
    rear: controls.rearDistance,
  };

  const updateRange = (dir: SensorDir, value: number) => {
    if (dir === 'forward') controls.setForwardDistance(value);
    else if (dir === 'left') controls.setLeftDistance(value);
    else if (dir === 'right') controls.setRightDistance(value);
    else if (dir === 'rear') controls.setRearDistance(value);
  };

  const activeDirs = (Object.keys(DIR_META) as SensorDir[]).filter((dir) => sensorDirs[dir]);

  return (
    <div className="flex items-stretch gap-1 p-1.5 bg-slate-950/95 backdrop-blur-md border-t border-slate-700/60 pointer-events-auto rounded-t-xl flex-wrap">
      {activeDirs.map((dir) => {
        const meta = DIR_META[dir];
        const isLateral = dir === 'left' || dir === 'right';
        const dist = distMap[dir];
        const proxColor = getProximityColor(dist, isLateral);
        const status = statusLabel(dist, isLateral);
        const isEdgeActive = isLateral && dist > EDGE_FILTER_THRESHOLD_M;
        const label = dir === 'forward' ? 'FRWD' : dir === 'left' ? 'LEFT' : dir === 'right' ? 'RIGHT' : 'REAR';
        // Customer / cab UI: only FORWARD · LEFT · RIGHT (no REAR channel)
        if (dir === 'rear') return null;
        return (
          <div key={dir} className={`flex flex-col gap-1 rounded-lg border px-2 py-1.5 min-w-[110px] flex-1 ${isEdgeActive ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-700/50 bg-slate-900/60'}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 min-h-[24px]">
              <span className="min-w-0 text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-start gap-0.5 leading-tight">
                {meta.icon} <span>{label}</span>
              </span>
              <div className="flex items-center gap-0.5 flex-nowrap justify-end self-start">
                {isEdgeActive && (
                  <span className="text-[7px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                    EDGE
                  </span>
                )}
                <span className={`text-[7px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full whitespace-nowrap ${status.bg} ${status.text_color}`}>
                  {status.text}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums leading-none whitespace-nowrap" style={{ color: proxColor }}>
                {dist.toFixed(1)}m
              </span>
              <Slider
                value={[dist]}
                onValueChange={(v) => updateRange(dir, v[0])}
                min={isLateral ? 0 : 0.5}
                max={meta.max}
                step={0.1}
                className="flex-1"
              />
            </div>
          </div>
        );
      })}
      {isC93Gap && (
        <div className="flex flex-col gap-0.5 rounded-lg border border-slate-700/50 bg-slate-900/60 px-2 py-1.5 min-w-[100px] flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <Waves className="w-3 h-3 inline" /> GAP
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">CLEAR</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums leading-none text-green-400 whitespace-nowrap">{controls.gapRange.toFixed(1)}m</span>
            <Slider value={[controls.gapRange]} onValueChange={(v) => controls.setGapRange(v[0])} min={1} max={3} step={0.5} className="flex-1" />
          </div>
        </div>
      )}
      {isLaneChange && (
        <div className="flex flex-col gap-0.5 rounded-lg border border-slate-700/50 bg-slate-900/60 px-2 py-1.5 min-w-[100px] flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <Radio className="w-3 h-3 inline" /> LANE CHG
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">ACTIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums leading-none text-blue-400 whitespace-nowrap">{Math.round(controls.laneChangeRange * 3.281)}ft</span>
            <Slider value={[controls.laneChangeRange]} onValueChange={(v) => controls.setLaneChangeRange(v[0])} min={3} max={27} step={0.5} className="flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}

const DIR_META: Record<SensorDir, { label: string; color: string; max: number; icon: React.ReactNode }> = {
  forward: { label: '10m FWD', color: '#F97316', max: 10, icon: <ArrowUp className="w-3 h-3" /> },
  left: { label: 'LEFT', color: '#3B82F6', max: 8, icon: <ArrowLeft className="w-3 h-3" /> },
  right: { label: 'RIGHT', color: '#3B82F6', max: 8, icon: <ArrowRight className="w-3 h-3" /> },
  rear: { label: '4m REAR', color: '#22C55E', max: 6, icon: <ArrowDown className="w-3 h-3" /> }
};

// ── Vehicle colors ──────────────────────────────────────────────
const CAB_COLOR = '#C8CDD6';       // light gray for power units
const CAB_STROKE = '#94A3B8';
const CAB_HOOD = '#B0B6C0';
const TRAILER_COLOR = '#FFFFFF';   // bright white for trailed units
const TRAILER_STROKE = '#CBD5E1';
const WHEEL_COLOR = '#1E293B';
const GLASS_COLOR = 'rgba(148, 163, 184, 0.35)';
const DETAIL_COLOR = '#64748B';
const EXHAUST_COLOR = '#475569';

// ── Vehicle geometry ────────────────────────────────────────────
interface VehicleGeom {
  cabFront: number;
  cabBack: number;
  cabCenterY: number;
  trailerBack: number;
  halfW: number;
  cabHalfW: number;
  hasTrailer: boolean;
}

function getVehicleGeom(vt: VehicleProfileKey, cx: number, cy: number, vehW: number, vehL: number): VehicleGeom {
  const halfL = vehL / 2;
  const halfW = vehW / 2;

  if (vt === 'class7_day_cab' || vt === 'commercial_van') {
    return {
      cabFront: cy - halfL,
      cabBack: cy + halfL,
      cabCenterY: cy,
      trailerBack: cy + halfL,
      halfW,
      cabHalfW: halfW * 0.9,
      hasTrailer: false,
    };
  }

  if (vt === 'class8_tractor_sleeper') {
    return {
      cabFront: cy - halfL,
      cabBack: cy + halfL,
      cabCenterY: cy,
      trailerBack: cy + halfL,
      halfW,
      cabHalfW: halfW * 0.85,
      hasTrailer: false,
    };
  }

  const cabRatio = vt === 'fuel_tanker' ? 0.30 : 0.28;
  const cabLen = vehL * cabRatio;
  return {
    cabFront: cy - halfL,
    cabBack: cy - halfL + cabLen,
    cabCenterY: cy - halfL + cabLen / 2,
    trailerBack: cy + halfL,
    halfW,
    cabHalfW: vehW * 0.41,
    hasTrailer: true,
  };
}

// ── Vehicle renderers ───────────────────────────────────────────

function drawCab(ctx: CanvasRenderingContext2D, cx: number, geom: VehicleGeom) {
  const { cabFront, cabBack, cabHalfW } = geom;
  const cabLen = cabBack - cabFront;
  const hoodLen = cabLen * 0.38;
  const hoodW = cabHalfW * 0.72;

  // Cab body
  ctx.fillStyle = CAB_COLOR;
  ctx.strokeStyle = CAB_STROKE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - cabHalfW, cabFront, cabHalfW * 2, cabLen, 4);
  ctx.fill();
  ctx.stroke();

  // Hood / grille
  ctx.fillStyle = CAB_HOOD;
  ctx.beginPath();
  ctx.roundRect(cx - hoodW / 2, cabFront, hoodW, hoodLen, 2);
  ctx.fill();

  ctx.strokeStyle = DETAIL_COLOR;
  ctx.lineWidth = 0.6;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - hoodW / 2 + 2, cabFront + (hoodLen / 4) * i);
    ctx.lineTo(cx + hoodW / 2 - 2, cabFront + (hoodLen / 4) * i);
    ctx.stroke();
  }

  // Windshield
  const wsY = cabFront + hoodLen;
  const wsH = cabLen * 0.14;
  ctx.fillStyle = GLASS_COLOR;
  ctx.beginPath();
  ctx.roundRect(cx - cabHalfW + 3, wsY, cabHalfW * 2 - 6, wsH, 1);
  ctx.fill();

  // Door split line
  ctx.strokeStyle = DETAIL_COLOR;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, wsY + wsH);
  ctx.lineTo(cx, cabBack);
  ctx.stroke();

  // Side mirrors
  ctx.fillStyle = CAB_COLOR;
  ctx.strokeStyle = CAB_STROKE;
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cx + side * (cabHalfW + 1), wsY + 1, 2.5, 5, 1);
    ctx.fill();
    ctx.stroke();
  }

  // Front wheels (fender wells)
  ctx.fillStyle = WHEEL_COLOR;
  const fwY = wsY + 2;
  const wW = 5, wL = 10;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cx + side * (cabHalfW - wW / 2 + 1), fwY, wW, wL, 1.5);
    ctx.fill();
  }

  // Exhaust stack (right side near cab back)
  ctx.fillStyle = EXHAUST_COLOR;
  ctx.beginPath();
  ctx.arc(cx + cabHalfW - 4, cabBack - 5, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoxTrailer(ctx: CanvasRenderingContext2D, cx: number, geom: VehicleGeom) {
  const { cabBack, trailerBack, halfW } = geom;
  const tLen = trailerBack - cabBack;

  // Trailer body — bright white
  ctx.fillStyle = TRAILER_COLOR;
  ctx.strokeStyle = TRAILER_STROKE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - halfW, cabBack, halfW * 2, tLen, 3);
  ctx.fill();
  ctx.stroke();

  // Rear door split
  ctx.strokeStyle = DETAIL_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, trailerBack - 3);
  ctx.lineTo(cx, cabBack + 4);
  ctx.stroke();

  // Rivet line along top edge
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - halfW + 3, cabBack + 6);
  ctx.lineTo(cx + halfW - 3, cabBack + 6);
  ctx.stroke();

  // Tandem rear wheels
  ctx.fillStyle = WHEEL_COLOR;
  const wW = 5, wL = 10;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.roundRect(cx + side * (halfW - wW / 2), trailerBack - 30 + i * 13, wW, wL, 1.5);
      ctx.fill();
    }
  }
}

function drawTanker(ctx: CanvasRenderingContext2D, cx: number, geom: VehicleGeom) {
  const { cabBack, trailerBack, halfW } = geom;
  const tLen = trailerBack - cabBack;
  const r = halfW; // tanker radius

  // Tanker body — bright white, rounded capsule
  ctx.fillStyle = TRAILER_COLOR;
  ctx.strokeStyle = TRAILER_STROKE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - r, cabBack, r * 2, tLen, r);
  ctx.fill();
  ctx.stroke();

  // Dome caps (circles along the top)
  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = TRAILER_STROKE;
  ctx.lineWidth = 1;
  const domeCount = 3;
  for (let i = 0; i < domeCount; i++) {
    const dy = cabBack + (tLen / (domeCount + 1)) * (i + 1);
    ctx.beginPath();
    ctx.arc(cx, dy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Center seam line
  ctx.strokeStyle = DETAIL_COLOR;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, cabBack + 6);
  ctx.lineTo(cx, trailerBack - 6);
  ctx.stroke();

  // Rear wheels
  ctx.fillStyle = WHEEL_COLOR;
  const wW = 5, wL = 10;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.roundRect(cx + side * (r - wW / 2), trailerBack - 30 + i * 13, wW, wL, 1.5);
      ctx.fill();
    }
  }
}

function drawFlatbed(ctx: CanvasRenderingContext2D, cx: number, geom: VehicleGeom) {
  const { cabBack, trailerBack, halfW } = geom;
  const tLen = trailerBack - cabBack;

  // Flatbed deck — white
  ctx.fillStyle = TRAILER_COLOR;
  ctx.strokeStyle = TRAILER_STROKE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - halfW * 0.85, cabBack, halfW * 1.7, tLen, 2);
  ctx.fill();
  ctx.stroke();

  // Deck plank lines
  ctx.strokeStyle = DETAIL_COLOR;
  ctx.lineWidth = 0.4;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - halfW * 0.85 + 2, cabBack + (tLen / 7) * i);
    ctx.lineTo(cx + halfW * 0.85 - 2, cabBack + (tLen / 7) * i);
    ctx.stroke();
  }

  // Rear wheels
  ctx.fillStyle = WHEEL_COLOR;
  const wW = 5, wL = 10;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.roundRect(cx + side * (halfW * 0.85 - wW / 2), trailerBack - 30 + i * 13, wW, wL, 1.5);
      ctx.fill();
    }
  }
}

function drawStraightBox(ctx: CanvasRenderingContext2D, cx: number, cy: number, vehW: number, vehL: number) {
  const halfW = vehW / 2;
  const halfL = vehL / 2;
  const cabLen = vehL * 0.3;
  const cabFront = cy - halfL;
  const cabBack = cabFront + cabLen;
  const boxBack = cy + halfL;
  const cabHalfW = halfW * 0.82;

  // Box body — white
  ctx.fillStyle = TRAILER_COLOR;
  ctx.strokeStyle = TRAILER_STROKE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - halfW, cabBack, halfW * 2, boxBack - cabBack, 2);
  ctx.fill();
  ctx.stroke();

  // Cab — light gray, integrated
  const geom: VehicleGeom = {
    cabFront, cabBack, cabCenterY: (cabFront + cabBack) / 2,
    trailerBack: boxBack, halfW, cabHalfW, hasTrailer: true,
  };
  drawCab(ctx, cx, geom);

  // Rear wheels on box
  ctx.fillStyle = WHEEL_COLOR;
  const wW = 5, wL = 10;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cx + side * (halfW - wW / 2), boxBack - 20, wW, wL, 1.5);
    ctx.fill();
  }
}

function drawVan(ctx: CanvasRenderingContext2D, cx: number, cy: number, vehW: number, vehL: number) {
  const halfW = vehW / 2;
  const halfL = vehL / 2;

  // Van body — light gray (it's a single power unit)
  ctx.fillStyle = CAB_COLOR;
  ctx.strokeStyle = CAB_STROKE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - halfW, cy - halfL, halfW * 2, vehL, 5);
  ctx.fill();
  ctx.stroke();

  // Windshield
  const wsH = vehL * 0.12;
  ctx.fillStyle = GLASS_COLOR;
  ctx.beginPath();
  ctx.roundRect(cx - halfW + 3, cy - halfL + 3, halfW * 2 - 6, wsH, 1);
  ctx.fill();

  // Door line
  ctx.strokeStyle = DETAIL_COLOR;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfL + wsH + 5);
  ctx.lineTo(cx, cy + halfL - 5);
  ctx.stroke();

  // Wheels
  ctx.fillStyle = WHEEL_COLOR;
  const wW = 5, wL = 9;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cx + side * (halfW - wW / 2), cy - halfL + vehL * 0.2, wW, wL, 1.5);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + side * (halfW - wW / 2), cy + halfL - vehL * 0.2 - wL, wW, wL, 1.5);
    ctx.fill();
  }
}

interface VehicleRenderBounds {
  frontGrilleY: number;
  rearY: number;
  halfWidth: number;
  centerX: number;
  centerY: number;
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  vt: VehicleProfileKey,
  cx: number,
  cy: number,
  vehW: number,
  vehL: number,
): VehicleRenderBounds {
  const img = getCabImage();
  if (img && img.complete && img.naturalWidth > 0) {
    // Scale image to fill the physical 2.5m width
    const targetW = vehW; // 75px = 2.5m
    const targetL = vehL;
    const scale = Math.min(targetW / img.naturalWidth, targetL / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return {
      frontGrilleY: cy - dh / 2,
      rearY: cy + dh / 2,
      halfWidth: dw / 2,
      centerX: cx,
      centerY: cy,
    };
  }
  const geom = getVehicleGeom(vt, cx, cy, vehW, vehL);
  drawCab(ctx, cx, geom);
  return {
    frontGrilleY: geom.cabFront,
    rearY: geom.trailerBack,
    halfWidth: geom.cabHalfW,
    centerX: cx,
    centerY: cy,
  };
}

// ── C55-PRO wave renderers ──────────────────────────────────────

function drawC55ForwardParabolic(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  rangeM: number,
  pxPerMeter: number,
  color: string,
  animPhase: number,
) {
  const maxRadius = Math.min(rangeM, 10.0) * pxPerMeter;
  if (maxRadius < 1) return;
  // Cone half-width is the sensor field-of-view in meters, scaled 1:1 with pxPerMeter
  // Forward cone spans ~1.3m half-width (typical radar FOV), matching lateral scale
  const coneHalfWidth = 1.3 * pxPerMeter;

  // Concentric parabolic arcs expanding outward from grille center
  const arcCount = 4;
  for (let i = 0; i < arcCount; i++) {
    const t = (i + 1) / arcCount;
    const r = maxRadius * t;
    const alpha = 0.35 - t * 0.22;
    const wobble = Math.sin(animPhase + i * 0.6) * 1.5;

    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = 2 - t;
    ctx.beginPath();
    const steps = 24;
    for (let s = 0; s <= steps; s++) {
      const u = (s / steps) * 2 - 1;
      const x = originX + u * coneHalfWidth * (0.3 + t * 0.7);
      const y = originY - r + wobble * (1 - t);
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Filled gradient cone — depth terminates exactly at maxRadius (1:1 with slider)
  const gradient = ctx.createRadialGradient(originX, originY, 0, originX, originY, maxRadius);
  gradient.addColorStop(0, hexToRgba(color, 0.28));
  gradient.addColorStop(0.6, hexToRgba(color, 0.08));
  gradient.addColorStop(1, hexToRgba(color, 0.01));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX - coneHalfWidth, originY - maxRadius);
  ctx.quadraticCurveTo(originX, originY - maxRadius, originX + coneHalfWidth, originY - maxRadius);
  ctx.closePath();
  ctx.fill();

  // Precise edge line at exact slider distance (1:1, no overshoot)
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(originX - coneHalfWidth, originY - maxRadius);
  ctx.quadraticCurveTo(originX, originY - maxRadius, originX + coneHalfWidth, originY - maxRadius);
  ctx.stroke();

  // Origin pulse dot
  const pulse = (Math.sin(animPhase * 2) + 1) / 2;
  ctx.fillStyle = hexToRgba(color, 0.6 + pulse * 0.4);
  ctx.beginPath();
  ctx.arc(originX, originY, 3 + pulse * 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawC55LateralElliptical(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  rangeM: number,
  pxPerMeter: number,
  color: string,
  animPhase: number,
  side: 'left' | 'right',
) {
  const maxRadius = Math.min(rangeM, 8.0) * pxPerMeter;
  if (maxRadius < 1) return;
  const dir = side === 'left' ? -1 : 1;

  // True 1:1 px/m — lateral extent equals maxRadius (same scale as forward depth)
  // Field-of-view: lateral sensors span ~1.3m vertically (matching forward cone width)
  const lateralFOV = 1.3 * pxPerMeter;

  // Concentric semicircular ripples expanding outward — 1:1 radius
  const rippleCount = 3;
  for (let i = 0; i < rippleCount; i++) {
    const t = (i + 1) / rippleCount;
    const r = maxRadius * t;
    const alpha = 0.35 - t * 0.18;
    const wobble = Math.sin(animPhase + i * 0.8) * 1.0;

    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = 2 - t * 0.5;
    ctx.beginPath();
    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      const u = (s / steps) * Math.PI;
      const rx = dir * r * Math.sin(u);
      const ry = (lateralFOV * t + wobble) * Math.cos(u);
      const x = originX + rx;
      const y = originY + ry;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Filled gradient — semicircle extending full maxRadius horizontally (1:1)
  const gradient = ctx.createRadialGradient(originX, originY, 0, originX, originY, maxRadius);
  gradient.addColorStop(0, hexToRgba(color, 0.25));
  gradient.addColorStop(1, hexToRgba(color, 0.02));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(originX + dir * maxRadius * 0.5, originY, maxRadius * 0.5, lateralFOV * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── Component ───────────────────────────────────────────────────

export function RadarVisualizer({
  vehicleType = 'class8_tractor_sleeper',
  speedMph = 42,
  activeSensors,
  hardwareProfile,
  safetyScore,
  location,
  expandedMode = false,
  showCanvasOverlays = false,
  controls: externalControls,
}: RadarVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const sweepAngleRef = useRef<number>(0);

  const isC55Pro = hardwareProfile?.startsWith('c55_pro') ?? false;
  const isC93Gap = hardwareProfile === 'c93_us4_gap' || hardwareProfile === 'c93_us4_gap_lane';
  const isLaneChange = activeSensors.some((s) => s === 'side_radar_left' || s === 'side_radar_right');

  const localControls = useRadarControls();
  const controls = externalControls || localControls;
  const { forwardDistance, leftDistance, rightDistance, rearDistance, gapRange, laneChangeRange } = controls;
  const ranges: RangeConfig = { forward: forwardDistance, left: leftDistance, right: rightDistance, rear: rearDistance };

  const sensorDirs: Record<SensorDir, boolean> = {
    forward: activeSensors.some((s) => s === 'front_radar'),
    left: activeSensors.some((s) => s === 'left_radar' || s === 'side_radar_left' || s === 'side_ultrasonic_left'),
    right: activeSensors.some(
      (s) => s === 'right_radar' || s === 'side_radar_right' || s === 'side_ultrasonic_right' || s.startsWith('front_right_ultrasonic'),
    ),
    rear: activeSensors.some((s) => s === 'rear_radar'),
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const vehL = expandedMode ? 260 : 190;
    // Physical truck width = 2.5m → 1.25m from center grille to each fender edge
    const vehW = 2.5 * LOCKED_PX_PER_M; // 75px = 2.5m at 30px/m
    const halfW = vehW / 2; // 37.5px = 1.25m

    // Pre-compute actual rendered image half-height so scale accounts for real asset size
    const img = getCabImage();
    const hasImg = !!(img && img.complete && img.naturalWidth > 0);
    const imgScale = hasImg ? Math.min(vehW / img!.naturalWidth, vehL / img!.naturalHeight) : 0;
    const vehHalfH = hasImg ? (img!.naturalHeight * imgScale) / 2 : vehL / 2;

    // Shift vehicle down significantly to give ample vertical headroom for full forward sensor range
    const cy = h * 0.7;
    // Locked px-per-meter — no cross-talk between forward and lateral zones
    const pxPerMeter = LOCKED_PX_PER_M;
    const clampedPxPerMeter = LOCKED_PX_PER_M;
    const maxRadius = Math.min(w, h) / 2 - 10;

    ctx.clearRect(0, 0, w, h);

    const geom = getVehicleGeom(vehicleType, cx, cy, vehW, vehL);

    const focalRangeM = isLaneChange
      ? Math.max(laneChangeRange, 4)
      : isC93Gap
        ? Math.max(gapRange, 3)
        : Math.max(...Object.values(ranges), 4);

    // Lateral scaling is locked independently — forward slider changes don't affect lateral zones
    const lateralPxPerMeter = LOCKED_PX_PER_M;

    // Draw vehicle first so we can use actual rendered bounds for ring and sensor calculations
    const vehBounds = drawVehicle(ctx, vehicleType, cx, cy, vehW, vehL);
    const grilleY = vehBounds.frontGrilleY;
    const grilleHalfW = vehBounds.halfWidth;
    const cabLen = vehBounds.rearY - grilleY;
    const hoodMidY = grilleY + cabLen * 0.12;

    // Range rings — measured from the front bumper (grilleY), not vehicle center
    // Rings at 1m, 2m, 3m, 4m, then every 2m beyond
    // Arcs are centered on the vehicle center but with radius = bumperOffset + N*pxPerMeter
    // so they visually sit at the correct distance from the grille
    const bumperOffset = cy - grilleY; // distance from vehicle center to front bumper in px
    const ringRadii: number[] = [
      bumperOffset + 1.0 * clampedPxPerMeter,  // 1m from grille
      bumperOffset + 2.0 * clampedPxPerMeter,  // 2m from grille
      bumperOffset + 3.0 * clampedPxPerMeter,  // 3m from grille
      bumperOffset + 4.0 * clampedPxPerMeter,  // 4m from grille
    ];
    // Add outer rings in 2m increments beyond 4m up to focalRangeM
    for (let m = 6; m <= focalRangeM; m += 2) {
      ringRadii.push(bumperOffset + m * clampedPxPerMeter);
    }

    // Ring 1 (1m) — solid, slightly brighter (cyan — matches Bolt Command HUD)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    if (ringRadii[0] !== undefined) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadii[0], 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2m and 3m — subtle interim rings
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    for (let i = 1; i <= 2 && i < ringRadii.length; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadii[i], 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ring 2 (4m) and outer rings — cyan arcs
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    for (let i = 3; i < ringRadii.length; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadii[i], 0, Math.PI * 2);
      ctx.stroke();
    }

    // Dashed baseline at vehicle edge
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, halfW, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance labels on rings — placed at the grille line (top of each ring)
    ctx.font = 'bold 8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(125, 211, 252, 0.65)';
    const ringLabels = [1, 2, 3, 4, 6, 8, 10];
    for (let i = 0; i < ringLabels.length && i < ringRadii.length; i++) {
      ctx.fillText(`${ringLabels[i]}m`, cx, cy - ringRadii[i] - 2);
    }

    // Crosshairs
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - maxRadius);
    ctx.lineTo(cx, cy + maxRadius);
    ctx.moveTo(cx - maxRadius, cy);
    ctx.lineTo(cx + maxRadius, cy);
    ctx.stroke();

    // Bumper line with fender edge markers at 1.25m from center
    const fenderHalfW = 1.25 * clampedPxPerMeter; // 37.5px = 1.25m
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - fenderHalfW, grilleY);
    ctx.lineTo(cx + fenderHalfW, grilleY);
    ctx.stroke();
    // Fender edge tick marks
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * fenderHalfW, grilleY - 5);
      ctx.lineTo(cx + side * fenderHalfW, grilleY + 5);
      ctx.stroke();
    }
    // Fender edge labels
    ctx.font = 'bold 7px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fillText('1.25m', cx - fenderHalfW - 10, grilleY + 3);
    ctx.fillText('1.25m', cx + fenderHalfW + 10, grilleY + 3);

    // Draw sensor arcs — origins aligned to vehicle physical edges
    const animPhase = sweepAngleRef.current;

    // C55-PRO: forward from front bumper center, left/right from mirror mounts
    if (isC55Pro) {
      // All 3 sensors converge at the front bumper center (top dead center)
      const bumperOriginX = cx;
      const bumperOriginY = grilleY;

      if (sensorDirs.forward) {
        const fwdColor = getProximityColor(ranges.forward, false);
        drawC55ForwardParabolic(ctx, bumperOriginX, bumperOriginY, ranges.forward, clampedPxPerMeter, fwdColor, animPhase);
      }

      if (sensorDirs.left) {
        const leftColor = getProximityColor(ranges.left, true);
        const leftOriginX = cx;
        drawC55LateralElliptical(ctx, leftOriginX, grilleY, Math.min(ranges.left, 8.0), lateralPxPerMeter, leftColor, animPhase, 'left');
        ctx.fillStyle = leftColor;
        ctx.beginPath();
        ctx.arc(leftOriginX, grilleY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sensorDirs.right) {
        const rightColor = getProximityColor(ranges.right, true);
        const rightOriginX = cx;
        drawC55LateralElliptical(ctx, rightOriginX, grilleY, Math.min(ranges.right, 8.0), lateralPxPerMeter, rightColor, animPhase, 'right');
        ctx.fillStyle = rightColor;
        ctx.beginPath();
        ctx.arc(rightOriginX, grilleY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dynamic distance labels at sensor arc edges
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (sensorDirs.forward) {
        const fwdRange = Math.min(ranges.forward, 10.0);
        const fwdPx = fwdRange * clampedPxPerMeter;
        const labelY = bumperOriginY - fwdPx - 10;
        const fwdColor = getProximityColor(ranges.forward, false);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        const labelText = `${fwdRange.toFixed(1)}m`;
        const tw = ctx.measureText(labelText).width;
        ctx.fillRect(cx - tw / 2 - 4, labelY - 7, tw + 8, 14);
        ctx.fillStyle = fwdColor;
        ctx.fillText(labelText, cx, labelY);
      }
      if (sensorDirs.left) {
        const lRange = Math.min(ranges.left, 8.0);
        const lPx = lRange * lateralPxPerMeter;
        const leftColor = getProximityColor(ranges.left, true);
        const labelX = cx - lPx * 0.55 - 14;
        const labelText = `${lRange.toFixed(1)}m`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        const tw = ctx.measureText(labelText).width;
        ctx.fillRect(labelX - tw / 2 - 4, grilleY - 7, tw + 8, 14);
        ctx.fillStyle = leftColor;
        ctx.fillText(labelText, labelX, grilleY);
      }
      if (sensorDirs.right) {
        const rRange = Math.min(ranges.right, 8.0);
        const rPx = rRange * lateralPxPerMeter;
        const rightColor = getProximityColor(ranges.right, true);
        const labelX = cx + rPx * 0.55 + 14;
        const labelText = `${rRange.toFixed(1)}m`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        const tw = ctx.measureText(labelText).width;
        ctx.fillRect(labelX - tw / 2 - 4, grilleY - 7, tw + 8, 14);
        ctx.fillStyle = rightColor;
        ctx.fillText(labelText, labelX, grilleY);
      }
    } else {
    (Object.keys(sensorDirs) as SensorDir[]).forEach((dir) => {
      if (!sensorDirs[dir]) return;
      // C93-GAP mode: skip standard lateral arcs, render dedicated gap beams below
      if (isC93Gap && (dir === 'left' || dir === 'right') && !isLaneChange) return;
      // Lane-change mode: use dedicated rearward arcs instead of standard lateral
      if (isLaneChange && (dir === 'left' || dir === 'right') && activeSensors.includes(dir === 'left' ? 'side_radar_left' : 'side_radar_right')) {
        const lcRange = laneChangeRange;
        const lcArcRadius = lcRange * clampedPxPerMeter;
        if (lcArcRadius < 1) return;
        const meta = DIR_META[dir];
        const lcOriginX = cx;
        const lcOriginY = grilleY;
        // Rearward-facing arc along the flank (90° to 180° from lateral)
        const lcStartDeg = dir === 'left' ? 95 : 265;
        const lcEndDeg = dir === 'left' ? 175 : 185;
        const lcStartRad = ((lcStartDeg - 90) * Math.PI) / 180;
        const lcEndRad = ((lcEndDeg - 90) * Math.PI) / 180;

        const lcGradient = ctx.createRadialGradient(lcOriginX, lcOriginY, 0, lcOriginX, lcOriginY, lcArcRadius);
        lcGradient.addColorStop(0, hexToRgba(meta.color, 0.3));
        lcGradient.addColorStop(1, hexToRgba(meta.color, 0.02));

        ctx.fillStyle = lcGradient;
        ctx.beginPath();
        ctx.moveTo(lcOriginX, lcOriginY);
        ctx.arc(lcOriginX, lcOriginY, lcArcRadius, lcStartRad, lcEndRad);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lcOriginX, lcOriginY, lcArcRadius, lcStartRad, lcEndRad);
        ctx.stroke();
        return;
      }

      const range = ranges[dir];
      const isLateral = dir === 'left' || dir === 'right';
      const cappedRange = isLateral ? Math.min(range, 8.0) : range;
      const arcRadius = cappedRange * clampedPxPerMeter;
      if (arcRadius < 1) return;

      const proxColor = getProximityColor(range, isLateral);
      let originX = cx;
      let originY = cy;
      let startDeg = 0;
      let endDeg = 0;

      if (dir === 'forward') {
        originX = cx;
        originY = grilleY;
        startDeg = 315; endDeg = 405;
      } else if (dir === 'rear') {
        originY = vehBounds.rearY;
        startDeg = 145; endDeg = 215;
      } else if (dir === 'left') {
        originX = cx;
        originY = grilleY;
        startDeg = 180; endDeg = 270;
      } else if (dir === 'right') {
        originX = cx;
        originY = grilleY;
        startDeg = 90; endDeg = 180;
      }

      const startRad = ((startDeg - 90) * Math.PI) / 180;
      const endRad = ((endDeg - 90) * Math.PI) / 180;

      const renderRadius = arcRadius;
      const gradient = ctx.createRadialGradient(originX, originY, 0, originX, originY, renderRadius);
      gradient.addColorStop(0, hexToRgba(proxColor, 0.35));
      gradient.addColorStop(1, hexToRgba(proxColor, 0.03));

      if (dir === 'left' || dir === 'right') {
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.arc(originX, originY, renderRadius, startRad, endRad);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = proxColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(originX, originY, renderRadius, startRad, endRad);
        ctx.stroke();

        // Sensor node dot at bumper center
        ctx.fillStyle = proxColor;
        ctx.beginPath();
        ctx.arc(originX, originY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // EDGE ACTIVE badge when lateral range > 4.1m
        if (cappedRange > EDGE_FILTER_THRESHOLD_M) {
          const badgeAngle = dir === 'left' ? 135 : 45;
          const badgeRad = (badgeAngle * Math.PI) / 180;
          const badgeX = originX + renderRadius * 0.75 * Math.cos(badgeRad);
          const badgeY = originY + renderRadius * 0.75 * Math.sin(badgeRad);
          ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
          ctx.fillRect(badgeX - 16, badgeY - 7, 32, 14);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('EDGE', badgeX, badgeY);
        }
      } else {
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.arc(originX, originY, renderRadius, startRad, endRad);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = proxColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(originX, originY, renderRadius, startRad, endRad);
        ctx.stroke();

        // For forward arc: draw precise termination line at exact slider distance from bumper
        if (dir === 'forward') {
          const termY = originY - renderRadius;
          ctx.strokeStyle = proxColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          // Horizontal termination line spanning the 90° forward cone
          const termHalfW = renderRadius * 0.42;
          ctx.moveTo(originX - termHalfW, termY);
          ctx.lineTo(originX + termHalfW, termY);
          ctx.stroke();

          // Distance label at the termination line
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          const labelText = `${range.toFixed(1)}m`;
          const tw = ctx.measureText(labelText).width;
          ctx.fillRect(originX - tw / 2 - 4, termY - 18, tw + 8, 14);
          ctx.fillStyle = proxColor;
          ctx.fillText(labelText, originX, termY - 11);
        }
      }
    });
    } // end non-C55-PRO sensor block

    // C93-GAP: render 4 narrow ultrasonic beams at front-right fender well
    if (isC93Gap) {
      const gapArcRadius = gapRange * clampedPxPerMeter;
      if (gapArcRadius >= 1) {
        const cabLen = vehBounds.rearY - grilleY;
        const gapNodes = [
          { y: grilleY, startDeg: 350, endDeg: 370 },
          { y: grilleY + cabLen * 0.2, startDeg: 355, endDeg: 375 },
          { y: grilleY + cabLen * 0.45, startDeg: 0, endDeg: 20 },
          { y: grilleY + cabLen * 0.7, startDeg: 5, endDeg: 25 },
        ];
        gapNodes.forEach((node) => {
          const gOriginX = cx + grilleHalfW;
          const gOriginY = node.y;
          const gStartRad = ((node.startDeg - 90) * Math.PI) / 180;
          const gEndRad = ((node.endDeg - 90) * Math.PI) / 180;

          const gGradient = ctx.createRadialGradient(gOriginX, gOriginY, 0, gOriginX, gOriginY, gapArcRadius);
          gGradient.addColorStop(0, hexToRgba('#22C55E', 0.4));
          gGradient.addColorStop(1, hexToRgba('#22C55E', 0.03));

          ctx.fillStyle = gGradient;
          ctx.beginPath();
          ctx.moveTo(gOriginX, gOriginY);
          ctx.arc(gOriginX, gOriginY, gapArcRadius, gStartRad, gEndRad);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(gOriginX, gOriginY, gapArcRadius, gStartRad, gEndRad);
          ctx.stroke();

          // Sensor node dot
          ctx.fillStyle = '#22C55E';
          ctx.beginPath();
          ctx.arc(gOriginX, gOriginY, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Sweep animation
    sweepAngleRef.current += 0.025;
    const sweepAngle = sweepAngleRef.current;
    const sweepR = halfW + focalRangeM * clampedPxPerMeter;

    if (ctx.createConicGradient) {
      const sweepGradient = ctx.createConicGradient(sweepAngle, cx, cy);
      sweepGradient.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      sweepGradient.addColorStop(0.1, 'rgba(56, 189, 248, 0.06)');
      sweepGradient.addColorStop(0.15, 'rgba(56, 189, 248, 0)');
      sweepGradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = sweepGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, sweepR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * sweepR, cy + Math.sin(sweepAngle) * sweepR);
    ctx.stroke();

    animationRef.current = requestAnimationFrame(draw);
  }, [forwardDistance, leftDistance, rightDistance, rearDistance, sensorDirs, speedMph, expandedMode, vehicleType, isC55Pro, isC93Gap, isLaneChange, gapRange, laneChangeRange]);

  useEffect(() => {
    getCabImage();
    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [draw]);


  return (
    <div className="relative w-full h-full flex flex-col pt-0 mt-0" style={{ paddingTop: 0, marginTop: 0 }}>
      {/* Peripheral status bar — above canvas, keeps stage unobstructed */}
      {showCanvasOverlays && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700 bg-slate-800/60">
          <div className="flex items-center gap-3 text-xs">
            {location && <span className="text-slate-400">{location}</span>}
          </div>
          <span className="flex items-center gap-1 text-green-400 font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
        </div>
      )}

      <div className="flex-1 relative bg-slate-900 overflow-visible min-h-0">
        <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block', position: 'relative', zIndex: 20, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getProximityColor(dist: number, isLateral: boolean): string {
  // Unified thresholds — same for both forward and lateral
  // CRITICAL: < 1.0m (close proximity)
  // CAUTION:  1.0m – 2.5m
  // SAFE:     2.5m – 4.1m
  // EDGE:     > 4.1m (handled separately with EDGE badge, color stays green)
  if (dist < 1.0) return '#EF4444';
  if (dist < 2.5) return '#F59E0B';
  return '#22C55E';
}
