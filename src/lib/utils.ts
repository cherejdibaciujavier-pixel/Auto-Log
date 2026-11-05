/* ------------------------------------------------------------------ */
/*  AutoLog — formatting, unit conversion & business calculations      */
/* ------------------------------------------------------------------ */

import type {
  AppData,
  CurrencyCode,
  DocumentStatus,
  FuelRecord,
  FuelStats,
  ServiceRecord,
  ServiceStatus,
  Settings,
  Vehicle,
  VehicleDocument,
} from "../types";

/* ------------------------------ ids & dates ------------------------------ */

export const uid = (): string =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

/** Parse yyyy-mm-dd safely in local time (avoids UTC off-by-one). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = (): string => toISO(new Date());

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISO(d);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Whole days from today until the given date (negative = past). */
export function daysUntil(iso: string): number {
  const a = parseISO(todayISO()).getTime();
  const b = parseISO(iso).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseISO(iso));
}

/** "in 24 days" / "today" / "3 days overdue" */
export function fmtCountdown(days: number): string {
  if (days === 0) return "Expires today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "Expired yesterday";
  return `${Math.abs(days)} days overdue`;
}

/* ------------------------------ numbers ------------------------------ */

export function fmtCurrency(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

/**
 * Pump prices are quoted to three decimals (€1.879/L) even though totals use
 * two — rounding them would misstate the price the driver actually paid.
 */
export function fmtUnitPrice(value: number, currency: CurrencyCode): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value);
  } catch {
    return `${value.toFixed(3)} ${currency}`;
  }
}

