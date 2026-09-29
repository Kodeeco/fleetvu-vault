'use client';

import React, { useState, useEffect, useRef } from 'react';
import { EDGE_FILTER_THRESHOLD_M } from '@/lib/edge-filter';
import { FLEETVU_COLORS } from '@/lib/constants';
import type { VehicleProfileKey } from '@/lib/types';
import { HazardSvgOverlay } from './hazard-overlay';
import type { HazardDetection } from '@/lib/hazard-detection';

interface RadarSweepCanvasProps {
  hardwareProfile: string;
  forwardRange: number;
  leftRange: number;
  rightRange: number;
  speedMph: number;
  proximityZone: 'green' | 'yellow' | 'red' | null;
  activeSensors: string[];
  vehicleType?: VehicleProfileKey;
  largeMode?: boolean;
  expandedMode?: boolean;
  hazards?: HazardDetection[];
  onHazardExpire?: (hazardId: string) => void;
  className?: string;
}

const FORWARD_COLOR = '#38BDF8';
const LATERAL_COLOR = '#60A5FA';
const FLEETVU_RED = '#EF4444';
const FLEETVU_YELLOW = '#F59E0B';
const FLEETVU_GREEN = '#22C55E';

const LATERAL_MAX_M = 8.0;
const FORWARD_MAX_M = 10.0;

// SVG viewBox is 0 0 1000 1000 — all coordinates are in this fixed space.
// Central bumper origin: top-dead-center of the front bumper.
const BUMPER_X = 500;
const BUMPER_Y = 900;

// Vehicle image fits inside viewBox. The truck image is centered horizontally
// at x=500 and positioned so the front bumper sits at y=900.
const VEHICLE_CENTER_X = 500;
const VEHICLE_CENTER_Y = 1080;
const VEHICLE_W = 190;
const VEHICLE_H = 360;
const VEHICLE_HALF_W = VEHICLE_W / 2;

// Pixels-per-meter in SVG coordinate space.
// 2.5m vehicle width maps to VEHICLE_W (190px), so 1m = 76 SVG units.
const PX_PER_M = 76;

// Distance ring radii (in SVG units) measured from bumper origin.
// Includes VEHICLE_HALF_W offset so rings clear the vehicle body.
const ringMeters = [1, 2, 3, 4, 6, 8, 10];
const ringRadii = ringMeters.map((m) => VEHICLE_HALF_W + m * PX_PER_M);

