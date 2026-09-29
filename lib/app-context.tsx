'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { UserRole, PlanTier } from './types';

export interface AuthUser {
  role: UserRole;
  email: string;
  name: string;
  companyName?: string;
  driverNumber?: string;
  location?: string;
  planTier?: PlanTier;
  companyId?: string;
  pinCode?: string;
  trialStartDate?: string;
  trialDurationDays?: number;
  provisionedRole?: string;
  scopedCompanyIds?: string[];
  assignedLocations?: string[];
  /** Vault profile fields (driver mobile session) */
  truckNumber?: string;
  sensorHardware?: string;
  depot?: string;
  driverId?: string;
  biometricVerified?: boolean;
  /**
   * Product SKU for this session.
   * - fleetvu (default): full Enterprise / Vault company portal
   * - accuvu: lean accident-reconstruction platform (SHA-256 custody, no Driver Vault)
   */
  productSku?: 'fleetvu' | 'accuvu';
}

/** FleetVu Vault mobile session phases after biometric unlock */
export type VaultPhase = 'locked' | 'hub' | 'active' | null;

export interface TrialState {
  isTrial: boolean;
  daysRemaining: number;
  daysElapsed: number;
  trialEndDate: Date | null;
}

export function computeTrialState(user: { trialStartDate?: string; trialDurationDays?: number } | null): TrialState {
  if (!user?.trialStartDate) {
    return { isTrial: false, daysRemaining: 0, daysElapsed: 0, trialEndDate: null };
  }
  const duration = user.trialDurationDays ?? 30;
  const start = new Date(user.trialStartDate);
  const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
  const now = new Date();
  const msRemaining = end.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  const daysElapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  return { isTrial: true, daysRemaining, daysElapsed, trialEndDate: end };
}

export type GlobalAdminMode = 'management' | 'inspection';

export type WidgetId =
  | 'radar'
  | 'gpsMap'
  | 'actuarial'
  | 'historicalTelemetry'
  | 'mobileGeofencing'
  | 'incidentReconstruction'
  | 'safetyTrend'
  | 'sensorDistribution'
  | 'bulkUploadLogs'
  | 'userManagement'
  | 'liveEventFeed'
  | 'forensicVault'
  | 'auditTrail';

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'radar',
  'gpsMap',
  'actuarial',
  'historicalTelemetry',
  'mobileGeofencing',
  'incidentReconstruction',
  'safetyTrend',
  'sensorDistribution',
  'bulkUploadLogs',
  'liveEventFeed',
  'forensicVault',
  'userManagement',
  'auditTrail',
];

export const ALL_WIDGETS: { id: WidgetId; label: string; description: string }[] = [
  { id: 'radar', label: 'Sensor Radar Telemetry & Canvas', description: 'Live 77GHz radar visualization with distance arcs' },
  { id: 'gpsMap', label: 'GPS Tracking Map', description: 'Real-time fleet GPS tracking with satellite/street tiles' },
  { id: 'actuarial', label: 'Actuarial Risk & Insurance Tiering', description: 'Insurance carrier risk assessment & discount certification' },
  { id: 'historicalTelemetry', label: 'Historical Telemetry & Event Audit', description: '30-day event logs & collision data export' },
  { id: 'mobileGeofencing', label: 'Mobile Driver Geofencing & App Telematics', description: 'Driver smartphone boundary alerts & route corridors' },
  { id: 'incidentReconstruction', label: 'Incident Vector Reconstruction', description: 'Multi-sensor collision diagram & timeline analysis' },
  { id: 'safetyTrend', label: 'Fleet Safety Trend (7-Day)', description: 'Rolling 7-day safety score trend chart' },
  { id: 'sensorDistribution', label: 'Sensor Distribution by Fleet', description: 'Hardware profile breakdown across fleet vehicles' },
  { id: 'bulkUploadLogs', label: 'Bulk Upload & User Management Logs', description: 'Recent bulk import & user provisioning audit trail' },
  { id: 'userManagement', label: 'User & Team Management', description: 'Provisioned users, roles & access requests' },
  { id: 'auditTrail', label: 'Audit Trail', description: 'Immutable system event & change log' },
  { id: 'liveEventFeed', label: 'Live Driver Event Feed', description: 'Real-time streaming proximity events & sensor zone alerts' },
  { id: 'forensicVault', label: 'Forensic Vault Status Banner', description: 'Full-width cryptographic vault access & renewal status bar' },
];

