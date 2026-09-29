import type {
  ChassisType,
  HardwareProfileKey,
  PlanTier,
  VehicleProfileKey,
} from './types';

export const FLEETVU_COLORS = {
  bgDark: '#0F172A',
  containerDark: '#1E293B',
  safetyOrange: '#F97316',
  safetyOrangeLight: '#FB923C',
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#EAB308',
  blueAccent: '#3B82F6',
  textLight: '#F1F5F9',
  textMuted: '#94A3B8',
};

export const PROXIMITY_ZONES = {
  green: { label: '>2.0m', color: '#22C55E', min: 2.0, description: 'Clear' },
  yellow: {
    label: '0.6m–2.0m',
    color: '#EAB308',
    min: 0.6,
    description: 'Caution',
  },
  red: { label: '<0.6m', color: '#EF4444', min: 0, description: 'Danger' },
} as const;

export const CHASSIS_TYPES: Record<
  ChassisType,
  { label: string; width: number; length: number }
> = {
  class8_tractor: {
    label: 'Class 8 Semi-Tractor',
    width: 2.6,
    length: 6.7,
  },
  class7_box: { label: 'Class 7/8 Box Truck', width: 2.6, length: 9.1 },
  vocational_dump: {
    label: 'Vocational Dump Truck',
    width: 2.9,
    length: 8.5,
  },
  heavy_equipment: {
    label: 'Heavy Equipment / Excavator',
    width: 3.2,
    length: 7.5,
  },
};

export const VEHICLE_PROFILES: Record<
  VehicleProfileKey,
  {
    label: string;
    description: string;
    widthM: number;
    lengthM: number;
    silhouetteRatio: number;
    frontRangeM: number;
    sideRangeM: number;
    rearRangeM: number;
  }
> = {
  class8_tractor_trailer: {
    label: 'Class 8 Tractor-Trailer (Standard / Long Haul)',
    description: 'Full 53ft trailer rig with 77GHz forward/rear radar and side lane-change sensors',
    widthM: 2.6,
    lengthM: 19.8,
    silhouetteRatio: 0.45,
    frontRangeM: 5.0,
    sideRangeM: 4.0,
    rearRangeM: 5.0,
  },
  class7_day_cab: {
    label: 'Class 7 Tractor (Cab only / Day Cab)',
    description: 'Shorter day-cab tractor without sleeper, tighter turning radius',
    widthM: 2.5,
    lengthM: 7.0,
    silhouetteRatio: 0.6,
    frontRangeM: 4.5,
    sideRangeM: 3.5,
    rearRangeM: 4.0,
  },
  class6_straight_box: {
    label: 'Class 6/7 Straight Box Truck',
    description: 'Single-unit box truck with ultrasonic corner detection',
    widthM: 2.6,
    lengthM: 9.1,
    silhouetteRatio: 0.55,
    frontRangeM: 4.0,
    sideRangeM: 3.5,
    rearRangeM: 4.0,
  },
  fuel_tanker: {
    label: 'Fuel Tanker / Liquid Bulk Trailer',
    description: 'Cylindrical tank trailer with extended side blind-zone coverage',
    widthM: 2.7,
    lengthM: 16.0,
    silhouetteRatio: 0.42,
    frontRangeM: 5.0,
    sideRangeM: 4.5,
    rearRangeM: 5.0,
  },
  flatbed_specialty: {
    label: 'Flatbed / Specialty Commercial Truck',
    description: 'Open-bed flatbed with wide-load sensor perimeter',
    widthM: 2.9,
    lengthM: 12.0,
    silhouetteRatio: 0.5,
    frontRangeM: 5.0,
    sideRangeM: 4.0,
    rearRangeM: 4.5,
  },
  commercial_van: {
    label: 'Commercial Delivery Van',
    description: 'Single-unit delivery van with tight-zone ultrasonic coverage',
    widthM: 2.4,
    lengthM: 6.5,
    silhouetteRatio: 0.62,
    frontRangeM: 4.0,
    sideRangeM: 3.0,
    rearRangeM: 3.5,
  },
  class8_tractor_sleeper: {
    label: 'Class 8 Tractor w/ Sleeper Cab (No Trailer)',
    description: 'Standalone Class 8 tractor with sleeper cab, no trailer attached',
    widthM: 2.5,
    lengthM: 6.5,
    silhouetteRatio: 0.65,
    frontRangeM: 5.0,
    sideRangeM: 4.0,
    rearRangeM: 4.0,
  },
};

