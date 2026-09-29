'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PersonStanding,
  Car,
  Bike,
  AlertTriangle,
  Truck,
} from 'lucide-react';
import {
  type HazardDetection,
  type HazardType,
  hazardToSvgPos,
  hazardIconLabel,
  hazardColor,
  isHazardExpired,
} from '@/lib/hazard-detection';

/**
 * Hazard Overlay — renders on top of the RadarSweepCanvas SVG.
 *
 * When a hazard is detected in a zone, an icon pops up at the exact
 * detected position (distance + angle) for ~5 seconds with a date/time
 * stamp and zone info, then fades out.
 *
 * Must be rendered as a child of the same SVG element as the radar canvas
 * so coordinates align (viewBox 0 0 1000 1300).
 */

const BUMPER_X = 500;
const BUMPER_Y = 900;
const PX_PER_M = 76;
const VEHICLE_HALF_W = 95;

export interface HazardOverlayProps {
  hazards: HazardDetection[];
  onExpire: (hazardId: string) => void;
  largeMode?: boolean;
}

export function HazardSvgOverlay({ hazards, onExpire, largeMode = false }: HazardOverlayProps) {
  const [, setTick] = useState(0);

  // Re-render every 100ms to check expiry
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      const now = Date.now();
      hazards.forEach((h) => {
        if (isHazardExpired(h, now)) {
          onExpire(h.id);
        }
      });
    }, 100);
    return () => clearInterval(interval);
  }, [hazards, onExpire]);

  return (
    <>
      {hazards.map((hazard) => {
        const pos = hazardToSvgPos(hazard, BUMPER_X, BUMPER_Y, PX_PER_M, VEHICLE_HALF_W);
        const color = hazardColor(hazard.type);
        const now = Date.now();
        const remainingMs = new Date(hazard.expiresAt).getTime() - now;
        const totalMs = 5000;
        const progress = Math.max(0, Math.min(1, remainingMs / totalMs));
        const opacity = progress < 0.2 ? progress / 0.2 : 1; // fade out in last 20%
        const scale = progress > 0.8 ? 1 + (1 - progress) * 2 : 1; // pop-in animation

        const iconSize = largeMode ? 36 : 28;
        const labelFontSize = largeMode ? 11 : 9;
        const stampFontSize = largeMode ? 8 : 7;

        const detectedTime = new Date(hazard.detectedAt);
        const timeStr = detectedTime.toLocaleTimeString('en-US', { hour12: false });

        return (
          <g
            key={hazard.id}
            transform={`translate(${pos.x} ${pos.y}) scale(${scale})`}
            opacity={opacity}
            style={{ transition: 'opacity 0.3s ease-out' }}
          >
            {/* Pulsing ring around the hazard */}
            <circle
              cx={0} cy={0}
              r={iconSize * 0.8 + Math.sin(now / 200) * 4}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={0.5}
            />

            {/* Background circle */}
            <circle
              cx={0} cy={0}
              r={iconSize * 0.65}
              fill={color}
              opacity={0.9}
            />

            {/* Icon */}
            <g transform={`translate(${-iconSize / 2} ${-iconSize / 2})`}>
              <HazardIcon type={hazard.type} size={iconSize} color="#FFFFFF" />
            </g>

            {/* Label badge */}
            <g transform={`translate(0 ${iconSize * 0.7})`}>
              <rect
                x={-50} y={-2}
                width={100} height={16}
                rx={4}
                fill="rgba(15,23,42,0.92)"
                stroke={color}
                strokeWidth={1}
              />
              <text
                x={0} y={9}
                fill={color}
                fontSize={labelFontSize}
                fontFamily="Inter, sans-serif"
                fontWeight="bold"
                textAnchor="middle"
              >
                {hazardIconLabel(hazard.type)}
              </text>
            </g>

            {/* Zone + distance info */}
            <g transform={`translate(0 ${iconSize * 0.7 + 16})`}>
              <rect
                x={-55} y={0}
                width={110} height={14}
                rx={3}
                fill="rgba(15,23,42,0.85)"
              />
              <text
                x={0} y={10}
                fill="rgba(255,255,255,0.9)"
                fontSize={stampFontSize}
                fontFamily="Inter, sans-serif"
                fontWeight="semibold"
                textAnchor="middle"
              >
                {`ZONE ${hazard.zone.toUpperCase()} ${hazard.distanceM.toFixed(1)}m`}
              </text>
            </g>

            {/* Timestamp */}
            <g transform={`translate(0 ${iconSize * 0.7 + 32})`}>
              <rect
                x={-45} y={0}
                width={90} height={12}
                rx={3}
                fill="rgba(15,23,42,0.75)"
              />
              <text
                x={0} y={9}
                fill="rgba(255,255,255,0.7)"
                fontSize={stampFontSize}
                fontFamily="Inter, sans-serif"
                textAnchor="middle"
              >
                {timeStr}
              </text>
            </g>

            {/* Countdown progress bar */}
            <g transform={`translate(${-iconSize * 0.6} ${iconSize * 0.6})`}>
              <rect
                x={0} y={0}
                width={iconSize * 1.2}
                height={3}
                rx={1.5}
                fill="rgba(255,255,255,0.2)"
              />
              <rect
                x={0} y={0}
                width={iconSize * 1.2 * progress}
                height={3}
                rx={1.5}
                fill={color}
              />
            </g>
          </g>
        );
      })}
    </>
  );
}

function HazardIcon({ type, size, color }: { type: HazardType; size: number; color: string }) {
  const iconProps = { size, color, strokeWidth: 2.5 };
  switch (type) {
    case 'pedestrian':
      return <PersonStanding {...iconProps} />;
    case 'small_car':
      return <Car {...iconProps} />;
    case 'vehicle':
      return <Truck {...iconProps} />;
    case 'cyclist':
      return <Bike {...iconProps} />;
    case 'generic':
      return <AlertTriangle {...iconProps} />;
  }
}
