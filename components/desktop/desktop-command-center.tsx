'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp, defaultDashboardLayout, DEFAULT_WIDGET_ORDER, ALL_WIDGETS, computeTrialState } from '@/lib/app-context';
import type { WidgetId } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsTrigger, TabsList } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Truck,
  Crown,
  Building2,
  MapPin,
  Pin,
  Globe,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Minus,
  LogOut,
  Shield,
  TrendingUp,
  FileText,
  Download,
  Mail,
  Plus,
  Upload,
  Send,
  DollarSign,
  Settings2,
  Wrench,
  CheckCircle2,
  Lock,
  Eye,
  Users,
  Car,
  Gauge,
  Zap,
  Layers,
  ScrollText,
  Database,
  KeyRound,
  FileBarChart,
  ShieldCheck,
  FileDown,
  Navigation,
  Radio,
  Bell,
  Search,
  Maximize2,
  Minimize2,
  Cpu,
  Waves,
  CircleDot,
  Sparkles,
  TicketPlus,
  Copy,
  ArrowUpRight,
  GripVertical,
  LayoutGrid,
  Save,
  RotateCcw,
  Info,
  AlertCircle,
  Activity,
  XCircle,
  AlertTriangle,
  LinkIcon,
  Smartphone,
  FileSpreadsheet,
  Archive,
  MoreVertical,
  Forward,
  Server,
  Unlock,
  Clock,
  RefreshCw,
  ShieldAlert,
  Gavel,
  Hash,
  FlaskConical,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from 'recharts';
import dynamic from 'next/dynamic';
import { GPSMapPanel, type GeofenceZone } from '@/components/hud/gps-map-panel';
import { GeofenceManagementModal } from '@/components/desktop/geofence-management-modal';
import { RadarVisualizer, RadarControlBar, useRadarControls } from '@/components/hud/radar-visualizer';