export const HARDWARE_PROFILES: Record<
  HardwareProfileKey,
  {
    label: string;
    description: string;
    sensors: string[];
    modality: '77ghz' | '40khz' | 'dual' | 'full';
    rangeM: number;
    directions: { forward: boolean; left: boolean; right: boolean; rear: boolean };
  }
> = {
  c55_pro_forward: {
    label: 'C55-PRO Forward L+R',
    description: '77GHz microwave radar: forward projection (10m) + left & right lateral bumper coverage (4m each)',
    sensors: ['front_radar', 'left_radar', 'right_radar'],
    modality: '77ghz',
    rangeM: 7.5,
    directions: { forward: true, left: true, right: true, rear: false },
  },
  c55_pro_forward_r: {
    label: 'C55-PRO Forward L+R',
    description: '77GHz microwave radar: forward projection (10m) + left & right lateral bumper coverage (4m each)',
    sensors: ['front_radar', 'right_radar'],
    modality: '77ghz',
    rangeM: 3.0,
    directions: { forward: true, left: false, right: true, rear: false },
  },
  c55_pro_forward_l: {
    label: 'C55-PRO Forward L+R',
    description: '77GHz microwave radar: forward projection (10m) + left & right lateral bumper coverage (4m each)',
    sensors: ['front_radar', 'left_radar'],
    modality: '77ghz',
    rangeM: 3.0,
    directions: { forward: true, left: true, right: false, rear: false },
  },
  c55_pro_forward_lr: {
    label: 'C55-PRO Forward L+R',
    description: '77GHz microwave radar: forward projection (10m) + left & right lateral bumper coverage (4m each)',
    sensors: ['front_radar', 'left_radar', 'right_radar'],
    modality: '77ghz',
    rangeM: 3.0,
    directions: { forward: true, left: true, right: true, rear: false },
  },
  c55_pro_forward_lr_rear: {
    label: 'C55-PRO Forward L+R',
    description: '77GHz microwave radar: forward projection (10m) + left & right lateral bumper coverage (4m each)',
    sensors: ['front_radar', 'left_radar', 'right_radar'],
    modality: '77ghz',
    rangeM: 3.0,
    directions: { forward: true, left: true, right: true, rear: false },
  },
  c93_us4_gap: {
    label: 'C93- "GAP" (4 Ultrasonic Fender Mount)',
    description: '4x 40kHz ultrasonic sensors for front corner gap detection',
    sensors: [
      'front_right_ultrasonic_1',
      'front_right_ultrasonic_2',
      'front_right_ultrasonic_3',
      'front_right_ultrasonic_4',
    ],
    modality: '40khz',
    rangeM: 1.5,
    directions: { forward: false, left: false, right: true, rear: false },
  },
  c93_us4_gap_lane: {
    label: 'C93-4LC (4 Ultrasonic Fender Mount + 2x 77GHz Side Lane Change)',
    description: '4x 40kHz ultrasonic gap sensors + 2x 77GHz side radar for lane-change protection',
    sensors: [
      'front_right_ultrasonic_1',
      'front_right_ultrasonic_2',
      'front_right_ultrasonic_3',
      'front_right_ultrasonic_4',
      'side_radar_left',
      'side_radar_right',
    ],
    modality: 'dual',
    rangeM: 2.0,
    directions: { forward: false, left: true, right: true, rear: false },
  },
};

export const PLAN_FEATURES: Record<
  PlanTier,
  { name: string; defaultPrice: number; features: string[] }
> = {
  basic: {
    name: 'Basic Plan',
    defaultPrice: 0.0,
    features: [
      'Unlimited vehicle/driver fleet',
      'Standard radar/ultrasonic proximity telemetry',
      'Core driver HUD controls',
      'Basic GPS map panel',
    ],
  },
  pro: {
    name: 'Pro Plan',
    defaultPrice: 9.95,
    features: [
      'Everything in Basic',
      'Live GPS Tracking',
      'Actuarial Safety Scoring',
      'Full Historical Telemetry Reporting',
      'PDF Export',
    ],
  },
  proplus: {
    name: 'Pro+ Plan',
    defaultPrice: 19.95,
    features: [
      'Everything in Pro',
      'Unlimited 360° Multi-Sensor Analytics',
      'Insurance Premium Risk Modeling',
      'Cryptographic Key-Code Telemetry Vault',
      'Automated Collision Reconstruction Diagrams',
      'Daily POST-Calibration Diagnostics',
    ],
  },
};

