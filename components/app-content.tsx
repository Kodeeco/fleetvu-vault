'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AppProvider, useApp, type AuthUser, type VaultPhase } from '@/lib/app-context';
import { LoginScreen } from '@/components/auth/login-screen';
import { MobileHUD } from '@/components/hud/mobile-hud';
import { DesktopCommandCenter } from '@/components/desktop/desktop-command-center';
import { FleetVuCrmWorkspace } from '@/components/desktop/fleetvu-crm-workspace';
import { VaultLandingPage, type GatewayChoice } from '@/components/landing/vault-landing-page';
import { DriverVaultOnboarding } from '@/components/landing/driver-vault-onboarding';
import { FleetVuErrorBoundary } from '@/components/error-boundary';
import { VaultLockScreen } from '@/components/vault/vault-lock-screen';
import { VaultFeatureHub, type VaultFeature } from '@/components/vault/vault-feature-hub';
import { getVaultPhase, setVaultPhase } from '@/lib/vault-session';
import {
  DEMO_APEX_COMPANY_ID,
  DEMO_CUSTOMER_SUPER_ADMIN,
  markUxDemoEnterprise,
  clearUxDemoEnterprise,
} from '@/lib/demo-customer-seed';
import { SCFUELS_TRIAL, SCFUELS_TRIAL_DRIVER } from '@/lib/scfuels-trial';
import { TRIAL_CHANNEL_CONFIG } from '@/lib/edge-filter';

type AppState = 'landing' | 'driver_onboarding' | 'enterprise_login' | 'accuvu_login' | 'global_login';

/** SCFuels C55-Pro evaluation — default #demo-vault identity */
const DEMO_DRIVER: AuthUser = { ...SCFUELS_TRIAL_DRIVER };

const DEMO_ENTERPRISE: AuthUser = {
  ...DEMO_CUSTOMER_SUPER_ADMIN,
  productSku: 'fleetvu',
};

const DEMO_ACCUVU: AuthUser = {
  ...DEMO_CUSTOMER_SUPER_ADMIN,
  email: 'admin@fleetvu.org',
  name: 'AccuVu Account Admin',
  companyName: 'AccuVu Demo Company',
  productSku: 'accuvu',
};

const DEMO_GLOBAL: AuthUser = {
  role: 'global_admin',
  email: 'admin@fleetvu.org',
  name: 'FleetVu Ops',
  companyName: 'FleetVu',
  planTier: 'proplus',
  productSku: 'fleetvu',
};

function isVaultUser(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.role === 'driver' || Boolean(user.biometricVerified) || Boolean(user.driverId);
}