export function fmtNum(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/* --------------------------- unit conversion --------------------------- */

const KM_TO_MI = 0.621371;
const L_TO_GAL = 0.264172;

/** Stored km → display value in the user's unit. */
export const kmToUnit = (km: number, s: Settings): number =>
  s.unit === "mi" ? km * KM_TO_MI : km;

/** Display value → stored km. */
export const unitToKm = (v: number, s: Settings): number =>
  s.unit === "mi" ? v / KM_TO_MI : v;

export const volumeToUnit = (litres: number, s: Settings, isEV: boolean): number =>
  !isEV && s.unit === "mi" ? litres * L_TO_GAL : litres;

export const unitToVolume = (v: number, s: Settings, isEV: boolean): number =>
  !isEV && s.unit === "mi" ? v / L_TO_GAL : v;

export const distanceUnitLabel = (s: Settings): string => s.unit;

export const volumeUnitLabel = (s: Settings, isEV: boolean): string =>
  isEV ? "kWh" : s.unit === "mi" ? "gal" : "L";

/** e.g. "78,400 km" */
export function fmtDistance(km: number, s: Settings): string {
  return `${fmtNum(kmToUnit(km, s))} ${s.unit}`;
}

/**
 * Human consumption string.
 * Metric: "7.4 L/100 km" (or kWh/100 km for EVs).
 * Imperial: "31.8 MPG".
 */
export function fmtConsumption(lPer100km: number, s: Settings, isEV: boolean): string {
  if (s.unit === "mi" && !isEV) {
    const mpg = 235.214 / lPer100km; // US MPG conversion constant
    return `${fmtNum(mpg, 1)} MPG`;
  }
  return `${fmtNum(lPer100km, 1)} ${isEV ? "kWh" : "L"}/100 ${s.unit}`;
}

/** e.g. "€0.14/km" */
export function fmtCostPerDistance(costPerKm: number, s: Settings): string {
  const perUnit = s.unit === "mi" ? costPerKm / KM_TO_MI : costPerKm;
  return `${fmtCurrency(perUnit, s.currency)}/${s.unit}`;
}

/* --------------------------- service predictor --------------------------- */

/**
 * Dynamic Next-Service Predictor.
 * Anchors on the most recent service record and projects forward by the
 * configured interval (+15 000 km / +365 days by default). A vehicle is:
 *  - overdue  → interval exceeded by distance OR date
 *  - soon     → within 1 500 km OR 30 days of the limit
 *  - ok       → comfortably inside the interval
 */
export function getServiceStatus(
  vehicle: Vehicle,
  services: ServiceRecord[],
  settings: Settings,
): ServiceStatus {
  const mine = services
    .filter((r) => r.vehicleId === vehicle.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.mileage - a.mileage);

  const last = mine[0] ?? null;
  if (!last) {
    return {
      state: "none",
      lastService: null,
      nextMileage: 0,
      nextDate: "",
      kmRemaining: 0,
      daysRemaining: 0,
      kmProgress: 0,
      daysProgress: 0,
    };
  }

  const nextMileage = last.mileage + settings.serviceIntervalKm;
  const nextDate = addDaysISO(last.date, settings.serviceIntervalDays);
  const kmRemaining = nextMileage - vehicle.mileage;
  const daysRemaining = daysUntil(nextDate);

  const kmUsed = vehicle.mileage - last.mileage;
  const totalDays = settings.serviceIntervalDays;
  const daysUsed = totalDays - daysRemaining;

  const overdue = kmRemaining <= 0 || daysRemaining < 0;
  const soon = !overdue && (kmRemaining <= 1500 || daysRemaining <= 30);

  return {
    state: overdue ? "overdue" : soon ? "soon" : "ok",
    lastService: last,
    nextMileage,
    nextDate,
    kmRemaining,
    daysRemaining,
    kmProgress: Math.min(100, Math.max(0, (kmUsed / settings.serviceIntervalKm) * 100)),
    daysProgress: Math.min(100, Math.max(0, (daysUsed / totalDays) * 100)),
  };
}

/* ------------------------------ documents ------------------------------ */

export function getDocumentStatus(
  doc: VehicleDocument,
  warningDays = 30,
): DocumentStatus {
  const days = daysUntil(doc.expiryDate);
  return {
    daysRemaining: days,
    state: days < 0 ? "overdue" : days <= warningDays ? "soon" : "ok",
  };
}

/* ------------------------------- fuel stats ------------------------------- */

/**
 * Fuel / charging statistics from odometer deltas.
 * Consumption uses every log after the first (the first log only sets the
 * baseline odometer), the standard full-to-full approximation.
 */
export function computeFuelStats(records: FuelRecord[]): FuelStats {
  const sorted = [...records].sort((a, b) => a.odometer - b.odometer);
  const perRecord = new Map<string, number>();

  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].odometer - sorted[i - 1].odometer;
    if (delta > 0) perRecord.set(sorted[i].id, (sorted[i].volume / delta) * 100);
  }

  if (sorted.length < 2) {
    return {
      fillUps: sorted.length,
      totalVolume: sorted.reduce((t, r) => t + r.volume, 0),
      totalCost: sorted.reduce((t, r) => t + r.totalCost, 0),
      totalDistance: 0,
      avgConsumption: null,
      costPerKm: null,
      avgPricePerUnit:
        sorted.length > 0
          ? sorted.reduce((t, r) => t + r.totalCost, 0) /
            Math.max(1, sorted.reduce((t, r) => t + r.volume, 0))
          : null,
      perRecord,
    };
  }

  const distance = sorted[sorted.length - 1].odometer - sorted[0].odometer;
  const used = sorted.slice(1);
  const volumeUsed = used.reduce((t, r) => t + r.volume, 0);
  const costUsed = used.reduce((t, r) => t + r.totalCost, 0);

  return {
    fillUps: sorted.length,
    totalVolume: sorted.reduce((t, r) => t + r.volume, 0),
    totalCost: sorted.reduce((t, r) => t + r.totalCost, 0),
    totalDistance: distance,
    avgConsumption: distance > 0 ? (volumeUsed / distance) * 100 : null,
    costPerKm: distance > 0 ? costUsed / distance : null,
    avgPricePerUnit:
      volumeUsed > 0 ? costUsed / volumeUsed : null,
    perRecord,
  };
}

/* ----------------------------- expense totals ----------------------------- */

export interface ExpenseSummary {
  fuel: number;
  maintenance: number;
  documents: number;
  allTime: number;
  thisMonth: number;
  /** Distance covered across fuel logs (fallback: service span). */
  totalDistance: number;
  costPerKm: number | null;
}

export function computeExpenses(
  vehicleId: string,
  data: Pick<AppData, "services" | "fuel" | "documents">,
): ExpenseSummary {
  const services = data.services.filter((r) => r.vehicleId === vehicleId);
  const fuelRecs = data.fuel.filter((r) => r.vehicleId === vehicleId);
  const docs = data.documents.filter((r) => r.vehicleId === vehicleId);

  const fuel = fuelRecs.reduce((t, r) => t + r.totalCost, 0);
  const maintenance = services.reduce((t, r) => t + r.cost, 0);
  const documents = docs.reduce((t, r) => t + r.cost, 0);

  const monthPrefix = todayISO().slice(0, 7);
  const inMonth = (iso: string) => iso.startsWith(monthPrefix);
  const thisMonth =
    services.filter((r) => inMonth(r.date)).reduce((t, r) => t + r.cost, 0) +
    fuelRecs.filter((r) => inMonth(r.date)).reduce((t, r) => t + r.totalCost, 0) +
    docs.filter((r) => inMonth(r.expiryDate)).reduce((t, r) => t + r.cost, 0);

  // Distance: prefer the fuel-log odometer span, fall back to services.
  const fuelStats = computeFuelStats(fuelRecs);
  let totalDistance = fuelStats.totalDistance;
  if (totalDistance === 0 && services.length >= 2) {
    const miles = services.map((r) => r.mileage);
    totalDistance = Math.max(...miles) - Math.min(...miles);
  }

  const allTime = fuel + maintenance + documents;
  return {
    fuel,
    maintenance,
    documents,
    allTime,
    thisMonth,
    totalDistance,
    costPerKm: totalDistance > 0 ? allTime / totalDistance : fuelStats.costPerKm,
  };
}