export const VEHICLE_MAKES: Record<
  string,
  { models: Record<string, { width: number; length: number }> }
> = {
  Toyota: {
    models: {
      Camry: { width: 1.83, length: 4.88 },
      Corolla: { width: 1.78, length: 4.64 },
      RAV4: { width: 1.86, length: 4.6 },
      Tacoma: { width: 1.85, length: 5.39 },
    },
  },
  Ford: {
    models: {
      'F-150': { width: 2.03, length: 5.89 },
      Escape: { width: 1.88, length: 4.58 },
      Explorer: { width: 2.0, length: 5.05 },
      Mustang: { width: 1.88, length: 4.79 },
    },
  },
  Chevrolet: {
    models: {
      Silverado: { width: 2.06, length: 5.87 },
      Equinox: { width: 1.84, length: 4.65 },
      Malibu: { width: 1.85, length: 4.9 },
      Tahoe: { width: 2.05, length: 5.35 },
    },
  },
  Honda: {
    models: {
      Civic: { width: 1.8, length: 4.65 },
      Accord: { width: 1.86, length: 4.91 },
      CRV: { width: 1.85, length: 4.6 },
      Pilot: { width: 1.99, length: 5.03 },
    },
  },
  Nissan: {
    models: {
      Altima: { width: 1.83, length: 4.88 },
      Rogue: { width: 1.84, length: 4.7 },
      'Frontier': { width: 1.85, length: 5.29 },
      Sentra: { width: 1.8, length: 4.64 },
    },
  },
  Jeep: {
    models: {
      Wrangler: { width: 1.9, length: 4.88 },
      GrandCherokee: { width: 1.99, length: 4.91 },
      Cherokee: { width: 1.87, length: 4.62 },
      Gladiator: { width: 1.91, length: 5.55 },
    },
  },
  Tesla: {
    models: {
      'Model 3': { width: 1.85, length: 4.69 },
      'Model Y': { width: 1.93, length: 4.75 },
      'Model S': { width: 1.96, length: 4.97 },
      'Model X': { width: 2.0, length: 5.04 },
    },
  },
  Ram: {
    models: {
      '1500': { width: 2.08, length: 5.88 },
      '2500': { width: 2.11, length: 6.05 },
      '3500': { width: 2.11, length: 6.1 },
      Promaster: { width: 2.47, length: 5.99 },
    },
  },
};

export const VEHICLE_YEARS: string[] = Array.from(
  { length: 20 },
  (_, i) => `${2025 - i}`,
);

export const IMPACT_ANGLES = [
  { key: 'inline_rear', label: 'Inline / Rear-End', icon: 'arrow-down' },
  { key: 'sideswipe', label: 'Side-swipe / Merge', icon: 'arrow-right' },
  { key: 'tbone', label: 'T-Bone / Angle', icon: 'arrow-up-right' },
] as const;

export const LANES = [
  { key: 'left', label: 'Left Lane' },
  { key: 'center', label: 'Center Lane' },
  { key: 'right', label: 'Right Lane' },
  { key: 'shoulder', label: 'Shoulder' },
] as const;

export const PHOTO_SLOTS = [
  { key: 'front_corner', label: 'Front Corner Angle', icon: 'car-front' },
  { key: 'rear_corner', label: 'Rear Corner Angle', icon: 'car-back' },
  { key: 'full_side', label: 'Full Side View', icon: 'car-side' },
  { key: 'damage_area', label: 'Other Car Damage Area', icon: 'car-crash' },
] as const;

export const DOCUMENT_PHOTO_SLOTS = [
  { key: 'other_license', label: "Other Driver's License", icon: 'id-card' },
  { key: 'other_insurance', label: 'Other Insurance Card', icon: 'file-text' },
  { key: 'scene_wide', label: 'Wide Scene Overview', icon: 'map' },
] as const;

export const TARGET_TYPES = [
  { key: 'passenger', label: 'Passenger Car / SUV' },
  { key: 'commercial', label: 'Commercial Truck' },
  { key: 'fixed_object', label: 'Fixed Object' },
] as const;

export const LEGAL_DISCLAIMER =
  'LEGAL DISCLAIMER: FleetVu is NOT, and shall NOT be considered, a replacement for a Certified Accident Reconstruction Expert. This report provides ONLY an initial preliminary overview of the incident for internal review and administrative evaluation.';

