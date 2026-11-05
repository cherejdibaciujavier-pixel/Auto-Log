import type {
  AppData,
  DocumentType,
  FuelType,
  MaintenancePlan,
  ServiceCategory,
  Vehicle,
  VehicleDocument,
} from "../types";

export const BACKUP_FORMAT = "autolog-backup";
export const BACKUP_VERSION = 1;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return value;
}

function isoDate(value: unknown, label: string): string {
  const date = text(value, label);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} must be a real date in YYYY-MM-DD format.`);
  }
  return date;
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return text(value, label);
}

function parseVehicle(value: unknown, index: number): Vehicle {
  const v = record(value, `Vehicle ${index + 1}`);
  if (!["Petrol", "Diesel", "Hybrid", "Electric"].includes(String(v.fuelType))) {
    throw new Error(`Vehicle ${index + 1} has an unsupported fuel type.`);
  }
  return {
    id: text(v.id, `Vehicle ${index + 1} ID`),
    make: text(v.make, `Vehicle ${index + 1} make`),
    model: text(v.model, `Vehicle ${index + 1} model`),
    motorisation: optionalText(v.motorisation, `Vehicle ${index + 1} motorisation`),
    year: finite(v.year, `Vehicle ${index + 1} year`),
    fuelType: v.fuelType as FuelType,
    mileage: finite(v.mileage, `Vehicle ${index + 1} mileage`),
    plate: text(v.plate, `Vehicle ${index + 1} plate`),
    vin: text(v.vin, `Vehicle ${index + 1} VIN`),
    image: optionalText(v.image, `Vehicle ${index + 1} image URL`),
    imagePath: optionalText(v.imagePath, `Vehicle ${index + 1} image path`),
    createdAt: finite(v.createdAt, `Vehicle ${index + 1} created date`),
  };
}

function parseService(value: unknown, index: number) {
  const r = record(value, `Service record ${index + 1}`);
  return {
    id: text(r.id, `Service record ${index + 1} ID`),
    vehicleId: text(r.vehicleId, `Service record ${index + 1} vehicle ID`),
    date: isoDate(r.date, `Service record ${index + 1} date`),
    mileage: finite(r.mileage, `Service record ${index + 1} mileage`),
    category: text(r.category, `Service record ${index + 1} category`) as ServiceCategory,
    cost: finite(r.cost, `Service record ${index + 1} cost`),
    workshop: text(r.workshop, `Service record ${index + 1} workshop`),
    notes: text(r.notes, `Service record ${index + 1} notes`),
  };
}

function parseFuel(value: unknown, index: number) {
  const r = record(value, `Fuel record ${index + 1}`);
  return {
    id: text(r.id, `Fuel record ${index + 1} ID`),
    vehicleId: text(r.vehicleId, `Fuel record ${index + 1} vehicle ID`),
    date: isoDate(r.date, `Fuel record ${index + 1} date`),
    volume: finite(r.volume, `Fuel record ${index + 1} volume`),
    pricePerUnit: finite(r.pricePerUnit, `Fuel record ${index + 1} price`),
    totalCost: finite(r.totalCost, `Fuel record ${index + 1} total`),
    odometer: finite(r.odometer, `Fuel record ${index + 1} odometer`),
    fullTank: r.fullTank === true,
  };
}

function parseDocument(value: unknown, index: number): VehicleDocument {
  const d = record(value, `Document ${index + 1}`);
  if (!["inspection", "insurance", "roadtax"].includes(String(d.type))) {
    throw new Error(`Document ${index + 1} has an unsupported type.`);
  }
  return {
    id: text(d.id, `Document ${index + 1} ID`),
    vehicleId: text(d.vehicleId, `Document ${index + 1} vehicle ID`),
    type: d.type as DocumentType,
    provider: text(d.provider, `Document ${index + 1} provider`),
    expiryDate: isoDate(d.expiryDate, `Document ${index + 1} expiry date`),
    cost: finite(d.cost, `Document ${index + 1} cost`),
    reference: text(d.reference, `Document ${index + 1} reference`),
    notes: text(d.notes, `Document ${index + 1} notes`),
  };
}

function parsePlan(value: unknown, index: number): MaintenancePlan {
  const p = record(value, `Maintenance plan ${index + 1}`);
  const intervalKm = p.intervalKm === null ? null : finite(p.intervalKm, `Maintenance plan ${index + 1} distance interval`);
  const intervalDays = p.intervalDays === null ? null : finite(p.intervalDays, `Maintenance plan ${index + 1} time interval`);
  if (intervalKm === null && intervalDays === null) {
    throw new Error(`Maintenance plan ${index + 1} needs a distance or time interval.`);
  }
  if ((intervalKm !== null && intervalKm <= 0) || (intervalDays !== null && intervalDays <= 0)) {
    throw new Error(`Maintenance plan ${index + 1} intervals must be greater than zero.`);
  }
  return {
    id: text(p.id, `Maintenance plan ${index + 1} ID`),
    vehicleId: text(p.vehicleId, `Maintenance plan ${index + 1} vehicle ID`),
    title: text(p.title, `Maintenance plan ${index + 1} title`),
    intervalKm,
    intervalDays,
    lastCompletedDate: isoDate(p.lastCompletedDate, `Maintenance plan ${index + 1} last completed date`),
    lastCompletedMileage: finite(p.lastCompletedMileage, `Maintenance plan ${index + 1} last completed mileage`),
  };
}

/** Validate both current versioned exports and legacy raw AppData JSON. */
export function parseBackupJson(source: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  const root = record(parsed, "Backup");
  let dataValue: unknown = parsed;
  if ("format" in root) {
    if (root.format !== BACKUP_FORMAT) throw new Error("This file is not an AutoLog backup.");
    if (typeof root.version !== "number" || root.version > BACKUP_VERSION || root.version < 1) {
      throw new Error("This AutoLog backup version is not supported.");
    }
    dataValue = root.data;
  }

  const sourceData = record(dataValue, "Backup data");
  for (const key of ["vehicles", "services", "fuel", "documents"] as const) {
    if (!Array.isArray(sourceData[key])) throw new Error(`Backup is missing its ${key} list.`);
  }
  const defaults: AppData["settings"] = {
    currency: "EUR",
    unit: "km",
    serviceIntervalKm: 15000,
    serviceIntervalDays: 365,
    fuelStationPromptEnabled: false,
  };
  const vehicles = (sourceData.vehicles as unknown[]).map(parseVehicle);
  const services = (sourceData.services as unknown[]).map(parseService);
  const fuel = (sourceData.fuel as unknown[]).map(parseFuel);
  const documents = (sourceData.documents as unknown[]).map(parseDocument);
  if (sourceData.maintenancePlans !== undefined && !Array.isArray(sourceData.maintenancePlans)) {
    throw new Error("Backup maintenance plans must be a list.");
  }
  const maintenancePlans = Array.isArray(sourceData.maintenancePlans)
    ? sourceData.maintenancePlans.map(parsePlan)
    : [];
  const validVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  const references = [
    ...services.map((item) => item.vehicleId),
    ...fuel.map((item) => item.vehicleId),
    ...documents.map((item) => item.vehicleId),
    ...maintenancePlans.map((item) => item.vehicleId),
  ];
  if (references.some((id) => !validVehicleIds.has(id))) {
    throw new Error("Backup contains a record linked to a missing vehicle.");
  }

  const rawSettings = sourceData.settings === undefined
    ? defaults
    : record(sourceData.settings, "Backup settings");
  const currency = rawSettings.currency ?? defaults.currency;
  const unit = rawSettings.unit ?? defaults.unit;
  if (!["EUR", "USD", "GBP"].includes(String(currency))) throw new Error("Backup currency is not supported.");
  if (!["km", "mi"].includes(String(unit))) throw new Error("Backup distance unit is not supported.");
  const fuelStationPromptEnabled = rawSettings.fuelStationPromptEnabled ?? defaults.fuelStationPromptEnabled;
  if (typeof fuelStationPromptEnabled !== "boolean") {
    throw new Error("Fuel-station notification setting must be a boolean.");
  }
  const settings = {
    currency: currency as AppData["settings"]["currency"],
    unit: unit as AppData["settings"]["unit"],
    serviceIntervalKm: finite(rawSettings.serviceIntervalKm ?? defaults.serviceIntervalKm, "Service interval"),
    serviceIntervalDays: finite(rawSettings.serviceIntervalDays ?? defaults.serviceIntervalDays, "Service interval days"),
    fuelStationPromptEnabled,
  };
  if (settings.serviceIntervalKm <= 0 || settings.serviceIntervalDays <= 0) {
    throw new Error("Service intervals in the backup must be greater than zero.");
  }
  const requestedActiveId = sourceData.activeVehicleId;

  return {
    vehicles,
    services,
    fuel,
    documents,
    maintenancePlans,
    settings,
    activeVehicleId: typeof requestedActiveId === "string" && validVehicleIds.has(requestedActiveId)
      ? requestedActiveId
      : vehicles[0]?.id ?? null,
  };
}