export interface DashboardLayout {
  widgetOrder: WidgetId[];
  widgetVisibility: Record<WidgetId, boolean>;
  gpsMapVisible: boolean;
  sensorCards: {
    forward: boolean;
    left: boolean;
    right: boolean;
    rear: boolean;
  };
  featureTeasers: {
    forensicVault: boolean;
    incidentReconstruction: boolean;
    actuarialReport: boolean;
  };
  teaserBannersVisible: boolean;
  telemetryBadgesVisible: boolean;
  radarZoom: 'standard' | 'expanded';
}

const allVisible = Object.fromEntries(
  DEFAULT_WIDGET_ORDER.map((w) => [w, true]),
) as Record<WidgetId, boolean>;

export const defaultDashboardLayout: DashboardLayout = {
  widgetOrder: [...DEFAULT_WIDGET_ORDER],
  widgetVisibility: allVisible,
  gpsMapVisible: true,
  sensorCards: { forward: true, left: true, right: true, rear: true },
  featureTeasers: { forensicVault: true, incidentReconstruction: true, actuarialReport: true },
  teaserBannersVisible: true,
  telemetryBadgesVisible: true,
  radarZoom: 'standard',
};

export interface FleetState {
  selectedCompanyId: string | null;
  selectedRegion: string | null;
  selectedLocation: string | null;
  selectedTerminal: string | null;
  selectedVehicleId: string | null;
  selectedHardwareProfile: string;
  selectedVehicleType: string;
  provisionedHardware: string[];
  vehicleSpeed: number;
  motionLockout: boolean;
  incidentDetectionEnabled: boolean;
  gForceThreshold: number;
  incidentDetected: boolean;
  sensorFault: boolean;
  calibrationInProgress: boolean;
  demoPlan: PlanTier;
  dashboardLayout: DashboardLayout;
  forwardRange: number;
  leftRange: number;
  rightRange: number;
}

interface AppContextValue {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  fleet: FleetState;
  setFleet: (partial: Partial<FleetState>) => void;
  setDashboardLayout: (partial: Partial<DashboardLayout>) => void;
  view: 'desktop' | 'mobile';
  setView: (v: 'desktop' | 'mobile') => void;
  switchRole: (role: UserRole) => void;
  globalAdminMode: GlobalAdminMode;
  setGlobalAdminMode: (mode: GlobalAdminMode) => void;
  isInspectionMode: boolean;
  logInspection: (targetTenantId: string, accessedView: string) => Promise<void>;
}

