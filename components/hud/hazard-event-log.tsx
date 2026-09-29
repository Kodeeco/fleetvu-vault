'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  PersonStanding,
  Car,
  Bike,
  AlertTriangle,
  Truck,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  type HazardEventLog,
  type HazardType,
  hazardIconLabel,
  hazardColor,
} from '@/lib/hazard-detection';

/**
 * Hazard Event Log — displays below the radar.
 *
 * When a hazard icon disappears from the radar (after ~5 seconds),
 * it falls into this log with full reporting: date/time, zone,
 * distance, speed, GPS location, and hazard type.
 */

export interface HazardEventLogProps {
  events: HazardEventLog[];
  maxVisible?: number;
  className?: string;
}

export function HazardEventLogPanel({ events, maxVisible = 20, className }: HazardEventLogProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleEvents = expanded ? events : events.slice(0, maxVisible);

  return (
    <div className={cn('rounded-xl bg-slate-900 border border-slate-700 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-white uppercase tracking-wide">Hazard Event Log</span>
          {events.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold">
              {events.length}
            </span>
          )}
        </div>
        {events.length > maxVisible && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-400 hover:text-white"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Event list */}
      <div className="max-h-64 overflow-y-auto">
        {visibleEvents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <span className="text-xs">No hazard events recorded</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {visibleEvents.map((event) => (
              <HazardEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HazardEventRow({ event }: { event: HazardEventLog }) {
  const color = hazardColor(event.type);
  const detectedTime = new Date(event.detectedAt);
  const timeStr = detectedTime.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = detectedTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/50 transition-colors">
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
      >
        <HazardIconSmall type={event.type} color={color} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-white">{hazardIconLabel(event.type)}</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
            style={{ backgroundColor: `${color}20`, color }}
          >
            Zone {event.zone}
          </span>
          <span className="text-[10px] text-slate-400">{event.distanceM.toFixed(1)}m</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {dateStr} {timeStr}
          </span>
          <span>{event.speedMph.toFixed(0)} MPH</span>
          {event.latitude !== null && event.longitude !== null && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
            </span>
          )}
          <span className="text-slate-600">({event.durationSec.toFixed(1)}s)</span>
        </div>
      </div>
    </div>
  );
}

function HazardIconSmall({ type, color }: { type: HazardType; color: string }) {
  const props = { size: 16, color, strokeWidth: 2.5 };
  switch (type) {
    case 'pedestrian':
      return <PersonStanding {...props} />;
    case 'small_car':
      return <Car {...props} />;
    case 'vehicle':
      return <Truck {...props} />;
    case 'cyclist':
      return <Bike {...props} />;
    case 'generic':
      return <AlertTriangle {...props} />;
  }
}
