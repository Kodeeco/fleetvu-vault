'use client';

import React, { useEffect, useRef } from 'react';
import { FLEETVU_COLORS } from '@/lib/constants';

interface ReconstructionCanvasProps {
  truckSpeed: number;
  targetSpeed: number;
  approachAngle: string;
  impactDistance: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  laneSelection?: string;
  impactAngleType?: string;
  fleetTruckMotion?: string;
  targetVehicleMotion?: string;
  truckDims?: { width: number; length: number };
  targetDims?: { width: number; length: number };
  phase?: 'pre' | 'impact' | 'post' | 'teaser';
  wideField?: boolean;
  /** AccuVu emerald forensic theme vs FleetVu orange */
  theme?: 'fleetvu' | 'accuvu';
  /** Hide built-in canvas labels/overlay when parent supplies its own HUD */
  showChrome?: boolean;
  className?: string;
}

export function ReconstructionCanvas({
  truckSpeed,
  targetSpeed,
  approachAngle,
  impactDistance,
  latitude,
  longitude,
  timestamp,
  laneSelection = 'center',
  impactAngleType = 'inline_rear',
  fleetTruckMotion = 'moving',
  targetVehicleMotion = 'stopped',
  truckDims = { width: 2.6, length: 6.7 },
  targetDims = { width: 1.9, length: 4.8 },
  phase = 'impact',
  wideField = false,
  theme = 'fleetvu',
  showChrome = true,
  className,
}: ReconstructionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAccuVu = theme === 'accuvu';
  const accent = isAccuVu ? '#38BDF8' : '#F97316';
  const accentDim = isAccuVu ? 'rgba(56, 189, 248, 0.45)' : 'rgba(249, 115, 22, 0.4)';
  const ringExt = isAccuVu ? 'rgba(96, 165, 250, 0.28)' : 'rgba(59, 130, 246, 0.2)';
  const truckMoving = isAccuVu ? '#38BDF8' : '#F97316';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Satellite map backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    if (isAccuVu) {
      bgGrad.addColorStop(0, '#0a1628');
      bgGrad.addColorStop(0.45, '#0f1c2e');
      bgGrad.addColorStop(1, '#070f1a');
    } else {
      bgGrad.addColorStop(0, '#1a2e1a');
      bgGrad.addColorStop(0.5, '#1e3a2e');
      bgGrad.addColorStop(1, '#15261a');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Map grid lines (simulated roads)
    ctx.strokeStyle = 'rgba(100, 120, 100, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Road (horizontal)
    const roadY = h / 2;
    ctx.fillStyle = 'rgba(60, 70, 60, 0.6)';
    ctx.fillRect(0, roadY - 50, w, 100);

    // Lane markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    const laneOffset = laneSelection === 'left' ? -25 : laneSelection === 'right' ? 25 : 0;
    const truckY = roadY + laneOffset;

    if (laneSelection !== 'shoulder') {
      ctx.beginPath();
      ctx.moveTo(0, roadY);
      ctx.lineTo(w, roadY);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Road edges
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadY - 50);
    ctx.lineTo(w, roadY - 50);
    ctx.moveTo(0, roadY + 50);
    ctx.lineTo(w, roadY + 50);
    ctx.stroke();

    // --- Wide-field extended telemetry range rings (reconstruction only) ---
    // In wide-field mode, render extended sensor range rings beyond the 4m focal
    // envelope: 8m, 16m, 24m to show full pre-collision tracking data.
    if (wideField) {
      const wfScale = 12; // px per meter for wide-field rings
      const wfCx = w / 2;
      const wfCy = roadY;
      [4, 8, 16, 24].forEach((m) => {
        const r = m * wfScale;
        if (r > Math.min(w, h) / 2) return;
        const isFocal = m === 4;
        ctx.strokeStyle = isFocal ? accentDim : ringExt;
        ctx.lineWidth = isFocal ? 2 : 1;
        ctx.setLineDash(isFocal ? [] : [6, 6]);
        ctx.beginPath();
        ctx.arc(wfCx, wfCy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Range label
        ctx.fillStyle = isFocal ? accent : ringExt;
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${m}m`, wfCx + r + 3, wfCy - 3);
      });
      // Label for wide-field mode
      if (showChrome) {
        ctx.fillStyle = isAccuVu ? 'rgba(56, 189, 248, 0.7)' : 'rgba(59, 130, 246, 0.5)';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(isAccuVu ? 'ACCUVU 77GHz WIDE-FIELD' : 'WIDE-FIELD TELEMETRY', 12, 20);
        ctx.fillText(isAccuVu ? 'C55-PRO MULTI-ARC TRACKING' : 'EXTENDED MICROWAVE TRACKING', 12, 32);
      }
    }

    // Fleet truck — Class 8 semi, cab forward (right), trailer aft (left)
    const scale = 10;
    const truckW = truckDims.width * scale;
    const truckL = truckDims.length * scale;
    const truckX = w / 2 - truckL / 2 - 40;
    const truckFrontX = truckX + truckL;
    const truckCabLeftFrontX = truckFrontX - truckL * 0.08;
    const truckCabLeftFrontY = truckY - truckW * 0.42;
    const truckColor = fleetTruckMotion === 'moving' ? truckMoving : '#EF4444';
    drawSemiTruckSVG(ctx, truckX, truckY - truckW / 2, truckL, truckW, truckColor);

    // Truck motion badge
    drawMotionBadge(ctx, truckX + truckL / 2, truckY - truckW / 2 - 12, fleetTruckMotion);

    // Target vehicle — placed by contact geometry relative to cab (front)
    let targetAngle = 0;
    let targetX = truckFrontX + 18;
    let targetYPos = truckY;
    if (impactAngleType === 'tbone' || impactAngleType === 'side_impact') {
      targetAngle = 90;
      targetX = truckFrontX - truckL * 0.15;
      targetYPos = truckY - 55;
    } else if (impactAngleType === 'sideswipe') {
      targetAngle = 15;
      targetX = truckFrontX - truckL * 0.2;
      targetYPos = truckY - 36;
    } else if (impactAngleType === 'left_front') {
      // Driver's left = screen-up when cab faces right; contact at left-front bumper
      targetAngle = -28;
      targetX = truckFrontX - 8;
      targetYPos = truckY - 48;
    } else if (impactAngleType === 'frontal') {
      targetAngle = 180;
      targetX = truckFrontX + 28;
      targetYPos = truckY;
    } else if (impactAngleType === 'inline_rear' || impactAngleType === 'rear_end') {
      // Other vehicle ahead in same lane (fleet struck from behind would be different case)
      targetAngle = 0;
      targetX = truckFrontX + 22;
      targetYPos = truckY;
    }

    const targetW = targetDims.width * scale;
    const targetL = targetDims.length * scale;

    ctx.save();
    ctx.translate(targetX + targetL / 2, targetYPos);
    ctx.rotate((targetAngle * Math.PI) / 180);

    const targetColor = targetVehicleMotion === 'moving' ? '#22C55E' : '#EF4444';
    drawSedanSVG(ctx, -targetL / 2, -targetW / 2, targetL, targetW, targetColor);

    ctx.restore();

    drawMotionBadge(ctx, targetX + targetL / 2, targetYPos - targetW / 2 - 12, targetVehicleMotion);

    // Impact marker at contact quadrant (not trailer mid-body)
    if (phase === 'impact' || phase === 'teaser') {
      const isLeftFront = impactAngleType === 'left_front';
      const isFrontal = impactAngleType === 'frontal';
      const impactX = isLeftFront
        ? truckCabLeftFrontX
        : isFrontal
          ? truckFrontX
          : (truckFrontX + targetX) / 2;
      const impactY = isLeftFront ? truckCabLeftFrontY : (truckY + targetYPos) / 2;

      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(impactX, impactY);
      ctx.lineTo(targetX + targetL / 2, targetYPos);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#EF4444';
      drawStar(ctx, impactX, impactY, 5, 10, 5);

      // Contact quadrant label for counsel review clarity
      if (isLeftFront || isFrontal) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(isLeftFront ? 'LEFT-FRONT CONTACT' : 'FRONTAL CONTACT', impactX + 12, impactY - 6);
      }
    }

    // Pre-collision trajectory (phase = pre) — extended in wide-field mode
    if (phase === 'pre') {
      const trajStart = wideField ? truckX - 180 : truckX - 60;
      ctx.strokeStyle = isAccuVu ? 'rgba(52, 211, 153, 0.7)' : 'rgba(249, 115, 22, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(trajStart, truckY);
      ctx.lineTo(truckX, truckY);
      ctx.stroke();
      ctx.setLineDash([]);

      drawArrowHead(ctx, truckX, truckY, 0, accent);

      // In wide-field mode, show extended pre-collision distance markers
      if (wideField) {
        [24, 16, 8].forEach((m) => {
          const mx = truckX - m * 12;
          if (mx < 0) return;
          ctx.fillStyle = accentDim;
          ctx.font = '8px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`-${m}m`, mx, truckY - 6);
          ctx.strokeStyle = isAccuVu ? 'rgba(52, 211, 153, 0.25)' : 'rgba(249, 115, 22, 0.2)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(mx, truckY - 4);
          ctx.lineTo(mx, truckY + 4);
          ctx.stroke();
        });
      }
    }

    // Post-collision trajectory (phase = post) — extended in wide-field mode
    if (phase === 'post') {
      const trajEnd = wideField ? 100 : 60;
      const trajDy = wideField ? -35 : -20;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(truckX + truckL, truckY);
      ctx.lineTo(truckX + truckL + trajEnd, truckY + trajDy);
      ctx.stroke();
      ctx.setLineDash([]);

      drawArrowHead(ctx, truckX + truckL + trajEnd, truckY + trajDy, -18, '#EF4444');
    }

    // North compass rose
    const compassX = w - 40;
    const compassY = 40;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(compassX, compassY, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(compassX, compassY, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(compassX, compassY - 14);
    ctx.lineTo(compassX - 3, compassY - 4);
    ctx.lineTo(compassX + 3, compassY - 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', compassX, compassY - 16);

    // Telemetry overlay
    if (showChrome) {
    const overlayX = 10;
    const overlayY = h - 90;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(overlayX, overlayY, wideField ? 240 : 200, wideField ? 100 : 80, 6);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      wideField
        ? isAccuVu
          ? 'ACCUVU TELEMETRY OVERLAY'
          : 'WIDE-FIELD TELEMETRY OVERLAY'
        : 'TELEMETRY OVERLAY',
      overlayX + 8,
      overlayY + 14,
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '8px Inter, sans-serif';
    ctx.fillText(`Truck Speed: ${truckSpeed.toFixed(1)} MPH`, overlayX + 8, overlayY + 28);
    ctx.fillText(`Target Speed: ${targetSpeed.toFixed(1)} MPH`, overlayX + 8, overlayY + 40);
    ctx.fillText(`Angle: ${approachAngle}`, overlayX + 8, overlayY + 52);
    ctx.fillText(`Distance: ${impactDistance.toFixed(1)}m`, overlayX + 8, overlayY + 64);
    ctx.fillText(`GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, overlayX + 8, overlayY + 76);
    if (wideField) {
      ctx.fillStyle = isAccuVu ? '#38BDF8' : '#3B82F6';
      ctx.fillText(`Extended Track: 24m pre-collision`, overlayX + 8, overlayY + 88);
      ctx.fillText(`Sensors: C55-PRO 77GHz 3-channel (FWD + L/R)`, overlayX + 8, overlayY + 100);
    }
    }

    // Timestamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '7px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`UTC: ${timestamp}`, w - 10, h - 8);
  }, [
    truckSpeed,
    targetSpeed,
    approachAngle,
    impactDistance,
    latitude,
    longitude,
    timestamp,
    laneSelection,
    impactAngleType,
    fleetTruckMotion,
    targetVehicleMotion,
    truckDims,
    targetDims,
    phase,
    wideField,
    theme,
    showChrome,
    isAccuVu,
    accent,
    accentDim,
    ringExt,
    truckMoving,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

function drawSemiTruckSVG(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  color: string,
) {
  // Travel direction is left → right: trailer aft (left), cab / grille forward (right).
  const cabLen = length * 0.32;
  const trailerLen = length - cabLen;
  const trailerX = x;
  const cabX = x + trailerLen;

  // Trailer body (rear)
  ctx.fillStyle = color === '#F97316' ? '#C2410C' : '#991B1B';
  ctx.strokeStyle = color === '#F97316' ? '#FDBA74' : '#FCA5A5';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(trailerX, y, trailerLen, width, 2);
  ctx.fill();
  ctx.stroke();

  // Trailer panel ribs
  ctx.strokeStyle = 'rgba(253, 186, 116, 0.3)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 5; i++) {
    const ribX = trailerX + (trailerLen / 5) * i;
    ctx.beginPath();
    ctx.moveTo(ribX, y + 2);
    ctx.lineTo(ribX, y + width - 2);
    ctx.stroke();
  }

  // Tractor cab (front)
  const cabW = width * 0.82;
  const cabY = y + (width - cabW) / 2;
  ctx.fillStyle = color;
  ctx.strokeStyle = color === '#F97316' ? '#FED7AA' : '#FECACA';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cabX, cabY, cabLen, cabW, 3);
  ctx.fill();
  ctx.stroke();

  // Windshield at forward edge of cab
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.beginPath();
  ctx.roundRect(cabX + cabLen * 0.65, cabY + cabW * 0.15, cabLen * 0.3, cabW * 0.7, 1.5);
  ctx.fill();

  // Headlights on grille (right / forward)
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(cabX + cabLen - 1.5, cabY + cabW * 0.22, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cabX + cabLen - 1.5, cabY + cabW * 0.78, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Side mirrors near cab A-pillar
  ctx.fillStyle = color;
  ctx.strokeStyle = color === '#F97316' ? '#FED7AA' : '#FECACA';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cabX + cabLen * 0.55, y - 2, 3, 5, 1);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(cabX + cabLen * 0.55, y + width - 3, 3, 5, 1);
  ctx.fill();
  ctx.stroke();

  // Wheels — cab (front axle)
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 0.8;
  const wheelR = width * 0.12;
  ctx.beginPath();
  ctx.arc(cabX + cabLen * 0.45, y - 1, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cabX + cabLen * 0.45, y + width + 1, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Trailer wheels (tandem axle group near rear)
  const axlePositions = [trailerX + trailerLen * 0.12, trailerX + trailerLen * 0.25];
  axlePositions.forEach((ax) => {
    ctx.beginPath();
    ctx.arc(ax, y - 1, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ax, y + width + 1, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Direction arrow on cab roof — points forward (right)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(cabX + cabLen - 2, y + width / 2);
  ctx.lineTo(cabX + cabLen - 7, y + width / 2 - 3);
  ctx.lineTo(cabX + cabLen - 7, y + width / 2 + 3);
  ctx.closePath();
  ctx.fill();
}

function drawSedanSVG(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  color: string,
) {
  // Faces left → right (nose / headlights on the right), matching fleet travel.
  ctx.fillStyle = color;
  ctx.strokeStyle = color === '#22C55E' ? '#86EFAC' : '#FCA5A5';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, length, width, 6);
  ctx.fill();
  ctx.stroke();

  // Cabin/roof greenhouse
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.beginPath();
  ctx.roundRect(x + length * 0.28, y + width * 0.15, length * 0.5, width * 0.7, 4);
  ctx.fill();

  // Windshield (front / right)
  ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
  ctx.beginPath();
  ctx.moveTo(x + length * 0.82, y + width * 0.12);
  ctx.lineTo(x + length * 0.76, y + width * 0.18);
  ctx.lineTo(x + length * 0.76, y + width * 0.82);
  ctx.lineTo(x + length * 0.82, y + width * 0.88);
  ctx.closePath();
  ctx.fill();

  // Rear window (left)
  ctx.beginPath();
  ctx.moveTo(x + length * 0.18, y + width * 0.18);
  ctx.lineTo(x + length * 0.24, y + width * 0.12);
  ctx.lineTo(x + length * 0.24, y + width * 0.88);
  ctx.lineTo(x + length * 0.18, y + width * 0.82);
  ctx.closePath();
  ctx.fill();

  // Headlights (forward / right)
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.roundRect(x + length - 4, y + width * 0.15, 3, 4, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + length - 4, y + width * 0.75, 3, 4, 1);
  ctx.fill();

  // Taillights (aft / left)
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(x + 1, y + width * 0.15, 3, 4, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + 1, y + width * 0.75, 3, 4, 1);
  ctx.fill();

  // Side mirrors near front quarter
  ctx.fillStyle = color;
  ctx.strokeStyle = color === '#22C55E' ? '#86EFAC' : '#FCA5A5';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(x + length * 0.72, y - 2, 2.5, 3.5, 1);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x + length * 0.72, y + width - 1.5, 2.5, 3.5, 1);
  ctx.fill();
  ctx.stroke();

  // Wheels (4 wheels at corners)
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 0.8;
  const wheelR = width * 0.14;
  const wheelXs = [x + length * 0.2, x + length * 0.8];
  wheelXs.forEach((wx) => {
    ctx.beginPath();
    ctx.arc(wx, y - 1, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(wx, y + width + 1, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Direction arrow on roof — points forward (right)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x + length * 0.85, y + width / 2);
  ctx.lineTo(x + length * 0.78, y + width / 2 - 3);
  ctx.lineTo(x + length * 0.78, y + width / 2 + 3);
  ctx.closePath();
  ctx.fill();
}

function drawMotionBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  motion: string,
) {
  const text = motion === 'moving' ? 'MOVING' : 'STOPPED';
  const color = motion === 'moving' ? '#22C55E' : '#EF4444';

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 25, y - 8, 50, 14, 3);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 7px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 2);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDeg: number,
  color: string,
) {
  const angle = (angleDeg * Math.PI) / 180;
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -4);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