/** Buckets for the last N months, split by expense category. */
export function monthlySeries(
  vehicleId: string,
  data: Pick<AppData, "services" | "fuel" | "documents">,
  months = 6,
): { labels: string[]; fuel: number[]; maintenance: number[]; documents: number[] } {
  const labels: string[] = [];
  const keys: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(toISO(d).slice(0, 7));
    labels.push(
      new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d),
    );
  }
  const bucket = () => keys.map(() => 0);
  const fuel = bucket();
  const maintenance = bucket();
  const documents = bucket();
  const add = (arr: number[], iso: string, amount: number) => {
    const idx = keys.indexOf(iso.slice(0, 7));
    if (idx >= 0) arr[idx] += amount;
  };
  data.fuel
    .filter((r) => r.vehicleId === vehicleId)
    .forEach((r) => add(fuel, r.date, r.totalCost));
  data.services
    .filter((r) => r.vehicleId === vehicleId)
    .forEach((r) => add(maintenance, r.date, r.cost));
  data.documents
    .filter((r) => r.vehicleId === vehicleId)
    .forEach((r) => add(documents, r.expiryDate, r.cost));
  return { labels, fuel, maintenance, documents };
}

/* ------------------------------- alerts ------------------------------- */

export interface AlertItem {
  id: string;
  kind: "service" | "document";
  state: "soon" | "overdue";
  title: string;
  detail: string;
  docType?: VehicleDocument["type"];
}

/** Central alert engine: service predictor + expiring documents. */
export function computeAlerts(
  vehicle: Vehicle,
  data: Pick<AppData, "services" | "documents">,
  settings: Settings,
  documentWarningDays = 30,
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const svc = getServiceStatus(vehicle, data.services, settings);
  if (svc.state === "soon" || svc.state === "overdue") {
    // Describe whichever limit (distance vs. time) is the binding one.
    let detail: string;
    if (svc.state === "overdue") {
      detail =
        svc.kmRemaining <= 0
          ? `Overdue by ${fmtNum(kmToUnit(Math.abs(svc.kmRemaining), settings))} ${settings.unit}`
          : fmtCountdown(svc.daysRemaining);
    } else {
      detail =
        svc.kmRemaining <= 1500
          ? `${fmtNum(kmToUnit(Math.max(0, svc.kmRemaining), settings))} ${settings.unit} of interval left`
          : fmtCountdown(svc.daysRemaining);
    }
    alerts.push({
      id: "alert-service",
      kind: "service",
      state: svc.state,
      title: svc.state === "overdue" ? "Service overdue" : "Service due soon",
      detail,
    });
  }
  data.documents
    .filter((d) => d.vehicleId === vehicle.id)
    .forEach((doc) => {
      const st = getDocumentStatus(doc, documentWarningDays);
      if (st.state === "soon" || st.state === "overdue") {
        alerts.push({
          id: `alert-doc-${doc.id}`,
          kind: "document",
          state: st.state,
          title: `${doc.type === "insurance" ? "Insurance" : doc.type === "inspection" ? "Inspection" : "Road tax"} ${
            st.state === "overdue" ? "expired" : "expiring"
          }`,
          detail: fmtCountdown(st.daysRemaining),
          docType: doc.type,
        });
      }
    });
  // Overdue first, then by urgency.
  return alerts.sort((a, b) =>
    a.state === b.state ? 0 : a.state === "overdue" ? -1 : 1,
  );
}

/* ------------------------------ misc helpers ----------------------------- */

/** Latest odometer evidence across fuel + service logs. */
export function latestKnownMileage(
  vehicleId: string,
  data: Pick<AppData, "services" | "fuel">,
): number {
  const fromFuel = data.fuel
    .filter((r) => r.vehicleId === vehicleId)
    .reduce((m, r) => Math.max(m, r.odometer), 0);
  const fromSvc = data.services
    .filter((r) => r.vehicleId === vehicleId)
    .reduce((m, r) => Math.max(m, r.mileage), 0);
  return Math.max(fromFuel, fromSvc);
}

/** e.g. "Honda Civic Type R" */
export const vehicleName = (v: Vehicle): string => `${v.make} ${v.model}`;