// Arc path helper — builds a wedge (pie slice) from origin to arc edge.
function arcPath(
  ox: number, oy: number,
  radius: number,
  startDeg: number, endDeg: number,
): string {
  const r = Math.max(0.5, radius);
  const startRad = ((startDeg - 90) * Math.PI) / 180;
  const endRad = ((endDeg - 90) * Math.PI) / 180;
  const x1 = ox + r * Math.cos(startRad);
  const y1 = oy + r * Math.sin(startRad);
  const x2 = ox + r * Math.cos(endRad);
  const y2 = oy + r * Math.sin(endRad);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${ox} ${oy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

// Stroke-only arc path (no fill wedge).
function arcStroke(
  ox: number, oy: number,
  radius: number,
  startDeg: number, endDeg: number,
): string {
  const r = Math.max(0.5, radius);
  const startRad = ((startDeg - 90) * Math.PI) / 180;
  const endRad = ((endDeg - 90) * Math.PI) / 180;
  const x1 = ox + r * Math.cos(startRad);
  const y1 = oy + r * Math.sin(startRad);
  const x2 = ox + r * Math.cos(endRad);
  const y2 = oy + r * Math.sin(endRad);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function RadarSweepCanvas({
  forwardRange,
  leftRange,
  rightRange,
  speedMph,
  proximityZone,
  largeMode = false,
  expandedMode = false,
  hazards = [],
  onHazardExpire,
  className,
}: RadarSweepCanvasProps) {
  const [sweepAngle, setSweepAngle] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);
  const animationRef = useRef<number>(0);
  const sweepRef = useRef(0);
  const pulseRef = useRef(0);

  useEffect(() => {
    const animate = () => {
      sweepRef.current += 0.025;
      pulseRef.current += 0.05;
      setSweepAngle(sweepRef.current);
      setPulsePhase(pulseRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  // ── Range calculations ──
  const fwdRangeM = Math.min(Math.max(0.5, forwardRange), FORWARD_MAX_M);
  const fwdRadius = VEHICLE_HALF_W + fwdRangeM * PX_PER_M;
  const fwdStartDeg = 240; // -120° from top → up-left
  const fwdEndDeg = 300;   // +120° from top → up-right (but in SVG, "up" is -y so 240-300 maps to forward)

  // Forward arc: 0° = up in our deg system. We want a cone pointing up (forward).
  // Using our convention: 270° = left, 0°/360° = up, 90° = right.
  // Forward cone: 315° to 45° (i.e. -45° to +45° from vertical up).
  const fwdStart = 315;
  const fwdEnd = 45;

  const leftRangeM = Math.min(Math.max(0.5, leftRange), LATERAL_MAX_M);
  const leftEdgeActive = leftRangeM > EDGE_FILTER_THRESHOLD_M;
  const leftRadius = VEHICLE_HALF_W + leftRangeM * PX_PER_M;
  // Left lateral: projects to the left side (180° to 270° in our convention)
  const leftStart = 180;
  const leftEnd = 270;

  const rightRangeM = Math.min(Math.max(0.5, rightRange), LATERAL_MAX_M);
  const rightEdgeActive = rightRangeM > EDGE_FILTER_THRESHOLD_M;
  const rightRadius = VEHICLE_HALF_W + rightRangeM * PX_PER_M;
  // Right lateral: projects to the right side (90° to 180° in our convention)
  const rightStart = 90;
  const rightEnd = 180;

  // Sweep line endpoint
  const sweepR = ringRadii[ringRadii.length - 1];
  const sweepEnd = polarToCart(BUMPER_X, BUMPER_Y, sweepR, ((sweepAngle * 180 / Math.PI) % 360));

  // Proximity pulse
  const proxPulse = (Math.sin(pulsePhase) + 1) / 2;

  // Sweep gradient stops — simulate the conic sweep with a rotating gradient overlay
  const sweepDeg = (sweepAngle * 180 / Math.PI) % 360;

  // Forward label position
  const fwdLabelPos = polarToCart(BUMPER_X, BUMPER_Y, fwdRadius + 20, 0);
  // Left label position
  const leftLabelPos = polarToCart(BUMPER_X, BUMPER_Y, leftRadius + 20, 225);
  // Right label position
  const rightLabelPos = polarToCart(BUMPER_X, BUMPER_Y, rightRadius + 20, 135);

  return (
    <svg
      viewBox="0 0 1000 1300"
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="fwdGradient" cx={BUMPER_X} cy={BUMPER_Y} r={fwdRadius} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={FORWARD_COLOR} stopOpacity={0.35} />
          <stop offset="100%" stopColor={FORWARD_COLOR} stopOpacity={0.03} />
        </radialGradient>
        <radialGradient id="leftGradient" cx={BUMPER_X} cy={BUMPER_Y} r={leftRadius} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={LATERAL_COLOR} stopOpacity={0.3} />
          <stop offset="100%" stopColor={LATERAL_COLOR} stopOpacity={0.03} />
        </radialGradient>
        <radialGradient id="rightGradient" cx={BUMPER_X} cy={BUMPER_Y} r={rightRadius} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={LATERAL_COLOR} stopOpacity={0.3} />
          <stop offset="100%" stopColor={LATERAL_COLOR} stopOpacity={0.03} />
        </radialGradient>
        <linearGradient id="truckShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D1D5DB" />
          <stop offset="100%" stopColor="#9CA3AF" />
        </linearGradient>
      </defs>

      {/* ── Background ── */}
      <rect x={0} y={0} width={1000} height={1300} fill="#0F172A" />

      {/* ── Crosshairs ── */}
      <line x1={BUMPER_X} y1={0} x2={BUMPER_X} y2={1300} stroke="rgba(148,163,184,0.08)" strokeWidth={1} />
      <line x1={0} y1={BUMPER_Y} x2={1000} y2={BUMPER_Y} stroke="rgba(148,163,184,0.08)" strokeWidth={1} />

      {/* ── Distance rings (centered on bumper origin) ── */}
      {/* Ring 1 — 1m solid */}
      <circle cx={BUMPER_X} cy={BUMPER_Y} r={ringRadii[0]} fill="none" stroke="rgba(249,115,22,0.4)" strokeWidth={1.5} />
      {/* 2m & 3m — subtle */}
      <circle cx={BUMPER_X} cy={BUMPER_Y} r={ringRadii[1]} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth={1} />
      <circle cx={BUMPER_X} cy={BUMPER_Y} r={ringRadii[2]} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth={1} />
      {/* 4m, 6m, 8m, 10m — solid orange */}
      {ringRadii.slice(3).map((r, i) => (
        <circle key={i} cx={BUMPER_X} cy={BUMPER_Y} r={r} fill="none" stroke="rgba(249,115,22,0.25)" strokeWidth={1.5} />
      ))}

      {/* Distance ring labels */}
      {ringMeters.map((m, i) => (
        <text
          key={m}
          x={BUMPER_X}
          y={BUMPER_Y - ringRadii[i] - 4}
          fill="rgba(249,115,22,0.6)"
          fontSize={largeMode ? 14 : 11}
          fontFamily="Inter, sans-serif"
          fontWeight="bold"
          textAnchor="middle"
        >
          {m}m
        </text>
      ))}

      {/* ── Dashed baseline at vehicle edge ── */}
      <circle
        cx={BUMPER_X} cy={BUMPER_Y} r={VEHICLE_HALF_W}
        fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth={1}
        strokeDasharray="6 6"
      />

      {/* ── Vehicle image (rotated 180° so front points up) ── */}
      <g transform={`translate(${VEHICLE_CENTER_X} ${VEHICLE_CENTER_Y}) rotate(180)`}>
        {/* Placeholder truck body */}
        <rect
          x={-VEHICLE_W / 2} y={-VEHICLE_H / 2}
          width={VEHICLE_W} height={VEHICLE_H}
          rx={8} fill="url(#truckShade)" stroke="#64748B" strokeWidth={2}
        />
        {/* Windshield */}
        <rect
          x={-VEHICLE_W * 0.35} y={-VEHICLE_H / 2 + 8}
          width={VEHICLE_W * 0.7} height={VEHICLE_H * 0.1}
          rx={3} fill="rgba(59,130,246,0.45)"
        />
        {/* Hood detail */}
        <rect
          x={-VEHICLE_W * 0.25} y={-VEHICLE_H / 2 + VEHICLE_H * 0.14}
          width={VEHICLE_W * 0.5} height={VEHICLE_H * 0.04}
          rx={2} fill="#475569"
        />
      </g>

      {/* ── FORWARD radar cone (Orange) — from bumper center, pointing up ── */}
      <path
        d={arcPath(BUMPER_X, BUMPER_Y, fwdRadius, fwdStart, fwdEnd)}
        fill="url(#fwdGradient)"
      />
      <path
        d={arcStroke(BUMPER_X, BUMPER_Y, fwdRadius, fwdStart, fwdEnd)}
        fill="none" stroke={FORWARD_COLOR} strokeWidth={2}
      />

      {/* ── LEFT lateral cone (Blue) — from bumper center, projecting left ── */}
      <path
        d={arcPath(BUMPER_X, BUMPER_Y, leftRadius, leftStart, leftEnd)}
        fill="url(#leftGradient)"
      />
      <path
        d={arcStroke(BUMPER_X, BUMPER_Y, leftRadius, leftStart, leftEnd)}
        fill="none" stroke={LATERAL_COLOR} strokeWidth={2}
      />
      {leftEdgeActive && (
        <g>
          <rect x={leftLabelPos.x - 52} y={leftLabelPos.y - 22} width={44} height={14} rx={3} fill="rgba(6,182,212,0.85)" />
          <text x={leftLabelPos.x - 30} y={leftLabelPos.y - 12} fill="#fff" fontSize={9} fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">EDGE</text>
        </g>
      )}

      {/* ── RIGHT lateral cone (Blue) — from bumper center, projecting right ── */}
      <path
        d={arcPath(BUMPER_X, BUMPER_Y, rightRadius, rightStart, rightEnd)}
        fill="url(#rightGradient)"
      />
      <path
        d={arcStroke(BUMPER_X, BUMPER_Y, rightRadius, rightStart, rightEnd)}
        fill="none" stroke={LATERAL_COLOR} strokeWidth={2}
      />
      {rightEdgeActive && (
        <g>
          <rect x={rightLabelPos.x + 8} y={rightLabelPos.y - 22} width={44} height={14} rx={3} fill="rgba(6,182,212,0.85)" />
          <text x={rightLabelPos.x + 30} y={rightLabelPos.y - 12} fill="#fff" fontSize={9} fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">EDGE</text>
        </g>
      )}

      {/* ── Sensor origin dot at bumper center ── */}
      <circle cx={BUMPER_X} cy={BUMPER_Y} r={4} fill={FORWARD_COLOR} opacity={0.8} />

      {/* ── Sweep line ── */}
      <line
        x1={BUMPER_X} y1={BUMPER_Y}
        x2={sweepEnd.x} y2={sweepEnd.y}
        stroke="rgba(249,115,22,0.5)" strokeWidth={2}
      />

      {/* ── Distance labels on arc edges ── */}
      {/* Forward label */}
      <rect
        x={fwdLabelPos.x - 30} y={fwdLabelPos.y - 12}
        width={60} height={24} rx={4}
        fill="rgba(15,23,42,0.85)"
      />
      <text
        x={fwdLabelPos.x} y={fwdLabelPos.y + 5}
        fill={FORWARD_COLOR}
        fontSize={largeMode ? 16 : 13}
        fontFamily="Inter, sans-serif"
        fontWeight="bold"
        textAnchor="middle"
      >
        {fwdRangeM.toFixed(1)}m
      </text>

      {/* Left label */}
      <rect
        x={leftLabelPos.x - 30} y={leftLabelPos.y - 12}
        width={60} height={24} rx={4}
        fill="rgba(15,23,42,0.85)"
      />
      <text
        x={leftLabelPos.x} y={leftLabelPos.y + 5}
        fill={LATERAL_COLOR}
        fontSize={largeMode ? 16 : 13}
        fontFamily="Inter, sans-serif"
        fontWeight="bold"
        textAnchor="middle"
      >
        {leftRangeM.toFixed(1)}m
      </text>

      {/* Right label */}
      <rect
        x={rightLabelPos.x - 30} y={rightLabelPos.y - 12}
        width={60} height={24} rx={4}
        fill="rgba(15,23,42,0.85)"
      />
      <text
        x={rightLabelPos.x} y={rightLabelPos.y + 5}
        fill={LATERAL_COLOR}
        fontSize={largeMode ? 16 : 13}
        fontFamily="Inter, sans-serif"
        fontWeight="bold"
        textAnchor="middle"
      >
        {rightRangeM.toFixed(1)}m
      </text>

      {/* ── Proximity alert pulse ── */}
      {proximityZone && (
        <circle
          cx={BUMPER_X} cy={BUMPER_Y}
          r={sweepR * 0.4 + proxPulse * 15}
          fill="none"
          stroke={
            proximityZone === 'red' ? FLEETVU_RED :
            proximityZone === 'yellow' ? FLEETVU_YELLOW :
            FLEETVU_GREEN
          }
          strokeWidth={3 + proxPulse * 3}
          opacity={0.3 + proxPulse * 0.4}
        />
      )}

      {/* ── Speed indicator ── */}
      <text
        x={16} y={1280}
        fill="rgba(148,163,184,0.7)"
        fontSize={largeMode ? 20 : 16}
        fontFamily="Inter, sans-serif"
        fontWeight="bold"
        textAnchor="start"
      >
        {speedMph.toFixed(0)} MPH
      </text>

      {/* ── North compass ── */}
      <text
        x={BUMPER_X} y={24}
        fill="rgba(148,163,184,0.6)"
        fontSize={14}
        fontFamily="Inter, sans-serif"
        fontWeight="bold"
        textAnchor="middle"
      >
        N
      </text>
      <polygon
        points={`${BUMPER_X},${30} ${BUMPER_X - 5},${38} ${BUMPER_X + 5},${38}`}
        fill="rgba(148,163,184,0.5)"
      />

      {/* ── Hazard detections overlay ── */}
      <HazardSvgOverlay
        hazards={hazards}
        onExpire={(id) => onHazardExpire?.(id)}
        largeMode={largeMode}
      />
    </svg>
  );
}