function clearHash() {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}`);
}

function setHash(hash: string) {
  if (typeof window === 'undefined') return;
  window.location.hash = hash;
}

function AppInner() {
  const { user, view, setView, login, logout, setFleet } = useApp();
  const [gateway, setGateway] = useState<AppState>('landing');
  const [vaultPhase, setPhase] = useState<VaultPhase>(null);
  const [openIncidentOnHud, setOpenIncidentOnHud] = useState(false);
  const [hudFocus, setHudFocus] = useState<'sensors' | 'gps' | 'log' | 'default'>('default');
  const [adminPreview, setAdminPreview] = useState(false);
  const [adminReturnUser, setAdminReturnUser] = useState<AuthUser | null>(null);

  const updatePhase = useCallback((phase: VaultPhase) => {
    setPhase(phase);
    setVaultPhase(phase);
  }, []);

  const hardLogoutToLanding = useCallback(() => {
    setAdminPreview(false);
    setAdminReturnUser(null);
    updatePhase(null);
    clearUxDemoEnterprise();
    logout();
    setView('desktop');
    setGateway('landing');
    // Keep #home so empty-hash SCFuels default does not bounce straight back into demo vault
    clearHash();
    setHash('home');
  }, [logout, setView, updatePhase]);

  const enterDemoVault = useCallback(
    (opts?: { asAdminPreview?: boolean; returnUser?: AuthUser | null }) => {
      clearUxDemoEnterprise();
      if (opts?.asAdminPreview && opts.returnUser) {
        setAdminReturnUser(opts.returnUser);
        setAdminPreview(true);
      } else {
        setAdminPreview(false);
        setAdminReturnUser(null);
      }
      clearHash();
      setHash('demo-vault');
      login({ ...DEMO_DRIVER });
      setFleet({
        forwardRange: TRIAL_CHANNEL_CONFIG.channel_forward_range_m,
        leftRange: TRIAL_CHANNEL_CONFIG.channel_left_range_m,
        rightRange: TRIAL_CHANNEL_CONFIG.channel_right_range_m,
        selectedCompanyId: SCFUELS_TRIAL.companyId,
      });
      setView('mobile');
      updatePhase('locked');
    },
    [login, setFleet, setView, updatePhase],
  );

  const enterDemoEnterprise = useCallback(() => {
    setAdminPreview(false);
    setAdminReturnUser(null);
    updatePhase(null);
    markUxDemoEnterprise();
    clearHash();
    setHash('demo-enterprise');
    login({ ...DEMO_ENTERPRISE });
    // Land inside Apex Logistics customer portal (not empty overview)
    setFleet({
      selectedCompanyId: DEMO_APEX_COMPANY_ID,
      selectedRegion: null,
      selectedLocation: null,
      selectedTerminal: null,
      demoPlan: 'proplus',
    });
    setView('desktop');
  }, [login, setFleet, setView, updatePhase]);

  /** AccuVu SKU — reconstruction platform (not full FleetVu / Driver Vault) */
  const enterDemoAccuVu = useCallback(() => {
    setAdminPreview(false);
    setAdminReturnUser(null);
    updatePhase(null);
    markUxDemoEnterprise();
    clearHash();
    setHash('demo-accuvu');
    login({ ...DEMO_ACCUVU });
    setFleet({
      selectedCompanyId: DEMO_APEX_COMPANY_ID,
      selectedRegion: null,
      selectedLocation: null,
      selectedTerminal: null,
      demoPlan: 'proplus',
    });
    setView('desktop');
  }, [login, setFleet, setView, updatePhase]);

  const enterDemoGlobal = useCallback(() => {
    setAdminPreview(false);
    setAdminReturnUser(null);
    updatePhase(null);
    clearUxDemoEnterprise();
    clearHash();
    setHash('fv-ops');
    login({ ...DEMO_GLOBAL });
    setView('desktop');
  }, [login, setView, updatePhase]);

  // Restore vault phase for returning drivers
  useEffect(() => {
    if (user && (user.role === 'driver' || adminPreview || view === 'mobile')) {
      const stored = getVaultPhase();
      setPhase(stored || 'locked');
    } else if (!user) {
      setPhase(null);
      setAdminPreview(false);
      setAdminReturnUser(null);
    }
  }, [user, view, adminPreview]);

  const returnToAdminPortal = useCallback(() => {
    setAdminPreview(false);
    updatePhase(null);
    if (adminReturnUser) {
      login(adminReturnUser);
      setView('desktop');
      setAdminReturnUser(null);
    } else {
      hardLogoutToLanding();
    }
  }, [adminReturnUser, hardLogoutToLanding, login, setView, updatePhase]);

  // Expose admin vault entry via custom event from desktop command center
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { demoUser?: AuthUser } | undefined;
      const returnUser = user && user.role !== 'driver' ? user : null;
      if (detail?.demoUser) {
        setAdminReturnUser(returnUser);
        setAdminPreview(true);
        login({ ...detail.demoUser, biometricVerified: true });
        setView('mobile');
        updatePhase('locked');
        return;
      }
      enterDemoVault({ asAdminPreview: Boolean(returnUser), returnUser });
    };
    window.addEventListener('fleetvu:open-driver-vault', handler);
    return () => window.removeEventListener('fleetvu:open-driver-vault', handler);
  }, [enterDemoVault, login, setView, updatePhase, user]);

  const applyHashRoute = useCallback(
    (rawHash: string) => {
      const hash = rawHash.replace(/^#/, '').toLowerCase();

      // SCFuels C55-Pro pilot: bare / opens the Vault lock screen (not the 3-product chooser).
      // Multi-portal landing stays available at #home / #portals for later.
      if (!hash) {
        enterDemoVault();
        return;
      }

      if (hash === 'home' || hash === 'portals') {
        setAdminPreview(false);
        setAdminReturnUser(null);
        updatePhase(null);
        clearUxDemoEnterprise();
        logout();
        setView('desktop');
        setGateway('landing');
        setHash('home');
        return;
      }
      if (hash === 'demo-vault' || hash === 'demo-driver') {
        enterDemoVault();
        return;
      }
      if (hash === 'demo-enterprise' || hash === 'demo-company') {
        enterDemoEnterprise();
        return;
      }
      if (hash === 'demo-accuvu') {
        enterDemoAccuVu();
        return;
      }
      if (hash === 'demo-global' || hash === 'demo-ops') {
        enterDemoGlobal();
        return;
      }
      if (hash === 'fv-ops' || hash === 'fleetvu-ops' || hash === 'global') {
        logout();
        updatePhase(null);
        setAdminPreview(false);
        setGateway('global_login');
        return;
      }
      if (hash === 'accuvu') {
        logout();
        updatePhase(null);
        setAdminPreview(false);
        setGateway('accuvu_login');
        return;
      }
      if (hash === 'enterprise' || hash === 'company') {
        logout();
        updatePhase(null);
        setAdminPreview(false);
        setGateway('enterprise_login');
        return;
      }
      if (hash === 'driver' || hash === 'vault') {
        logout();
        updatePhase(null);
        setAdminPreview(false);
        setGateway('driver_onboarding');
      }
    },
    [
      enterDemoAccuVu,
      enterDemoEnterprise,
      enterDemoGlobal,
      enterDemoVault,
      logout,
      setView,
      updatePhase,
    ],
  );

  // Deep-link hashes — always work, even when already logged in
  const applyHashRouteRef = useRef(applyHashRoute);
  applyHashRouteRef.current = applyHashRoute;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const run = () => applyHashRouteRef.current(window.location.hash);
    // Defer past AppProvider hydration so portal hashes own the session
    const t = window.setTimeout(run, 20);
    window.addEventListener('hashchange', run);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('hashchange', run);
    };
  }, []);

  const handleFeatureSelect = (feature: VaultFeature) => {
    if (feature === 'lock_vault') {
      updatePhase('locked');
      return;
    }
    if (feature === 'post_check') {
      return;
    }
    if (feature === 'report_incident') {
      setOpenIncidentOnHud(true);
      setHudFocus('default');
      updatePhase('active');
      return;
    }
    if (feature === 'live_gps') {
      setHudFocus('gps');
      setOpenIncidentOnHud(false);
      updatePhase('active');
      return;
    }
    if (feature === 'event_log') {
      setHudFocus('log');
      setOpenIncidentOnHud(false);
      updatePhase('active');
      return;
    }
    setHudFocus('sensors');
    setOpenIncidentOnHud(false);
    updatePhase('active');
  };

  // Authenticated mobile / driver vault flow
  if (user && (view === 'mobile' || user.role === 'driver' || adminPreview)) {
    if (view === 'desktop' && user.role !== 'driver' && !adminPreview) {
      return (
        <>
          <FleetVuErrorBoundary name="DesktopCommandCenter">
            <DesktopCommandCenter />
          </FleetVuErrorBoundary>
        </>
      );
    }

    const phase = vaultPhase || 'locked';
    const previewMode = adminPreview || (user.role !== 'driver' && view === 'mobile');

    if (phase === 'locked' || (isVaultUser(user) && phase === null)) {
      return (
        <>
          <FleetVuErrorBoundary name="VaultLockScreen">
            <VaultLockScreen
              user={user}
              previewMode={previewMode}
              onLaunch={() => {
                setHudFocus('sensors');
                setOpenIncidentOnHud(false);
                updatePhase('active');
              }}
            />
          </FleetVuErrorBoundary>
        </>
      );
    }

    if (phase === 'hub') {
      return (
        <>
          <FleetVuErrorBoundary name="VaultFeatureHub">
            <VaultFeatureHub
              user={user}
              previewMode={previewMode}
              onSelect={handleFeatureSelect}
              onLock={() => updatePhase('locked')}
            />
          </FleetVuErrorBoundary>
        </>
      );
    }

    return (
      <>
        <FleetVuErrorBoundary name="MobileHUD">
          <MobileHUD
            initialShowIncident={openIncidentOnHud}
            initialFocus={hudFocus}
            onReturnToVault={() => {
              setOpenIncidentOnHud(false);
              updatePhase('hub');
            }}
            onLockVault={() => {
              setOpenIncidentOnHud(false);
              updatePhase('locked');
            }}
            onReturnToPortal={adminPreview ? returnToAdminPortal : hardLogoutToLanding}
            trialMode={!adminPreview}
          />
        </FleetVuErrorBoundary>
      </>
    );
  }

  // Authenticated desktop / admin
  if (user) {
    if (user.role === 'global_admin') {
      return (
        <>
          <FleetVuErrorBoundary name="FleetVuCrmWorkspace">
            <FleetVuCrmWorkspace user={user} />
          </FleetVuErrorBoundary>
        </>
      );
    }

    return (
      <>
        <FleetVuErrorBoundary name="DesktopCommandCenter">
          <DesktopCommandCenter />
        </FleetVuErrorBoundary>
      </>
    );
  }

  // Unauthenticated gateway
  if (gateway === 'landing') {
    return (
      <>
        <VaultLandingPage
          onSelect={(choice: GatewayChoice, opts) => {
            if (opts?.demo && choice === 'driver') {
              enterDemoVault();
              return;
            }
            if (opts?.demo && choice === 'enterprise') {
              enterDemoEnterprise();
              return;
            }
            if (opts?.demo && choice === 'accuvu') {
              enterDemoAccuVu();
              return;
            }
            if (opts?.demo && choice === 'global') {
              enterDemoGlobal();
              return;
            }

            if (choice === 'driver') {
              clearHash();
              setHash('driver');
              setGateway('driver_onboarding');
            } else if (choice === 'global') {
              setHash('fv-ops');
              setGateway('global_login');
            } else if (choice === 'accuvu') {
              setHash('accuvu');
              setGateway('accuvu_login');
            } else {
              setHash('enterprise');
              setGateway('enterprise_login');
            }
          }}
        />
      </>
    );
  }

  if (gateway === 'driver_onboarding') {
    return (
      <>
        <DriverVaultOnboarding
          onBack={() => {
            clearHash();
            setGateway('landing');
          }}
          onVaultReady={() => {
            updatePhase('locked');
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <LoginScreen
          portalMode={
            gateway === 'global_login' ? 'global' : gateway === 'accuvu_login' ? 'accuvu' : 'enterprise'
          }
        />
        <button
          type="button"
          onClick={() => {
            clearHash();
            setGateway('landing');
          }}
          className="fixed top-3 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 backdrop-blur border border-slate-700 text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Portal Selection
        </button>
      </div>
    </>
  );
}

export default function AppContent() {
  return (
    <FleetVuErrorBoundary name="FleetVuRoot">
      <AppProvider>
        <AppInner />
      </AppProvider>
    </FleetVuErrorBoundary>
  );
}