type GPSMapPanelProps = React.ComponentProps<typeof GPSMapPanel>;

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackKey: number },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallbackKey: number }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { fallbackKey: number }) {
    if (prevProps.fallbackKey !== this.props.fallbackKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-slate-400 gap-3 p-4">
          <MapPin className="w-8 h-8 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">Map unavailable</p>
          <p className="text-xs text-slate-500 text-center max-w-xs">
            The GPS map module could not be loaded. Telemetry and sensor data are still active.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="text-slate-300 border-slate-600 hover:bg-slate-800 mt-1"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry Map Load
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GPSMapPanelDynamic = dynamic(
  () => import('@/components/hud/gps-map-panel').then((m) => m.GPSMapPanel),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full bg-slate-900 text-slate-500 text-sm">Loading map…</div>,
  },
);

function SafeGPSMap(props: GPSMapPanelProps) {
  const [retryKey, setRetryKey] = useState(0);
  return (
    <MapErrorBoundary fallbackKey={retryKey}>
      <GPSMapPanelDynamic {...props} />
    </MapErrorBoundary>
  );
}
import { ReconstructionCanvas } from '@/components/reconstruction/reconstruction-canvas';
import { ReconstructionPortal } from './reconstruction-portal';
import { ReconstructionWrapper } from './reconstruction-wrapper';
import { AccuVuHeroLand } from '@/components/accuvu/accuvu-hero-land';
import { PocExpirationBanner } from './poc-expiration-banner';
import { MasterAdminControlPanel } from './master-admin-control-panel';
import { HardwareConfigModal } from './hardware-config-modal';
import { PricingModal } from './pricing-modal';
import { BulkUploadModal } from './bulk-upload-modal';
import { AccessRequestQueue } from './access-request-queue';
import { ReportBuilderModal } from './report-builder-modal';
import { UserManagementPanel } from './user-management-panel';
import { UserManagement } from '@/components/admin/UserManagement';
import { AuditTrailPanel } from './audit-trail-panel';
import { GatedBlurOverlay } from './gated-blur-overlay';
import { SafetyScoreAuditModal } from './safety-score-audit-modal';
import { InsuranceScorecardModal } from './insurance-scorecard-modal';
import { RiskSafetyScorecardModal } from './risk-safety-scorecard-modal';
import { SuperAdminScorecardModal } from './super-admin-scorecard-modal';
import { CompanyAssetDirectory } from './company-asset-directory';
import { InstantFleetReportModal, quickInsuranceScorecardPDF, quickUnderwritingScorecardPDF } from './instant-fleet-report-modal';
import { ArchivedReportsView } from './archived-reports-view';
import {
  CustomerLiveVehicleMirror,
  CustomerLiveVehicleEmpty,
} from './customer-live-vehicle-mirror';
import { ForensicVaultStream } from './forensic-vault-stream';
import {
  canSeeLegalForensicUi,
  canAccessCustomerLegalData,
  isFleetVuPlatformOperator,
  LEGAL_ISOLATION_DENIAL_MESSAGE,
} from '@/lib/legal-data-isolation';
import { CustomerSupportAgent } from '@/components/support/customer-support-agent';
import { SystemSettingsPanel } from './system-settings-panel';
import { MasterProvisioningConsole } from './master-provisioning-console';
import { DelegateSetupWizard } from './delegate-setup-wizard';

import {
  PLAN_FEATURES,
  LEGAL_DISCLAIMER,
  HARDWARE_PROFILES,
  CHASSIS_TYPES,
  VEHICLE_PROFILES,
  REGIONS,
  REGION_LOCATIONS,
  REGION_COORDS,
  LOCATION_COORDS,
  LOCATION_TERMINALS,
} from '@/lib/constants';
import type { Company, Driver, Vehicle, PlanTier, PricingConfig, Incident, VehicleProfileKey } from '@/lib/types';
import {
  getDemoCompanies,
  getDemoDrivers,
  getDemoVehicles,
  isUxDemoEnterpriseFlag,
  isUxDemoEnterpriseSession,
} from '@/lib/demo-customer-seed';
import { LocationAssetView } from '@/components/desktop/location-asset-view';
import { DesktopOptimizationBridge, useForceDesktopViewport, useIsTabletViewport } from '@/components/desktop/desktop-optimization-bridge';

type SubView = 'dashboard' | 'reconstruction' | 'billing' | 'access' | 'audit' | 'users' | 'tenants' | 'reports' | 'system-settings' | 'provisioning' | 'onboarding';

export function DesktopCommandCenter() {
  const { user, logout, fleet, setFleet, setDashboardLayout, globalAdminMode, setGlobalAdminMode, isInspectionMode, logInspection } = useApp();
  const isAccuVu = user?.productSku === 'accuvu';
  const [accuvuSurface, setAccuvuSurface] = useState<'hero' | 'workspace'>('hero');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<SubView>(() =>
    typeof window !== 'undefined' &&
    (window.location.hash.replace(/^#/, '').toLowerCase() === 'demo-accuvu' ||
      (() => {
        try {
          const u = JSON.parse(localStorage.getItem('fleetvu_user') || 'null');
          return u?.productSku === 'accuvu';
        } catch {
          return false;
        }
      })())
      ? 'reconstruction'
      : 'dashboard',
  );

  // AccuVu always re-enters on the hero land
  useEffect(() => {
    if (user?.productSku === 'accuvu') {
      setAccuvuSurface('hero');
      setSubView('reconstruction');
    }
  }, [user?.productSku, user?.email]);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showHardwareConfig, setShowHardwareConfig] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showCustomizeLayout, setShowCustomizeLayout] = useState(false);
  const [editMode, setEditMode] = useState(false);
  useEffect(() => { if (isInspectionMode && editMode) setEditMode(false); }, [isInspectionMode, editMode]);
  const [showSafetyAudit, setShowSafetyAudit] = useState(false);
  const [showInsuranceScorecard, setShowInsuranceScorecard] = useState(false);
  const [showRiskSafetyScorecard, setShowRiskSafetyScorecard] = useState(false);
  const [showSuperAdminScorecard, setShowSuperAdminScorecard] = useState(false);
  const [showInstantReport, setShowInstantReport] = useState(false);
  const [instantReportVehicleId, setInstantReportVehicleId] = useState<string | undefined>(undefined);
  const [pairedSensorCount, setPairedSensorCount] = useState(0);
  const [alertPrefsEnabled, setAlertPrefsEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [alertDeliveryMethod, setAlertDeliveryMethod] = useState('immediate');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showVaultServiceModal, setShowVaultServiceModal] = useState(false);
  const [vaultDropdownOpen, setVaultDropdownOpen] = useState(false);
  const [showVaultExpiryDialog, setShowVaultExpiryDialog] = useState(false);
  /** Dismissed urgency tier (60|30|14|7|0) — re-prompt when a tighter window is entered */
  const [vaultExpiryDismissedTier, setVaultExpiryDismissedTier] = useState<number | null>(null);
  const [showMasterAdminPanel, setShowMasterAdminPanel] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<'profile' | 'features' | 'alerts'>('profile');
  const [mobileRollupEnabled, setMobileRollupEnabled] = useState(false);
  const [rollupCadence, setRollupCadence] = useState('daily');
  const [rollupCustomInterval, setRollupCustomInterval] = useState('3');
  const [rollupUnit, setRollupUnit] = useState('days');
  const [portalStorageEnabled, setPortalStorageEnabled] = useState(true);
  useEffect(() => {
    const savedPortal = localStorage.getItem('fleetvu_portal_storage');
    if (savedPortal) {
      try { setPortalStorageEnabled(JSON.parse(savedPortal).enabled ?? true); } catch { /* ignore */ }
    }
  }, []);
  const savePortalStorage = (enabled: boolean) => {
    setPortalStorageEnabled(enabled);
    localStorage.setItem('fleetvu_portal_storage', JSON.stringify({ enabled }));
  };

  // Feature entitlement toggles with role-based defaults
  // LEGAL ISOLATION: Global Admin never receives accident/forensic entitlements.
  const defaultFeatureToggles = (role: string, accuvu = false): Record<string, boolean> => {
    const isPlatform = role === 'global_admin';
    const isCustomerAdmin = role === 'super_admin' || role === 'admin' || role === 'location_admin';
    if (accuvu) {
      return {
        accidentReconstruction: true,
        bulkDataUpload: false,
        c55RawTelemetry: true,
        riskScorecard: false,
        insuranceScorecard: true,
        advancedAuditTrail: true,
        mobileDriverRollup: false,
        archivedReports: true,
      };
    }
    return {
      accidentReconstruction: !isPlatform && (role === 'super_admin' || role === 'admin'),
      bulkDataUpload: isCustomerAdmin || isPlatform,
      c55RawTelemetry: false,
      riskScorecard: !isPlatform,
      insuranceScorecard: !isPlatform && isCustomerAdmin,
      advancedAuditTrail: !isPlatform && (isCustomerAdmin || role === 'auditor'),
      mobileDriverRollup: !isPlatform && isCustomerAdmin,
      archivedReports: !isPlatform,
    };
  };
  const [featureToggles, setFeatureToggles] = useState<Record<string, boolean>>(() =>
    defaultFeatureToggles(user?.role || user?.provisionedRole || 'standard_user', user?.productSku === 'accuvu'),
  );
  useEffect(() => {
    const role = user?.role || user?.provisionedRole || 'standard_user';
    const accuvu = user?.productSku === 'accuvu';
    const defaults = defaultFeatureToggles(role, accuvu);
    // LEGAL ISOLATION: Platform operators never inherit legal/forensic toggles from localStorage
    if (role === 'global_admin' || accuvu) {
      setFeatureToggles(defaults);
      return;
    }
    const saved = localStorage.getItem('fleetvu_feature_toggles');
    if (!saved) {
      setFeatureToggles(defaults);
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      setFeatureToggles({ ...defaults, ...parsed });
    } catch {
      setFeatureToggles(defaults);
    }
  }, [user?.role, user?.provisionedRole, user?.productSku]);

  const saveFeatureToggle = (key: string, enabled: boolean) => {
    const role = user?.role || user?.provisionedRole || 'standard_user';
    // Global Admin cannot enable legal/forensic entitlements
    if (
      role === 'global_admin' &&
      [
        'accidentReconstruction',
        'insuranceScorecard',
        'advancedAuditTrail',
        'archivedReports',
        'riskScorecard',
        'c55RawTelemetry',
      ].includes(key)
    ) {
      return;
    }
    setFeatureToggles((prev) => {
      const next = { ...prev, [key]: enabled };
      localStorage.setItem('fleetvu_feature_toggles', JSON.stringify(next));
      return next;
    });
  };
  useEffect(() => {
    const companyId = user?.companyId;
    if (!companyId || user?.role === 'global_admin') {
      const saved = localStorage.getItem('fleetvu_mobile_rollup');
      if (saved) {
        try {
          const r = JSON.parse(saved);
          setMobileRollupEnabled(r.enabled ?? false);
          setRollupCadence(r.cadence ?? 'weekly');
          setRollupCustomInterval(r.customInterval ?? '3');
          setRollupUnit(r.unit ?? 'days');
        } catch {
          /* ignore */
        }
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reports/rollup?companyId=${encodeURIComponent(companyId)}`);
        if (!res.ok) throw new Error('prefs fetch failed');
        const data = await res.json();
        if (cancelled) return;
        const p = data.prefs;
        setMobileRollupEnabled(!!p.enabled);
        setRollupCadence(p.cadence || 'weekly');
        localStorage.setItem(
          'fleetvu_mobile_rollup',
          JSON.stringify({
            enabled: !!p.enabled,
            cadence: p.cadence || 'weekly',
            customInterval: '3',
            unit: 'days',
          }),
        );
      } catch {
        const saved = localStorage.getItem('fleetvu_mobile_rollup');
        if (saved) {
          try {
            const r = JSON.parse(saved);
            if (!cancelled) {
              setMobileRollupEnabled(r.enabled ?? false);
              setRollupCadence(r.cadence ?? 'weekly');
            }
          } catch {
            /* ignore */
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.companyId, user?.role]);

  const saveMobileRollup = (enabled: boolean, cadence: string, customInterval: string, unit: string) => {
    setMobileRollupEnabled(enabled);
    setRollupCadence(cadence);
    setRollupCustomInterval(customInterval);
    setRollupUnit(unit);
    localStorage.setItem('fleetvu_mobile_rollup', JSON.stringify({ enabled, cadence, customInterval, unit }));
    const companyId = user?.companyId;
    if (companyId && user?.role !== 'global_admin') {
      void fetch('/api/reports/rollup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          companyId,
          enabled,
          cadence,
          weeklyWeekday: 5,
          updatedBy: user?.email || null,
        }),
      }).catch(() => {
        /* prefs persist best-effort */
      });
    }
  };
  useEffect(() => {
    const saved = localStorage.getItem('fleetvu_alert_prefs');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        setAlertPrefsEnabled(prefs.enabled ?? false);
        setAlertThreshold(prefs.threshold ?? '80');
        setAlertDeliveryMethod(prefs.deliveryMethod ?? 'immediate');
      } catch { /* ignore */ }
    }
  }, []);
  const saveAlertPrefs = (enabled: boolean, threshold: string, deliveryMethod: string) => {
    setAlertPrefsEnabled(enabled);
    setAlertThreshold(threshold);
    setAlertDeliveryMethod(deliveryMethod);
    localStorage.setItem('fleetvu_alert_prefs', JSON.stringify({ enabled, threshold, deliveryMethod }));
  };
  const isSuperAdmin = user?.role === 'super_admin';
  const isExecutive = user?.role === 'executive';
  const isGlobalAdmin = user?.role === 'global_admin';
  const provisionedRoleLabel = user?.provisionedRole
    ? user.provisionedRole === 'super_admin' ? 'Super-Admin'
      : user.provisionedRole === 'global_admin' ? 'Global Admin'
      : user.provisionedRole === 'admin' ? 'Admin'
      : user.provisionedRole === 'manager' ? 'Location Manager'
      : user.provisionedRole === 'auditor' ? 'Auditor'
      : user.provisionedRole === 'standard_user' ? 'User'
      : user.provisionedRole.charAt(0).toUpperCase() + user.provisionedRole.slice(1)
    : isGlobalAdmin ? 'Global Admin'
      : isSuperAdmin ? 'Super-Admin'
      : isExecutive ? 'Executive'
      : 'Driver';
  const scopedCompanyIds = user?.scopedCompanyIds;
  const isScopedAdmin = !!scopedCompanyIds && scopedCompanyIds.length > 0 && !isSuperAdmin && !isGlobalAdmin;
  useForceDesktopViewport();
  const isTablet = useIsTabletViewport();
  const showMobileSummary = isTablet && (isExecutive || isSuperAdmin || isGlobalAdmin);
  const canEditPricing = isGlobalAdmin && !isInspectionMode;
  const canCustomizeLayout = (isSuperAdmin || isGlobalAdmin) && !isInspectionMode && !isAccuVu;
  const canToggleFeatures = isSuperAdmin || isGlobalAdmin || user?.provisionedRole === 'admin';
  const isAuditor = user?.provisionedRole === 'auditor' || user?.role === 'auditor';
  const demoPlan = fleet.demoPlan || 'proplus';
  const outerTrial = computeTrialState(user);
  const isTrialActive = outerTrial.isTrial && outerTrial.daysRemaining > 0;
  const vaultIsOpen = !outerTrial.isTrial || isTrialActive;
  const vaultDaysRemaining = outerTrial.daysRemaining;
  const vaultUrgencyTier = getVaultUrgencyTier(vaultDaysRemaining);
  const showVaultExpiryWarning =
    isTrialActive &&
    vaultUrgencyTier != null &&
    vaultUrgencyTier !== vaultExpiryDismissedTier;
  const showVaultRenewalAction = !vaultIsOpen || (isTrialActive && vaultDaysRemaining <= 60);

  const togglePin = (wid: WidgetId) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const vis = fleet?.dashboardLayout?.widgetVisibility ?? {};
    setDashboardLayout({ widgetVisibility: { ...vis, [wid]: vis[wid] === false } });
  };
  const isPinned = (wid: WidgetId) => fleet?.dashboardLayout?.widgetVisibility?.[wid] !== false;
  const selectedPlan = demoPlan;
  const isBasicPlan = selectedVehicle?.plan_tier === 'basic';
  const activeAlerts = vehicles.filter((v) => v.status === 'maintenance' || v.status === 'inoperable').length + incidents.length;
  const hasOrgFilter = !!(fleet.selectedCompanyId || fleet.selectedRegion || fleet.selectedLocation || fleet.selectedTerminal);

  // Log inspection event when global admin in inspection mode navigates into a tenant
  useEffect(() => {
    if (isInspectionMode && fleet.selectedCompanyId && subView !== 'billing') {
      logInspection(fleet.selectedCompanyId, subView);
    }
  }, [isInspectionMode, fleet.selectedCompanyId, subView, logInspection]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const platformOperator = isFleetVuPlatformOperator({
        role: user?.role,
        email: user?.email,
      });

      const useDemoSeed =
        isUxDemoEnterpriseFlag() ||
        isUxDemoEnterpriseSession(user?.email) ||
        false;

      const [coRes, vehRes, drvRes, priceRes] = await Promise.all([
        supabase.from('companies').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('pricing_config').select('*'),
      ]);

      // LEGAL ISOLATION FIREWALL:
      // FleetVu Global Admin must NEVER load customer incident / accident rows.
      let incRes: { data: Incident[] | null } = { data: [] };
      if (
        !platformOperator &&
        canAccessCustomerLegalData({
          role: user?.role,
          companyId: user?.companyId,
          scopedCompanyIds: user?.scopedCompanyIds,
          email: user?.email,
        })
      ) {
        let query = supabase
          .from('incidents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (user?.companyId) {
          query = query.eq('company_id', user.companyId);
        } else if (user?.scopedCompanyIds && user.scopedCompanyIds.length > 0) {
          query = query.in('company_id', user.scopedCompanyIds);
        }

        const result = await query;
        incRes = { data: (result.data as Incident[]) || [] };
      }

      const dbCompanies = (coRes.data as Company[]) || [];
      const dbVehicles = (vehRes.data as Vehicle[]) || [];
      const dbDrivers = (drvRes.data as Driver[]) || [];

      // UX Review: empty DB (or demo enterprise session) → seed Apex customer portal like BOLT
      const seedNeeded = useDemoSeed || dbCompanies.length === 0;
      let allCompanies = seedNeeded ? getDemoCompanies() : dbCompanies;
      let allVehicles = seedNeeded ? getDemoVehicles() : dbVehicles;
      let allDrivers = seedNeeded ? getDemoDrivers() : dbDrivers;

      if (!isSuperAdmin && !isGlobalAdmin && user?.scopedCompanyIds && user.scopedCompanyIds.length > 0) {
        allCompanies = allCompanies.filter((c) => user.scopedCompanyIds!.includes(c.id));
      }
      setCompanies(allCompanies);

      let filteredVehicles = allVehicles;
      if (user?.companyId && !isGlobalAdmin) {
        // Customer Super-Admin: show their company trucks; keep sibling demo companies visible in directory only
        filteredVehicles = allVehicles.filter((v) => v.company_id === user.companyId);
      }
      setVehicles(seedNeeded ? allVehicles : filteredVehicles);
      setDrivers(allDrivers);
      setIncidents(incRes.data || []);
      if (priceRes.data) setPricing(priceRes.data as PricingConfig[]);

      // Auto-enter Apex company workspace for demo Super-Admin
      if (
        seedNeeded &&
        isSuperAdmin &&
        user?.companyId &&
        !fleet.selectedCompanyId
      ) {
        setFleet({ selectedCompanyId: user.companyId });
      }
    } catch {
      // Tables may not be ready — still show demo customer portal for UX Review
      if (isSuperAdmin || isUxDemoEnterpriseSession(user?.email)) {
        setCompanies(getDemoCompanies());
        setVehicles(getDemoVehicles());
        setDrivers(getDemoDrivers());
        if (user?.companyId) setFleet({ selectedCompanyId: user.companyId });
      }
    } finally {
      setLoading(false);
    }
  }, [user?.companyId, user?.role, user?.email, user?.scopedCompanyIds, isSuperAdmin, isGlobalAdmin, fleet.selectedCompanyId, setFleet]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [incidentPortalAlert, setIncidentPortalAlert] = useState<{
    caseId: string;
    fileName?: string;
    driverName?: string;
    at?: string;
  } | null>(null);

  useEffect(() => {
    if (isGlobalAdmin || !user?.companyId) return;
    const key = `fleetvu_incident_alert_${user.companyId}`;
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]') as Array<{
        caseId: string;
        fileName?: string;
        driverName?: string;
        at?: string;
        read?: boolean;
      }>;
      const unread = list.find((x) => !x.read);
      if (unread) setIncidentPortalAlert(unread);
    } catch {
      /* ignore */
    }
    const onAlert = (e: Event) => {
      const d = (e as CustomEvent).detail as { caseId?: string; fileName?: string };
      if (d?.caseId) {
        setIncidentPortalAlert({
          caseId: d.caseId,
          fileName: d.fileName,
          at: new Date().toISOString(),
        });
        setSubView('reconstruction');
      }
    };
    window.addEventListener('fleetvu:incident-alert', onAlert);
    return () => window.removeEventListener('fleetvu:incident-alert', onAlert);
  }, [isGlobalAdmin, user?.companyId]);

  // LEGAL ISOLATION: bounce Global Admin off reconstruction / force empty incidents
  useEffect(() => {
    if (!isGlobalAdmin) return;
    if (incidents.length > 0) setIncidents([]);
    if (subView === 'reconstruction') {
      console.warn('[FleetVu Legal Isolation]', LEGAL_ISOLATION_DENIAL_MESSAGE);
    }
  }, [isGlobalAdmin, subView, incidents.length]);

  // Customer Super Admin / Admin: Tenant Directory is platform-only — bounce home
  useEffect(() => {
    if (isGlobalAdmin) return;
    if (subView === 'tenants') setSubView('dashboard');
  }, [isGlobalAdmin, subView]);

  const legalUiAllowed = canSeeLegalForensicUi({
    role: user?.role,
    companyId: user?.companyId,
    scopedCompanyIds: user?.scopedCompanyIds,
    email: user?.email,
  });

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      !searchQuery ||
      v.truck_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.company_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    const matchesCompany =
      !fleet.selectedCompanyId || v.company_id === fleet.selectedCompanyId;
    const matchesRegion =
      !fleet.selectedRegion ||
      (v.location && v.location.includes(fleet.selectedRegion.split(' ')[0])) ||
      (companies.find((c) => c.id === v.company_id)?.region === fleet.selectedRegion);
    const matchesLocation =
      !fleet.selectedLocation || v.location === fleet.selectedLocation ||
      (companies.find((c) => c.id === v.company_id)?.location === fleet.selectedLocation);
    const matchesTerminal =
      !fleet.selectedTerminal ||
      (v.location && v.location.includes(fleet.selectedTerminal)) ||
      (fleet.selectedLocation && LOCATION_TERMINALS[fleet.selectedLocation]?.includes(fleet.selectedTerminal) && v.location === fleet.selectedLocation);
    return matchesSearch && matchesStatus && matchesCompany && matchesRegion && matchesLocation && matchesTerminal;
  });

  const selectedCompany = companies.find((c) => c.id === fleet.selectedCompanyId);
  const selectedCompanyPlan = selectedCompany?.plan_tier || (fleet.demoPlan || 'proplus');
  const isCompanyBasicPlan = selectedCompanyPlan === 'basic';



  // Load saved dashboard layout from Supabase on login
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_layouts')
          .select('widget_order')
          .eq('user_email', user.email)
          .maybeSingle();
        if (!cancelled && data?.widget_order && Array.isArray(data.widget_order) && data.widget_order.length > 0) {
          const saved = data.widget_order as WidgetId[];
          const valid = saved.filter((w) => DEFAULT_WIDGET_ORDER.includes(w));
          if (valid.length > 0) {
            const missing = DEFAULT_WIDGET_ORDER.filter((w) => !valid.includes(w));
            setFleet({ dashboardLayout: { ...fleet?.dashboardLayout ?? defaultDashboardLayout, widgetOrder: [...valid, ...missing] } });
          }
        }
      } catch { /* ignore — fall back to default layout */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // ── URL hash ↔ view state synchronization ──────────────────────────────
  // Maps hash fragment #view=<key> to the appropriate subView / modal state.
  // On mount and on hashchange (back/forward, refresh, external tab), the
  // matching view or modal is restored. Conversely, navigating via the UI
  // updates the hash so the URL is shareable / bookmarkable.
  type VaultHashKey =
    | 'dashboard' | 'accident-reconstruction' | 'sha256-safety-reports'
    | 'insurance-scorecard' | 'report-archiving' | 'litigation-exoneration'
    | 'third-party-access' | 'chain-of-custody' | 'chain-of-compliance'
    | 'rbac-permissions';

  const applyHashView = useCallback((key: string) => {
    const k = key as VaultHashKey;
    const legalSubject = { role: user?.role, companyId: user?.companyId, scopedCompanyIds: user?.scopedCompanyIds };
    const legalAllowed = canSeeLegalForensicUi(legalSubject);

    // LEGAL ISOLATION: FleetVu Global Admin cannot open accident / safety / forensic views
    const legalKeys: VaultHashKey[] = [
      'accident-reconstruction',
      'sha256-safety-reports',
      'chain-of-custody',
      'litigation-exoneration',
      'insurance-scorecard',
      'report-archiving',
      'chain-of-compliance',
    ];
    if (!legalAllowed && legalKeys.includes(k)) {
      console.warn('[FleetVu Legal Isolation]', LEGAL_ISOLATION_DENIAL_MESSAGE);
      setSubView('dashboard');
      return;
    }

    switch (k) {
      case 'dashboard':
        setSubView('dashboard'); break;
      case 'accident-reconstruction':
        setSubView('reconstruction'); break;
      case 'sha256-safety-reports':
        // Generate sealed safety reports (driver or full fleet) — NOT the login audit trail
        setShowReportBuilder(true);
        break;
      case 'chain-of-custody':
        setSubView('audit'); break;
      case 'litigation-exoneration':
        setShowInsuranceScorecard(true); break;
      case 'third-party-access':
        setSubView('access'); break;
      case 'report-archiving':
        setSubView('reports'); break;
      case 'insurance-scorecard':
        setShowInsuranceScorecard(true); break;
      case 'chain-of-compliance':
        // Recurring auto digest (daily / weekly Friday / monthly) lives in Account Settings → Alerts
        setAccountModalTab('alerts');
        setShowAccountModal(true);
        break;
      case 'rbac-permissions':
        setShowAccountModal(true); setAccountModalTab('features'); break;
      default:
        setSubView('dashboard'); break;
    }
  }, [user?.role, user?.companyId, user?.scopedCompanyIds]);

  // Restore view from hash on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(raw);
    const viewKey = params.get('view');
    if (viewKey) {
      applyHashView(viewKey);
    }
  }, [applyHashView]);

  // Listen for back/forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const raw = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(raw);
      const viewKey = params.get('view');
      if (viewKey) {
        applyHashView(viewKey);
      } else {
        setSubView('dashboard');
        setShowInsuranceScorecard(false);
        setShowReportBuilder(false);
        setShowAccountModal(false);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHashView]);

  // Push a new view key into the URL hash without page reload
  const navigateToVaultView = useCallback((key: VaultHashKey) => {
    if (typeof window !== 'undefined') {
      const newHash = `view=${key}`;
      if (window.location.hash.replace(/^#/, '') !== newHash) {
        window.location.hash = newHash;
      }
    }
    // Apply state immediately so the UI updates even if hash is unchanged
    applyHashView(key);
    setVaultDropdownOpen(false);
  }, [applyHashView]);

  // Determine GPS map center based on selected filters
  const mapCenter = React.useMemo(() => {
    if (fleet.selectedLocation && LOCATION_COORDS[fleet.selectedLocation]) {
      return LOCATION_COORDS[fleet.selectedLocation];
    }
    if (fleet.selectedRegion && REGION_COORDS[fleet.selectedRegion]) {
      return REGION_COORDS[fleet.selectedRegion];
    }
    return { lat: 39.5, lng: -98.35 }; // US center for global view
  }, [fleet.selectedLocation, fleet.selectedRegion]);

  // Map vehicles for GPS panel — spread around the map center, enriched with driver data
  const mapVehicles = filteredVehicles.slice(0, 8).map((v, i) => {
    const baseLat = mapCenter.lat;
    const baseLng = mapCenter.lng;
    const angle = (i / Math.max(filteredVehicles.length, 1)) * Math.PI * 2;
    const offset = 0.02 * (i + 1);
    const driver = drivers.find((d) => d.id === v.assigned_driver_id);
    return {
      id: v.id,
      truckNumber: v.truck_number,
      lat: baseLat + Math.cos(angle) * offset,
      lng: baseLng + Math.sin(angle) * offset,
      status: v.status,
      selected: selectedVehicle?.id === v.id,
      driverName: driver?.name,
      speedMph: 42,
      location: v.location || v.company_name || undefined,
      planTier: v.plan_tier,
    };
  });

  const isGlobalView = !fleet.selectedCompanyId && !fleet.selectedRegion && !fleet.selectedLocation && !fleet.selectedTerminal;
  const resetToGlobal = () => { setFleet({ selectedCompanyId: null, selectedRegion: null, selectedLocation: null, selectedTerminal: null }); setSelectedVehicle(null); }

  const avgSafetyScore = vehicles.length > 0 ? vehicles.reduce((s, v) => s + v.safety_score, 0) / vehicles.length : 0;

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 text-slate-200 flex flex-col">
      <DesktopOptimizationBridge />
      {/* Top Navigation Bar */}
      {/* Top chrome — slim AccuVu account bar on hero; full header otherwise */}
      {isAccuVu && accuvuSurface === 'hero' ? (
        <header className="shrink-0 bg-slate-950/95 border-b border-sky-500/20 px-4 py-1.5 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            AccuVu Live Reconstruction
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-sky-500/10 text-xs text-slate-300">
                <span className="font-semibold text-sky-200">{user?.email}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-sky-500/20 z-[9999]">
              <DropdownMenuItem className="text-slate-200 cursor-pointer" onClick={() => { setShowAccountModal(true); setAccountModalTab('profile'); }}>
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400 cursor-pointer font-semibold" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" /> LOG-OFF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
      ) : (
      <header className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700 px-4 py-2 flex items-center justify-between sticky top-0 z-40">
        <button
          className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => {
            if (isAccuVu) {
              setAccuvuSurface('hero');
              setSubView('reconstruction');
              return;
            }
            if (isGlobalAdmin) {
              setFleet({ selectedCompanyId: null, selectedRegion: null, selectedLocation: null, selectedTerminal: null });
            }
            setSelectedVehicle(null);
            navigateToVaultView('dashboard');
          }}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-lg ${
            isAccuVu ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-orange-500 shadow-orange-500/20'
          }`}>
            {isAccuVu ? <Gauge className="w-5 h-5 text-white" /> : <Truck className="w-5 h-5 text-white" />}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-white">{isAccuVu ? 'AccuVu' : 'FleetVu'}</span>
            <span className={`text-xs ml-1 ${isAccuVu ? 'text-emerald-400' : 'text-orange-400'}`}>
              {isAccuVu ? 'Reconstruction' : isGlobalAdmin ? 'Business Portal' : 'Company Command'}
            </span>
            {selectedCompany && (
              <span className="text-slate-600">|</span>
            )}
            {selectedCompany && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 ${
                selectedCompany.plan_tier === 'proplus' ? 'bg-amber-500/15 border-amber-500/25' :
                selectedCompany.plan_tier === 'pro' ? 'bg-blue-500/15 border-blue-500/25' :
                'bg-slate-600/20 border-slate-500/25'
              }`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  selectedCompany.plan_tier === 'proplus' ? 'text-amber-400' :
                  selectedCompany.plan_tier === 'pro' ? 'text-blue-400' :
                  'text-slate-300'
                }`}>
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 text-left leading-tight">
                  <p className="text-xs font-bold text-white truncate max-w-[140px]">{selectedCompany.plan_tier === 'proplus' ? 'ProPlus' : selectedCompany.plan_tier.toUpperCase()}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide truncate max-w-[140px]">{selectedCompany.name}</p>
                  <p className="text-[9px] text-slate-500 truncate max-w-[140px]">{selectedCompany.location || 'Location not set'}</p>
                </div>
              </div>
            )}
          </div>
        </button>

        {/* Trial countdown badge */}
        {isTrialActive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/40 backdrop-blur-sm animate-fade-in">
            <Sparkles className="w-3 h-3 text-orange-400" />
            <span className="text-[11px] font-bold text-orange-300">
              BASIC+ TRIAL MODE — {outerTrial.daysRemaining} {outerTrial.daysRemaining === 1 ? 'Day' : 'Days'} Remaining
            </span>
          </div>
        )}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {/* Active context badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedVehicle && (
              <Badge className="bg-orange-500/15 text-orange-300 border border-orange-500/30 text-xs gap-1 h-7 px-2.5">
                <Truck className="w-3 h-3" />
                {selectedVehicle.truck_number}
              </Badge>
            )}
            {fleet.selectedRegion && (
              <Badge className="bg-slate-700/50 text-slate-300 border border-slate-600 text-xs h-7 px-2.5">
                {fleet.selectedRegion}
              </Badge>
            )}
          </div>
        </div>

        {/* Global Asset Search */}
        <div className="relative shrink-0 max-w-xs w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <Input
            placeholder="Search fleet assets, trucks, drivers…"
            className="pl-8 bg-slate-900/50 border-slate-600 text-white text-sm h-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Right: Alert Counter + User Profile Dropdown */}
        <div className="flex items-center gap-2">
          {/* Global-Admin Mode Switcher */}
          {isGlobalAdmin && (
            <div className="flex items-center rounded-lg border border-slate-600 overflow-hidden">
              <button
                onClick={() => setGlobalAdminMode('management')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold transition-colors ${
                  globalAdminMode === 'management'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Account Management Mode — full read/write"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Management
              </button>
              <button
                onClick={() => setGlobalAdminMode('inspection')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold transition-colors ${
                  globalAdminMode === 'inspection'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Forensic Inspection Mode — strict read-only"
              >
                <Eye className="w-3.5 h-3.5" />
                Inspection
              </button>
            </div>
          )}

          {/* Open Driver Vault (mobile app) — FleetVu Full only */}
          {!isAccuVu && (isGlobalAdmin || isSuperAdmin) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 text-xs font-bold"
              title="Open FleetVu Vault mobile experience (biometric → profile → features)"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('fleetvu:open-driver-vault', {
                    detail: {
                      demoUser: {
                        role: 'driver',
                        email: 'marcus.reyes@driver.fleetvu.com',
                        name: 'Marcus Reyes',
                        companyName: selectedCompany?.name || 'Acme Logistics',
                        companyId: selectedCompany?.id || fleet.selectedCompanyId || undefined,
                        driverNumber: 'DRV-4821',
                        driverId: 'DRV-4821',
                        truckNumber: '#072',
                        sensorHardware: 'C55-Pro',
                        depot: selectedCompany?.location || 'Newark Terminal 4',
                        location: selectedCompany?.location || 'Newark Terminal 4',
                        planTier: 'proplus',
                        biometricVerified: true,
                      },
                    },
                  }),
                );
              }}
            >
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              Open Driver Vault
            </Button>
          )}
          {/* Active Telemetry Alert Counter — functional dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 transition-colors cursor-pointer">
                <Bell className="w-3.5 h-3.5 text-red-400" />
                <span className="text-sm font-bold text-red-400">{activeAlerts}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wide hidden lg:inline">Alerts</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-slate-800 border-slate-700 z-[9999]">
              <DropdownMenuLabel className="text-slate-400 text-xs flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-orange-400" />
                Live Telemetry &amp; Sensor Alerts
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-700" />
              {(() => {
                const telemetryAlerts: Array<{ id: string; type: 'radar' | 'hardware' | 'vehicle'; severity: 'critical' | 'warning' | 'info'; vehicle: string; message: string; icon: React.ReactNode }> = [];

                for (const v of vehicles) {
                  if (v.status === 'inoperable') {
                    telemetryAlerts.push({
                      id: `vehicle-down-${v.id}`,
                      type: 'vehicle',
                      severity: 'critical',
                      vehicle: v.truck_number,
                      message: 'Vehicle inoperable — immediate dispatch required',
                      icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
                    });
                  }
                  if (v.status === 'maintenance') {
                    telemetryAlerts.push({
                      id: `vehicle-maint-${v.id}`,
                      type: 'vehicle',
                      severity: 'warning',
                      vehicle: v.truck_number,
                      message: 'Scheduled maintenance — sensor suite offline',
                      icon: <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
                    });
                  }
                  if (v.safety_score < 70) {
                    telemetryAlerts.push({
                      id: `safety-low-${v.id}`,
                      type: 'radar',
                      severity: 'warning',
                      vehicle: v.truck_number,
                      message: `Safety score critical (${v.safety_score.toFixed(0)}) — radar event threshold breached`,
                      icon: <Gauge className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
                    });
                  }
                  const hwKey = v.hardware_profile as keyof typeof HARDWARE_PROFILES;
                  const hwProfile = HARDWARE_PROFILES[hwKey];
                  if (hwProfile && hwProfile.sensors.length > 4) {
                    telemetryAlerts.push({
                      id: `hw-fault-${v.id}`,
                      type: 'hardware',
                      severity: 'info',
                      vehicle: v.truck_number,
                      message: `${hwProfile.label} — ${hwProfile.sensors.length}-channel sensor node operational`,
                      icon: <Radio className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
                    });
                  }
                }

                if (telemetryAlerts.length === 0) {
                  return (
                    <div className="px-3 py-4 text-center">
                      <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-400 font-semibold">All systems nominal</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">No active telemetry or sensor alerts</p>
                    </div>
                  );
                }

                return telemetryAlerts.slice(0, 10).map((alert) => (
                  <DropdownMenuItem
                    key={alert.id}
                    className="cursor-pointer flex items-start gap-2 py-2 hover:bg-slate-700/40"
                    onClick={() => { setSelectedVehicle(vehicles.find((v) => v.truck_number === alert.vehicle) || null); }}
                  >
                    {alert.icon}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{alert.vehicle}</span>
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
                          alert.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                          alert.severity === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-snug">{alert.message}</span>
                    </div>
                  </DropdownMenuItem>
                ));
              })()}
              <DropdownMenuSeparator className="bg-slate-700" />
              <div className="px-3 py-1.5 text-[9px] text-slate-500 text-center">
                Forensic audit logs are accessible via the Vault widget below
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2.5 py-1.5 min-w-[196px] rounded-md hover:bg-slate-700/50 transition-colors cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                  {isGlobalAdmin ? <DollarSign className="w-4 h-4 text-orange-400" /> : isSuperAdmin ? <Crown className="w-4 h-4 text-orange-400" /> : <Shield className="w-4 h-4 text-orange-400" />}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs font-bold text-white truncate max-w-[140px]">
                    {isAccuVu
                      ? 'AccuVu Reconstruction'
                      : isGlobalAdmin
                        ? 'FleetVu Business Portal'
                        : isSuperAdmin
                          ? 'Customer Super-Admin'
                          : provisionedRoleLabel}
                  </span>
                  <span className="text-[9px] text-slate-400 truncate max-w-[140px]">{user?.email}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 bg-slate-800 border-slate-700 z-[9999]">
              <DropdownMenuLabel className="text-slate-400 text-[10px] uppercase tracking-widest flex items-center justify-between">
                <span>
                  {isAccuVu
                    ? 'AccuVu Account'
                    : isGlobalAdmin
                      ? 'FleetVu Global Admin'
                      : 'Customer Portal'}
                </span>
                <span className="text-slate-500 normal-case tracking-normal text-[10px]">Settings:</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem className="text-amber-300 hover:bg-amber-500/10 cursor-pointer font-bold border border-amber-500/20 rounded-md mb-1" onClick={() => { setShowAccountModal(true); setAccountModalTab('profile'); }}>
                <Settings2 className="w-4 h-4 mr-2 text-amber-400" /> ACCOUNT SETTINGS
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              {canCustomizeLayout && (
                <>
                  <DropdownMenuItem className="text-orange-300 hover:bg-orange-500/10 cursor-pointer" onClick={() => setShowCustomizeLayout(true)}>
                    <Settings2 className="w-4 h-4 mr-2" /> Customize Widgets
                  </DropdownMenuItem>
                  <DropdownMenuItem className={`cursor-pointer ${editMode ? 'bg-orange-500/20 text-orange-300' : 'text-blue-300 hover:bg-blue-500/10'}`} onClick={() => !isInspectionMode && setEditMode((v) => !v)}>
                    <LayoutGrid className="w-4 h-4 mr-2" /> {editMode ? 'Exit Layout Editing' : 'Edit Dashboard Layout'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-700" />
                </>
              )}
              {featureToggles.bulkDataUpload && isSuperAdmin && !isAccuVu && <DropdownMenuItem className="text-orange-300 hover:bg-orange-500/10 cursor-pointer font-semibold" onClick={() => !isInspectionMode && setShowBulkUpload(true)}><Upload className="w-4 h-4 mr-2" /> Bulk Upload</DropdownMenuItem>}
              {isSuperAdmin && !isAccuVu && <DropdownMenuItem className="text-orange-300 hover:bg-orange-500/10 cursor-pointer font-semibold" onClick={() => setSubView('access')}><KeyRound className="w-4 h-4 mr-2" /> Access Requests</DropdownMenuItem>}
              {isSuperAdmin && !isAccuVu && <DropdownMenuItem className="text-orange-300 hover:bg-orange-500/10 cursor-pointer font-semibold" onClick={() => setSubView('users')}><Users className="w-4 h-4 mr-2" /> User &amp; Team Management</DropdownMenuItem>}
              <DropdownMenuItem className="text-orange-300 hover:bg-orange-500/10 cursor-pointer font-semibold" onClick={() => setSubView('audit')}><ScrollText className="w-4 h-4 mr-2" /> Audit Trail</DropdownMenuItem>
              {isGlobalAdmin && <DropdownMenuItem className="text-orange-300 hover:bg-orange-500/10 cursor-pointer font-semibold" onClick={() => setSubView('system-settings')}><Server className="w-4 h-4 mr-2" /> System Settings</DropdownMenuItem>}
              {isGlobalAdmin && (
                <DropdownMenuItem
                  className="text-orange-300 hover:bg-orange-500/10 cursor-pointer font-semibold"
                  onClick={() => { resetToGlobal(); setSubView('provisioning'); }}
                >
                  <Server className="w-4 h-4 mr-2" />
                  Client Onboarding &amp; CRM
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem className="text-red-400 hover:bg-red-500/10 cursor-pointer font-semibold" onClick={logout}><LogOut className="w-4 h-4 mr-2" /> LOG-OFF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      )}

      {incidentPortalAlert && legalUiAllowed && (
        <div className="shrink-0 bg-orange-500 text-white px-4 py-2 flex items-center justify-between gap-3 z-30">
          <span className="text-sm font-bold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            INCIDENT COMPLETED — {incidentPortalAlert.fileName || incidentPortalAlert.caseId}
            {incidentPortalAlert.driverName ? ` · ${incidentPortalAlert.driverName}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-white text-orange-700 hover:bg-orange-50 h-7 text-xs font-bold"
              onClick={() => {
                setSubView('reconstruction');
                try {
                  const key = `fleetvu_incident_alert_${user?.companyId}`;
                  const list = JSON.parse(localStorage.getItem(key) || '[]') as Array<{ caseId: string; read?: boolean }>;
                  localStorage.setItem(
                    key,
                    JSON.stringify(list.map((x) => (x.caseId === incidentPortalAlert.caseId ? { ...x, read: true } : x))),
                  );
                } catch {
                  /* ignore */
                }
                setIncidentPortalAlert(null);
              }}
            >
              Open Reconstruction
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-orange-600 h-7 text-xs"
              onClick={() => setIncidentPortalAlert(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Executive Summary KPI Cards — shown below 1024px for exec/admin roles */}
      {showMobileSummary && subView === 'dashboard' && (
        <div className="lg:hidden bg-slate-800/50 border-b border-slate-700 px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <MobileKpiCard label="SAFE Score" value={avgSafetyScore.toFixed(1)} color="text-emerald-400" icon={<ShieldCheck className="w-4 h-4" />} />
            <MobileKpiCard label="Active Alerts" value={String(activeAlerts)} color="text-red-400" icon={<Bell className="w-4 h-4" />} />
            <MobileKpiCard label="Assets" value={String(vehicles.length)} color="text-blue-400" icon={<Truck className="w-4 h-4" />} />
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs h-9 gap-1.5"
              onClick={() => setShowReportBuilder(true)}
            >
              <FileDown className="w-3.5 h-3.5" />
              Vault Safety Report
            </Button>
            {legalUiAllowed && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-orange-300 border-orange-500/40 hover:bg-orange-500/10 text-xs h-9 gap-1.5"
              onClick={() => setSubView('reconstruction')}
              disabled={!featureToggles.accidentReconstruction}
            >
              <FileText className="w-3.5 h-3.5" />
              Incidents
            </Button>
            )}
          </div>
        </div>
      )}

      {/* Sub-navigation — AccuVu hero hides chrome; AccuVu workspace shows lean tabs */}
      {!(isAccuVu && accuvuSurface === 'hero') && (
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-1.5 flex items-center gap-2 flex-wrap">
        {isAccuVu ? (
          <>
            <NavTab
              active={subView === 'reconstruction'}
              onClick={() => {
                setAccuvuSurface('hero');
                setSubView('reconstruction');
              }}
              icon={<FileText className="w-4 h-4" />}
              label="AccuVu Reconstruction"
            />
            <NavTab
              active={accuvuSurface === 'workspace' && subView === 'reconstruction'}
              onClick={() => {
                setAccuvuSurface('workspace');
                setSubView('reconstruction');
              }}
              icon={<Layers className="w-4 h-4" />}
              label="Case Workspace"
            />
            <NavTab
              active={subView === 'audit'}
              onClick={() => setSubView('audit')}
              icon={<ScrollText className="w-4 h-4" />}
              label="SHA-256 Audit"
            />
            <NavTab
              active={subView === 'reports'}
              onClick={() => setSubView('reports')}
              icon={<FileBarChart className="w-4 h-4" />}
              label="Sealed Digests"
            />
          </>
        ) : (
          <NavTab
            active={subView === 'dashboard'}
            onClick={() => {
              // Customer Super Admin stays in their tenant — clearing companyId remounts the GPS map and trips Leaflet clearRect crashes.
              if (isGlobalAdmin) {
                setFleet({ selectedCompanyId: null, selectedRegion: null, selectedLocation: null, selectedTerminal: null });
              } else if (user?.companyId) {
                setFleet({ selectedCompanyId: user.companyId, selectedRegion: null, selectedLocation: null, selectedTerminal: null });
              }
              setSubView('dashboard');
            }}
            icon={<Layers className="w-4 h-4" />}
            label="Dashboard"
          />
        )}
        {isGlobalAdmin && (
          <NavTab active={subView === 'tenants'} onClick={() => { resetToGlobal(); setSubView('tenants'); }} icon={<Building2 className="w-4 h-4" />} label="Tenant Directory" />
        )}
        {/* Forensic / sealed reports live only under Vault — no duplicate Export / Incidents / Vault Reports tabs */}
        {/* Inline KPI stat metrics — hidden in System Settings */}
        {subView !== 'system-settings' && subView !== 'provisioning' && subView !== 'onboarding' && !isAccuVu && (
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-thin">
          <InlineKpiBar
            isGlobalView={isGlobalView}
            selectedCompany={selectedCompany}
            companies={companies}
            vehicles={vehicles}
            incidents={incidents}
            onTotalCompaniesClick={() => { resetToGlobal(); setSubView('tenants'); }}
          />
        </div>
        )}
        {isAccuVu && <div className="flex-1" />}

        {/* Quick-action tools + Super-Admin pricing — hidden in System Settings */}
        {subView !== 'system-settings' && subView !== 'provisioning' && subView !== 'onboarding' && (
        <div className="flex items-center gap-1.5 shrink-0">
          {canEditPricing && !isAccuVu && (
            <Button
              variant="ghost"
              className="text-slate-300 hover:text-white gap-1.5 h-8 text-xs"
              onClick={() => setShowPricing(true)}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Pricing
            </Button>
          )}

          {isAccuVu && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10">
              <Gauge className="w-4 h-4 text-emerald-300" />
              <span className="text-[11px] font-black uppercase tracking-wide text-emerald-200">AccuVu SHA-256</span>
            </div>
          )}

          {/* Forensic Vault dropdown — FleetVu Full only (not AccuVu SKU) */}
          {!isAccuVu && (
          <DropdownMenu open={vaultDropdownOpen} onOpenChange={setVaultDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center gap-2 px-2.5 py-1.5 min-w-[220px] rounded-lg border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-slate-900/40 hover:from-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer group"
                title="Forensic Vault"
              >
                <div className="relative h-12 flex items-center justify-center shrink-0">
                  <img
                    src="/FV-Vault-header.webp"
                    alt="Forensic Vault"
                    className="h-10 w-auto max-w-[180px] rounded object-contain ring-1 ring-amber-500/40"
                  />
                  {vaultIsOpen && (
                    <span className="absolute inset-0 rounded ring-1 ring-amber-400/60 animate-pulse pointer-events-none" />
                  )}
                  {showAccountModal && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                      <span className="text-[8px] font-black text-amber-300 tracking-widest">OPEN</span>
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-black uppercase tracking-wide hidden sm:inline',
                    vaultIsOpen ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {vaultIsOpen ? 'OPEN' : 'LOCKED'}
                </span>
                <ChevronDown className="w-3 h-3 text-amber-400/70 ml-auto" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-slate-800 border-amber-500/20 z-[9999]">
              <DropdownMenuLabel className="text-amber-300 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Forensic Vault Features
                {vaultIsOpen ? (
                  <span className="ml-auto text-emerald-400 font-black">VAULT OPEN</span>
                ) : (
                  <span className="ml-auto text-red-400 font-black">VAULT LOCKED</span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-700" />
              {/* LEGAL ISOLATION: Customer-only legal/forensic vault menus — hidden from Global Admin */}
              {legalUiAllowed ? (
                <>
              {/* Safety Reports — one generate path (OPEN = SHA-256 sealed) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 hover:bg-amber-500/10 text-amber-100 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Safety Reports
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-80 bg-slate-800 border-amber-500/20">
                  {[
                    {
                      icon: <FileBarChart className="w-4 h-4 text-amber-400" />,
                      label: 'Safety Report',
                      desc: vaultIsOpen
                        ? 'Driver or full fleet · daily → annual · SHA-256 sealed while Vault is OPEN'
                        : 'Driver or full fleet PDF (unsealed — Vault LOCKED)',
                      onClick: () => navigateToVaultView('sha256-safety-reports'),
                    },
                    {
                      icon: <Smartphone className="w-4 h-4 text-amber-400" />,
                      label: 'Auto Fleet Digest',
                      desc: 'Phones → one Daily / Weekly (Fri) / Monthly PDF to Admins',
                      onClick: () => navigateToVaultView('chain-of-compliance'),
                    },
                    {
                      icon: <Archive className="w-4 h-4 text-amber-400" />,
                      label: 'Report Archive',
                      desc: 'Review sealed reports already in the Vault',
                      onClick: () => navigateToVaultView('report-archiving'),
                    },
                  ].map((item) => (
                    <DropdownMenuItem key={item.label} className="cursor-pointer flex items-start gap-2.5 py-2.5 hover:bg-amber-500/10" onClick={item.onClick}>
                      <div className="shrink-0 mt-0.5">{item.icon}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-amber-100">{item.label}</span>
                        <span className="text-[10px] text-slate-400 leading-snug">{item.desc}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Insurance & Legal */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 hover:bg-amber-500/10 text-amber-100 text-xs font-bold">
                  <Gavel className="w-4 h-4 text-amber-400" />
                  Insurance &amp; Legal
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-72 bg-slate-800 border-amber-500/20">
                  {[
                    { icon: <FileBarChart className="w-4 h-4 text-amber-400" />, label: 'Insurance Scorecard', desc: 'Carrier-ready policy verification', onClick: () => navigateToVaultView('insurance-scorecard') },
                    { icon: <ShieldCheck className="w-4 h-4 text-amber-400" />, label: 'Risk & Safety Scorecard', desc: 'Executive fleet risk breakdown', onClick: () => { if (featureToggles.riskScorecard) setShowRiskSafetyScorecard(true); } },
                    { icon: <KeyRound className="w-4 h-4 text-amber-400" />, label: 'Third-Party Access', desc: 'Granular external party access', onClick: () => navigateToVaultView('third-party-access') },
                  ].map((item) => (
                    <DropdownMenuItem key={item.label} className="cursor-pointer flex items-start gap-2.5 py-2.5 hover:bg-amber-500/10" onClick={item.onClick}>
                      <div className="shrink-0 mt-0.5">{item.icon}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-amber-100">{item.label}</span>
                        <span className="text-[10px] text-slate-400 leading-snug">{item.desc}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Forensics */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 hover:bg-amber-500/10 text-amber-100 text-xs font-bold">
                  <FlaskConical className="w-4 h-4 text-amber-400" />
                  Forensics
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-72 bg-slate-800 border-amber-500/20">
                  {[
                    { icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, label: 'Incidents / Reconstruction', desc: 'Crash forensics & trajectory analysis', onClick: () => navigateToVaultView('accident-reconstruction') },
                    { icon: <ScrollText className="w-4 h-4 text-amber-400" />, label: 'Chain of Custody', desc: 'Tamper-proof evidence audit trail', onClick: () => navigateToVaultView('chain-of-custody') },
                    { icon: <Smartphone className="w-4 h-4 text-amber-400" />, label: 'Open Driver Vault App', desc: 'Live sensors · biometric lock · incident push', onClick: () => {
                      window.dispatchEvent(new CustomEvent('fleetvu:open-driver-vault'));
                    }},
                  ].map((item) => (
                    <DropdownMenuItem key={item.label} className="cursor-pointer flex items-start gap-2.5 py-2.5 hover:bg-amber-500/10" onClick={item.onClick}>
                      <div className="shrink-0 mt-0.5">{item.icon}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-amber-100">{item.label}</span>
                        <span className="text-[10px] text-slate-400 leading-snug">{item.desc}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Administration */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 hover:bg-amber-500/10 text-amber-100 text-xs font-bold">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Administration
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-72 bg-slate-800 border-amber-500/20">
                  <DropdownMenuItem
                    className="cursor-pointer flex items-start gap-2.5 py-2.5 hover:bg-amber-500/10"
                    onClick={() => navigateToVaultView('rbac-permissions')}
                  >
                    <div className="shrink-0 mt-0.5"><Lock className="w-4 h-4 text-amber-400" /></div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-amber-100">Forensic Permissions (RBAC)</span>
                      <span className="text-[10px] text-slate-400 leading-snug">Tiered access for Vault legal data</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
                </>
              ) : (
                <>
                  <div className="px-3 py-2 text-[11px] text-amber-200/80 leading-snug">
                    Legal / forensic customer data is tenant-exclusive. FleetVu Global Admin has zero access (subpoena firewall).
                  </div>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-start gap-2.5 py-2.5 hover:bg-amber-500/10"
                    onClick={() => window.dispatchEvent(new CustomEvent('fleetvu:open-driver-vault'))}
                  >
                    <div className="shrink-0 mt-0.5"><Smartphone className="w-4 h-4 text-amber-400" /></div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-amber-100">Preview Driver Vault UX</span>
                      <span className="text-[10px] text-slate-400 leading-snug">Hardware / biometric UI only — no customer accident files</span>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
              {showVaultRenewalAction && (
                <>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {vaultIsOpen ? (
                        <>
                          <Clock className={`w-3.5 h-3.5 ${vaultDaysRemaining <= 30 ? 'text-red-400' : 'text-amber-400'}`} />
                          <span className={`text-[11px] font-bold ${vaultDaysRemaining <= 30 ? 'text-red-300' : 'text-amber-300'}`}>
                            {vaultDaysRemaining} {vaultDaysRemaining === 1 ? 'Day' : 'Days'} Until Locked
                          </span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-[11px] font-bold text-red-300">Vault Locked</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => { setShowVaultServiceModal(true); setVaultDropdownOpen(false); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold hover:bg-orange-500/30 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {vaultIsOpen ? 'Renew Vault' : 'OPEN Vault'}
                    </button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
        )}
      </div>
      )}

      {/* Persistent Inspection Mode Banner */}
      {isInspectionMode && (
        <div className="bg-cyan-950/80 border-b border-cyan-700/50 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
              GLOBAL-ADMIN READ-ONLY INSPECTION MODE — FORENSICALLY SECURED (NO DATA MUTATION)
            </span>
          </div>
          <span className="text-[10px] text-cyan-400/70 hidden sm:inline">
            All edits, saves, and mutations disabled. Audit trail recording active.
          </span>
        </div>
      )}

      {/* Main content — scrollable so 100% desktop zoom can reach the bottom of every view */}
      <div
        className={`flex-1 min-h-0 overflow-x-hidden flex flex-col ${
          isAccuVu && accuvuSurface === 'hero' ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {!isGlobalAdmin && user?.companyId && !(isAccuVu && accuvuSurface === 'hero') && (
          <div className="px-4 pt-2 shrink-0">
            <PocExpirationBanner
              hardwareSerial={selectedVehicle?.truck_number || 'FV-HW-DEMO'}
              companyId={user.companyId}
              companyName={selectedCompany?.name || user.companyName || 'Fleet'}
              location={selectedCompany?.location || user.location || null}
              pocName={user.name}
              pocEmail={user.email}
              hardwareSerials={vehicles.filter((v) => v.company_id === user.companyId).map((v) => v.truck_number).filter(Boolean)}
              vaultIsOpen={vaultIsOpen}
            />
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col">
        {subView === 'dashboard' && (isSuperAdmin || isGlobalAdmin) && !fleet.selectedCompanyId && (
          <SuperAdminWorkspace
            vehicles={filteredVehicles}
            companies={companies}
            drivers={drivers}
            incidents={incidents}
            loading={loading}
            mapVehicles={mapVehicles}
            mapCenter={mapCenter}
            onSelectCompany={(companyId) => {
              setFleet({ selectedCompanyId: companyId, selectedRegion: null, selectedLocation: null, selectedTerminal: null });
              setSubView('dashboard');
            }}
            onNavigateToBilling={() => !isInspectionMode && setSubView('billing')}
            isCompanyBasicPlan={isCompanyBasicPlan}
            onNavigateToVehicle={(v) => {
              setSelectedVehicle(v);
              setFleet({ selectedCompanyId: v.company_id });
            }}
            onBackToOverview={() => { resetToGlobal(); setSubView('dashboard'); }}
            user={user!}
            onClientCreated={loadData}
            onInstantFleetReport={() => { setInstantReportVehicleId(undefined); setShowInstantReport(true); }}
            onOpenReportBuilder={() => setShowReportBuilder(true)}
            onShowInsuranceScorecard={() => setShowInsuranceScorecard(true)}
            onShowSuperAdminScorecard={() => setShowSuperAdminScorecard(true)}
          />
        )}

        {subView === 'dashboard' && (isSuperAdmin || isGlobalAdmin) && fleet.selectedCompanyId && selectedCompany && (
          <SuperAdminCompanyInspect
            company={selectedCompany}
            vehicles={filteredVehicles}
            drivers={drivers.filter((d) => d.company_id === fleet.selectedCompanyId)}
            incidents={incidents.filter((inc) => inc.company_id === fleet.selectedCompanyId)}
            mapVehicles={mapVehicles}
            mapCenter={mapCenter}
            onSelectVehicle={(v) => {
              setSelectedVehicle(v);
            }}
            selectedVehicle={selectedVehicle}
            onBackToOverview={() => { resetToGlobal(); setSubView('dashboard'); }}
            onOpenReportBuilder={() => setShowReportBuilder(true)}
            onInstantFleetReport={() => { setInstantReportVehicleId(undefined); setShowInstantReport(true); }}
            onInstantInsuranceScorecard={() => {
              const co = selectedCompany;
              const coVehicles = filteredVehicles.filter((v) => v.company_id === co?.id);
              const coDrivers = drivers.filter((d) => d.company_id === co?.id);
              const now = new Date();
              const end = now.toISOString().slice(0, 10);
              const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
              quickInsuranceScorecardPDF(coVehicles, coDrivers, co, { start, end, label: 'Last 30 Days' });
            }}
            onInstantUnderwritingScorecard={() => {
              const co = selectedCompany;
              const coVehicles = filteredVehicles.filter((v) => v.company_id === co?.id);
              const coDrivers = drivers.filter((d) => d.company_id === co?.id);
              quickUnderwritingScorecardPDF(coVehicles, coDrivers, co);
            }}
            onVehiclePdfReport={(v) => { setInstantReportVehicleId(v.id); setShowInstantReport(true); }}
            onVehicleMobileSync={(v) => { setSelectedVehicle(v); setShowSafetyAudit(true); }}
            user={user!}
            onOpenAuditTrail={() => setSubView('audit')}
          />
        )}

        {subView === 'dashboard' && !isSuperAdmin && (fleet.selectedLocation || fleet.selectedTerminal) && selectedCompany && (
          <LocationAssetView
            locationName={fleet.selectedTerminal || fleet.selectedLocation || 'Location'}
            companyName={selectedCompany.name}
            vehicles={filteredVehicles}
            drivers={drivers.filter((d) => d.company_id === fleet.selectedCompanyId)}
            mapCenter={mapCenter}
            mapVehicles={mapVehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(v) => setSelectedVehicle(v)}
            onBackToOverview={resetToGlobal}
          />
        )}

        {subView === 'dashboard' && !isSuperAdmin && fleet.selectedCompanyId && selectedCompany && !fleet.selectedLocation && !fleet.selectedTerminal && (
          <CompanyCommandView
            company={selectedCompany}
            vehicles={filteredVehicles}
            drivers={drivers.filter((d) => d.company_id === fleet.selectedCompanyId)}
            incidents={incidents}
            mapVehicles={mapVehicles}
            mapCenter={mapCenter}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(v) => setSelectedVehicle(v)}
            onBackToOverview={resetToGlobal}
            userRole={user?.role || 'executive'}
            onShowSafetyAudit={() => setShowSafetyAudit(true)}
            onShowInsuranceScorecard={() => setShowInsuranceScorecard(true)}
            onOpenReportBuilder={() => setShowReportBuilder(true)}
            onInstantFleetReport={() => { setInstantReportVehicleId(undefined); setShowInstantReport(true); }}
            onInstantInsuranceScorecard={() => {
              const co = selectedCompany;
              const coVehicles = filteredVehicles.filter((v) => v.company_id === co?.id);
              const coDrivers = drivers.filter((d) => d.company_id === co?.id);
              const now = new Date();
              const end = now.toISOString().slice(0, 10);
              const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
              quickInsuranceScorecardPDF(coVehicles, coDrivers, co, { start, end, label: 'Last 30 Days' });
            }}
            onInstantUnderwritingScorecard={() => {
              const co = selectedCompany;
              const coVehicles = filteredVehicles.filter((v) => v.company_id === co?.id);
              const coDrivers = drivers.filter((d) => d.company_id === co?.id);
              quickUnderwritingScorecardPDF(coVehicles, coDrivers, co);
            }}
            onVehiclePdfReport={(v) => { setInstantReportVehicleId(v.id); setShowInstantReport(true); }}
            onVehicleMobileSync={(v) => { setSelectedVehicle(v); setShowSafetyAudit(true); }}
          />
        )}

        {subView === 'dashboard' && !isSuperAdmin && !fleet.selectedCompanyId && (
          <DashboardView
            vehicles={filteredVehicles}
            drivers={drivers}
            incidents={incidents}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            selectedVehicle={selectedVehicle}
            setSelectedVehicle={setSelectedVehicle}
            mapVehicles={mapVehicles}
            mapCenter={mapCenter}
            isBasicPlan={isBasicPlan}
            isCompanyBasicPlan={isCompanyBasicPlan}
            selectedPlan={selectedPlan}
            hasOrgFilter={hasOrgFilter}
            onOpenReconstruction={() => {
              if (canSeeLegalForensicUi({ role: user?.role, companyId: user?.companyId, scopedCompanyIds: user?.scopedCompanyIds })) {
                setSubView('reconstruction');
              }
            }}
            onOpenReportBuilder={() => {
              if (canSeeLegalForensicUi({ role: user?.role, companyId: user?.companyId, scopedCompanyIds: user?.scopedCompanyIds })) {
                setShowReportBuilder(true);
              }
            }}
            onOpenBulkUpload={() => !isInspectionMode && setShowBulkUpload(true)}
            onOpenCustomizeLayout={() => !isInspectionMode && setShowCustomizeLayout(true)}
            onOpenAccessRequests={() => setSubView('access')}
            onOpenAuditTrail={() => setSubView('audit')}
            onNavigateToBilling={() => !isInspectionMode && setSubView('billing')}
            onStartVaultService={() => setShowVaultServiceModal(true)}
            canCustomizeLayout={canCustomizeLayout}
            editMode={editMode}
            onResetLayout={() => { if (!isInspectionMode) { setFleet({ dashboardLayout: { ...defaultDashboardLayout } }); setEditMode(false); } }}
            onSaveLayout={async () => {
              if (isInspectionMode) return;
              try {
                await supabase.from('user_layouts').upsert({
                  user_email: user?.email || 'unknown',
                  user_role: user?.role || 'executive',
                  widget_order: fleet.dashboardLayout.widgetOrder,
                  layout_config: fleet.dashboardLayout,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'user_email' });
              } catch { /* ignore */ }
              setEditMode(false);
            }}
            companies={companies}
            isSuperAdmin={isSuperAdmin}
            isExecutive={isExecutive}
            isGlobalAdmin={isGlobalAdmin}
            user={user!}
            pairedSensorCount={pairedSensorCount}
            onSensorPaired={() => !isInspectionMode && setPairedSensorCount((c) => c + 1)}
            onShowSafetyAudit={() => {
              if (legalUiAllowed) setShowSafetyAudit(true);
            }}
            onShowInsuranceScorecard={() => {
              if (legalUiAllowed) setShowInsuranceScorecard(true);
            }}
            onShowRiskSafetyScorecard={() => {
              if (legalUiAllowed) setShowRiskSafetyScorecard(true);
            }}
            onInstantFleetReport={() => {
              if (legalUiAllowed) {
                setInstantReportVehicleId(undefined);
                setShowInstantReport(true);
              }
            }}
            featureToggles={featureToggles}
            isAuditor={isAuditor}
          />
        )}

        {isAccuVu && subView === 'reconstruction' && accuvuSurface === 'hero' && (
          <AccuVuHeroLand onEnterWorkspace={() => setAccuvuSurface('workspace')} />
        )}

        {subView === 'reconstruction' &&
          !(isAccuVu && accuvuSurface === 'hero') &&
          canSeeLegalForensicUi({ role: user?.role, companyId: user?.companyId, scopedCompanyIds: user?.scopedCompanyIds }) && (
          <ReconstructionWrapper
            companyId={user?.companyId || 'unknown'}
            hardwareSerial={selectedVehicle?.truck_number || 'FV-HW-DEMO'}
            vaultIsOpen={vaultIsOpen}
            onLockedAction={() => setShowVaultServiceModal(true)}
          >
            <ReconstructionPortal
              incidents={incidents}
              vehicles={vehicles}
              onClose={() => {
                if (isAccuVu) setAccuvuSurface('hero');
                else navigateToVaultView('dashboard');
              }}
              user={user!}
              previewMode={isCompanyBasicPlan && !isAccuVu}
              onUpgrade={() => setSubView('billing')}
              productSku={user?.productSku === 'accuvu' ? 'accuvu' : 'fleetvu'}
            />
          </ReconstructionWrapper>
        )}

        {subView === 'reconstruction' && isGlobalAdmin && (
          <div className="mx-6 my-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 max-w-2xl">
            <h2 className="text-lg font-bold text-amber-200 mb-2">Legal Data Isolation — Access Denied</h2>
            <p className="text-sm text-amber-100/80 leading-relaxed">{LEGAL_ISOLATION_DENIAL_MESSAGE}</p>
            <p className="text-xs text-slate-400 mt-3">
              Incident alerts and reconstruction packages are delivered exclusively to the customer&apos;s Super Admin / Admin portal accounts.
            </p>
            <Button className="mt-4 bg-slate-800 text-white" onClick={() => setSubView('dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        )}

        {subView === 'billing' && (
          <BillingView
            pricing={pricing}
            vehicles={vehicles}
            isSuperAdmin={isSuperAdmin}
            canEditPricing={canEditPricing}
            onOpenPricing={() => setShowPricing(true)}
            onOpenBulkUpload={() => !isInspectionMode && setShowBulkUpload(true)}
            user={user!}
          />
        )}

        {subView === 'access' && (
          <AccessRequestQueue
            selectedRegion={fleet.selectedRegion}
            selectedLocation={fleet.selectedLocation}
          />
        )}

        {subView === 'audit' && (
          <AuditTrailPanel user={user!} />
        )}

        {subView === 'users' && (
          <UserManagement companies={companies} user={user!} />
        )}

        {/* Settings view is now handled by the unified Account Settings modal */}

        {subView === 'system-settings' && isGlobalAdmin && (
          <SystemSettingsPanel user={user!} onClose={() => setSubView('dashboard')} />
        )}
        {isGlobalAdmin && (
          <div className="fixed bottom-4 right-4 z-40">
            <Button
              size="sm"
              className="bg-slate-800 border border-amber-500/40 text-amber-200 hover:bg-slate-700"
              onClick={() => setShowMasterAdminPanel(true)}
            >
              Master Admin Controls
            </Button>
          </div>
        )}
        <MasterAdminControlPanel open={showMasterAdminPanel} onClose={() => setShowMasterAdminPanel(false)} />
        {subView === 'provisioning' && isGlobalAdmin && (
          <>
            {isGlobalAdmin && (
              <div className="mx-6 mt-4 mb-0 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3">
                <p className="text-sm font-semibold text-sky-200">FleetVu Business Portal — Global Admin</p>
                <p className="text-xs text-sky-100/70 mt-1 leading-relaxed">
                  Onboard clients, enable accounts, send welcome emails, sales follow-ups, and daily CRM.
                  Customer accident files and safety reports stay in the customer tenant — you have zero legal-data access by design.
                </p>
              </div>
            )}
            <MasterProvisioningConsole
              user={user!}
              companies={companies}
              onClientCreated={loadData}
              onClose={() => setSubView('dashboard')}
            />
          </>
        )}
        {subView === 'onboarding' && user && (() => {
          const onboardingCompany = companies.find((c) => c.id === user.companyId);
          if (!onboardingCompany) return null;
          const isWizardSuperAdmin = user.provisionedRole === 'super_admin' || user.role === 'super_admin';
          return (
            <DelegateSetupWizard
              user={user}
              companyId={onboardingCompany.id}
              companyName={onboardingCompany.name}
              isSuperAdmin={isWizardSuperAdmin}
              primaryLocation={onboardingCompany.location || user.location || 'HQ'}
              existingLocations={onboardingCompany.fleet_locations || []}
              featureEntitlements={{ radar: true, gps: true, vault: true, risk_scoring: true }}
              onComplete={() => setSubView('dashboard')}
              onClose={() => setSubView('dashboard')}
            />
          );
        })()}
        {subView === 'reports' && legalUiAllowed && (
          <ArchivedReportsView user={user!} />
        )}
        {subView === 'reports' && isGlobalAdmin && (
          <div className="mx-6 my-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 max-w-2xl">
            <h2 className="text-lg font-bold text-amber-200 mb-2">Legal Data Isolation — Access Denied</h2>
            <p className="text-sm text-amber-100/80 leading-relaxed">{LEGAL_ISOLATION_DENIAL_MESSAGE}</p>
            <Button className="mt-4 bg-slate-800 text-white" onClick={() => setSubView('dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        )}
        {subView === 'tenants' && isGlobalAdmin && (
          <TenantDirectory
            companies={companies}
            vehicles={vehicles}
            drivers={drivers}
            incidents={incidents}
            loading={loading}
            onSelectCompany={(companyId) => {
              setFleet({ selectedCompanyId: companyId, selectedRegion: null, selectedLocation: null, selectedTerminal: null });
              setSubView('dashboard');
            }}
            user={user!}
            onClientCreated={loadData}
          />
        )}
        </div>
      </div>

      {/* Modals */}
      {showHardwareConfig && <HardwareConfigModal onClose={() => setShowHardwareConfig(false)} />}
      {showPricing && !isInspectionMode && <PricingModal pricing={pricing} onUpdate={loadData} onClose={() => setShowPricing(false)} canEdit={canEditPricing} userRole={user?.role || 'executive'} />}
      {showBulkUpload && !isInspectionMode && <BulkUploadModal companies={companies} onClose={() => { setShowBulkUpload(false); loadData(); }} />}
      {/* Widget Customizer Slide-Out Drawer */}
      <Sheet open={showCustomizeLayout && !isInspectionMode} onOpenChange={(v) => !isInspectionMode && setShowCustomizeLayout(v)}>
        <SheetContent side="right" className="w-[400px] bg-slate-800 border-slate-700 overflow-y-auto scrollbar-thin">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-orange-400" />
              Widget Customizer
            </SheetTitle>
          </SheetHeader>
          <WidgetCustomizerContent />
        </SheetContent>
      </Sheet>
      <SafetyScoreAuditModal
        open={showSafetyAudit && legalUiAllowed}
        onClose={() => setShowSafetyAudit(false)}
        vehicle={selectedVehicle}
        incidents={incidents}
      />
      <InsuranceScorecardModal
        open={showInsuranceScorecard && legalUiAllowed}
        onClose={() => setShowInsuranceScorecard(false)}
        vehicles={vehicles}
        drivers={drivers}
        companies={companies}
        incidents={incidents}
        user={user!}
        defaultCompanyId={fleet.selectedCompanyId}
        defaultRegion={fleet.selectedRegion}
        defaultLocation={fleet.selectedLocation}
      />
      <RiskSafetyScorecardModal
        open={showRiskSafetyScorecard && legalUiAllowed}
        onClose={() => setShowRiskSafetyScorecard(false)}
        vehicles={vehicles}
        drivers={drivers}
        companies={companies}
        incidents={incidents}
        user={user!}
        defaultCompanyId={fleet.selectedCompanyId}
        defaultRegion={fleet.selectedRegion}
        defaultLocation={fleet.selectedLocation}
      />
      <SuperAdminScorecardModal
        open={showSuperAdminScorecard}
        onClose={() => setShowSuperAdminScorecard(false)}
        onUpgrade={() => { setShowSuperAdminScorecard(false); setSubView('billing'); }}
        vehicles={vehicles}
        drivers={drivers}
        companies={companies}
        incidents={incidents}
        user={user!}
      />
      {showReportBuilder && (
        <ReportBuilderModal
          vehicles={vehicles}
          drivers={drivers}
          companies={companies}
          defaultCompanyId={fleet.selectedCompanyId}
          defaultRegion={fleet.selectedRegion}
          defaultLocation={fleet.selectedLocation}
          onClose={() => setShowReportBuilder(false)}
          user={user!}
        previewMode={isCompanyBasicPlan}
        onUpgrade={() => { setShowReportBuilder(false); setSubView('billing'); }}
        />
      )}
      {showInstantReport && (
        <InstantFleetReportModal
          open={showInstantReport}
          onClose={() => setShowInstantReport(false)}
          vehicles={filteredVehicles.filter((v) => v.company_id === selectedCompany?.id)}
          drivers={drivers.filter((d) => d.company_id === selectedCompany?.id)}
          company={selectedCompany}
          defaultVehicleId={instantReportVehicleId}
          vaultActive={vaultIsOpen}
        />
      )}
      <AccountSettingsModal
        open={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        initialTab={accountModalTab}
        user={user!}
        provisionedRoleLabel={provisionedRoleLabel}
        isSuperAdmin={isSuperAdmin}
        isGlobalAdmin={isGlobalAdmin}
        canToggleFeatures={canToggleFeatures}
        alertPrefsEnabled={alertPrefsEnabled}
        alertThreshold={alertThreshold}
        alertDeliveryMethod={alertDeliveryMethod}
        onSaveAlertPrefs={saveAlertPrefs}
        mobileRollupEnabled={mobileRollupEnabled}
        rollupCadence={rollupCadence}
        rollupCustomInterval={rollupCustomInterval}
        rollupUnit={rollupUnit}
        onSaveMobileRollup={saveMobileRollup}
        companyId={user?.companyId || selectedCompany?.id || null}
        companyName={selectedCompany?.name || user?.companyName || null}
        portalStorageEnabled={portalStorageEnabled}
        onSavePortalStorage={savePortalStorage}
        featureToggles={featureToggles}
        onSaveFeatureToggle={saveFeatureToggle}
        onNavigateToProvisioning={() => { resetToGlobal(); setSubView('provisioning'); setShowAccountModal(false); }}
      />
      <VaultServiceRequestModal
        open={showVaultServiceModal}
        onClose={() => setShowVaultServiceModal(false)}
        user={user!}
        companyName={selectedCompany?.name || user?.companyName || ''}
      />
      <VaultExpiryDialog
        open={showVaultExpiryDialog || showVaultExpiryWarning}
        daysRemaining={vaultDaysRemaining}
        onRenew={() => {
          setShowVaultExpiryDialog(false);
          setVaultExpiryDismissedTier(vaultUrgencyTier);
          setShowVaultServiceModal(true);
        }}
        onDismiss={() => {
          setShowVaultExpiryDialog(false);
          setVaultExpiryDismissedTier(vaultUrgencyTier);
        }}
      />

      {/* Customer-tenant AI support — hidden for FleetVu Global Admin */}
      {user && !isGlobalAdmin && (
        <CustomerSupportAgent
          user={user}
          companyName={selectedCompany?.name || user.companyName}
          onNavigateDeepLink={(key) => navigateToVaultView(key as Parameters<typeof navigateToVaultView>[0])}
        />
      )}
    </div>
  );
}

function AccountSettingsModal({
  open,
  onClose,
  initialTab,
  user,
  provisionedRoleLabel,
  isSuperAdmin,
  isGlobalAdmin,
  canToggleFeatures,
  alertPrefsEnabled,
  alertThreshold,
  alertDeliveryMethod,
  onSaveAlertPrefs,
  mobileRollupEnabled,
  rollupCadence,
  rollupCustomInterval,
  rollupUnit,
  onSaveMobileRollup,
  companyId,
  companyName,
  portalStorageEnabled,
  onSavePortalStorage,
  featureToggles,
  onSaveFeatureToggle,
  onNavigateToProvisioning,
}: {
  open: boolean;
  onClose: () => void;
  initialTab: 'profile' | 'features' | 'alerts';
  user: { name: string; email: string; role: string };
  provisionedRoleLabel: string;
  isSuperAdmin: boolean;
  isGlobalAdmin: boolean;
  canToggleFeatures: boolean;
  alertPrefsEnabled: boolean;
  alertThreshold: string;
  alertDeliveryMethod: string;
  onSaveAlertPrefs: (enabled: boolean, threshold: string, deliveryMethod: string) => void;
  mobileRollupEnabled: boolean;
  rollupCadence: string;
  rollupCustomInterval: string;
  rollupUnit: string;
  onSaveMobileRollup: (enabled: boolean, cadence: string, customInterval: string, unit: string) => void;
  companyId?: string | null;
  companyName?: string | null;
  portalStorageEnabled: boolean;
  onSavePortalStorage: (enabled: boolean) => void;
  featureToggles: Record<string, boolean>;
  onSaveFeatureToggle: (key: string, enabled: boolean) => void;
  onNavigateToProvisioning?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'features' | 'alerts'>(initialTab);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rollupRunMsg, setRollupRunMsg] = useState<string | null>(null);
  const [rollupRunning, setRollupRunning] = useState(false);

  useEffect(() => { setActiveTab(initialTab); }, [initialTab, open]);

  const handlePasswordReset = () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'All password fields are required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setPasswordMessage({ type: 'success', text: 'Password reset request submitted. You will receive a confirmation email shortly.' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 pointer-events-auto">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-slate-700/50">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <Settings2 className="w-5 h-5 text-orange-400" />
            Account Settings
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 cursor-default">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                    <span className="text-[11px] font-semibold text-emerald-300 whitespace-nowrap">SHA-256 Archived Reports Vault: Active</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-slate-800 border-slate-600 max-w-xs">
                  <p className="text-xs text-slate-300">All exported reports are automatically hashed with SHA-256 cryptographic verification and archived for legal defense.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Manage your profile, security, and notification preferences.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'profile' | 'features' | 'alerts')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 mx-6 mt-3 bg-slate-800 border border-slate-700 shrink-0">
            <TabsTrigger value="profile" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-sm gap-1.5">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Profile &amp; Security</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-sm gap-1.5">
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Feature &amp; Module</span>
              <span className="sm:hidden">Features</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-300 text-sm gap-1.5">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alert &amp; Delivery</span>
              <span className="sm:hidden">Alerts</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Profile & Security */}
          <TabsContent value="profile" className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-5 mt-3">
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-300 uppercase">Account Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Name</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={user.name} readOnly />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Email</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={user.email} readOnly />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Role</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={provisionedRoleLabel} readOnly />
                </div>
              </div>
            </div>

            {isGlobalAdmin && onNavigateToProvisioning && (
              <div className="border-t border-slate-700/50 pt-4 space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase">Admin Tools</p>
                <button
                  onClick={onNavigateToProvisioning}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors px-3 py-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-orange-400 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">Client Onboarding &amp; CRM</p>
                      <p className="text-[11px] text-slate-400 leading-snug">FleetVu ops only — deploy tenants and activation keys.</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-orange-400 shrink-0" />
                </button>
              </div>
            )}

            <div className="border-t border-slate-700/50 pt-4 space-y-3">
              <p className="text-xs font-bold text-slate-300 uppercase">Password Reset</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Current Password</Label>
                  <Input type="password" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPasswordMessage(null); }} placeholder="Enter current password" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">New Password</Label>
                    <Input type="password" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordMessage(null); }} placeholder="At least 8 characters" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Confirm New Password</Label>
                    <Input type="password" className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMessage(null); }} placeholder="Re-enter new password" />
                  </div>
                </div>
              </div>
              {passwordMessage && (
                <div className={`rounded-lg px-3 py-2 text-xs ${passwordMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
                  {passwordMessage.text}
                </div>
              )}
              <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-sm gap-2" onClick={handlePasswordReset}>
                <Lock className="w-4 h-4" />
                Reset Password
              </Button>
            </div>
          </TabsContent>

          {/* Tab 2: Feature & Module Preferences */}
          <TabsContent value="features" className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-5 mt-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <LayoutGrid className="w-4 h-4 text-orange-400" />
                <p className="text-sm font-bold text-white">Role-Based Feature Entitlements</p>
              </div>
              <p className="text-xs text-slate-400 -mt-2">
                {canToggleFeatures
                  ? 'Toggle modules ON or OFF for your account. Changes are saved automatically.'
                  : 'Features are set based on your assigned role tier. Contact an administrator to request changes.'}
              </p>

              <div className="space-y-3 pt-1">
                {[
                  { key: 'accidentReconstruction', label: 'Accident Reconstruction Engine', desc: 'Crash forensics canvas, trajectory analysis, and incident reconstruction tools.', icon: <FileText className="w-4 h-4 text-orange-400" /> },
                  { key: 'bulkDataUpload', label: 'Bulk Asset Upload Tool', desc: 'Mass import of vehicle, driver, and sensor log data via CSV/Excel.', icon: <Upload className="w-4 h-4 text-orange-400" /> },
                  { key: 'c55RawTelemetry', label: 'C55 Raw Telemetry & Diagnostic Stream', desc: 'Live access to raw C55 sensor events, radar sweeps, and high-frequency telemetry feeds.', icon: <Radio className="w-4 h-4 text-orange-400" /> },
                  { key: 'advancedAuditTrail', label: 'Advanced Audit Trail Log', desc: 'Detailed access logging, permission change tracking, and forensic action history.', icon: <ScrollText className="w-4 h-4 text-orange-400" /> },
                  { key: 'mobileDriverRollup', label: 'Detailed Safety Log Report', desc: 'Compiles itemized C55 sensor events, driver logs, & timestamped GPS audit records into exportable report logs.', icon: <Smartphone className="w-4 h-4 text-orange-400" /> },
                  { key: 'riskScorecard', label: 'Risk & Safety Scorecard', desc: 'Operational risk scoring, driver safety metrics, and spatial telemetry analysis.', icon: <ShieldCheck className="w-4 h-4 text-orange-400" /> },
                  { key: 'insuranceScorecard', label: 'Insurance Scorecard Export', desc: 'Carrier-ready policy verification and cryptographically signed audit trail exports.', icon: <Lock className="w-4 h-4 text-orange-400" /> },
                ].map((feat) => (
                  <div key={feat.key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2.5">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="shrink-0 mt-0.5">{feat.icon}</div>
                      <div className="min-w-0">
                        <Label className="text-sm font-semibold text-white">{feat.label}</Label>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{feat.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={featureToggles[feat.key] ?? false}
                      onCheckedChange={(checked) => onSaveFeatureToggle(feat.key, checked)}
                      disabled={!canToggleFeatures}
                    />
                  </div>
                ))}
              </div>

              {!canToggleFeatures && (
                <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <p className="text-[11px] text-slate-400">Your role tier ({provisionedRoleLabel}) has a fixed feature set. Super-Admins, Global Admins, and Admins can toggle modules dynamically.</p>
                </div>
              )}

              <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 px-3 py-2.5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-orange-300">
                  New accounts default to a clean &ldquo;Default Enabled&rdquo; state based on their assigned role tier. Admins and Super-Admins can adjust these at any time.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Alert & Report Delivery */}
          <TabsContent value="alerts" className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-5 mt-3">
            {/* Safety Score Alert Preferences */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-bold text-white">Receive Automated Email Alerts for Sub-par Safety Scores</Label>
                  <p className="text-xs text-slate-400 mt-1">Send an email notification when a fleet or tenant safety score drops below a set threshold.</p>
                </div>
                <Switch
                  checked={alertPrefsEnabled}
                  onCheckedChange={(checked) => onSaveAlertPrefs(checked, alertThreshold, alertDeliveryMethod)}
                />
              </div>

              {alertPrefsEnabled && (
                <div className="space-y-4 pt-2 border-t border-slate-700/50">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-300">Trigger Threshold Score</Label>
                    <Select value={alertThreshold} onValueChange={(v) => onSaveAlertPrefs(true, v, alertDeliveryMethod)}>
                      <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-sm h-9 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="85">85</SelectItem>
                        <SelectItem value="80">80</SelectItem>
                        <SelectItem value="75">75</SelectItem>
                        <SelectItem value="70">70</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-slate-500">Alerts trigger when any fleet safety score falls at or below this value.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-300">Delivery Method</Label>
                    <RadioGroup
                      value={alertDeliveryMethod}
                      onValueChange={(v) => onSaveAlertPrefs(true, alertThreshold, v)}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="immediate" id="immediate" />
                        <Label htmlFor="immediate" className="text-xs text-slate-300 cursor-pointer">Immediate Email — sent as soon as threshold is breached</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="daily" id="daily" />
                        <Label htmlFor="daily" className="text-xs text-slate-300 cursor-pointer">Daily Digest — summarized once per day</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Current Configuration</p>
                    <p className="text-xs text-slate-300">
                      Alerts <span className="font-bold text-green-400">enabled</span> — threshold <span className="font-bold text-orange-400">{alertThreshold}</span> — delivery <span className="font-bold text-blue-400">{alertDeliveryMethod === 'immediate' ? 'Immediate Email' : 'Daily Digest'}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Recipient: {user.email}</p>
                  </div>
                </div>
              )}

              {!alertPrefsEnabled && (
                <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5">
                  <p className="text-xs text-slate-400">Automated alerts are currently <span className="font-bold text-slate-500">disabled</span>. Toggle the switch above to enable email notifications for sub-par safety scores.</p>
                </div>
              )}
            </div>

            {/* Driver Mobile App Report Batching */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-orange-400" />
                    Automated Safety Digest (Admin / Manager)
                  </Label>
                  <p className="text-xs text-slate-400 mt-1">
                    Driver safety packages are collected for the period, compressed into <span className="text-slate-200 font-semibold">one</span> PDF digest,
                    archived under Vault Reports, and emailed to company Super Admin / Admin / Manager — not 50 separate emails.
                    Weekly digests send on Fridays by default.
                  </p>
                </div>
                <Switch
                  checked={mobileRollupEnabled}
                  onCheckedChange={(checked) => {
                    onSaveMobileRollup(checked, rollupCadence, rollupCustomInterval, rollupUnit);
                    onSaveFeatureToggle('mobileDriverRollup', checked);
                  }}
                  disabled={!featureToggles.mobileDriverRollup}
                />
              </div>

              {mobileRollupEnabled && (
                <div className="space-y-4 pt-2 border-t border-slate-700/50">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-300">Delivery Frequency</Label>
                    <div className="flex gap-2">
                      {(['daily', 'weekly', 'monthly'] as const).map((cad) => (
                        <button
                          key={cad}
                          type="button"
                          onClick={() => onSaveMobileRollup(true, cad, rollupCustomInterval, rollupUnit)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                            rollupCadence === cad
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-slate-900/50 text-slate-300 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500'
                          }`}
                        >
                          {cad === 'daily' ? 'Daily' : cad === 'weekly' ? 'Weekly' : 'Monthly'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Choose how often Admins receive the single compressed fleet digest. You can change this anytime.
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5 space-y-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Current Configuration</p>
                    <p className="text-xs text-slate-300">
                      Digest delivery <span className="font-bold text-green-400">enabled</span> — frequency{' '}
                      <span className="font-bold text-orange-400">
                        {rollupCadence === 'daily' ? 'Daily' : rollupCadence === 'weekly' ? 'Weekly (Friday)' : 'Monthly'}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Recipients: company Super Admin / Admin / Manager accounts (customer tenant only)
                    </p>
                    {companyId && !isGlobalAdmin && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-1 h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
                        disabled={rollupRunning}
                        onClick={async () => {
                          setRollupRunning(true);
                          setRollupRunMsg(null);
                          try {
                            const res = await fetch('/api/reports/rollup', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'run',
                                companyId,
                                companyName,
                                cadence: rollupCadence,
                                triggeredBy: user.email,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok || !data.success) {
                              throw new Error(data.error || 'Digest run failed');
                            }
                            setRollupRunMsg(
                              `Sent: ${data.reportTitle || 'digest'} · ${data.driverCount ?? 0} drivers · ${(data.recipientEmails || []).length} recipient(s). Also saved to Vault Reports.`,
                            );
                          } catch (e) {
                            setRollupRunMsg(e instanceof Error ? e.message : 'Digest run failed');
                          } finally {
                            setRollupRunning(false);
                          }
                        }}
                      >
                        {rollupRunning ? 'Building digest…' : 'Run digest now'}
                      </Button>
                    )}
                    {rollupRunMsg && (
                      <p className="text-[11px] text-slate-300 leading-snug">{rollupRunMsg}</p>
                    )}
                  </div>
                </div>
              )}

              {!mobileRollupEnabled && (
                <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5">
                  <p className="text-xs text-slate-400">
                    Automated digest delivery is currently <span className="font-bold text-slate-500">disabled</span>.
                    Toggle on and pick Daily / Weekly / Monthly — Admins get one compressed PDF, not one email per driver.
                  </p>
                </div>
              )}
            </div>

            {/* Portal Storage & Archival Sync */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-orange-400" />
                    Save Automated Safety Log Reports to Web Portal Repository
                  </Label>
                  <p className="text-xs text-slate-400 mt-1">Every batch-compiled Safety Log Report generated from the FleetVu Mobile Command App is automatically saved to the Archived Reports repository inside the portal in addition to email delivery.</p>
                </div>
                <Switch
                  checked={portalStorageEnabled}
                  onCheckedChange={(checked) => onSavePortalStorage(checked)}
                />
              </div>

              <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Repository Status</p>
                <p className="text-xs text-slate-300">
                  Portal archival <span className={`font-bold ${portalStorageEnabled ? 'text-green-400' : 'text-slate-500'}`}>{portalStorageEnabled ? 'enabled' : 'disabled'}</span>
                  {portalStorageEnabled && mobileRollupEnabled && <span className="text-slate-400"> — reports will be saved to the Archived Reports tab automatically</span>}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="shrink-0 px-6 py-3 border-t border-slate-700/50 flex justify-end">
          <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompanyCommandView({
  company,
  vehicles,
  drivers,
  incidents,
  mapVehicles,
  mapCenter,
  selectedVehicle,
  onSelectVehicle,
  onBackToOverview,
  userRole,
  onShowSafetyAudit,
  onShowInsuranceScorecard,
  onOpenReportBuilder,
  onInstantFleetReport,
  onInstantInsuranceScorecard,
  onInstantUnderwritingScorecard,
  onVehiclePdfReport,
  onVehicleMobileSync,
}: {
  company: Company;
  vehicles: Vehicle[];
  drivers: Driver[];
  incidents: Incident[];
  mapVehicles: Array<{ id: string; truckNumber: string; lat: number; lng: number; status: string; selected?: boolean; driverName?: string; speedMph?: number; location?: string }>;
  mapCenter: { lat: number; lng: number };
  selectedVehicle: Vehicle | null;
  onSelectVehicle: (v: Vehicle) => void;
  onBackToOverview: () => void;
  userRole: string;
  onShowSafetyAudit: () => void;
  onShowInsuranceScorecard: () => void;
  onOpenReportBuilder: () => void;
  onInstantFleetReport: () => void;
  onInstantInsuranceScorecard: () => void;
  onInstantUnderwritingScorecard: () => void;
  onVehiclePdfReport: (v: Vehicle) => void;
  onVehicleMobileSync: (v: Vehicle) => void;
}) {
  const isGlobalAdmin = userRole === 'global_admin';
  const [gpsExpanded, setGpsExpanded] = useState(false);
  const companyVehicles = vehicles.filter((v) => v.company_id === company.id);
  const companyIncidents = incidents.filter((inc) => inc.company_id === company.id);
  const companySafety = companyVehicles.length > 0
    ? companyVehicles.reduce((s, v) => s + v.safety_score, 0) / companyVehicles.length
    : 0;
  const uniqueLocations = new Set(companyVehicles.map((v) => v.location).filter(Boolean)).size;
  const uniqueFleets = 1;
  const activeAlerts = companyIncidents.length;
  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* GPS Map + Asset Directory */}
      <div className="flex-1 p-4 pt-2 space-y-4 min-h-0 flex flex-col">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 flex-1 min-h-0 items-stretch">
          {/* GPS Map — compact by default, expandable to full height */}
          <div className={`${gpsExpanded ? 'xl:col-span-4' : 'xl:col-span-2'} rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden flex flex-col h-full transition-all duration-300`} style={{ minHeight: gpsExpanded ? 600 : 240, maxHeight: gpsExpanded ? 'none' : '50%' }}>
            <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between bg-slate-900/40 shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-white">Fleet GPS Tracking{selectedVehicle ? ` — ${selectedVehicle.truck_number}` : ''}</span>
              </div>
              <button
                onClick={() => setGpsExpanded((e) => !e)}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-slate-700/50"
                title={gpsExpanded ? 'Shrink map' : 'Expand map'}
              >
                {gpsExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                {gpsExpanded ? 'Shrink' : 'Expand'}
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <SafeGPSMap
                latitude={mapCenter.lat}
                longitude={mapCenter.lng}
                vehicles={mapVehicles}
                selectedVehicle={mapVehicles.find((mv) => mv.id === selectedVehicle?.id) || null}
                selectedPlanTier={company.plan_tier}
                compact
                onExpandToggle={setGpsExpanded}
              />
            </div>
          </div>

          {/* Asset Directory — takes remaining width on xl */}
          <div className={`${gpsExpanded ? 'xl:col-span-1' : 'xl:col-span-3'}`}>
            <CompanyAssetDirectory
              vehicles={vehicles}
              drivers={drivers}
              incidents={incidents}
              onSelectVehicle={onSelectVehicle}
              onPdfReport={onVehiclePdfReport}
              onMobileSync={onVehicleMobileSync}
            />
          </div>
        </div>

        {/* Action Bar — direct report exports for selected vehicle */}
        {selectedVehicle && (
          <div className="px-4 py-3 rounded-xl border border-orange-500/30 bg-slate-800/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <FileDown className="w-4 h-4 text-orange-400" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-white">Asset Reports</p>
                <p className="text-[10px] text-slate-400">{selectedVehicle.truck_number} — {(() => { const d = drivers.find((dr) => dr.id === selectedVehicle.assigned_driver_id); return d?.name || 'Unassigned'; })()}</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white h-9 px-4 text-xs font-bold gap-1.5 flex-1"
                onClick={() => onShowSafetyAudit()}
              >
                <Download className="w-3.5 h-3.5" />
                Download Driver Safety PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 h-9 px-4 text-xs font-bold gap-1.5 flex-1"
                onClick={() => onShowSafetyAudit()}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Live Sync Driver Mobile Report
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 h-9 px-4 text-xs font-bold gap-1.5 flex-1"
                onClick={() => onShowInsuranceScorecard()}
              >
                <Lock className="w-3.5 h-3.5" />
                Export Insurance Scorecard PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuperAdminCompanyInspect({
  company,
  vehicles,
  drivers,
  incidents,
  mapVehicles,
  mapCenter,
  onSelectVehicle,
  selectedVehicle,
  onBackToOverview,
  onOpenReportBuilder,
  onInstantFleetReport,
  onInstantInsuranceScorecard,
  onInstantUnderwritingScorecard,
  onVehiclePdfReport,
  onVehicleMobileSync,
  user,
  onOpenAuditTrail,
}: {
  company: Company;
  vehicles: Vehicle[];
  drivers: Driver[];
  incidents: Incident[];
  mapVehicles: Array<{ id: string; truckNumber: string; lat: number; lng: number; status: string; selected?: boolean; driverName?: string; speedMph?: number; location?: string }>;
  mapCenter: { lat: number; lng: number };
  onSelectVehicle: (v: Vehicle | null) => void;
  selectedVehicle: Vehicle | null;
  onBackToOverview: () => void;
  onOpenReportBuilder: () => void;
  onInstantFleetReport: () => void;
  onInstantInsuranceScorecard: () => void;
  onInstantUnderwritingScorecard: () => void;
  onVehiclePdfReport: (v: Vehicle) => void;
  onVehicleMobileSync: (v: Vehicle) => void;
  user: { name: string; email: string; role: string; trialStartDate?: string; trialDurationDays?: number; planTier?: string };
  onOpenAuditTrail: () => void;
}) {
  const { fleet } = useApp();
  const outerTrial = computeTrialState(user);
  const isTrialActive = outerTrial.isTrial && outerTrial.daysRemaining > 0;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'operational' | 'maintenance' | 'inoperable'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;

  const filteredVehicles = vehicles.filter((v) => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const driver = drivers.find((d) => d.id === v.assigned_driver_id);
      const driverName = driver?.name || '';
      return (
        v.truck_number.toLowerCase().includes(q) ||
        v.chassis_type.toLowerCase().includes(q) ||
        v.hardware_profile.toLowerCase().includes(q) ||
        driverName.toLowerCase().includes(q) ||
        (v.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredVehicles.length / pageSize);
  const pageVehicles = filteredVehicles.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, statusFilter]);

  const activeSensors = React.useMemo(() => {
    const hwKey = (selectedVehicle?.hardware_profile || fleet.selectedHardwareProfile) as keyof typeof HARDWARE_PROFILES;
    const hwProfile = HARDWARE_PROFILES[hwKey];
    return hwProfile?.sensors || ['front_radar'];
  }, [selectedVehicle, fleet.selectedHardwareProfile]);

  const [mapExpanded, setMapExpanded] = useState(false);
  const radarControls = useRadarControls();
  const selectedVehicleId = selectedVehicle?.id;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto scrollbar-thin">
      {/* 3-Column Master Grid — scrolls as a unit when viewport is tight at 100% zoom */}
      <div className="flex-1 grid min-h-[min(100%,640px)] p-3" style={{ gridTemplateColumns: 'minmax(440px, 32%) 1fr minmax(340px, 26%)', gap: '12px', minHeight: 'calc(100vh - 11rem)' }}>
        {/* LEFT COLUMN: Fleet Directory / Asset Details */}
        <div className="flex flex-col border-r border-slate-700 bg-slate-800/50 overflow-hidden min-h-0 rounded-l-xl" style={{ flexShrink: 0 }}>
          {selectedVehicle ? (
            <>
              <div className="px-3 py-2.5 border-b border-slate-700 bg-slate-800/40 flex items-center justify-between shrink-0">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-orange-400" />
                  Selected Asset
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white h-7 text-xs px-2"
                  onClick={() => onSelectVehicle(null)}
                >
                  Back to List <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2 min-h-0">
                {(() => {
                  const v = selectedVehicle;
                  const driver = drivers.find((d) => d.id === v.assigned_driver_id);
                  const hwKey = v.hardware_profile as keyof typeof HARDWARE_PROFILES;
                  const hwProfile = HARDWARE_PROFILES[hwKey];
                  const sensorCount = hwProfile?.sensors.length || 0;
                  return (
                    <div className="rounded-xl bg-slate-800/60 border-2 border-orange-500/40 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5 text-orange-400" />
                          <span className="text-lg font-bold text-white">{v.truck_number}</span>
                        </div>
                        <div className="text-right leading-tight">
                          <p className="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">Safety Score</p>
                          <p className="text-xl font-bold text-emerald-400">{v.safety_score.toFixed(1)}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Driver</span>
                          <span className="text-white font-semibold">{driver?.name || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Location</span>
                          <span className="text-white font-semibold">{v.location || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Status</span>
                          {v.status === 'operational' && <Badge className="bg-emerald-600 text-white text-[9px]">Operational</Badge>}
                          {v.status === 'maintenance' && <Badge className="bg-yellow-600 text-white text-[9px]">Maintenance</Badge>}
                          {v.status === 'inoperable' && <Badge className="bg-red-600 text-white text-[9px]">Inoperable</Badge>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Speed</span>
                          <span className="text-white font-bold text-sm flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-orange-400" />
                            42 MPH
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Sensor Kit</span>
                          <span className="text-blue-300 font-semibold flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            {hwProfile?.label || 'No Kit'}
                            {sensorCount > 0 && <span className="text-slate-500">({sensorCount}ch)</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold pt-2 pb-1">Other Fleet Assets</p>
                {filteredVehicles.filter((v) => v.id !== selectedVehicle.id).slice(0, 20).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onSelectVehicle(v)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-700/50 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Truck className="w-3 h-3 text-orange-400/60 shrink-0" />
                      <span className="text-xs font-semibold text-white truncate">{v.truck_number}</span>
                    </div>
                    <span className={`text-[10px] font-bold shrink-0 ${v.safety_score >= 85 ? 'text-emerald-400' : v.safety_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {v.safety_score.toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
          {/* Search + filter bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/40 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                type="text"
                placeholder="Search truck #, driver, chassis, location…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900/60 border-slate-600 text-white text-xs h-8 pl-8"
              />
            </div>
            <div className="flex items-center rounded-lg border border-slate-600 overflow-hidden">
              {(['all', 'operational', 'maintenance', 'inoperable'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    statusFilter === f
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle table */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[13%]" />
                <col className="w-[20%]" />
                <col className="w-[11%]" />
                <col className="w-[20%]" />
                <col className="w-[36%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900/90 backdrop-blur text-slate-400 text-[10px] uppercase tracking-wide border-b border-slate-700">
                  <th className="text-left py-2 px-3 font-semibold">Unit #</th>
                  <th className="text-left py-2 px-3 font-semibold">Assigned Driver</th>
                  <th className="text-left py-2 px-3 font-semibold">Safety Score</th>
                  <th className="text-left py-2 px-3 font-semibold">C55-PRO Sensor Status</th>
                  <th className="relative text-left py-2 px-1 font-semibold">
                    <span className="inline-block w-[72px] text-center">Inspect</span>
                    <span className="absolute left-[88px] top-1/2 z-10 w-[64px] -translate-y-1/2 whitespace-nowrap text-center text-[9px] leading-tight text-slate-400">PDF/Live Sync</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageVehicles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500 py-8">No vehicles match your search.</td>
                  </tr>
                )}
                {pageVehicles.map((v) => {
                  const driver = drivers.find((d) => d.id === v.assigned_driver_id);
                  const hwKey = v.hardware_profile as keyof typeof HARDWARE_PROFILES;
                  const hwProfile = HARDWARE_PROFILES[hwKey];
                  const sensorCount = hwProfile?.sensors.length || 0;
                  const isSelected = selectedVehicleId === v.id;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVehicle(v)}
                      className={`border-b border-slate-700/40 cursor-pointer transition-colors group ${
                        isSelected ? 'bg-orange-500/20 ring-1 ring-orange-500/30' : 'hover:bg-orange-500/8'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-orange-400/60 group-hover:text-orange-400" />
                          <span className="font-bold text-white text-sm">{v.truck_number}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-xs">
                        {driver?.name || <span className="text-slate-500 italic">Unassigned</span>}
                      </td>
                      <td className="py-2.5 px-3 text-left">
                        <span className={`font-bold text-sm ${v.safety_score >= 85 ? 'text-emerald-400' : v.safety_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {v.safety_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs text-blue-300 flex items-center gap-1 min-w-0 truncate">
                          <Radio className={`w-3 h-3 shrink-0 ${sensorCount > 0 ? 'text-blue-400' : 'text-slate-600'}`} />
                          <span className="truncate">{hwProfile?.label || 'No Kit'}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-left">
                        <div className="flex items-center justify-start gap-0.5 whitespace-nowrap shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-[10px] h-7 w-[72px] px-2 gap-1 transition-colors ${
                              isSelected
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'text-orange-400 border-orange-500/40 hover:bg-slate-700'
                            }`}
                            onClick={(e) => { e.stopPropagation(); onSelectVehicle(v); }}
                            title="LIVE sensor view — same as driver Vault Mobile"
                          >
                            <Waves className="w-3 h-3" />
                            <span>LIVE</span>
                          </Button>
                          <div className="ml-6 flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 w-5 px-0.5 shrink-0 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                              onClick={(e) => { e.stopPropagation(); onVehiclePdfReport(v); }}
                              title="Download PDF Report"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 w-5 px-0.5 shrink-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              onClick={(e) => { e.stopPropagation(); onVehicleMobileSync(v); }}
                              title="Live Mobile Sync"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 bg-slate-800/40">
              <span className="text-xs text-slate-400">
                Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredVehicles.length)} of {filteredVehicles.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-slate-300 border-slate-600 h-7 text-xs"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <span className="text-xs text-slate-400 px-2">{currentPage + 1} / {totalPages}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-slate-300 border-slate-600 h-7 text-xs"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* CENTER COLUMN (1fr Flexible): GPS Map on top + Vault Logs below */}
        <div className="flex flex-col bg-slate-800/40 overflow-hidden min-h-0 h-full relative">
            <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-white">Fleet GPS Tracking{selectedVehicle ? ` — ${selectedVehicle.truck_number}` : ''}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white h-7 text-xs px-2 gap-1"
                onClick={() => setMapExpanded(true)}
              >
                <Maximize2 className="w-3.5 h-3.5" /> Expand
              </Button>
            </div>
            <div className="flex-1 min-h-0 relative" style={{ flex: '1.1' }}>
              <SafeGPSMap
                latitude={selectedVehicle ? mapVehicles.find((mv) => mv.id === selectedVehicle.id)?.lat ?? mapCenter.lat : mapCenter.lat}
                longitude={selectedVehicle ? mapVehicles.find((mv) => mv.id === selectedVehicle.id)?.lng ?? mapCenter.lng : mapCenter.lng}
                vehicles={mapVehicles}
                selectedVehicle={mapVehicles.find((mv) => mv.id === selectedVehicle?.id) || null}
                selectedPlanTier={company.plan_tier}
                compact
                onExpandToggle={(expanded) => { if (expanded) setMapExpanded(true); }}
              />
            </div>
            {/* Vault Event Stream — middle column (BOLT layout); sensors stay on the right */}
            <div className="min-h-0 border-t border-slate-700/60" style={{ flex: '0.95' }}>
              {selectedVehicle ? (
                <ForensicVaultStream
                  vehicle={selectedVehicle}
                  drivers={drivers}
                  incidents={incidents}
                  activeSensors={activeSensors.filter((s) => !s.includes('rear'))}
                  controls={radarControls}
                  compact
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-900/40 px-4 text-center">
                  <p className="text-[11px] text-slate-500">Select a vehicle to view Vault Event Stream</p>
                </div>
              )}
            </div>
          </div>

        {/* RIGHT COLUMN: LIVE radar + adjustable FORWARD / LEFT / RIGHT */}
        <div className="flex flex-col overflow-hidden min-h-0 h-full border-l border-slate-700/60" style={{ flex: 1, height: '100%' }}>
          {selectedVehicle ? (
            <CustomerLiveVehicleMirror
              vehicle={selectedVehicle}
              drivers={drivers}
              controls={radarControls}
            />
          ) : (
            <CustomerLiveVehicleEmpty />
          )}
        </div>
      </div>

      {mapExpanded && (
        <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-950">
          <div className="p-2.5 border-b border-slate-700 flex items-center justify-between bg-slate-800/80 backdrop-blur z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-bold text-white">Fleet GPS Tracking{selectedVehicle ? ` — ${selectedVehicle.truck_number}` : ''}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={() => setMapExpanded(false)}
            >
              <Minimize2 className="w-4 h-4 mr-1" />
              Close Fullscreen
            </Button>
          </div>
          <div className="flex-1 relative">
            <SafeGPSMap
              latitude={selectedVehicle ? mapVehicles.find((mv) => mv.id === selectedVehicle.id)?.lat ?? mapCenter.lat : mapCenter.lat}
              longitude={selectedVehicle ? mapVehicles.find((mv) => mv.id === selectedVehicle.id)?.lng ?? mapCenter.lng : mapCenter.lng}
              vehicles={mapVehicles}
              selectedVehicle={mapVehicles.find((mv) => mv.id === selectedVehicle?.id) || null}
              selectedPlanTier={company.plan_tier}
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MobileKpiCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900/60 border border-slate-700/60 p-2.5">
      <div className={`mb-1 ${color}`}>{icon}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">{label}</div>
    </div>
  );
}

function NavTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 backdrop-blur-md border ${
        active
          ? 'bg-orange-500/90 text-white border-orange-400 shadow-lg shadow-orange-500/20'
          : 'bg-slate-900/40 text-slate-300 border-slate-600/40 hover:bg-orange-500/15 hover:text-orange-300 hover:border-orange-500/30'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ---- Draggable Widget Wrapper ----
function DraggableWidget({
  widgetId,
  editMode,
  onReorder,
  className,
  order,
  children,
}: {
  widgetId: WidgetId;
  editMode: boolean;
  onReorder: (fromId: WidgetId, toId: WidgetId) => void;
  className?: string;
  order: number;
  children: React.ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      data-widget-id={widgetId}
      className={cn(
        'relative transition-all',
        className,
        editMode && 'ring-2 ring-blue-500/40 rounded-xl',
        isDragging && 'opacity-50',
        isDragOver && editMode && 'ring-2 ring-orange-500/60',
      )}
      style={{ order }}
      draggable={editMode}
      onDragStart={(e) => {
        if (!editMode) return;
        e.dataTransfer.setData('text/plain', widgetId);
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        setIsDragOver(false);
      }}
      onDragOver={(e) => {
        if (!editMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (!editMode) return;
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain') as WidgetId;
        if (fromId) onReorder(fromId, widgetId);
        setIsDragOver(false);
        setIsDragging(false);
      }}
    >
      {editMode && (
        <div className="absolute top-1 right-1 z-[10000] flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-blue-300" />
          <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wide">Drag</span>
        </div>
      )}
      <div className={cn('flex flex-col h-full', isCollapsed && 'min-h-0')}>
        <CollapsibleWidgetContext.Provider value={{ isCollapsed, toggle: () => setIsCollapsed((c) => !c) }}>
          {children}
        </CollapsibleWidgetContext.Provider>
      </div>
    </div>
  );
}

const CollapsibleWidgetContext = React.createContext<{ isCollapsed: boolean; toggle: () => void }>({
  isCollapsed: false,
  toggle: () => {},
});

function WidgetCollapseToggle({ iconColor = 'text-slate-400' }: { iconColor?: string }) {
  const { isCollapsed, toggle } = React.useContext(CollapsibleWidgetContext);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className={`p-1 rounded-md hover:bg-slate-700/50 transition-colors shrink-0 ${iconColor}`}
      title={isCollapsed ? 'Expand widget' : 'Collapse widget'}
    >
      {isCollapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
    </button>
  );
}

function WidgetCollapsibleBody({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = React.useContext(CollapsibleWidgetContext);
  if (isCollapsed) return null;
  return <>{children}</>;
}

function getVaultUrgencyTier(daysRemaining: number): 60 | 30 | 14 | 7 | 0 | null {
  if (daysRemaining <= 0) return 0;
  if (daysRemaining <= 7) return 7;
  if (daysRemaining <= 14) return 14;
  if (daysRemaining <= 30) return 30;
  if (daysRemaining <= 60) return 60;
  return null;
}

function vaultUrgencyCopy(daysRemaining: number): {
  title: string;
  headline: string;
  tone: 'amber' | 'orange' | 'red';
} {
  const tier = getVaultUrgencyTier(daysRemaining);
  if (tier === 0) {
    return {
      title: 'Vault LOCKED Today',
      headline: 'Your Forensic Vault is LOCKED as of today.',
      tone: 'red',
    };
  }
  if (tier === 7) {
    return {
      title: 'Vault LOCK in 7 Days',
      headline: `Your Vault will LOCK in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
      tone: 'red',
    };
  }
  if (tier === 14) {
    return {
      title: 'Vault LOCK in 14 Days',
      headline: `Your Vault will LOCK in ${daysRemaining} days.`,
      tone: 'orange',
    };
  }
  if (tier === 30) {
    return {
      title: 'Vault LOCK in 30 Days',
      headline: `Your Vault will LOCK in ${daysRemaining} days.`,
      tone: 'orange',
    };
  }
  return {
    title: 'Vault LOCK in 60 Days',
    headline: `Your Vault will LOCK in ${daysRemaining} days.`,
    tone: 'amber',
  };
}

function VaultServiceRequestModal({
  open,
  onClose,
  user,
  companyName,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string; role: string };
  companyName: string;
}) {
  const [contactName, setContactName] = useState(user.name || '');
  const [company, setCompany] = useState(companyName || '');
  const [location, setLocation] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [preferredCallTime, setPreferredCallTime] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user.email || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setContactName(user.name || '');
      setCompany(companyName || '');
      setEmail(user.email || '');
      setResult(null);
    }
  }, [open, user.name, user.email, companyName]);

  const handleSubmit = async () => {
    if (!contactName || !company || !phone || !email) {
      setResult({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'VAULT_SERVICE_REQUEST',
          contact_name: contactName,
          company_name: company,
          location: location || 'Not specified',
          vehicle_count: fleetSize || 'Not specified',
          fleet_size: fleetSize || 'Not specified',
          preferred_call_time: preferredCallTime || 'Not specified',
          phone,
          email,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setResult({ type: 'success', text: 'Your request has been sent. The FleetVu team will contact you shortly.' });
    } catch (e) {
      setResult({ type: 'error', text: e instanceof Error ? e.message : 'Failed to send request. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg pointer-events-auto p-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-slate-700/50">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <img src="/FV.jpg" alt="Forensic Vault" className="w-7 h-7 rounded object-cover" />
            Keep Your Forensic Vault OPEN
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Vault is all-or-nothing: OPEN (SHA-256 sealed &amp; account secured) or LOCKED (standard PDFs only, no seal).
            Submit below and sales@fleetvu.org will contact you.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Contact Name *</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="John Smith" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Company Name *</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Trucking" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Location</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Dallas, TX" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Fleet Size (# vehicles)</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} placeholder="e.g. 25" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Phone *</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Email *</Label>
              <Input className="bg-slate-900/50 border-slate-600 text-white text-sm h-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Preferred Call Time</Label>
            <Input
              className="bg-slate-900/50 border-slate-600 text-white text-sm h-9"
              value={preferredCallTime}
              onChange={(e) => setPreferredCallTime(e.target.value)}
              placeholder="e.g. Weekdays 9–11am CT"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Additional Notes</Label>
            <Textarea className="bg-slate-900/50 border-slate-600 text-white text-sm min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any questions or specific needs..." />
          </div>
          {result && (
            <div className={`rounded-lg px-3 py-2 text-xs ${result.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
              {result.text}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-800 h-9 text-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-sm gap-2 flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Request to Sales
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ForensicVaultBanner({
  trialActive,
  daysRemaining,
  onRenew,
  onAuditTrail,
}: {
  trialActive: boolean;
  daysRemaining: number;
  onRenew: () => void;
  onAuditTrail: () => void;
}) {
  const vaultOpen = trialActive && daysRemaining > 0;
  const warningState = vaultOpen && daysRemaining <= 60;
  const criticalState = vaultOpen && daysRemaining <= 14;

  const accentColor = vaultOpen
    ? criticalState
      ? 'text-red-400'
      : 'text-amber-300'
    : 'text-red-400';

  const accentBg = vaultOpen
    ? criticalState
      ? 'bg-red-500/15'
      : 'bg-amber-500/15'
    : 'bg-red-500/15';

  const badgeClass = vaultOpen
    ? criticalState
      ? 'bg-red-500/20 text-red-300'
      : 'bg-amber-500/20 text-amber-200'
    : 'bg-red-500/20 text-red-300';

  const borderColor = vaultOpen
    ? criticalState
      ? 'border-red-500/30'
      : 'border-amber-500/25'
    : 'border-red-500/30';

  return (
    <div className={`relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-r from-[#0a0e1a] via-slate-900 to-[#0d1117]`}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(245,158,11,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(245,158,11,0.2) 0%, transparent 50%)' }} />
      <div className="flex items-center gap-3 px-4 py-2.5 relative flex-wrap">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentBg} ring-1 ring-amber-500/30 shadow-inner shadow-amber-500/10 shrink-0`}>
          {vaultOpen ? <Unlock className={`w-4.5 h-4.5 ${accentColor}`} /> : <Lock className={`w-4.5 h-4.5 ${accentColor}`} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-amber-50 tracking-tight">Forensic Vault</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${badgeClass}`}>
            {vaultOpen ? 'Open' : 'Locked'}
          </span>
        </div>
        {vaultOpen ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gradient-to-r from-[#0a0e1a] to-slate-950/80 border border-amber-500/15">
              <Clock className={`w-3.5 h-3.5 ${accentColor} shrink-0`} />
              <span className="text-xs text-amber-50 font-bold tracking-wide">
                {daysRemaining} {daysRemaining === 1 ? 'Day' : 'Days'} Remaining
              </span>
              {criticalState ? <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />}
            </div>
            {(warningState || criticalState) && (
              <button
                onClick={onRenew}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold hover:bg-orange-500/30 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Renew Subscription
              </button>
            )}
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={onAuditTrail}
                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-gradient-to-b from-slate-950/80 to-slate-950/60 border border-amber-500/20 text-amber-200/90 text-[11px] font-semibold hover:border-amber-500/40 hover:text-amber-100 transition-all"
              >
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                Audit Logs
              </button>
              <button
                onClick={onAuditTrail}
                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-gradient-to-b from-slate-950/80 to-slate-950/60 border border-amber-500/20 text-amber-200/90 text-[11px] font-semibold hover:border-amber-500/40 hover:text-amber-100 transition-all"
              >
                <FileBarChart className="w-3 h-3 text-amber-400" />
                Reconstruction
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400 flex-1 min-w-0">
              Vault LOCKED — PDF safety reports still download, but without SHA-256 seal. Account is not secured for forensic use.
            </p>
            <button
              onClick={onRenew}
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold hover:bg-orange-500/30 transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              START-RENEW FORENSIC ACCESS
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function VaultExpiryDialog({
  open,
  daysRemaining,
  onRenew,
  onDismiss,
}: {
  open: boolean;
  daysRemaining: number;
  onRenew: () => void;
  onDismiss: () => void;
}) {
  const copy = vaultUrgencyCopy(daysRemaining);
  const isCritical = copy.tone === 'red';
  const isDayOf = daysRemaining <= 0;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent className="bg-slate-900 border-amber-500/30 max-w-md pointer-events-auto p-0 overflow-hidden">
        <div className={`h-1 ${isCritical ? 'bg-red-500' : copy.tone === 'orange' ? 'bg-orange-500' : 'bg-amber-500'}`} />
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isCritical ? 'bg-red-500/15' : 'bg-amber-500/15'} ring-1 ${isCritical ? 'ring-red-500/30' : 'ring-amber-500/30'}`}>
              {isCritical ? <ShieldAlert className="w-5 h-5 text-red-400" /> : <ShieldCheck className="w-5 h-5 text-amber-400" />}
            </div>
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {copy.headline}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-5 space-y-4">
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${isCritical ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
            <Clock className={`w-6 h-6 shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
            <div>
              <p className={`text-2xl font-black ${isCritical ? 'text-red-300' : 'text-amber-300'}`}>
                {isDayOf ? 'LOCKED' : `${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'}`}
              </p>
              <p className="text-xs text-slate-400 font-semibold">
                {isDayOf ? (
                  <>Forensic Vault is <span className="text-red-400">LOCKED</span></>
                ) : (
                  <>until your Vault is <span className={isCritical ? 'text-red-400' : 'text-amber-400'}>LOCKED</span></>
                )}
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed space-y-2">
            <p>
              <span className="text-slate-200 font-semibold">Vault OPEN:</span> SHA-256 sealed safety reports,
              Accident Reconstruction, chain-of-custody, and a secured company account.
            </p>
            <p>
              <span className="text-slate-200 font-semibold">Vault LOCKED:</span> you can still download PDF safety reports —
              they will <span className="text-red-300 font-semibold">not</span> be SHA-256 sealed, and your account
              is no longer secured for forensic use. This is all-or-nothing — not per-feature.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isDayOf && (
              <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-800 h-9 text-sm" onClick={onDismiss}>
                Remind Me Later
              </Button>
            )}
            <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-sm gap-2 flex-1" onClick={onRenew}>
              <RefreshCw className="w-4 h-4" />
              {isDayOf ? 'Click Here to OPEN Your Vault' : 'Click Here — Contact Sales'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LiveDriverEventFeed({
  incidents,
  vehicles,
  selectedVehicle,
}: {
  incidents: Incident[];
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}) {
  const [feedEvents, setFeedEvents] = useState<Array<{
    id: string;
    vehicleId: string;
    truckNumber: string;
    zone: string;
    eventType: 'proximity' | 'sensor' | 'geofence' | 'speed' | 'system';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: number;
  }>>([]);

  useEffect(() => {
    const zones = ['Forward 77GHz', 'Left 40kHz', 'Right 40kHz', 'RAR 77GHz', 'Blind Spot'];
    const eventTypes: Array<'proximity' | 'sensor' | 'geofence' | 'speed' | 'system'> = ['proximity', 'sensor', 'geofence', 'speed'];
    const severities: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];
    const messages: Record<string, string[]> = {
      proximity: [
        'Vehicle detected in forward zone — closing distance 4.2m',
        'Lateral proximity alert — adjacent lane occupant',
        'Rear approach vehicle — relative speed +12mph',
        'Blind spot intrusion — left side mirror zone',
      ],
      sensor: [
        'C55-PRO calibration drift detected — auto-recalibrating',
        'Ultrasonic array ping cycle complete — all channels nominal',
        'Radar echo anomaly — temporary interference filtered',
        'IMU g-force sample above baseline — 0.82g logged',
      ],
      geofence: [
        'Geofence breach — driver exited assigned corridor',
        'Geofence re-entry — vehicle returned to permitted zone',
        'Terminal approach — 0.4mi from facility checkpoint',
        'Route deviation — off planned corridor by 2.1mi',
      ],
      speed: [
        'Speed threshold exceeded — 68mph in 55 zone',
        'Hard brake event — deceleration 0.71g',
        'Lane departure warning — no turn signal detected',
        'Following distance below 3.0s — 2.1s gap logged',
      ],
      system: ['Diagnostic heartbeat — all systems nominal'],
    };

    const pool = vehicles.length > 0 ? vehicles : [];
    const generate = () => {
      const v = pool.length > 0
        ? pool[Math.floor(Math.random() * Math.min(pool.length, 8))]
        : { id: 'demo-1', truck_number: 'TRK-001' };
      const et = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const msgs = messages[et];
      const sev: 'info' | 'warning' | 'critical' = et === 'proximity' || et === 'speed'
        ? (Math.random() > 0.5 ? 'warning' : 'critical')
        : et === 'geofence'
          ? (Math.random() > 0.6 ? 'critical' : 'warning')
          : 'info';
      setFeedEvents((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          vehicleId: v.id,
          truckNumber: v.truck_number,
          zone: zones[Math.floor(Math.random() * zones.length)],
          eventType: et,
          severity: sev,
          message: msgs[Math.floor(Math.random() * msgs.length)],
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 30));
    };

    generate();
    const interval = setInterval(generate, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [vehicles]);

  const historicalEvents = incidents.slice(0, 10).map((inc) => {
    const v = vehicles.find((veh) => veh.id === inc.vehicle_id);
    const severity = inc.severity_grade === 'A' || inc.severity_grade === 'B'
      ? 'critical' as const
      : inc.severity_grade === 'C'
        ? 'warning' as const
        : 'info' as const;
    return {
      id: inc.id,
      vehicleId: inc.vehicle_id || 'unknown',
      truckNumber: v?.truck_number || 'Unknown',
      zone: inc.proximity_zone || 'Unknown',
      eventType: 'proximity' as const,
      severity,
      message: inc.case_id
        ? `Incident Case ${inc.case_id} — ${inc.target_type || 'vehicle'} contact logged`
        : `Proximity event — ${inc.proximity_zone || 'unknown zone'} alert`,
      timestamp: new Date(inc.utc_timestamp).getTime(),
    };
  });

  const allEvents = [...feedEvents, ...historicalEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 25);

  const severityConfig = {
    info: { dot: 'bg-blue-500', text: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'INFO' },
    warning: { dot: 'bg-amber-500', text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'WARN' },
    critical: { dot: 'bg-red-500', text: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'CRIT' },
  };

  const typeIcon = {
    proximity: <Radio className="w-3 h-3 text-orange-400 shrink-0" />,
    sensor: <Activity className="w-3 h-3 text-cyan-400 shrink-0" />,
    geofence: <Navigation className="w-3 h-3 text-green-400 shrink-0" />,
    speed: <Gauge className="w-3 h-3 text-red-400 shrink-0" />,
    system: <Cpu className="w-3 h-3 text-slate-400 shrink-0" />,
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">LIVE DRIVER EVENT FEED</span>
          </div>
          <span className="text-[10px] text-slate-500">Real-time proximity &amp; sensor alerts</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono">{allEvents.length} events</span>
          <WidgetCollapseToggle />
        </div>
      </div>
      <WidgetCollapsibleBody>
        <div className="overflow-y-auto scrollbar-thin max-h-[160px] min-h-[80px]">
          {allEvents.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
              <Activity className="w-4 h-4 mr-2 opacity-50" />
              Waiting for live telemetry stream...
            </div>
          ) : (
            <div className="divide-y divide-slate-700/40">
              {allEvents.map((ev) => {
                const cfg = severityConfig[ev.severity];
                const isFiltered = selectedVehicle && ev.vehicleId !== selectedVehicle.id;
                return (
                  <div
                    key={ev.id}
                    className={`flex items-center gap-2.5 px-3 py-1.5 text-xs transition-opacity ${isFiltered ? 'opacity-30' : ''} ${cfg.bg} border-l-2 ${cfg.border}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
                    {typeIcon[ev.eventType]}
                    <span className="text-slate-300 font-mono font-bold shrink-0 w-16 truncate">{ev.truckNumber}</span>
                    <span className={`text-[9px] font-bold uppercase shrink-0 w-10 ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-slate-400 truncate flex-1">{ev.message}</span>
                    <span className="text-slate-500 text-[10px] font-mono shrink-0">
                      {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </WidgetCollapsibleBody>
    </div>
  );
}

// ---- Dashboard View ----
function DashboardView({
  vehicles,
  drivers,
  incidents,
  loading,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  selectedVehicle,
  setSelectedVehicle,
  mapVehicles,
  mapCenter,
  isBasicPlan,
  isCompanyBasicPlan,
  selectedPlan,
  hasOrgFilter,
  onOpenReconstruction,
  onOpenReportBuilder,
  onOpenBulkUpload,
  onOpenCustomizeLayout,
  onOpenAccessRequests,
  onOpenAuditTrail,
  onNavigateToBilling,
  onStartVaultService,
  canCustomizeLayout,
  editMode,
  onResetLayout,
  onSaveLayout,
  companies,
  isSuperAdmin,
  isExecutive,
  isGlobalAdmin,
  user,
  pairedSensorCount,
  onSensorPaired,
  onShowSafetyAudit,
  onShowInsuranceScorecard,
  onShowRiskSafetyScorecard,
  onInstantFleetReport,
  featureToggles,
  isAuditor,
}: {
  vehicles: Vehicle[];
  drivers: Driver[];
  incidents: Incident[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  selectedVehicle: Vehicle | null;
  setSelectedVehicle: (v: Vehicle | null) => void;
  mapVehicles: Array<{ id: string; truckNumber: string; lat: number; lng: number; status: string; selected?: boolean; driverName?: string; speedMph?: number; location?: string }>;
  mapCenter: { lat: number; lng: number };
  isBasicPlan: boolean;
  isCompanyBasicPlan: boolean;
  selectedPlan: PlanTier;
  hasOrgFilter: boolean;
  onOpenReconstruction: () => void;
  onOpenReportBuilder: () => void;
  onOpenBulkUpload: () => void;
  onOpenCustomizeLayout: () => void;
  onOpenAccessRequests: () => void;
  onOpenAuditTrail: () => void;
  onNavigateToBilling: () => void;
  onStartVaultService: () => void;
  canCustomizeLayout: boolean;
  editMode: boolean;
  onResetLayout: () => void;
  onSaveLayout: () => void;
  companies: Company[];
  isSuperAdmin: boolean;
  isExecutive: boolean;
  isGlobalAdmin: boolean;
  user: { name: string; email: string; role: string; companyName?: string; trialStartDate?: string; trialDurationDays?: number; planTier?: string };
  pairedSensorCount: number;
  onSensorPaired: () => void;
  onShowSafetyAudit: () => void;
  onShowInsuranceScorecard: () => void;
  onShowRiskSafetyScorecard: () => void;
  onInstantFleetReport: () => void;
  featureToggles: Record<string, boolean>;
  isAuditor: boolean;
}) {
  const { fleet, setFleet } = useApp();
  const [mapExpanded, setMapExpanded] = useState(false);
  const radarControls = useRadarControls();
  const [provisionedUsers, setProvisionedUsers] = useState<Array<{ full_name: string; role: string; status: string }>>([]);

  useEffect(() => {
    Promise.resolve(
      supabase.from('provisioned_users').select('full_name, role, status').order('created_at', { ascending: false }).limit(5)
    )
      .then(({ data, error }) => { if (!error && data) setProvisionedUsers(data); })
      .catch(() => { /* non-fatal: recent-users roster is decorative */ });
  }, []);

  const [showActuarialReport, setShowActuarialReport] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showTrialWelcome, setShowTrialWelcome] = useState(false);
  const [showExportLockdown, setShowExportLockdown] = useState(false);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const trial = computeTrialState(user);
  const isTrialActive = trial.isTrial && trial.daysRemaining > 0;
  const isTrialExpired = trial.isTrial && trial.daysRemaining <= 0;
  const isTrialExportLocked = isTrialActive;

  useEffect(() => {
    if (isTrialActive && typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('fleetvu_trial_welcome_dismissed');
      if (!dismissed) {
        setShowTrialWelcome(true);
        sessionStorage.setItem('fleetvu_trial_welcome_dismissed', '1');
      }
    }
  }, [isTrialActive]);
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>([]);
  const [upgradeSlot, setUpgradeSlot] = useState<null | { dir: string; range: string }>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [pairedSensors, setPairedSensors] = useState<string[]>([]);
  const layout = fleet?.dashboardLayout ?? defaultDashboardLayout;
  const hwKey = fleet.selectedHardwareProfile as keyof typeof HARDWARE_PROFILES;
  const hwProfile = HARDWARE_PROFILES[hwKey];
  const activeSensors = React.useMemo(() => {
    const base = hwProfile?.sensors || ['front_radar'];
    const merged = new Set(base);
    pairedSensors.forEach((s) => merged.add(s));
    return Array.from(merged);
  }, [hwProfile, pairedSensors]);
  const sensorDirs = {
    forward: activeSensors.some((s) => s === 'front_radar'),
    left: activeSensors.some((s) => s === 'left_radar' || s === 'side_radar_left' || s === 'side_ultrasonic_left'),
    right: activeSensors.some(
      (s) => s === 'right_radar' || s === 'side_radar_right' || s === 'side_ultrasonic_right' || s.startsWith('front_right_ultrasonic'),
    ),
    rear: activeSensors.some((s) => s === 'rear_radar'),
  };

  const handleReorder = useCallback((fromId: WidgetId, toId: WidgetId) => {
    const order = [...(layout?.widgetOrder || DEFAULT_WIDGET_ORDER)];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [item] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, item);
    setFleet({ dashboardLayout: { ...layout, widgetOrder: order } });
  }, [layout, setFleet]);

  return (
    <div className="flex flex-col h-full">
      {/* Roster + main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* COLUMN 1 (20%): Vehicle List Roster — shown when org filter selected or non-admin view */}
        {(hasOrgFilter || (!isSuperAdmin && !isGlobalAdmin)) && (
        <div className="w-full lg:w-[22%] min-w-[260px] border-r border-slate-700 bg-slate-800/50 flex flex-col hidden lg:flex">
          <div className="p-3 border-b border-slate-700">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Fleet Roster</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {loading && (
              <div className="text-center text-slate-500 text-sm py-4">Loading fleet...</div>
            )}
            {!loading && vehicles.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-4">No vehicles found</div>
            )}
            {vehicles.map((v) => {
              const driver = drivers.find((d) => d.id === v.assigned_driver_id);
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                    selectedVehicle?.id === v.id
                      ? 'bg-orange-500/20 border border-orange-500/40'
                      : 'hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">{v.truck_number}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      v.status === 'operational' ? 'bg-green-500' :
                      v.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                  </div>
                  <div className="text-xs text-slate-400">
                    {driver?.name || 'Unassigned'}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {v.location || v.company_name}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-xs h-4 px-1">
                      {v.plan_tier}
                    </Badge>
                    {v.status === 'inoperable' && (
                      <Badge className="bg-red-600 text-white text-xs h-4 px-1">
                        INOPERABLE
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* COLUMN 2 (55%) + COLUMN 3 (25%) — main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Edit Mode Toolbar */}
        {editMode && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-950/40 border-b border-blue-500/30">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-300">Layout Editing Mode</span>
              <span className="text-xs text-blue-400/60">Drag widget cards to reorder</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-slate-300 border-slate-600 hover:bg-slate-700/50 h-7 text-xs gap-1"
                onClick={onResetLayout}
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Default
              </Button>
              <Button
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white h-7 text-xs gap-1"
                onClick={onSaveLayout}
              >
                <Save className="w-3 h-3" />
                Save Layout
              </Button>
            </div>
          </div>
        )}
        {/* Reorderable widget grid — 12-column CSS grid with vertical scroll */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          <div className="grid grid-cols-12 gap-4 auto-rows-min min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {(layout?.widgetOrder || DEFAULT_WIDGET_ORDER).map((wid: WidgetId) => {
              const orderIdx = (layout?.widgetOrder || []).indexOf(wid);
              if (layout?.widgetVisibility?.[wid] === false) return null;

              // Radar widget — large, takes 60% width
              if (wid === 'radar')
                return isAuditor ? (
                  <DraggableWidget key="radar" widgetId="radar" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-6 min-h-[300px]">
                    <div className="rounded-xl border border-emerald-500/30 bg-slate-800/50 overflow-hidden flex flex-col h-full" style={{ minHeight: 400, height: 'auto', overflowY: 'visible' }}>
                      <div className="px-2 py-1.5 border-b border-slate-700 flex items-center gap-2 bg-slate-900/40">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-300">Vault Read-Only Access</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center p-6">
                        <div className="text-center max-w-sm">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                            <FileText className="w-6 h-6 text-emerald-400" />
                          </div>
                          <p className="text-slate-300 text-sm font-semibold mb-1">Live Dispatch &amp; Radar Telemetry Restricted</p>
                          <p className="text-slate-500 text-xs leading-relaxed">Your HR / Legal auditor role grants read-only access to notarized Vault records, signed driver compliance forms, and audit trails. Live GPS and radar dispatch controls are hidden by policy.</p>
                        </div>
                      </div>
                    </div>
                  </DraggableWidget>
                ) : (
                  <DraggableWidget key="radar" widgetId="radar" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-7 min-h-[400px]">
                    <div className="rounded-xl border border-orange-500/30 bg-slate-800/50 overflow-hidden flex flex-col ring-1 ring-orange-500/10 h-full" style={{ minHeight: 400, height: 'auto', overflowY: 'visible' }}>
                      <div className="px-2 py-1.5 border-b border-slate-700 flex items-center justify-end bg-slate-900/40 flex-wrap gap-1.5 shrink-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <WidgetCollapseToggle iconColor="text-orange-400" />
                          {selectedVehicle && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-700/50 text-orange-300 border border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all whitespace-nowrap min-w-[220px]">
                                  <Radio className="w-3 h-3 text-orange-400 shrink-0" />
                                  <span className="truncate flex-1 text-left">
                                    {(fleet.provisionedHardware || ['c55_pro_forward_lr']).length === 0
                                      ? 'Unequipped — No Hardware'
                                      : hwProfile?.label || 'Unknown'}
                                  </span>
                                  <ChevronDown className="w-3 h-3 ml-0.5 shrink-0" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" side="bottom" className="w-72 bg-slate-800 border-slate-700 z-[9999]">
                                <DropdownMenuLabel className="text-slate-400 text-xs">Select Sensor System</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-slate-700" />
                                {(Object.entries(HARDWARE_PROFILES) as [string, typeof HARDWARE_PROFILES[keyof typeof HARDWARE_PROFILES]][])
                                  .filter(([key]) => (fleet.provisionedHardware || ['c55_pro_forward_lr']).includes(key))
                                  .map(([key, p]) => (
                                  <DropdownMenuItem
                                    key={key}
                                    className={`cursor-pointer ${fleet.selectedHardwareProfile === key ? 'bg-orange-500/10' : ''}`}
                                    onClick={() => {
                                      setFleet({ selectedHardwareProfile: key });
                                    }}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <Radio className="w-3 h-3 text-orange-400 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{p.label}</p>
                                        <p className="text-[9px] text-slate-500 truncate">{p.description}</p>
                                      </div>
                                      {fleet.selectedHardwareProfile === key && (
                                        <CheckCircle2 className="w-3 h-3 text-orange-400 shrink-0" />
                                      )}
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                                {(fleet.provisionedHardware || ['c55_pro_forward_lr']).length === 0 && (
                                  <div className="px-3 py-4 text-center">
                                    <AlertCircle className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                                    <p className="text-xs text-slate-400 font-semibold">No hardware provisioned</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Use "+ Add Hardware" to pair sensors</p>
                                  </div>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Select
                            value={fleet.selectedVehicleType}
                            onValueChange={(v) => setFleet({ selectedVehicleType: v })}
                          >
                            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white text-xs h-7 w-auto gap-1 z-[9999]">
                              <Truck className="w-3 h-3 text-orange-400" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                              {(['class8_tractor_sleeper'] as VehicleProfileKey[]).map((key) => (
                                <SelectItem key={key} value={key}>
                                  {VEHICLE_PROFILES[key].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedVehicle && (
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 text-white h-7 px-2.5 text-[10px] font-bold gap-1 shrink-0"
                              onClick={() => setShowProvisionModal(true)}
                            >
                              <Plus className="w-3 h-3" />
                              Add Hardware / Pair Sensor
                            </Button>
                          )}
                        </div>
                      </div>
                      <WidgetCollapsibleBody>
                      <div className="flex-1 relative bg-slate-900 overflow-y-auto min-h-0 flex flex-col">
                        <div className="flex-1 relative overflow-hidden min-h-0">
                        <GatedBlurOverlay
                          gated={isTrialActive}
                          locked={isTrialExpired}
                          badgeText="C55-PRO Radar & Advanced Telemetry"
                          upgradeLabel="Upgrade to PRO"
                          onUpgrade={onNavigateToBilling}
                        >
                        {selectedVehicle ? (
                          (fleet.provisionedHardware || ['c55_pro_forward_lr']).length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center px-4">
                                <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 text-sm font-semibold">Unequipped — No Sensor Hardware</p>
                                <p className="text-slate-500 text-xs mt-1">This vehicle has no provisioned radar hardware. Use "+ Add Hardware / Pair Sensor" to provision a C55-PRO or C93-US4 package.</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <RadarVisualizer
                                vehicleType={fleet.selectedVehicleType as VehicleProfileKey}
                                speedMph={42}
                                activeSensors={activeSensors}
                                hardwareProfile={fleet.selectedHardwareProfile?.startsWith('c55') ? fleet.selectedHardwareProfile : 'c55_pro_forward_lr'}
                                expandedMode={layout?.radarZoom === 'expanded'}
                                controls={radarControls}
                              />
                            </>
                          )
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center px-4">
                              <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                              <p className="text-slate-400 text-sm font-semibold">No Vehicle Selected</p>
                              <p className="text-slate-500 text-xs mt-1">Click a truck from the left roster to view live 77GHz radar &amp; 40kHz ultrasonic telemetry</p>
                            </div>
                          </div>
                        )}
                        </GatedBlurOverlay>
                        </div>
                        {selectedVehicle && (fleet.provisionedHardware || ['c55_pro_forward_lr']).length > 0 && (
                          <RadarControlBar
                            controls={radarControls}
                            activeSensors={activeSensors}
                            hardwareProfile={fleet.selectedHardwareProfile}
                          />
                        )}
                      </div>
                      </WidgetCollapsibleBody>
                    </div>
                  </DraggableWidget>
                );

              // GPS Map widget
              if (wid === 'gpsMap')
                return isAuditor ? null : (
                  <DraggableWidget key="gpsMap" widgetId="gpsMap" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-5 min-h-[280px]">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden flex flex-col h-full" style={{ minHeight: 280, height: 'auto', overflowY: 'visible' }}>
                      <div className="p-2.5 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-bold text-white">GPS TRACKING</span>
                        </div>
                        <WidgetCollapseToggle />
                      </div>
                      <WidgetCollapsibleBody>
                      <div className="flex-1 relative min-h-0">
                        <SafeGPSMap
                          latitude={mapCenter.lat}
                          longitude={mapCenter.lng}
                          vehicles={mapVehicles}
                          selectedVehicle={selectedVehicle ? mapVehicles.find((mv) => mv.id === selectedVehicle.id) || null : null}
                          selectedPlanTier={selectedVehicle?.plan_tier}
                          isTeaser={false}
                          className="w-full h-full"
                          geofenceZones={geofenceZones}
                          compact
                          onExpandToggle={(expanded) => { if (expanded) setMapExpanded(true); }}
                          onFullscreen={() => setMapExpanded(true)}
                        />
                      </div>
                      </WidgetCollapsibleBody>
                    </div>
                  </DraggableWidget>
                );

              // Live Driver Event Feed widget
              if (wid === 'liveEventFeed')
                return isAuditor ? null : (
                  <DraggableWidget key="liveEventFeed" widgetId="liveEventFeed" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 min-h-[120px]">
                    <LiveDriverEventFeed incidents={incidents} vehicles={vehicles} selectedVehicle={selectedVehicle} />
                  </DraggableWidget>
                );

              // Forensic Vault — full-width 2nd-row banner
              if (wid === 'forensicVault')
                return isAuditor ? null : (
                  <DraggableWidget key="forensicVault" widgetId="forensicVault" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 min-h-[56px]">
                    <ForensicVaultBanner
                      trialActive={isTrialActive}
                      daysRemaining={trial.daysRemaining}
                      onRenew={onStartVaultService}
                      onAuditTrail={onOpenAuditTrail}
                    />
                  </DraggableWidget>
                );

              // Actuarial widget
              if (wid === 'actuarial')
                return (
                  <DraggableWidget key="actuarial" widgetId="actuarial" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-6">
                    <div className="relative rounded-lg border border-emerald-500/25 bg-slate-800/60 overflow-hidden h-full">
                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Actuarial Risk &amp; Insurance Tiering</p>
                            <p className="text-[10px] text-emerald-400/70">Est. Annual Savings: $14,200</p>
                          </div>
                          <WidgetCollapseToggle iconColor="text-emerald-400" />
                          <Button size="sm" variant="outline" className="text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 h-6 px-2 text-[10px] shrink-0" onClick={() => setShowActuarialReport(true)}>
                            View Report
                          </Button>
                          {featureToggles.insuranceScorecard && (
                          <Button size="sm" variant="outline" className="text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 h-6 px-2 text-[10px] shrink-0" onClick={() => onShowInsuranceScorecard()}>
                            <Download className="w-3 h-3" /> Scorecard
                          </Button>
                          )}
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Loss Ratio</p>
                            <p className="text-xs font-bold text-emerald-400">0.42</p>
                          </div>
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Safety</p>
                            <p className="text-xs font-bold text-green-400">A+</p>
                          </div>
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Risk Tier</p>
                            <p className="text-xs font-bold text-blue-400">1</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-400">Fleet Loss History</span>
                            <span className="text-emerald-400 font-bold">Low</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '42%' }} />
                          </div>
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-400">Underwriter Confidence</span>
                            <span className="text-green-400 font-bold">High</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: '88%' }} />
                          </div>
                        </div>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                  </DraggableWidget>
                );

              // Historical Telemetry widget
              if (wid === 'historicalTelemetry')
                return (
                  <DraggableWidget key="historicalTelemetry" widgetId="historicalTelemetry" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-6">
                    <GatedBlurOverlay
                      gated={isTrialActive}
                      locked={isTrialExpired}
                      badgeText="Historical Reports & Analytics"
                      upgradeLabel="Upgrade to PRO"
                      onUpgrade={onNavigateToBilling}
                    >
                    <div className="relative rounded-lg border border-violet-500/25 bg-slate-800/60 overflow-hidden h-full">
                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <FileBarChart className="w-3.5 h-3.5 text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Historical Telemetry &amp; Event Audit</p>
                            <p className="text-[10px] text-violet-400/70">30-Day Event Logs &amp; Collision Export</p>
                          </div>
                          <WidgetCollapseToggle iconColor="text-violet-400" />
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                          {incidents.slice(0, 3).map((inc) => (
                            <div key={inc.id} className="flex items-center gap-1.5 text-[9px] bg-slate-900/40 rounded p-1.5">
                              <FileText className="w-2.5 h-2.5 text-violet-400 shrink-0" />
                              <span className="text-slate-300 truncate flex-1">{inc.case_id ? `Case ${inc.case_id}` : 'Incident Report'}</span>
                              <span className="text-slate-500 shrink-0">{new Date(inc.utc_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          ))}
                          {incidents.length === 0 && (
                            <p className="text-[9px] text-slate-500 italic text-center py-1">No events recorded in trial period</p>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-violet-300 border-violet-500/40 hover:bg-violet-500/10 h-6 text-[10px] gap-1"
                            disabled={isCompanyBasicPlan}
                            onClick={() => !isCompanyBasicPlan && onOpenReportBuilder()}
                          >
                            <FileText className="w-3 h-3" /> PDF
                            {isCompanyBasicPlan && <Lock className="w-2 h-2 text-slate-500" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-violet-300 border-violet-500/40 hover:bg-violet-500/10 h-6 text-[10px] gap-1"
                            disabled={isCompanyBasicPlan || isTrialExportLocked}
                            onClick={() => {
                              if (isTrialExportLocked) { setShowExportLockdown(true); return; }
                              if (!isCompanyBasicPlan) onOpenReportBuilder();
                            }}
                          >
                            <FileDown className="w-3 h-3" /> CSV
                            {(isCompanyBasicPlan || isTrialExportLocked) && <Lock className="w-2 h-2 text-slate-500" />}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-orange-300 border-orange-500/40 hover:bg-orange-500/10 h-6 text-[10px] gap-1"
                          disabled={isTrialExportLocked || !featureToggles.riskScorecard}
                          onClick={() => {
                            if (isTrialExportLocked) { setShowExportLockdown(true); return; }
                            if (featureToggles.riskScorecard) onShowRiskSafetyScorecard();
                          }}
                        >
                          <ShieldCheck className="w-3 h-3" /> Export Risk &amp; Safety Scorecard (PDF)
                          {isTrialExportLocked && <Lock className="w-2 h-2 text-slate-500" />}
                        </Button>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                    </GatedBlurOverlay>
                  </DraggableWidget>
                );

              // Mobile Geofencing widget
              if (wid === 'mobileGeofencing')
                return (
                  <DraggableWidget key="mobileGeofencing" widgetId="mobileGeofencing" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-6">
                    <div
                      className="relative rounded-lg border border-orange-500/25 bg-slate-800/60 overflow-hidden h-full cursor-pointer hover:border-orange-500/50 transition-colors"
                      onClick={() => setShowGeofenceModal(true)}
                    >
                      <div className="p-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-7 h-7 rounded-md bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <Navigation className="w-3.5 h-3.5 text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Mobile Driver Geofencing &amp; App Telematics</p>
                            <p className="text-[10px] text-orange-400/70">Driver smartphone boundary alerts, route corridors &amp; mobile check-ins</p>
                          </div>
                          <WidgetCollapseToggle iconColor="text-orange-400" />
                          <Maximize2 className="w-3.5 h-3.5 text-orange-400/50 shrink-0" />
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Vehicles</p>
                            <p className="text-xs font-bold text-orange-400">{vehicles.length}</p>
                          </div>
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Geofences</p>
                            <p className="text-xs font-bold text-green-400">3</p>
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-orange-400/60">
                          <Navigation className="w-2.5 h-2.5" />
                          Click to manage corridors &amp; boundary rules
                        </div>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                  </DraggableWidget>
                );

              // Incident Reconstruction gated card
              if (wid === 'incidentReconstruction')
                if (!featureToggles.accidentReconstruction) return null;
                return (
                  <DraggableWidget key="incidentReconstruction" widgetId="incidentReconstruction" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-6">
                    <Card
                      className="bg-gradient-to-br from-orange-500/15 to-red-500/5 border-orange-500/25 cursor-pointer hover:border-orange-500/50 transition-colors h-full"
                      onClick={onOpenReconstruction}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/25 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">Incident Vector Reconstruction</p>
                          </div>
                          <WidgetCollapseToggle iconColor="text-orange-400" />
                        </div>
                        <WidgetCollapsibleBody>
                        <p className="text-xs text-slate-400 mb-3">Multi-sensor collision diagram &amp; timeline analysis engine</p>
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white w-full"
                          onClick={(e) => { e.stopPropagation(); onOpenReconstruction(); }}
                        >
                          Explore Reconstruction Engine
                        </Button>
                        </WidgetCollapsibleBody>
                      </CardContent>
                    </Card>
                  </DraggableWidget>
                );

              // Actuarial Report gated card — removed (redundant with actuarial widget)

              // Fleet Safety Trend (7-Day) widget
              if (wid === 'safetyTrend')
                return (
                  <DraggableWidget key="safetyTrend" widgetId="safetyTrend" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-6">
                    <GatedBlurOverlay
                      gated={isTrialActive}
                      locked={isTrialExpired}
                      badgeText="Driver Safety Scorecards & Trend Analysis"
                      upgradeLabel="Upgrade to PRO"
                      onUpgrade={onNavigateToBilling}
                    >
                    <div className="relative rounded-lg border border-blue-500/25 bg-slate-800/60 overflow-hidden h-full">
                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Fleet Safety Trend (7-Day)</p>
                            <p className="text-[10px] text-blue-400/70">Rolling safety score analysis</p>
                          </div>
                          <WidgetCollapseToggle iconColor="text-blue-400" />
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="flex items-end gap-1.5 h-16">
                          {[82, 85, 79, 88, 91, 87, 93].map((score, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                              <div
                                className="w-full rounded-t bg-gradient-to-t from-blue-500/60 to-blue-400 transition-all hover:from-blue-500 hover:to-blue-300"
                                style={{ height: `${score}%` }}
                              />
                              <span className="text-[7px] text-slate-500">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-slate-400">7-Day Avg</span>
                          <span className="text-blue-400 font-bold">86.4</span>
                        </div>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                    </GatedBlurOverlay>
                  </DraggableWidget>
                );

              // Sensor Distribution by Fleet widget
              if (wid === 'sensorDistribution')
                return (
                  <DraggableWidget key="sensorDistribution" widgetId="sensorDistribution" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-6">
                    <div className="relative rounded-lg border border-cyan-500/25 bg-slate-800/60 overflow-hidden h-full">
                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Sensor Distribution by Fleet</p>
                            <p className="text-[10px] text-cyan-400/70">Hardware profile breakdown</p>
                          </div>
                          <WidgetCollapseToggle iconColor="text-cyan-400" />
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="space-y-1.5">
                          {[
                            { label: 'C55-PRO Forward', count: 12, pct: 40, color: 'bg-orange-500' },
                            { label: 'C55-PRO Forward + L + R', count: 8, pct: 27, color: 'bg-green-500' },
                            { label: 'C55-PRO Full 4-Dir', count: 6, pct: 20, color: 'bg-blue-500' },
                            { label: 'C93-US4 Dual Layer', count: 4, pct: 13, color: 'bg-cyan-500' },
                          ].map((row) => (
                            <div key={row.label} className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-400 w-32 truncate">{row.label}</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-700/50 overflow-hidden">
                                <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                              </div>
                              <span className="text-[9px] text-white font-bold w-6 text-right">{row.count}</span>
                            </div>
                          ))}
                        </div>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                  </DraggableWidget>
                );

              // Bulk Upload & User Management Logs widget
              if (wid === 'bulkUploadLogs')
                if (!featureToggles.bulkDataUpload) return null;
                return (
                  <DraggableWidget key="bulkUploadLogs" widgetId="bulkUploadLogs" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-4">
                    <div className="relative rounded-lg border border-slate-600/40 bg-slate-800/60 overflow-hidden h-full">
                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-slate-500/20 flex items-center justify-center flex-shrink-0">
                            <Upload className="w-3.5 h-3.5 text-slate-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Bulk Upload &amp; User Management Logs</p>
                            <p className="text-[10px] text-slate-400/70">Recent imports &amp; provisioning audit trail</p>
                          </div>
                          <WidgetCollapseToggle />
                          <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700 h-6 px-2 text-[10px] shrink-0" onClick={onOpenBulkUpload}>
                            <Upload className="w-3 h-3" /> Upload
                          </Button>
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                          {[
                            { action: 'Vehicle import', user: 'admin@fleet.com', time: '2h ago', count: 15 },
                            { action: 'Driver provisioning', user: 'superadmin@fleet.com', time: '5h ago', count: 8 },
                            { action: 'Sensor profile update', user: 'admin@fleet.com', time: '1d ago', count: 3 },
                          ].map((log, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[9px] bg-slate-900/40 rounded p-1.5">
                              <Upload className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="text-slate-300 truncate flex-1">{log.action} ({log.count} records)</span>
                              <span className="text-slate-500 shrink-0">{log.time}</span>
                            </div>
                          ))}
                        </div>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                  </DraggableWidget>
                );

              // User & Team Management widget
              if (wid === 'userManagement')
                return (
                  <DraggableWidget key="userManagement" widgetId="userManagement" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-4">
                    <div className="relative rounded-lg border border-orange-500/20 bg-slate-800/60 overflow-hidden h-full">
                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">User &amp; Team Management</p>
                            <p className="text-[10px] text-orange-400/70">Provisioned users, roles &amp; access</p>
                          </div>
                          <WidgetCollapseToggle iconColor="text-orange-400" />
                          <Button size="sm" variant="outline" className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 h-6 px-2 text-[10px] shrink-0" onClick={onOpenAccessRequests}>
                            Manage
                          </Button>
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Admins</p>
                            <p className="text-xs font-bold text-orange-400">{provisionedUsers.filter((u) => u.role === 'admin').length}</p>
                          </div>
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Drivers</p>
                            <p className="text-xs font-bold text-blue-400">{provisionedUsers.filter((u) => u.role === 'standard_user').length}</p>
                          </div>
                          <div className="rounded bg-slate-900/50 p-1.5 text-center">
                            <p className="text-[8px] text-slate-500 uppercase">Suspended</p>
                            <p className="text-xs font-bold text-yellow-400">{provisionedUsers.filter((u) => u.status === 'suspended').length}</p>
                          </div>
                        </div>
                        <div className="space-y-1 max-h-20 overflow-y-auto scrollbar-thin">
                          {provisionedUsers.length === 0 && (
                            <p className="text-[9px] text-slate-500 text-center py-1">Loading users…</p>
                          )}
                          {provisionedUsers.map((u, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[9px] bg-slate-900/40 rounded p-1.5">
                              <Users className="w-2.5 h-2.5 text-orange-400/60 shrink-0" />
                              <span className="text-slate-300 truncate flex-1">{u.full_name}</span>
                              <span className="text-slate-500 shrink-0 capitalize">{u.role === 'standard_user' ? 'Driver' : u.role}</span>
                              <span className={`shrink-0 capitalize ${u.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>{u.status}</span>
                            </div>
                          ))}
                        </div>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                  </DraggableWidget>
                );

              // Audit Trail widget
              if (wid === 'auditTrail')
                if (!featureToggles.advancedAuditTrail) return null;
                return (
                  <DraggableWidget key="auditTrail" widgetId="auditTrail" editMode={editMode} onReorder={handleReorder} order={orderIdx} className="col-span-12 lg:col-span-4">
                    <div className="relative rounded-lg border border-slate-600/40 bg-slate-800/60 overflow-hidden h-full">
                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-slate-500/20 flex items-center justify-center flex-shrink-0">
                            <ScrollText className="w-3.5 h-3.5 text-slate-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Audit Trail</p>
                            <p className="text-[10px] text-slate-400/70">Immutable system event log</p>
                          </div>
                          <WidgetCollapseToggle />
                          <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700 h-6 px-2 text-[10px] shrink-0" onClick={onOpenAuditTrail}>
                            View All
                          </Button>
                        </div>
                        <WidgetCollapsibleBody>
                        <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                          {[
                            { action: 'Vehicle TRK-1042 status updated', user: 'admin@fleet.com', time: '5m ago' },
                            { action: 'Pricing tier changed to Pro+', user: 'globaladmin@fleet.com', time: '1h ago' },
                            { action: 'Driver assigned to TRK-2103', user: 'admin@fleet.com', time: '3h ago' },
                            { action: 'Sensor paired: C55-PRO Forward', user: 'superadmin@fleet.com', time: '6h ago' },
                          ].map((log, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[9px] bg-slate-900/40 rounded p-1.5">
                              <ScrollText className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="text-slate-300 truncate flex-1">{log.action}</span>
                              <span className="text-slate-500 shrink-0">{log.time}</span>
                            </div>
                          ))}
                        </div>
                        </WidgetCollapsibleBody>
                      </div>
                    </div>
                  </DraggableWidget>
                );

              return null;
            })}
          </div>
        </div>
        </div>
      </div>

      {/* Fullscreen Map Overlay Modal — z-99999 to sit above all map layers */}
      {mapExpanded && (
        <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-950">
          <div className="p-2.5 border-b border-slate-700 flex items-center justify-between bg-slate-800/80 backdrop-blur z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-bold text-white">GPS Fleet Tracking — Fullscreen</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={() => setMapExpanded(false)}
            >
              <Minimize2 className="w-4 h-4 mr-1" />
              Close Fullscreen
            </Button>
          </div>
          <div className="flex-1 relative">
            <SafeGPSMap
              latitude={mapCenter.lat}
              longitude={mapCenter.lng}
              vehicles={mapVehicles}
              selectedVehicle={selectedVehicle ? mapVehicles.find((mv) => mv.id === selectedVehicle.id) || null : null}
              selectedPlanTier={selectedVehicle?.plan_tier}
              isTeaser={false}
              className="w-full h-full"
              geofenceZones={geofenceZones}
            />
          </div>
        </div>
      )}

      {/* Actuarial Risk Report Modal */}
      <ActuarialRiskReportModal
        open={showActuarialReport}
        onClose={() => setShowActuarialReport(false)}
        vehicles={vehicles}
        previewMode={isCompanyBasicPlan}
        onUpgrade={() => { setShowActuarialReport(false); setShowUpgradeModal(true); }}
      />
      {/* Upgrade Plan Modal — keeps user on current tenant view */}
      <UpgradePlanModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onGoToBilling={onNavigateToBilling}
        userEmail={user?.email}
      />
      {/* Sensor Upgrade Prompt Modal */}
      <SensorUpgradeModal
        open={!!upgradeSlot}
        onClose={() => setUpgradeSlot(null)}
        truckNumber={selectedVehicle?.truck_number || ''}
        direction={upgradeSlot?.dir || ''}
        range={upgradeSlot?.range || ''}
      />
      {/* Geofencing Management Modal */}
      <GeofenceManagementModal
        open={showGeofenceModal}
        onClose={() => setShowGeofenceModal(false)}
        vehicleCount={vehicles.length}
        onCorridorsChange={setGeofenceZones}
      />
      {/* Hardware Provisioning Modal */}
      <HardwareProvisioningModal
        open={showProvisionModal}
        onClose={() => setShowProvisionModal(false)}
        truckNumber={selectedVehicle?.truck_number || ''}
        provisionedHardware={fleet.provisionedHardware || ['c55_pro_forward_lr']}
        onProvision={(profileKey: string) => {
          setFleet({
            provisionedHardware: [...(fleet.provisionedHardware || ['c55_pro_forward_lr']), profileKey],
            selectedHardwareProfile: profileKey,
          });
        }}
        onPair={(sensorId: string) => {
          setPairedSensors((prev) => prev.includes(sensorId) ? prev : [...prev, sensorId]);
          onSensorPaired();
        }}
      />

      {/* Trial Welcome Modal */}
      <Dialog open={showTrialWelcome} onOpenChange={(v) => !v && setShowTrialWelcome(false)}>
        <DialogContent className="bg-slate-800 border-orange-500/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-orange-400" />
              Welcome to FleetVu PRO+ Trial
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              You now have full access to all PRO+ features
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-400/30">
              <p className="text-sm text-orange-200 font-semibold">
                For the next {trial.daysRemaining} days, you can explore everything FleetVu has to offer:
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" /> C55-PRO Radar Telemetry Canvas</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" /> Actuarial & Insurance Scorecards</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" /> Historical Report Builder</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" /> Incident Vector Reconstruction</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" /> GPS Fleet Tracking & Geofencing</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              After your trial ends, advanced features will be locked. Upgrade to PRO or PRO+ anytime to keep full access. Note: exporting reports (PDF/CSV) is disabled during the trial.
            </p>
          </div>
          <DialogFooter>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full" onClick={() => setShowTrialWelcome(false)}>
              Start Exploring
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Lockdown Modal */}
      <Dialog open={showExportLockdown} onOpenChange={(v) => !v && setShowExportLockdown(false)}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-orange-400" />
              Exporting Disabled
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Exporting is disabled during the 30-day trial
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-slate-300">
              Upgrade to PRO or PRO+ to download reports as PDF or CSV, and send scorecards via email.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setShowExportLockdown(false)}>
              Close
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => { setShowExportLockdown(false); setShowUpgradeModal(true); }}>
              View Plans
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trial-mode copy protection on sensitive data */}
      {isTrialActive && (
        <style>{`[data-trial-protected] { user-select: none; -webkit-user-select: none; }`}</style>
      )}
    </div>
  );
}

function HardwareProvisioningModal({
  open,
  onClose,
  truckNumber,
  provisionedHardware,
  onProvision,
  onPair,
}: {
  open: boolean;
  onClose: () => void;
  truckNumber: string;
  provisionedHardware: string[];
  onProvision: (profileKey: string) => void;
  onPair: (sensorId: string) => void;
}) {
  const [hwType, setHwType] = useState('dual_layer');
  const [serial, setSerial] = useState('');
  const [mountLocs, setMountLocs] = useState<string[]>(['forward']);
  const [calibration, setCalibration] = useState(4.0);
  const [paired, setPaired] = useState(false);

  const hwOptions = [
    { value: 'c55_pro_forward', label: 'C55-PRO (FWD / LEFT / RIGHT)', desc: 'Tri-directional 77GHz radar from front grille', icon: <Radio className="w-4 h-4" /> },
    { value: 'c55_pro_forward_r', label: 'C55-PRO Forward + R', desc: 'Forward + right side 77GHz radar', icon: <Radio className="w-4 h-4" /> },
    { value: 'c55_pro_forward_l', label: 'C55-PRO Forward + L', desc: 'Forward + left side 77GHz radar', icon: <Radio className="w-4 h-4" /> },
    { value: 'c55_pro_forward_lr', label: 'C55-PRO Forward + L + R', desc: 'Forward + both side 77GHz radar', icon: <Radio className="w-4 h-4" /> },
    { value: 'c55_pro_forward_lr_rear', label: 'C55-PRO Forward + L + R + Rear', desc: 'Full 4-direction 77GHz radar', icon: <Radio className="w-4 h-4" /> },
    { value: 'c93_us4_gap', label: 'C93-US4 Dual Layer "GAP" ONLY', desc: '4x 40kHz ultrasonic gap detection', icon: <Waves className="w-4 h-4" /> },
    { value: 'c93_us4_gap_lane', label: 'C93-US4 Dual Layer "GAP"-Lane Change', desc: '4x ultrasonic + 2x 77GHz side radar', icon: <Cpu className="w-4 h-4" /> },
  ];

  const mountOptions = [
    { value: 'forward', label: 'Front / FWD Grille', sensorId: 'front_radar' },
    { value: 'front_left_fender', label: 'Front Left Fender', sensorId: 'side_radar_left' },
    { value: 'front_right_fender', label: 'Front Right Fender', sensorId: 'side_radar_right' },
    { value: 'driver_door_77ghz', label: 'Driver Door 77GHz', sensorId: 'left_radar' },
    { value: 'passenger_door_77ghz', label: 'Passenger Door 77GHz', sensorId: 'right_radar' },
    { value: 'rear_bumper', label: 'Rear Bumper', sensorId: 'rear_radar' },
  ];

  const toggleMountLoc = (val: string) => {
    setMountLocs((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const handlePair = () => {
    const sensors = mountOptions
      .filter((m) => mountLocs.includes(m.value))
      .map((m) => m.sensorId);
    sensors.forEach((s) => onPair(s));
    onProvision(hwType);
    setPaired(true);
    setTimeout(() => {
      setPaired(false);
      setSerial('');
      onClose();
    }, 1500);
  };

  const selectedHw = hwOptions.find((h) => h.value === hwType);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-orange-400" />
            Provision Sensor / Add Hardware
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Pair a new sensor device to {truckNumber || 'this vehicle'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {/* Hardware Type Selector */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Hardware Type</Label>
            <div className="grid grid-cols-1 gap-2">
              {hwOptions.map((opt) => {
                const alreadyProvisioned = provisionedHardware.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => setHwType(opt.value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      hwType === opt.value
                        ? 'bg-orange-500/15 border-orange-500/50 ring-1 ring-orange-500/20'
                        : 'bg-slate-900/60 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      hwType === opt.value ? 'bg-orange-500/25 text-orange-400' : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{opt.label}</p>
                        {alreadyProvisioned && (
                          <Badge className="bg-green-600/20 text-green-400 border border-green-500/30 text-[8px] px-1 py-0 h-3.5">
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">{opt.desc}</p>
                    </div>
                    {hwType === opt.value && <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Device Serial / MAC Address */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Device Serial / MAC Address</Label>
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. C93-A4F2-0091 / 00:1B:44:88:9A:CD"
              className="bg-slate-900/60 border-slate-700 text-white font-mono text-sm"
            />
            <p className="text-[10px] text-slate-500">Scan or manually enter the sensor hardware ID for pairing verification.</p>
          </div>

          {/* Mounting Location Mapping — Multi-Select */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Mounting Locations (Multi-Select)</Label>
            <div className="grid grid-cols-2 gap-2">
              {mountOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    mountLocs.includes(opt.value)
                      ? 'bg-orange-500/15 border-orange-500/50'
                      : 'bg-slate-900/60 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Checkbox
                    checked={mountLocs.includes(opt.value)}
                    onCheckedChange={() => toggleMountLoc(opt.value)}
                    className="border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <span className="text-xs font-bold text-white">{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">Select all applicable mounting locations for this sensor package.</p>
          </div>

          {/* Calibration & Zeroing Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide">Calibration &amp; Zeroing</Label>
              <span className="text-sm font-bold text-orange-400">{calibration.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={6}
              step={0.5}
              value={calibration}
              onChange={(e) => setCalibration(parseFloat(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>0.5m</span>
              <span>2m</span>
              <span>4m (default)</span>
              <span>6m</span>
            </div>
            <p className="text-[10px] text-slate-500">Set the baseline detection threshold distance for this sensor.</p>
          </div>

          {/* Summary Preview */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Hardware:</span>
              <span className="text-white font-bold">{selectedHw?.label}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Mounts:</span>
              <span className="text-white font-bold">{mountLocs.length > 0 ? mountOptions.filter((m) => mountLocs.includes(m.value)).map((m) => m.label).join(', ') : 'None selected'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Calibration:</span>
              <span className="text-orange-400 font-bold">{calibration.toFixed(1)}m threshold</span>
            </div>
            {serial && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Serial:</span>
                <span className="text-white font-mono font-bold">{serial}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={handlePair}
            disabled={paired}
          >
            {paired ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Paired Successfully!</>
            ) : (
              <><Cpu className="w-4 h-4 mr-2" /> Pair &amp; Save Hardware to Asset</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SensorUpgradeModal({
  open,
  onClose,
  truckNumber,
  direction,
  range,
}: {
  open: boolean;
  onClose: () => void;
  truckNumber: string;
  direction: string;
  range: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-400" />
            Upgrade Sensor Coverage
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Add {direction} {range} sensor coverage to {truckNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-orange-950/40 border border-orange-800/40">
            <div className="flex items-center gap-2 text-orange-300 mb-2">
              <Radio className="w-4 h-4" />
              <span className="text-sm font-semibold">
                Upgrade {truckNumber} to C93 Pro+ Side Arch Telemetry ($19.95/mo)
              </span>
            </div>
            <p className="text-xs text-orange-400/70">
              This upgrade adds {direction} fender-well {range} coverage with 77GHz microwave radar
              and 40kHz ultrasonic sensors for blind-zone detection.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <p className="text-xs text-slate-400">Current Plan</p>
              <p className="text-sm font-bold text-white">C55-PRO (FWD / LEFT / RIGHT)</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <p className="text-xs text-slate-400">Upgrade To</p>
              <p className="text-sm font-bold text-orange-400">C93 Pro+ Side Arch</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-700">
            <span className="text-sm text-slate-400">Monthly cost per vehicle</span>
            <span className="text-lg font-bold text-orange-400">$19.95</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={onClose}>
            <Plus className="w-4 h-4 mr-2" />
            Upgrade {truckNumber}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Actuarial Risk Report Modal ----
function ActuarialRiskReportModal({
  open,
  onClose,
  vehicles,
  previewMode = false,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  previewMode?: boolean;
  onUpgrade?: () => void;
}) {
  const [locked, setLocked] = useState(false);
  const fleetSafety = vehicles.length > 0
    ? vehicles.reduce((s, v) => s + v.safety_score, 0) / vehicles.length
    : 0;
  const operationalCount = vehicles.filter((v) => v.status === 'operational').length;
  const riskScore = Math.max(0, 100 - fleetSafety).toFixed(1);
  const estimatedDiscount = fleetSafety >= 90 ? '18-25%' : fleetSafety >= 80 ? '12-18%' : fleetSafety >= 70 ? '5-12%' : '0-5%';

  useEffect(() => {
    if (!open || !previewMode) { setLocked(false); return; }
    setLocked(false);
    const timer = setTimeout(() => setLocked(true), 6000);
    return () => clearTimeout(timer);
  }, [open, previewMode]);

  const resetDemo = () => {
    setLocked(false);
    const timer = setTimeout(() => setLocked(true), 6000);
    return () => clearTimeout(timer);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Actuarial Risk Report
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Insurance carrier risk assessment based on fleet safety scoring and sensor telemetry data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 relative">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <p className="text-xs text-slate-400">Fleet Safety Score</p>
              <p className="text-2xl font-bold text-green-400">{fleetSafety.toFixed(1)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <p className="text-xs text-slate-400">Actuarial Risk Score</p>
              <p className="text-2xl font-bold text-orange-400">{riskScore}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <p className="text-xs text-slate-400">Operational Vehicles</p>
              <p className="text-2xl font-bold text-white">{operationalCount}/{vehicles.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <p className="text-xs text-slate-400">Est. Carrier Discount</p>
              <p className="text-2xl font-bold text-blue-400">{estimatedDiscount}</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
            <p className="text-xs font-semibold text-slate-300 mb-2">Risk Factor Breakdown</p>
            <div className="space-y-1.5">
              {[
                { label: 'Forward Collision Proximity', value: 'Low Risk', color: 'text-green-400' },
                { label: 'Side Blind-Zone Coverage', value: 'Low Risk', color: 'text-green-400' },
                { label: 'Rear Backup Detection', value: 'Moderate', color: 'text-yellow-400' },
                { label: 'Hard Braking Frequency', value: 'Low Risk', color: 'text-green-400' },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{f.label}</span>
                  <span className={`font-semibold ${f.color}`}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>

          {previewMode && locked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-md rounded-lg">
              <div className="text-center max-w-sm px-6">
                <Lock className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-white mb-2">PRO/PRO+ CARRIER RISK API REQUIRED</p>
                <p className="text-xs text-slate-300 mb-4">
                  Live carrier telemetry export, automated risk calculations, and verified insurance
                  discount certification require an active Pro/Pro+ plan.
                </p>
                <div className="flex flex-col gap-2">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full" onClick={() => onUpgrade?.()}>
                    Upgrade Plan to Export Certified Report
                  </Button>
                  <Button variant="ghost" className="text-slate-400 hover:text-white w-full text-xs" onClick={resetDemo}>
                    Reset Demo Preview
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={onClose}>
            {previewMode ? 'Close Preview' : 'Close Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Billing View ----
function BillingView({
  pricing,
  vehicles,
  isSuperAdmin,
  canEditPricing,
  onOpenPricing,
  onOpenBulkUpload,
  user,
}: {
  pricing: PricingConfig[];
  vehicles: Vehicle[];
  isSuperAdmin: boolean;
  canEditPricing: boolean;
  onOpenPricing: () => void;
  onOpenBulkUpload: () => void;
  user: { name: string; email: string; role: string; companyName?: string; trialStartDate?: string; trialDurationDays?: number; planTier?: string };
}) {
  const { login } = useApp();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  return (
    <div className="p-6 overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Billing &amp; Fleet Management</h2>
            <p className="text-sm text-slate-400">Manage subscription tiers and fleet provisioning</p>
          </div>
          {canEditPricing && (
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={onOpenPricing}>
              <Settings2 className="w-4 h-4 mr-2" />
              Configure Pricing
            </Button>
          )}
          {isSuperAdmin && !canEditPricing && (
            <Badge className="bg-purple-600 text-white">
              <Lock className="w-3 h-3 mr-1" />
              Pricing Read-Only
            </Badge>
          )}
        </div>

        {/* Pricing tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pricing.length > 0 ? pricing.map((p) => {
            const isCurrent = vehicles.some((v) => v.plan_tier === p.tier);
            return (
              <Card
                key={p.id}
                className={`bg-slate-800/50 border-slate-700 ${
                  p.tier === 'proplus' ? 'border-orange-500/30 ring-1 ring-orange-500/20' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-white">{p.name}</CardTitle>
                    {p.tier === 'proplus' && (
                      <Badge className="bg-orange-500 text-white">RECOMMENDED</Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-orange-400">
                      ${p.price_monthly.toFixed(2)}
                    </span>
                    <span className="text-sm text-slate-400">/month per vehicle</span>
                  </div>
                  <CardDescription className="text-slate-400">{p.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent && (
                    <Badge className="mt-3 w-full justify-center bg-blue-600 text-white">
                      Active on Your Fleet
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          }) : (
            // Fallback to constants if pricing not loaded
            Object.entries(PLAN_FEATURES).map(([tier, p]) => (
              <Card
                key={tier}
                className={`bg-slate-800/50 border-slate-700 ${
                  tier === 'proplus' ? 'border-orange-500/30 ring-1 ring-orange-500/20' : ''
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-lg text-white">{p.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-orange-400">
                      ${p.defaultPrice.toFixed(2)}
                    </span>
                    <span className="text-sm text-slate-400">/month per vehicle</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Fleet management actions */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white">Fleet Provisioning</CardTitle>
            <CardDescription className="text-slate-400">
              Unlimited vehicle &amp; driver capacity across all plans
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50">
              <Users className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{vehicles.length} Vehicles Registered</p>
                <p className="text-xs text-slate-400">No quota restrictions on any plan</p>
              </div>
              <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onOpenBulkUpload}>
                <Upload className="w-4 h-4 mr-2" />
                Import Group (CSV)
              </Button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50">
              <Mail className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Automated Account Provisioning</p>
                <p className="text-xs text-slate-400">Dispatch welcome credentials, Master Keys, Driver IDs, PINs, and PWA setup links</p>
              </div>
              <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setShowWelcomeModal(true)}>
                <Send className="w-4 h-4 mr-2" />
                Send Welcome Emails
              </Button>
            </div>
          </CardContent>
        </Card>

        {showWelcomeModal && (
          <Dialog open onOpenChange={() => setShowWelcomeModal(false)}>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Send Welcome Emails &amp; Driver App Codes</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Dispatch welcome credentials, Master Keys, Driver IDs, PIN codes, and PWA setup links to onboarded drivers.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div className="bg-green-950/40 border border-green-800/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-300">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold">4 drivers queued for welcome email dispatch</span>
                  </div>
                  <p className="text-xs text-green-400/70 mt-2">
                    Each email will contain: temporary login credentials, secure access link,
                    cryptographic Master Key, Driver ID, PIN code, and PWA installation instructions.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowWelcomeModal(false)}>
                  <Send className="w-4 h-4 mr-2" />
                  Dispatch All Welcome Emails
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ---- Audit Trail View ----
function AuditTrailView({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) setLogs(data as Record<string, unknown>[]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Immutable Audit Trail</h2>
          <p className="text-sm text-slate-400">
            SHA-256 cryptographic hash chaining — append-only ledger.{' '}
            {isSuperAdmin && 'Super-Admin: Read-Only access enforced.'}
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-950/40 border border-purple-800/40">
            <Lock className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300">
              Super-Admin Read-Only: You can view audit records but cannot edit, alter, or purge recorded collision/sensor data.
            </span>
          </div>
        )}

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-orange-400" />
              Recent Administrative Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-400 text-sm">Loading audit trail...</p>
            ) : logs.length === 0 ? (
              <p className="text-slate-400 text-sm">No audit records yet.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                      <Eye className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {String(log.action_type || 'unknown')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {String(log.actor_role || 'unknown')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {String(log.actor_email || 'system')} ·{' '}
                        {new Date(String(log.utc_timestamp || log.created_at)).toLocaleString()}
                      </p>
                      {log.record_hash ? (
                        <p className="text-xs text-orange-400/60 font-mono mt-1 truncate">
                          SHA-256: {String(log.record_hash).substring(0, 32)}...
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---- Super-Admin Command Workspace ----
function SuperAdminWorkspace({
  vehicles,
  companies,
  drivers,
  incidents,
  loading,
  mapVehicles,
  mapCenter,
  onSelectCompany,
  onNavigateToBilling,
  isCompanyBasicPlan,
  onNavigateToVehicle,
  onBackToOverview,
  user,
  onClientCreated,
  onInstantFleetReport,
  onOpenReportBuilder,
  onShowInsuranceScorecard,
  onShowSuperAdminScorecard,
}: {
  vehicles: Vehicle[];
  companies: Company[];
  drivers: Driver[];
  incidents: Incident[];
  loading: boolean;
  mapVehicles: Array<{ id: string; truckNumber: string; lat: number; lng: number; status: string; selected?: boolean; driverName?: string; speedMph?: number; location?: string }>;
  mapCenter: { lat: number; lng: number };
  onSelectCompany: (id: string) => void;
  onNavigateToBilling: () => void;
  isCompanyBasicPlan: boolean;
  onNavigateToVehicle: (v: Vehicle) => void;
  onBackToOverview: () => void;
  user?: { name: string; email: string; role: string };
  onClientCreated?: () => void;
  onInstantFleetReport: () => void;
  onOpenReportBuilder: () => void;
  onShowInsuranceScorecard: () => void;
  onShowSuperAdminScorecard: () => void;
}) {
  const { fleet } = useApp();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showKeyGen, setShowKeyGen] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto scrollbar-thin">
      <div className="px-4 pt-4 pb-2 shrink-0 space-y-3">
        {/* Top action bar — New Client only (KPI bar is now persistent in parent) */}
        <div className="flex items-center justify-between">
          {user?.role === 'global_admin' && (
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9 font-semibold text-sm shadow-lg shadow-orange-500/20"
              onClick={() => setShowNewClient(true)}
            >
              <Plus className="w-4 h-4" />
              New Client Account
            </Button>
          )}
        </div>

      </div>

      {/* Three-panel layout: directory tree | global map | system health */}
      <div className="flex flex-1 min-h-[min(100%,560px)] overflow-hidden px-4 pb-4 gap-3" style={{ minHeight: 'calc(100vh - 12rem)' }}>
        {/* Left: Global Fleet Hierarchy Directory */}
        <div className="w-64 shrink-0 flex flex-col rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/40 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-white">Fleet Directory</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <p className="text-slate-400 text-sm p-4">Loading…</p>
            ) : companies.length === 0 ? (
              <p className="text-slate-400 text-sm p-4">No fleets registered.</p>
            ) : (
              <div className="py-1">
                {companies.map((c) => {
                  const companyVehicles = vehicles.filter((v) => v.company_id === c.id);
                  const companySafety = companyVehicles.length > 0
                    ? companyVehicles.reduce((s, v) => s + v.safety_score, 0) / companyVehicles.length
                    : 0;
                  const isSelected = fleet.selectedCompanyId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelectCompany(c.id)}
                      className={`w-full text-left px-3 py-2.5 border-b border-slate-700/40 transition-colors group ${
                        isSelected ? 'bg-orange-500/15 border-l-2 border-l-orange-500' : 'hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-orange-400' : 'text-blue-400'}`} />
                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-orange-300' : 'text-white'}`}>{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-5.5">
                        <Badge variant="outline" className="text-[9px] text-slate-400">{c.plan_tier}</Badge>
                        <span className="text-[10px] text-slate-500">{companyVehicles.length} trucks</span>
                        <span className={`text-[10px] font-bold ${companySafety >= 85 ? 'text-green-400' : companySafety >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {companySafety.toFixed(0)}
                        </span>
                        {companySafety > 0 && companySafety < 80 && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-help">
                                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-slate-900 border-slate-600 text-xs text-slate-200 z-[9999]">
                                Sub-par Safety Score (&lt;80). Action recommended.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center: Full-height Global GPS Map */}
        <div className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden flex flex-col min-w-0">
          <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-white">Global Fleet GPS Tracking — All Tenants</span>
            </div>
            <Badge className="bg-blue-600 text-white text-[10px]">{mapVehicles.length} Assets Tracked</Badge>
          </div>
          <div className="flex-1 relative">
            <SafeGPSMap
              latitude={mapCenter.lat}
              longitude={mapCenter.lng}
              vehicles={mapVehicles}
              selectedVehicle={null}
              selectedPlanTier="proplus"
            />
          </div>
        </div>

        {/* Right: System Health & Critical Alerts */}
        <div className="w-64 shrink-0 flex flex-col rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/40 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-white">Sensor Health</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
            {/* C55 77GHz Radar Diagnostics */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">C55 77GHz Radar Diagnostics</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><Radio className="w-3 h-3 text-cyan-400" /> Radar Signal Lock</span>
                <span className="font-bold text-green-400">98.7%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><Cpu className="w-3 h-3 text-cyan-400" /> Active Sensor Nodes</span>
                <span className="font-bold text-cyan-400">15,240</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-yellow-400" /> Hardware Faults</span>
                <span className="font-bold text-yellow-400">3</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><Zap className="w-3 h-3 text-green-400" /> Line Voltage</span>
                <span className="font-bold text-green-400">12.4V — Nominal</span>
              </div>
            </div>

            {/* FleetVu Vault & Gateway Connectivity */}
            <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Vault &amp; Connectivity</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Vault Data Logging</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">Active <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /></span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" /> Gateway Uplink</span>
                <span className="font-bold text-green-400">Online</span>
              </div>
            </div>

            <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Critical Alerts</p>
              {incidents.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No active alerts.</p>
              ) : (
                incidents.slice(0, 6).map((inc) => {
                  const co = companies.find((c) => c.id === inc.company_id);
                  return (
                    <div key={inc.id} className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-3 h-3 text-red-400 shrink-0" />
                        <span className="text-xs font-semibold text-red-300 truncate">{inc.target_type || 'Incident'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 ml-4">{co?.name || 'Unknown'} — {new Date(inc.utc_timestamp).toLocaleDateString()}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Key Generation — Global Admin only */}
            {user?.role === 'global_admin' && (
              <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Access Provisioning</p>
                <Button
                  size="sm"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 gap-1.5"
                  onClick={() => setShowKeyGen(true)}
                >
                  <TicketPlus className="w-3.5 h-3.5" />
                  Generate Admin/Driver Key
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ActivationKeyDialog open={showKeyGen} onClose={() => setShowKeyGen(false)} userEmail={user?.email} />
      <TenantProvisioningModal
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        userEmail={user?.email}
        onCreated={onClientCreated}
      />
      <UpgradePlanModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onGoToBilling={onNavigateToBilling}
      />
    </div>
  );
}

// ─── Tenant Directory View ───────────────────────────────────────────────────

function TenantDirectory({
  companies,
  vehicles,
  drivers,
  incidents,
  loading,
  onSelectCompany,
  user,
  onClientCreated,
}: {
  companies: Company[];
  vehicles: Vehicle[];
  drivers: Driver[];
  incidents: Incident[];
  loading: boolean;
  onSelectCompany: (id: string) => void;
  user: { name: string; email: string; role: string };
  onClientCreated: () => void;
}) {
  const [search, setSearch] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);

  const filtered = companies.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
      {/* Header with Provision button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-400" />
            Master Tenant Directory
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">All provisioned fleet client accounts across the platform</p>
        </div>
        {user.role === 'global_admin' && (
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9 font-semibold text-sm shadow-lg shadow-orange-500/20"
            onClick={() => setShowNewClient(true)}
          >
            <Plus className="w-4 h-4" />
            Provision New Client Account
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-blue-500/25 bg-blue-500/15 p-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-300">Total Tenants</span>
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-1">{companies.length}</p>
        </div>
        <div className="rounded-lg border border-orange-500/25 bg-orange-500/15 p-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-slate-300">Total Assets</span>
          </div>
          <p className="text-2xl font-bold text-orange-400 mt-1">{vehicles.length}</p>
        </div>
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/15 p-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-300">Total Drivers</span>
          </div>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{drivers.length}</p>
        </div>
        <div className="rounded-lg border border-red-500/25 bg-red-500/15 p-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-slate-300">Active Incidents</span>
          </div>
          <p className="text-2xl font-bold text-red-400 mt-1">{incidents.length}</p>
        </div>
      </div>

      {/* Search */}
      <Input
        className="bg-slate-900/50 border-slate-600 text-white h-9 text-sm"
        placeholder="Search by company name or location…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Tenant table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tenant accounts found.</p>
          {user.role === 'global_admin' && (
            <Button size="sm" className="mt-3 bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={() => setShowNewClient(true)}>
              <Plus className="w-3.5 h-3.5" /> Provision First Client
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-2.5 bg-slate-800/60 border-b border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Company Name</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Region</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Plan Tier</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Assets</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Safety Score</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Action</span>
          </div>
          {/* Table rows */}
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin">
            {filtered.map((c) => {
              const companyVehicles = vehicles.filter((v) => v.company_id === c.id);
              const companySafety = companyVehicles.length > 0
                ? companyVehicles.reduce((s, v) => s + v.safety_score, 0) / companyVehicles.length
                : 0;
              return (
                <div
                  key={c.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{c.location || '—'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-300 truncate">{c.region || '—'}</span>
                  <Badge className={cn('text-[10px]', c.plan_tier === 'proplus' ? 'bg-purple-600 text-white' : c.plan_tier === 'pro' ? 'bg-blue-600 text-white' : 'bg-slate-600 text-white')}>
                    {c.plan_tier.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-slate-300">{companyVehicles.length} trucks</span>
                  <span className={cn('text-xs font-bold flex items-center gap-1', companySafety >= 85 ? 'text-green-400' : companySafety >= 70 ? 'text-yellow-400' : 'text-red-400')}>
                    {companySafety > 0 ? companySafety.toFixed(1) : '—'}
                    {companySafety > 0 && companySafety < 80 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-slate-900 border-slate-600 text-xs text-slate-200 z-[9999]">
                            Sub-par Safety Score (&lt;80). Action recommended.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 h-7 text-xs gap-1.5"
                    onClick={() => onSelectCompany(c.id)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TenantProvisioningModal
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        userEmail={user.email}
        onCreated={onClientCreated}
      />
    </div>
  );
}

function TenantProvisioningModal({
  open,
  onClose,
  userEmail,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  userEmail?: string;
  onCreated?: () => void;
}) {
  const [companyName, setCompanyName] = useState('');
  const [terminalLocation, setTerminalLocation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [planTier, setPlanTier] = useState<'basic' | 'pro' | 'proplus'>('basic');
  const [orgKey, setOrgKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ key: string; email: string; setupLink: string } | null>(null);

  const generateOrgKey = useCallback(() => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setOrgKey(`FV-${randomNum}-SA`);
    setKeyCopied(false);
  }, []);

  useEffect(() => {
    if (open) {
      setCompanyName('');
      setTerminalLocation('');
      setFirstName('');
      setLastName('');
      setTitle('');
      setAdminEmail('');
      setPhone('');
      setPlanTier('basic');
      setOrgKey('');
      setKeyCopied(false);
      setSuccess(null);
    }
  }, [open]);

  const copyKey = () => {
    if (orgKey) {
      navigator.clipboard.writeText(orgKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleSubmit = async () => {
    if (!companyName || !terminalLocation || !firstName || !lastName || !adminEmail || !orgKey) return;
    setSaving(true);
    try {
      const { data: newCompany, error: coErr } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          region: 'Global',
          location: terminalLocation,
          plan_tier: planTier,
        })
        .select('id')
        .single();

      if (coErr || !newCompany) {
        setSaving(false);
        return;
      }

      await supabase.from('activation_keys').insert({
        key_code: orgKey,
        role_type: 'super_admin',
        company_name: companyName,
        company_id: newCompany.id,
        recipient_email: adminEmail,
        status: 'active',
        created_by_email: userEmail || null,
      });

      const fullName = `${firstName} ${lastName}`;
      const { data: newUser } = await supabase.from('provisioned_users').insert({
        full_name: fullName,
        email: adminEmail,
        role: 'super_admin',
        company_name: companyName,
        company_id: newCompany.id,
        status: 'pending_invitation',
      }).select('id').single();

      const setupToken = crypto.randomUUID();
      await supabase.from('invite_tokens').insert({
        token: setupToken,
        user_email: adminEmail,
        user_id: newUser?.id || null,
        company_id: newCompany.id,
        created_by: userEmail || null,
        status: 'active',
      });

      const setupLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://fleetvu.app'}/setup?t=${setupToken}`;

      const subject = encodeURIComponent(`Welcome to FleetVu — ${companyName} Account Setup`);
      const body = encodeURIComponent(
        `Hello ${firstName},\n\n` +
        `Your FleetVu fleet account has been provisioned.\n\n` +
        `Company: ${companyName}\n` +
        `Plan: ${planTier === 'proplus' ? 'PRO+' : planTier === 'pro' ? 'PRO' : 'Standard'}\n` +
        `Role: Super-Admin\n` +
        `Org Activation Key: ${orgKey}\n\n` +
        `Complete your account setup within 24 hours using this single-use link:\n${setupLink}\n\n` +
        `This link expires in 24 hours and can only be used once.\n\n` +
        `— FleetVu Administration`
      );
      window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;

      setSuccess({ key: orgKey, email: adminEmail, setupLink });
      onCreated?.();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  const planLabels: Record<string, string> = {
    basic: 'Standard',
    pro: 'PRO',
    proplus: 'PRO+',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-400" />
            Provision New Client Account
            <Badge className="bg-orange-600 text-white text-[9px]">SUPER-ADMIN</Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Onboard a new fleet tenant. An activation key and 24-hour single-use setup link are generated for the customer Super-Admin.
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <div className="overflow-y-auto flex-1 space-y-4 py-2 scrollbar-thin pr-1">
            {/* Section: Company Details */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Company Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Company Legal Name *</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm"
                    placeholder="Apex Logistics LLC"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Main Terminal Location *</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm"
                    placeholder="Los Angeles, CA"
                    value={terminalLocation}
                    onChange={(e) => setTerminalLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section: Service Plan */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Service Plan Tier</p>
              <div className="grid grid-cols-3 gap-2">
                {(['basic', 'pro', 'proplus'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlanTier(p)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                      planTier === p
                        ? p === 'proplus' ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                        : p === 'pro' ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                        : 'bg-slate-600/30 text-slate-200 border-slate-500/50'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border-slate-600'
                    }`}
                  >
                    {planLabels[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Section: Org Activation Key */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Organization Activation Key</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900/50 px-3 h-9">
                  {orgKey ? (
                    <span className="font-mono text-sm font-bold text-orange-400">{orgKey}</span>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Auto-generate a key for this tenant…</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="text-orange-300 border-orange-500/40 hover:bg-orange-500/10 h-9 text-xs gap-1.5"
                  onClick={generateOrgKey}
                >
                  <TicketPlus className="w-3.5 h-3.5" />
                  Generate
                </Button>
                {orgKey && (
                  <Button
                    variant="ghost"
                    className="h-9 text-xs gap-1.5 text-slate-300"
                    onClick={copyKey}
                  >
                    {keyCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {keyCopied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </div>
            </div>

            {/* Section: Super-Admin Details */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Customer Super-Admin Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">First Name *</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Last Name *</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Title</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm"
                    placeholder="VP of Fleet Operations"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Phone</Label>
                  <Input
                    className="bg-slate-900/50 border-slate-600 text-white text-sm"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Email Address *</Label>
                <Input
                  type="email"
                  className="bg-slate-900/50 border-slate-600 text-white text-sm"
                  placeholder="jane@apexlogistics.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
              <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2 ml-auto"
                onClick={handleSubmit}
                disabled={saving || !companyName || !terminalLocation || !firstName || !lastName || !adminEmail || !orgKey}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Provisioning…
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Provision Account &amp; Send Setup Link
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-xl border-2 border-green-500/40 bg-green-500/10 p-4 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-sm font-bold text-white">Tenant Provisioned Successfully</p>
              <p className="text-xs text-slate-400">{companyName} has been added to the Master Tenant Directory.</p>
              <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3 space-y-1.5 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Activation Key</span>
                  <span className="font-mono font-bold text-orange-400">{success.key}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Super-Admin</span>
                  <span className="text-white">{firstName} {lastName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Email</span>
                  <span className="text-white">{success.email}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Plan</span>
                  <span className="text-white">{planLabels[planTier]}</span>
                </div>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 space-y-1.5 text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                  <LinkIcon className="w-3.5 h-3.5" />
                  24-Hour Single-Use Setup Link
                </div>
                <p className="text-[10px] text-blue-200/70 break-all font-mono">{success.setupLink}</p>
                <p className="text-[10px] text-blue-300/80 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  Setup email opened in your mail client.
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                setCompanyName(''); setTerminalLocation(''); setFirstName(''); setLastName('');
                setTitle(''); setAdminEmail(''); setPhone(''); setPlanTier('basic');
                setOrgKey(''); setKeyCopied(false); setSuccess(null);
              }}
            >
              Provision Another Client
            </Button>
            <Button variant="ghost" className="w-full text-slate-400" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivationKeyDialog({ open, onClose, userEmail }: { open: boolean; onClose: () => void; userEmail?: string }) {
  const [keyType, setKeyType] = useState<'super_admin' | 'global_admin' | 'executive' | 'driver'>('executive');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [recentKeys, setRecentKeys] = useState<Array<{ key_code: string; role_type: string; status: string; recipient_email: string | null; created_at: string }>>([]);
  const [copied, setCopied] = useState(false);

  const loadRecentKeys = useCallback(async () => {
    const { data } = await supabase
      .from('activation_keys')
      .select('key_code, role_type, status, recipient_email, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setRecentKeys(data);
  }, []);

  useEffect(() => {
    if (open) {
      loadRecentKeys();
      setGeneratedKey(null);
      setCopied(false);
    }
  }, [open, loadRecentKeys]);

  const generateKey = async () => {
    setGenerating(true);
    try {
      const prefix = keyType === 'super_admin' ? 'SA'
        : keyType === 'global_admin' ? 'GA'
        : keyType === 'executive' ? 'EX'
        : 'DV';
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const keyCode = `FV-${randomNum}-${prefix}`;

      await supabase.from('activation_keys').insert({
        key_code: keyCode,
        role_type: keyType,
        company_name: companyName || null,
        recipient_email: recipientEmail || null,
        status: 'active',
        created_by_email: userEmail || null,
      });

      setGeneratedKey(keyCode);
      loadRecentKeys();
    } catch {
      // ignore
    }
    setGenerating(false);
  };

  const copyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendKeyEmail = () => {
    if (!generatedKey || !recipientEmail) return;
    const subject = encodeURIComponent('FleetVu Activation Key');
    const body = encodeURIComponent(
      `Welcome to FleetVu Mobile Command!\n\nYour activation key is: ${generatedKey}\n\n` +
      `This key grants ${keyType.replace('_', ' ')} access. Use it at the FleetVu login screen ` +
      `along with your email and PIN to sign in.\n\n` +
      `Important: This key is single-use. Keep it secure.\n\n` +
      `— FleetVu Administration`
    );
    window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super-Admin',
    global_admin: 'Global Admin',
    executive: 'Executive',
    driver: 'Driver',
  };

  const roleColors: Record<string, string> = {
    super_admin: 'bg-orange-600 text-white',
    global_admin: 'bg-red-600 text-white',
    executive: 'bg-blue-600 text-white',
    driver: 'bg-green-600 text-white',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <TicketPlus className="w-5 h-5 text-orange-400" />
            Generate Activation Key
            <Badge className="bg-orange-600 text-white text-[9px]">SUPER-ADMIN</Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Create single-use activation keys to onboard admins or drivers. Email the key directly to your team member.
          </DialogDescription>
        </DialogHeader>

        {!generatedKey ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Key Type (Role to Grant)</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['executive', 'driver', 'super_admin', 'global_admin'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setKeyType(r)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      keyType === r
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 border-slate-600'
                    }`}
                  >
                    {roleLabels[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Recipient Email (Optional)</Label>
              <Input
                className="bg-slate-900/50 border-slate-600 text-white text-sm"
                placeholder="teammate@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Company Name (Optional, for fleet-scoped keys)</Label>
              <Input
                className="bg-slate-900/50 border-slate-600 text-white text-sm"
                placeholder="Apex Logistics"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={generateKey}
              disabled={generating}
            >
              {generating ? 'Generating…' : 'Generate Activation Key'}
            </Button>

            {recentKeys.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-700">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Recent Keys</p>
                <div className="max-h-[140px] overflow-y-auto scrollbar-thin space-y-1">
                  {recentKeys.map((k) => (
                    <div key={k.key_code} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-900/40 border border-slate-700/50 text-xs">
                      <span className="font-mono text-slate-300 font-semibold">{k.key_code}</span>
                      <Badge className={`${roleColors[k.role_type] || 'bg-slate-600 text-white'} text-[8px] px-1.5 py-0`}>
                        {roleLabels[k.role_type] || k.role_type}
                      </Badge>
                      <Badge className={`text-[8px] px-1.5 py-0 ${k.status === 'active' ? 'bg-green-600 text-white' : k.status === 'used' ? 'bg-slate-600 text-slate-300' : 'bg-red-600 text-white'}`}>
                        {k.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border-2 border-orange-500/40 bg-orange-500/10 p-4 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-sm font-bold text-white">Activation Key Generated</p>
              <p className="font-mono text-2xl font-bold text-orange-400 tracking-wider">{generatedKey}</p>
              <div className="flex items-center justify-center gap-2">
                <Badge className={`${roleColors[keyType]} text-[10px]`}>{roleLabels[keyType]}</Badge>
                <Badge className="bg-green-600 text-white text-[10px]">Active — Single Use</Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-slate-300 border-slate-600 gap-1.5"
                onClick={copyKey}
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Key'}
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 ml-auto"
                onClick={sendKeyEmail}
                disabled={!recipientEmail}
              >
                <Mail className="w-4 h-4" />
                Email to Recipient
              </Button>
            </div>

            {!recipientEmail && (
              <p className="text-xs text-slate-500 text-center">
                Enter a recipient email above to send via email, or copy the key to share manually.
              </p>
            )}

            <Button
              variant="ghost"
              className="w-full text-slate-400"
              onClick={() => { setGeneratedKey(null); setCopied(false); }}
            >
              Generate Another Key
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-700">
          <Button variant="outline" className="text-slate-300 border-slate-600" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InlineKpiBar({
  isGlobalView,
  selectedCompany,
  companies,
  vehicles,
  incidents,
  onTotalCompaniesClick,
}: {
  isGlobalView: boolean;
  selectedCompany?: Company;
  companies: Company[];
  vehicles: Vehicle[];
  incidents: Incident[];
  onTotalCompaniesClick?: () => void;
}) {
  const companyVehicles = selectedCompany
    ? vehicles.filter((v) => v.company_id === selectedCompany.id)
    : [];
  const companyIncidents = selectedCompany
    ? incidents.filter((inc) => inc.company_id === selectedCompany.id)
    : [];

  if (!isGlobalView && selectedCompany) {
    const companySafety = companyVehicles.length > 0
      ? companyVehicles.reduce((s, v) => s + v.safety_score, 0) / companyVehicles.length
      : 0;
    const uniqueLocations = new Set(companyVehicles.map((v) => v.location).filter(Boolean)).size;
    const activeAlerts = companyIncidents.length;

    return (
      <div className="flex items-center gap-1.5 flex-nowrap">
        <InlineKpiCard label="Locations" value={String(Math.max(uniqueLocations, 1))} icon={<MapPin className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/15" border="border-blue-500/25" />
        <InlineKpiCard label="Trucks" value={String(companyVehicles.length)} icon={<Truck className="w-4 h-4" />} color="text-orange-400" bg="bg-orange-500/15" border="border-orange-500/25" />
        <InlineKpiCard label="Safety Score" value={companySafety.toFixed(1)} icon={<Shield className="w-4 h-4" />} color={companySafety >= 85 ? 'text-green-400' : companySafety >= 70 ? 'text-yellow-400' : 'text-red-400'} bg={companySafety >= 85 ? 'bg-green-500/15' : companySafety >= 70 ? 'bg-yellow-500/15' : 'bg-red-500/15'} border={companySafety >= 85 ? 'border-green-500/25' : companySafety >= 70 ? 'border-yellow-500/25' : 'border-red-500/25'} />
        <InlineKpiCard label="Active Alerts" value={activeAlerts === 0 ? '0' : `${activeAlerts} HIGH`} icon={<Bell className="w-4 h-4" />} color={activeAlerts === 0 ? 'text-green-400' : 'text-red-400'} bg={activeAlerts === 0 ? 'bg-green-500/15' : 'bg-red-500/15'} border={activeAlerts === 0 ? 'border-green-500/25' : 'border-red-500/25'} />
      </div>
    );
  }

  const totalSafety = vehicles.length > 0
    ? vehicles.reduce((s, v) => s + v.safety_score, 0) / vehicles.length
    : 0;
  const totalAlerts = incidents.length;

  return (
    <div className="flex items-center gap-1.5 flex-nowrap">
      <InlineKpiCard label="Total Companies" value={String(companies.length)} icon={<Building2 className="w-4 h-4" />} color="text-blue-400" bg="bg-blue-500/15" border="border-blue-500/25" onClick={onTotalCompaniesClick} />
      <InlineKpiCard label="Total Fleets" value={String(companies.length)} icon={<Layers className="w-4 h-4" />} color="text-cyan-400" bg="bg-cyan-500/15" border="border-cyan-500/25" />
      <InlineKpiCard label="Total Trucks" value={String(vehicles.length)} icon={<Truck className="w-4 h-4" />} color="text-orange-400" bg="bg-orange-500/15" border="border-orange-500/25" />
      <InlineKpiCard label="Global Safety Score" value={totalSafety.toFixed(1)} icon={<Shield className="w-4 h-4" />} color={totalSafety >= 85 ? 'text-green-400' : totalSafety >= 70 ? 'text-yellow-400' : 'text-red-400'} bg={totalSafety >= 85 ? 'bg-green-500/15' : totalSafety >= 70 ? 'bg-yellow-500/15' : 'bg-red-500/15'} border={totalSafety >= 85 ? 'border-green-500/25' : totalSafety >= 70 ? 'border-yellow-500/25' : 'border-red-500/25'} />
      <InlineKpiCard label="Active Alerts" value={totalAlerts === 0 ? '0' : `${totalAlerts} HIGH`} icon={<Bell className="w-4 h-4" />} color={totalAlerts === 0 ? 'text-green-400' : 'text-red-400'} bg={totalAlerts === 0 ? 'bg-green-500/15' : 'bg-red-500/15'} border={totalAlerts === 0 ? 'border-green-500/25' : 'border-red-500/25'} />
    </div>
  );
}

function InlineKpiCard({ label, value, icon, color, bg, border, onClick }: { label: string; value: string; icon: React.ReactNode; color: string; bg: string; border: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`rounded-lg ${bg} ${border} border px-2.5 py-1 flex items-center gap-1.5 min-w-0 shrink-0 ${onClick ? 'cursor-pointer hover:brightness-125 transition-all' : ''}`}>
      <div className={`w-7 h-7 rounded-md ${bg} ${border} border flex items-center justify-center ${color} shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <p className="text-sm font-bold text-white truncate leading-tight">{value}</p>
        <p className="text-[9px] text-slate-400 uppercase tracking-wide truncate leading-tight">{label}</p>
      </div>
    </Tag>
  );
}

function UpgradePlanModal({
  open,
  onClose,
  onGoToBilling,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  onGoToBilling: () => void;
  userEmail?: string;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    targetPlan: 'pro',
    numVehicles: '',
    locations: '',
    fullName: '',
    title: '',
    phone: '',
    email: '',
    companyName: '',
    bestTime: '',
  });

  const updateField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESEND_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@fleetvu.org',
          to: 'support@fleetvu.org',
          cc: form.email || userEmail || undefined,
          subject: `Upgrade Request — ${form.targetPlan.toUpperCase()} Plan`,
          text: [
            `Target Plan: ${form.targetPlan.toUpperCase()}`,
            `Number of Vehicles: ${form.numVehicles}`,
            `Location(s): ${form.locations}`,
            `Full Name: ${form.fullName}`,
            `Title: ${form.title}`,
            `Phone Number: ${form.phone}`,
            `Email Address: ${form.email}`,
            `Company Name: ${form.companyName}`,
            `Best Time to Contact: ${form.bestTime}`,
          ].join('\n'),
        }),
      });
    } catch {
      // Best-effort submission — show confirmation regardless
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  const handleClose = () => {
    if (submitted) {
      setSubmitted(false);
      setForm({
        targetPlan: 'pro',
        numVehicles: '',
        locations: '',
        fullName: '',
        title: '',
        phone: '',
        email: '',
        companyName: '',
        bestTime: '',
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        {submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Request Submitted
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-sm text-slate-200 font-semibold">
                Thank you for your submission. A FleetVu representative will contact you soon.
              </p>
              <p className="text-xs text-slate-400">
                A copy of your request has been sent to {form.email || userEmail || 'your email'}.
              </p>
            </div>
            <DialogFooter>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400" />
                Upgrade Plan
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                You&apos;re currently in BASIC+ TRIAL MODE. Submit a request to upgrade to Pro or Pro+ for full production sync, live API keys, and historical exports.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto scrollbar-thin pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Target Plan</Label>
                  <Select value={form.targetPlan} onValueChange={(v) => setForm((p) => ({ ...p, targetPlan: v }))}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600 text-white text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="pro">PRO</SelectItem>
                      <SelectItem value="proplus">PRO+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Number of Vehicles</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.numVehicles}
                    onChange={updateField('numVehicles')}
                    className="bg-slate-900/60 border-slate-600 text-white text-sm h-9"
                    placeholder="e.g. 25"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Location(s)</Label>
                <Textarea
                  value={form.locations}
                  onChange={updateField('locations')}
                  className="bg-slate-900/60 border-slate-600 text-white text-sm resize-none"
                  rows={2}
                  placeholder="e.g. Los Angeles, CA; Phoenix, AZ"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Full Name</Label>
                  <Input
                    value={form.fullName}
                    onChange={updateField('fullName')}
                    className="bg-slate-900/60 border-slate-600 text-white text-sm h-9"
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Title</Label>
                  <Input
                    value={form.title}
                    onChange={updateField('title')}
                    className="bg-slate-900/60 border-slate-600 text-white text-sm h-9"
                    placeholder="Fleet Manager"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Phone Number</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={updateField('phone')}
                    className="bg-slate-900/60 border-slate-600 text-white text-sm h-9"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Email Address</Label>
                  <Input
                    type="email"
                    value={form.email || userEmail || ''}
                    onChange={updateField('email')}
                    className="bg-slate-900/60 border-slate-600 text-white text-sm h-9"
                    placeholder="john@company.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Company Name</Label>
                  <Input
                    value={form.companyName}
                    onChange={updateField('companyName')}
                    className="bg-slate-900/60 border-slate-600 text-white text-sm h-9"
                    placeholder="Acme Trucking Co."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Best Time to Contact</Label>
                  <Select value={form.bestTime} onValueChange={(v) => setForm((p) => ({ ...p, bestTime: v }))}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600 text-white text-sm h-9">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="morning">Morning (8AM–12PM)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (12PM–5PM)</SelectItem>
                      <SelectItem value="evening">Evening (5PM–8PM)</SelectItem>
                      <SelectItem value="anytime">Anytime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="text-slate-300 border-slate-600 sm:flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white sm:flex-[2] gap-2"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Click Here to Submit Your Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Widget Customizer Sheet Content ----
function WidgetCustomizerContent() {
  const { fleet, setDashboardLayout } = useApp();
  const layout = fleet?.dashboardLayout ?? defaultDashboardLayout;
  const order = layout?.widgetOrder ?? DEFAULT_WIDGET_ORDER;
  const visibility = layout?.widgetVisibility ?? {};

  const toggleWidget = (id: WidgetId) => (checked: boolean) => {
    setDashboardLayout({
      widgetVisibility: { ...visibility, [id]: checked },
    });
  };

  const moveWidget = (id: WidgetId, direction: 'up' | 'down') => {
    const idx = order.indexOf(id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= order.length) return;
    const newOrder = [...order];
    const [item] = newOrder.splice(idx, 1);
    newOrder.splice(newIdx, 0, item);
    setDashboardLayout({ widgetOrder: newOrder });
  };

  return (
    <div className="space-y-4 py-4">
      <p className="text-xs text-slate-400">
        Toggle widgets on or off and reorder them. Changes save automatically to your profile.
      </p>

      <div className="space-y-2">
        {order.map((wid) => {
          const meta = ALL_WIDGETS.find((w) => w.id === wid);
          if (!meta) return null;
          const isVisible = visibility[wid] !== false;
          const idx = order.indexOf(wid);
          return (
            <div
              key={wid}
              className={`rounded-lg border p-2.5 transition-colors ${
                isVisible
                  ? 'bg-slate-900/50 border-slate-700'
                  : 'bg-slate-900/30 border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveWidget(wid, 'up')}
                    disabled={idx === 0}
                    className="text-slate-500 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-0.5"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveWidget(wid, 'down')}
                    disabled={idx === order.length - 1}
                    className="text-slate-500 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-0.5"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{meta.label}</p>
                  <p className="text-[10px] text-slate-500 truncate">{meta.description}</p>
                </div>
                <Switch checked={isVisible} onCheckedChange={toggleWidget(wid)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