const defaultFleet: FleetState = {
  selectedCompanyId: null,
  selectedRegion: null,
  selectedLocation: null,
  selectedTerminal: null,
  selectedVehicleId: null,
  selectedHardwareProfile: 'c55_pro_forward_lr',
  selectedVehicleType: 'class8_tractor_sleeper',
  provisionedHardware: ['c55_pro_forward_lr'],
  vehicleSpeed: 0,
  motionLockout: false,
  incidentDetectionEnabled: true,
  gForceThreshold: 1.5,
  incidentDetected: false,
  sensorFault: false,
  calibrationInProgress: false,
  demoPlan: 'proplus',
  dashboardLayout: defaultDashboardLayout,
  forwardRange: 7.0,
  leftRange: 4.0,
  rightRange: 4.0,
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [fleet, setFleetState] = useState<FleetState>(defaultFleet);
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
  const [globalAdminMode, setGlobalAdminModeState] = useState<GlobalAdminMode>('management');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '').toLowerCase();
      // Portal jump hashes own the session — do not restore a stale localStorage user
      const portalOwnsSession = [
        'home',
        'portals',
        'demo-vault',
        'demo-driver',
        'demo-enterprise',
        'demo-company',
        'demo-accuvu',
        'demo-global',
        'demo-ops',
        'fv-ops',
        'fleetvu-ops',
        'global',
        'enterprise',
        'company',
        'accuvu',
        'driver',
        'vault',
      ].includes(hash);

      if (portalOwnsSession) {
        localStorage.removeItem('fleetvu_user');
        localStorage.removeItem('fleetvu_vault_phase');
        return;
      }

      const stored = localStorage.getItem('fleetvu_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          localStorage.removeItem('fleetvu_user');
        }
      }
      const storedFleet = localStorage.getItem('fleetvu_fleet');
      if (storedFleet) {
        try {
          setFleetState(JSON.parse(storedFleet));
        } catch {
          localStorage.removeItem('fleetvu_fleet');
        }
      }
    }
  }, []);

  const login = useCallback((u: AuthUser) => {
    setUser(u);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fleetvu_user', JSON.stringify(u));
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setFleetState(defaultFleet);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fleetvu_user');
      localStorage.removeItem('fleetvu_fleet');
      localStorage.removeItem('fleetvu_vault_phase');
    }
  }, []);

  const setDashboardLayout = useCallback((partial: Partial<DashboardLayout>) => {
    setFleetState((prev) => {
      const nextLayout = { ...prev.dashboardLayout, ...partial };
      const next = { ...prev, dashboardLayout: nextLayout };
      if (typeof window !== 'undefined') {
        localStorage.setItem('fleetvu_fleet', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const setFleet = useCallback((partial: Partial<FleetState>) => {
    setFleetState((prev) => {
      const next = { ...prev, ...partial };
      // Enforce hard sensor bounds
      if (partial.forwardRange !== undefined) next.forwardRange = Math.min(10.0, Math.max(0.5, partial.forwardRange));
      if (partial.leftRange !== undefined) next.leftRange = Math.min(4.0, Math.max(0.5, partial.leftRange));
      if (partial.rightRange !== undefined) next.rightRange = Math.min(4.0, Math.max(0.5, partial.rightRange));
      const newLockout = next.vehicleSpeed >= 3;
      if (newLockout !== prev.motionLockout) {
        next.motionLockout = newLockout;
      }
      if (next.vehicleSpeed > 3 && prev.incidentDetected) {
        next.incidentDetected = false;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('fleetvu_fleet', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const setGlobalAdminMode = useCallback((mode: GlobalAdminMode) => {
    setGlobalAdminModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fleetvu_global_admin_mode', mode);
    }
  }, []);

  const logInspection = useCallback(async (targetTenantId: string, accessedView: string) => {
    if (!user || user.role !== 'global_admin') return;
    try {
      const { supabase } = await import('./supabase');
      await supabase.from('audit_logs').insert({
        actor_role: 'global_admin',
        actor_email: user.email,
        action_type: 'INSPECT_TENANT',
        entity_type: 'tenant',
        entity_id: targetTenantId,
        new_state: {
          targetTenantId,
          accessedView,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Inspection logging is best-effort — must not block the read path
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem('fleetvu_global_admin_mode');
      if (storedMode === 'inspection' || storedMode === 'management') {
        setGlobalAdminModeState(storedMode);
      }
    }
  }, []);

  // Reset to management mode when user changes away from global_admin
  useEffect(() => {
    if (user?.role !== 'global_admin' && globalAdminMode !== 'management') {
      setGlobalAdminModeState('management');
    }
  }, [user?.role, globalAdminMode]);

  const isInspectionMode = user?.role === 'global_admin' && globalAdminMode === 'inspection';

  const switchRole = useCallback((role: UserRole) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, role };
      if (typeof window !== 'undefined') {
        localStorage.setItem('fleetvu_user', JSON.stringify(next));
      }
      return next;
    });
    setView(role === 'driver' ? 'mobile' : 'desktop');
  }, []);

  return (
    <AppContext.Provider
      value={{ user, login, logout, fleet, setFleet, setDashboardLayout, view, setView, switchRole, globalAdminMode, setGlobalAdminMode, isInspectionMode, logInspection }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
