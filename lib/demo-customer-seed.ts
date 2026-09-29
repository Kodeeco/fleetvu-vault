import type { Company, Driver, Vehicle } from '@/lib/types';

/** Stable IDs for UX Review customer portal seed (matches BOLT demo feel). */
export const DEMO_APEX_COMPANY_ID = 'demo-apex-logistics';
export const DEMO_ENTERPRISE_EMAIL = 'info@fleetmasterusa.com';

export const DEMO_CUSTOMER_SUPER_ADMIN = {
  role: 'super_admin' as const,
  email: DEMO_ENTERPRISE_EMAIL,
  name: 'Apex Logistics Super-Admin',
  companyName: 'Apex Logistics',
  companyId: DEMO_APEX_COMPANY_ID,
  planTier: 'proplus' as const,
  provisionedRole: 'super_admin',
};

const now = '2026-09-15T12:00:00.000Z';

export function getDemoCompanies(): Company[] {
  return [
    {
      id: DEMO_APEX_COMPANY_ID,
      name: 'Apex Logistics',
      region: 'Midwest',
      location: 'Kansas City, KS',
      plan_tier: 'proplus',
      fleet_locations: ['Kansas City Terminal', 'Wichita Hub', 'Topeka Yard'],
      created_at: now,
      account_status: 'active',
      fleet_size: 3,
      health_score: 92,
      industry: 'Long-haul freight',
    },
    {
      id: 'demo-summit-freight',
      name: 'Summit Freight Co.',
      region: 'Mountain',
      location: 'Denver, CO',
      plan_tier: 'pro',
      fleet_locations: ['Denver Central'],
      created_at: now,
      account_status: 'active',
      fleet_size: 0,
      health_score: 0,
    },
    {
      id: 'demo-coastal-hauling',
      name: 'Coastal Hauling',
      region: 'West',
      location: 'Long Beach, CA',
      plan_tier: 'basic',
      fleet_locations: ['Port Terminal'],
      created_at: now,
      account_status: 'active',
      fleet_size: 0,
      health_score: 0,
    },
    {
      id: 'demo-redstone-transport',
      name: 'Redstone Transport',
      region: 'South',
      location: 'Dallas, TX',
      plan_tier: 'basic',
      fleet_locations: ['DFW Yard'],
      created_at: now,
      account_status: 'active',
      fleet_size: 0,
      health_score: 0,
    },
    {
      id: 'demo-northwind-logistics',
      name: 'Northwind Logistics',
      region: 'North',
      location: 'Minneapolis, MN',
      plan_tier: 'basic',
      fleet_locations: ['Twin Cities Hub'],
      created_at: now,
      account_status: 'active',
      fleet_size: 0,
      health_score: 0,
    },
  ];
}

export function getDemoDrivers(): Driver[] {
  return [
    {
      id: 'demo-drv-marcus',
      company_id: DEMO_APEX_COMPANY_ID,
      name: 'Marcus Chen',
      email: 'marcus.chen@apexlogistics.com',
      driver_number: 'DRV-101',
      pin_code: null,
      location: 'Kansas City Terminal',
      company_name: 'Apex Logistics',
      license_class: 'CDL-A',
      status: 'active',
      created_at: now,
    },
    {
      id: 'demo-drv-sarah',
      company_id: DEMO_APEX_COMPANY_ID,
      name: 'Sarah Williams',
      email: 'sarah.williams@apexlogistics.com',
      driver_number: 'DRV-102',
      pin_code: null,
      location: 'Kansas City Terminal',
      company_name: 'Apex Logistics',
      license_class: 'CDL-A',
      status: 'active',
      created_at: now,
    },
    {
      id: 'demo-drv-unassigned',
      company_id: DEMO_APEX_COMPANY_ID,
      name: 'Unassigned',
      email: null,
      driver_number: 'DRV-103',
      pin_code: null,
      location: 'Wichita Hub',
      company_name: 'Apex Logistics',
      license_class: 'CDL-A',
      status: 'active',
      created_at: now,
    },
  ];
}

export function getDemoVehicles(): Vehicle[] {
  return [
    {
      id: 'demo-veh-101',
      company_id: DEMO_APEX_COMPANY_ID,
      truck_number: 'TRK-101',
      chassis_type: 'class8_tractor',
      hardware_profile: 'c55_pro_forward_lr',
      assigned_driver_id: 'demo-drv-marcus',
      company_name: 'Apex Logistics',
      location: 'Kansas City Terminal',
      status: 'operational',
      plan_tier: 'proplus',
      safety_score: 94.5,
      created_at: now,
    },
    {
      id: 'demo-veh-102',
      company_id: DEMO_APEX_COMPANY_ID,
      truck_number: 'TRK-102',
      chassis_type: 'class8_tractor',
      hardware_profile: 'c55_pro_forward_lr',
      assigned_driver_id: 'demo-drv-sarah',
      company_name: 'Apex Logistics',
      location: 'Kansas City Terminal',
      status: 'operational',
      plan_tier: 'proplus',
      safety_score: 91.2,
      created_at: now,
    },
    {
      id: 'demo-veh-103',
      company_id: DEMO_APEX_COMPANY_ID,
      truck_number: 'TRK-103',
      chassis_type: 'class8_tractor_sleeper',
      hardware_profile: 'c55_pro_forward_lr_rear',
      assigned_driver_id: null,
      company_name: 'Apex Logistics',
      location: 'Wichita Hub',
      status: 'operational',
      plan_tier: 'proplus',
      safety_score: 89.0,
      created_at: now,
    },
  ];
}

export function isUxDemoEnterpriseSession(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return (
    e === DEMO_ENTERPRISE_EMAIL ||
    e === 'safety.director@acmelogistics.com' ||
    e.endsWith('@apexlogistics.com')
  );
}

export function markUxDemoEnterprise(): void {
  try {
    sessionStorage.setItem('fleetvu_ux_demo_enterprise', '1');
  } catch {
    /* ignore */
  }
}

export function clearUxDemoEnterprise(): void {
  try {
    sessionStorage.removeItem('fleetvu_ux_demo_enterprise');
  } catch {
    /* ignore */
  }
}

export function isUxDemoEnterpriseFlag(): boolean {
  try {
    return sessionStorage.getItem('fleetvu_ux_demo_enterprise') === '1';
  } catch {
    return false;
  }
}
