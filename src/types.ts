/* ------------------------------------------------------------------ */
/*  AutoLog — shared domain types                                      */
/*  All monetary values are stored raw; formatting happens in utils.   */
/*  All distances are stored in kilometres, volumes in litres          */
/*  (kWh for EVs) — unit conversion happens only at display time.      */
/* ------------------------------------------------------------------ */

export type FuelType = "Petrol" | "Diesel" | "Hybrid" | "Electric";
export type DistanceUnit = "km" | "mi";
export type CurrencyCode = "EUR" | "USD" | "GBP";

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  /** Owner-confirmed engine / drivetrain variant. Optional for older saved vehicles. */
  motorisation?: string;
  year: number;
  fuelType: FuelType;
  /** Current odometer reading, always stored in km. */
  mileage: number;
  plate: string;
  vin: string;
  /** Optional externally hosted image URL. */
  image?: string;
  /** Private Supabase Storage object path for an uploaded vehicle photo. */
  imagePath?: string;
  createdAt: number;
}

export type ServiceCategory =
  | "Oil & Filters"
  | "Brake Pads/Discs"
  | "Timing Belt"
  | "Battery"
  | "Tyres"
  | "Suspension"
  | "General Inspection"
  | "Other";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "Oil & Filters",
  "Brake Pads/Discs",
  "Timing Belt",
  "Battery",
  "Tyres",
  "Suspension",
  "General Inspection",
  "Other",
];

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  /** ISO date: yyyy-mm-dd */
  date: string;
  /** Odometer at service, km. */
  mileage: number;
  category: ServiceCategory;
  cost: number;
  workshop: string;
  notes: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  date: string;
  /** Litres (or kWh for electric vehicles). */
  volume: number;
  /** Price per litre / kWh. */
  pricePerUnit: number;
  totalCost: number;
  /** Odometer at fill-up, km. */
  odometer: number;
  fullTank: boolean;
}

export type DocumentType = "inspection" | "insurance" | "roadtax";

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  type: DocumentType;
  /** Insurer / authority name. */
  provider: string;
  expiryDate: string;
  /** Last amount paid — counted under "Insurance & Taxes" spend. */
  cost: number;
  reference: string;
  notes: string;
}

export interface MaintenancePlan {
  id: string;
  vehicleId: string;
  title: string;
  /** Recurrence interval in canonical kilometres; null disables distance tracking. */
  intervalKm: number | null;
  /** Recurrence interval in days; null disables date tracking. */
  intervalDays: number | null;
  lastCompletedDate: string;
  /** Odometer in canonical kilometres at last completion. */
  lastCompletedMileage: number;
}

export const DOCUMENT_META: Record<
  DocumentType,
  { label: string; short: string; hint: string }
> = {
  inspection: {
    label: "Technical Inspection",
    short: "MOT / ITV / TÜV",
    hint: "Mandatory roadworthiness test",
  },
  insurance: {
    label: "Insurance Policy",
    short: "RCA / CASCO",
    hint: "Third-party & comprehensive cover",
  },
  roadtax: {
    label: "Road Tax",
    short: "VED / Vignette",
    hint: "Annual vehicle excise duty",
  },
};

export interface Settings {
  currency: CurrencyCode;
  unit: DistanceUnit;
  /** Next-service interval in km (default 15 000). */
  serviceIntervalKm: number;
  /** Next-service interval in days (default 365). */
  serviceIntervalDays: number;
}

export interface AppData {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  fuel: FuelRecord[];
  documents: VehicleDocument[];
  maintenancePlans: MaintenancePlan[];
  settings: Settings;
  activeVehicleId: string | null;
}

/** Health states shared by service predictor + document tracker. */
export type HealthState = "ok" | "soon" | "overdue" | "none";

export interface ServiceStatus {
  state: HealthState;
  /** Anchor record the prediction is based on (last service). */
  lastService: ServiceRecord | null;
  nextMileage: number;
  nextDate: string;
  kmRemaining: number;
  daysRemaining: number;
  /** 0–100: how much of the interval (distance / time) is consumed. */
  kmProgress: number;
  daysProgress: number;
}

export interface DocumentStatus {
  state: HealthState;
  daysRemaining: number;
}

export interface FuelStats {
  fillUps: number;
  totalVolume: number;
  totalCost: number;
  totalDistance: number;
  /** Litres (kWh) per 100 km — null until 2+ logs exist. */
  avgConsumption: number | null;
  /** Cost per single km driven. */
  costPerKm: number | null;
  avgPricePerUnit: number | null;
  /** Consumption for each log index > 0, keyed by record id. */
  perRecord: Map<string, number>;
}