export const LEGAL_ACKNOWLEDGMENT_TEXT =
  'I hereby swear or verify under penalty of perjury upon submitting that FleetVu training has been completed, hardware baseline checks are verified, and all system operating parameters are understood.';

export const AUXILIARY_DISCLAIMER =
  'FleetVu telemetry is an auxiliary driver-awareness tool and does not replace driver visual monitoring, mirrors, DVIRs, or standard safety protocols.';

export const MOTION_LOCKOUT_THRESHOLD = 3;
export const DEFAULT_G_FORCE_TRIGGER = 1.5;

export const REGIONS = [
  'West Coast',
  'Midwest',
  'East Coast',
  'South',
] as const;

export const REGION_LOCATIONS: Record<string, string[]> = {
  'West Coast': ['Los Angeles, CA', 'San Francisco, CA', 'Seattle, WA', 'Portland, OR'],
  'Midwest': ['Chicago, IL', 'Detroit, MI', 'Minneapolis, MN', 'Kansas City, MO'],
  'East Coast': ['New York, NY', 'Boston, MA', 'Miami, FL', 'Atlanta, GA'],
  'South': ['Houston, TX', 'Dallas, TX', 'Phoenix, AZ', 'Denver, CO'],
};

export const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  'West Coast': { lat: 34.0522, lng: -118.2437 },
  'Midwest': { lat: 41.8781, lng: -87.6298 },
  'East Coast': { lat: 40.7128, lng: -74.006 },
  'South': { lat: 29.7604, lng: -95.3698 },
};

export const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Los Angeles, CA': { lat: 34.0522, lng: -118.2437 },
  'San Francisco, CA': { lat: 37.7749, lng: -122.4194 },
  'Seattle, WA': { lat: 47.6062, lng: -122.3321 },
  'Portland, OR': { lat: 45.5152, lng: -122.6784 },
  'Chicago, IL': { lat: 41.8781, lng: -87.6298 },
  'Detroit, MI': { lat: 42.3314, lng: -83.0458 },
  'Minneapolis, MN': { lat: 44.9778, lng: -93.265 },
  'Kansas City, MO': { lat: 39.0997, lng: -94.5786 },
  'New York, NY': { lat: 40.7128, lng: -74.006 },
  'Boston, MA': { lat: 42.3601, lng: -71.0589 },
  'Miami, FL': { lat: 25.7617, lng: -80.1918 },
  'Atlanta, GA': { lat: 33.749, lng: -84.388 },
  'Houston, TX': { lat: 29.7604, lng: -95.3698 },
  'Dallas, TX': { lat: 32.7767, lng: -96.797 },
  'Phoenix, AZ': { lat: 33.4484, lng: -112.074 },
  'Denver, CO': { lat: 39.7392, lng: -104.9903 },
};

export const LOCATION_TERMINALS: Record<string, string[]> = {
  'Los Angeles, CA': ['Los Angeles Terminal #1', 'San Diego Yard'],
  'San Francisco, CA': ['Oakland Bay Terminal', 'San Jose Yard'],
  'Seattle, WA': ['Port of Seattle Terminal', 'Tacoma Yard'],
  'Portland, OR': ['Portland Distribution Center', 'Beaverton Yard'],
  'Chicago, IL': ['Chicago Rail Terminal', 'Joliet Yard'],
  'Detroit, MI': ['Detroit Industrial Terminal', 'Ann Arbor Yard'],
  'Minneapolis, MN': ['Minneapolis Freight Terminal', 'St. Paul Yard'],
  'Kansas City, MO': ['Kansas City Crossroads Terminal', 'Independence Yard'],
  'New York, NY': ['Port Newark Terminal', 'Queens Distribution Yard'],
  'Boston, MA': ['Boston Harbor Terminal', 'Worcester Yard'],
  'Miami, FL': ['Port of Miami Terminal', 'Hialeah Yard'],
  'Atlanta, GA': ['Atlanta Logistics Terminal', 'Smyrna Yard'],
  'Houston, TX': ['Houston Port Terminal', 'Galveston Yard'],
  'Dallas, TX': ['Dallas Intermodal Terminal', 'Fort Worth Yard'],
  'Phoenix, AZ': ['Phoenix Desert Terminal', 'Tucson Yard'],
  'Denver, CO': ['Denver Mountain Terminal', 'Aurora Yard'],
};
