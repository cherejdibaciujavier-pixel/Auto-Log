export type StationKind = "fuel" | "charging";
export type FuelGrade = "diesel" | "petrol95" | "petrol98" | "petrol91" | "e10" | "e85" | "dieselPremium" | "lpg";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface PriceQuote {
  amount: number;
  currency: string;
  /** The individual quote's update time, if supplied by its source. */
  updatedAt?: string;
}

export interface Station {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  distanceKm: number;
  hours?: string;
  prices: Partial<Record<FuelGrade, PriceQuote>>;
  sourceId?: string;
}

export interface PriceSource {
  id: string;
  attribution: string;
  url: string;
  /** Source-wide snapshot time; this is not an individual pump update. */
  reportedAt?: string;
}

export interface StationSearchResult {
  stations: Station[];
  priceSources: PriceSource[];
  locationSource: "overpass" | "photon" | "unavailable";
  priceCoverage: "available" | "partial" | "none" | "error" | "not-applicable";
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: string;
    osm_id: number;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    extra?: Record<string, string>;
  };
}

interface FuelWideStation {
  id: string | number;
  name?: string | null;
  brand?: string | null;
  address?: string | null;
  town?: string | null;
  postcode?: string | null;
  hours?: string | null;
  lat: number;
  lon: number;
  prices?: Partial<Record<FuelGrade, number | null>>;
}

interface FuelWideResponse {
  stations: FuelWideStation[];
  currency: string;
  unit: string;
  reportedAt?: string;
  updatedAt?: string;
  attribution: string;
  source?: { url?: string };
}

type FrenchRecord = Record<string, unknown> & {
  id: number | string;
  latitude?: string;
  longitude?: string;
  geom?: Coordinates;
  adresse?: string;
  ville?: string;
  cp?: string;
};

interface PriceFeedResult {
  stations: Station[];
  source: PriceSource;
}

const FRANCE_DATASET = "https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/";
const FRANCE_API = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records";

export const FUEL_GRADES: { value: FuelGrade; label: string }[] = [
  { value: "petrol95", label: "Petrol 95" },
  { value: "diesel", label: "Diesel" },
  { value: "e10", label: "Petrol E10" },
  { value: "petrol98", label: "Petrol 98" },
  { value: "petrol91", label: "Petrol 91" },
  { value: "dieselPremium", label: "Premium diesel" },
  { value: "lpg", label: "LPG" },
  { value: "e85", label: "E85" },
];

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Straight-line distance; it is not a driving route. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatStationPrice(quote: PriceQuote): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: quote.currency,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(quote.amount);
  } catch {
    return `${quote.currency} ${quote.amount.toFixed(3)}`;
  }
}

export function formatPriceTime(value?: string): string | null {
  if (!value) return null;
  // The Spanish feed publishes DD/MM/YYYY rather than ISO timestamps.
  const spanish = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2})(?::\d{2})?)?$/.exec(value);
  if (spanish) return `${spanish[1]}/${spanish[2]}/${spanish[3]}${spanish[4] ? ` ${spanish[4]}` : ""}`;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    ...(value.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(parsed);
}

export function isPriceOutdated(value?: string): boolean {
  if (!value) return false;
  const spanish = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  const timestamp = spanish
    ? new Date(Number(spanish[3]), Number(spanish[2]) - 1, Number(spanish[1]), Number(spanish[4] || 0), Number(spanish[5] || 0), Number(spanish[6] || 0)).getTime()
    : Date.parse(value);
  return Number.isFinite(timestamp) && Date.now() - timestamp > 7 * 86400000;
}

async function fetchJson<T>(url: string, signal: AbortSignal, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = window.setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

let nextPhotonRequest = 0;

// Keep requests to the public geocoding service modest and user initiated.
async function photonJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, nextPhotonRequest - now);
  nextPhotonRequest = Math.max(now, nextPhotonRequest) + 1100;
  if (wait) await new Promise<void>((resolve) => window.setTimeout(resolve, wait));
  if (signal.aborted) throw new DOMException("Search cancelled", "AbortError");
  return fetchJson<T>(url, signal, 9000);
}

export async function searchLocation(query: string, signal: AbortSignal): Promise<{ point: Coordinates; label: string } | null> {
  const url = new URL("https://photon.komoot.io/api/");
  url.search = new URLSearchParams({ q: query, limit: "1" }).toString();
  const results = await photonJson<{ features: PhotonFeature[] }>(url.toString(), signal);
  const result = results.features?.[0];
  if (!result) return null;
  const [lon, lat] = result.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const place = result.properties;
  const address = [place.housenumber, place.street].filter(Boolean).join(" ");
  const parts = [place.name, address, place.city, place.state, place.country].filter((part): part is string => Boolean(part));
  const label = parts.filter((part, index) => parts.indexOf(part) === index).join(", ");
  return { point: { lat, lon }, label: label || query };
}

function stationAddress(tags: Record<string, string>): string {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const town = [tags["addr:postcode"], tags["addr:city"] || tags["addr:town"]].filter(Boolean).join(" ");
  return [street, town].filter(Boolean).join(", ");
}

async function queryOverpass(center: Coordinates, radiusKm: number, kind: StationKind, signal: AbortSignal): Promise<Station[]> {
  const amenity = kind === "fuel" ? "fuel" : "charging_station";
  const query = `[out:json][timeout:8];nwr["amenity"="${amenity}"](around:${radiusKm * 1000},${center.lat},${center.lon});out center;`;
  const url = new URL("https://overpass-api.de/api/interpreter");
  url.search = new URLSearchParams({ data: query }).toString();
  const data = await fetchJson<{ elements: OverpassElement[] }>(url.toString(), signal, 6500);
  if (!Array.isArray(data.elements)) throw new Error("Invalid station response");
  return data.elements.flatMap((element) => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const tags = element.tags ?? {};
    return [{
      id: `osm-${element.type}-${element.id}`,
      name: tags.name || tags.brand || tags.operator || (kind === "fuel" ? "Fuel station" : "Charging station"),
      address: stationAddress(tags),
      lat, lon,
      distanceKm: distanceKm(center, { lat, lon }),
      hours: tags.opening_hours,
      prices: {},
    }];
  });
}

async function queryPhotonStations(center: Coordinates, radiusKm: number, kind: StationKind, signal: AbortSignal): Promise<Station[]> {
  const url = new URL("https://photon.komoot.io/reverse");
  url.search = new URLSearchParams({
    lat: String(center.lat), lon: String(center.lon), radius: String(radiusKm),
    osm_tag: `amenity:${kind === "fuel" ? "fuel" : "charging_station"}`,
    limit: "80", dedupe: "0",
  }).toString();
  const data = await photonJson<{ features: PhotonFeature[] }>(url.toString(), signal);
  if (!Array.isArray(data.features)) throw new Error("Invalid station response");
  return data.features.flatMap((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const distance = distanceKm(center, { lat, lon });
    if (distance > radiusKm) return [];
    const place = feature.properties;
    const street = [place.housenumber, place.street].filter(Boolean).join(" ");
    const town = place.city || place.district;
    return [{
      id: `osm-${place.osm_type}-${place.osm_id}`,
      name: place.name || place.extra?.brand || (kind === "fuel" ? "Fuel station" : "Charging station"),
      address: [street, place.postcode, town].filter(Boolean).join(", "),
      lat, lon, distanceKm: distance,
      hours: place.extra?.opening_hours,
      prices: {},
    }];
  });
}

async function searchOpenStreetMap(center: Coordinates, radiusKm: number, kind: StationKind, signal: AbortSignal): Promise<{ stations: Station[]; source: "overpass" | "photon" }> {
  try {
    return { stations: await queryPhotonStations(center, radiusKm, kind, signal), source: "photon" };
  } catch {
    if (signal.aborted) throw new DOMException("Search cancelled", "AbortError");
    return { stations: await queryOverpass(center, radiusKm, kind, signal), source: "overpass" };
  }
}

function validPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function frenchPrices(center: Coordinates, radiusKm: number, signal: AbortSignal): Promise<PriceFeedResult> {
  const point = `geom'POINT(${center.lon} ${center.lat})'`;
  const fields = ["gazole", "sp95", "sp98", "e10", "e85", "gplc"];
  const select = ["id", "latitude", "longitude", "geom", "adresse", "ville", "cp",
    ...fields.flatMap((field) => [`${field}_prix`, `${field}_maj`, `${field}_rupture_type`]),
    `distance(geom, ${point}) as dist`].join(",");
  const url = new URL(FRANCE_API);
  url.search = new URLSearchParams({
    select,
    where: `within_distance(geom, ${point}, ${radiusKm}km)`,
    order_by: "dist asc",
    limit: "100",
  }).toString();
  const data = await fetchJson<{ results: FrenchRecord[] }>(url.toString(), signal);
  if (!Array.isArray(data.results)) throw new Error("Invalid price response");
  const source: PriceSource = {
    id: "france",
    attribution: "Station prices: prix-carburants.gouv.fr, Licence Ouverte",
    url: FRANCE_DATASET,
  };
  const keys: [string, FuelGrade][] = [["gazole", "diesel"], ["sp95", "petrol95"], ["sp98", "petrol98"], ["e10", "e10"], ["e85", "e85"], ["gplc", "lpg"]];
  const stations = data.results.flatMap((record) => {
    const lat = record.geom?.lat ?? Number(record.latitude) / 100000;
    const lon = record.geom?.lon ?? Number(record.longitude) / 100000;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const prices: Station["prices"] = {};
    keys.forEach(([field, grade]) => {
      const amount = record[`${field}_prix`];
      // A temporarily or permanently unavailable fuel is not a valid quote.
      if (validPrice(amount) && !record[`${field}_rupture_type`]) {
        const updated = record[`${field}_maj`];
        prices[grade] = { amount, currency: "EUR", updatedAt: typeof updated === "string" ? updated : undefined };
      }
    });
    return [{
      id: `france-${record.id}`, name: "Fuel station",
      address: [record.adresse, record.cp, record.ville].filter(Boolean).join(", "),
      lat, lon, distanceKm: distanceKm(center, { lat, lon }), prices, sourceId: source.id,
    }];
  });
  return { stations, source };
}

async function fuelWidePrices(country: "spain" | "italy" | "australia", center: Coordinates, radiusKm: number, signal: AbortSignal): Promise<PriceFeedResult> {
  const url = new URL(`https://fuelwide.com/api/stations/${country}`);
  url.search = new URLSearchParams({ near: `${center.lat},${center.lon}`, km: String(radiusKm), limit: "100" }).toString();
  const data = await fetchJson<FuelWideResponse>(url.toString(), signal);
  if (!Array.isArray(data.stations) || !data.currency || !data.unit?.toLowerCase().includes("litre")) {
    throw new Error("Invalid price response");
  }
  const source: PriceSource = {
    id: country,
    attribution: data.attribution || `Station prices: ${country}, via FuelWide`,
    url: data.source?.url?.startsWith("https://") ? data.source.url : "https://fuelwide.com/fuel-prices-api",
    reportedAt: data.reportedAt || data.updatedAt,
  };
  const stations = data.stations.flatMap((record) => {
    if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) return [];
    const prices: Station["prices"] = {};
    FUEL_GRADES.forEach(({ value }) => {
      const amount = record.prices?.[value];
      if (validPrice(amount)) prices[value] = { amount, currency: data.currency };
    });
    return [{
      id: `${country}-${record.id}`,
      name: record.name || record.brand || "Fuel station",
      address: [record.address, record.postcode, record.town].filter(Boolean).join(", "),
      lat: record.lat, lon: record.lon,
      distanceKm: distanceKm(center, record),
      hours: record.hours || undefined,
      prices, sourceId: source.id,
    }];
  });
  return { stations, source };
}

function withinBox(point: Coordinates, radiusKm: number, south: number, north: number, west: number, east: number): boolean {
  const margin = radiusKm / 70;
  return point.lat >= south - margin && point.lat <= north + margin && point.lon >= west - margin && point.lon <= east + margin;
}

/** Preserve all unmatched OSM stations; only combine an unambiguous nearby match. */
function mergeStations(osm: Station[], priced: Station[]): Station[] {
  const unused = new Set(osm.map((station) => station.id));
  const combined = priced.map((station) => {
    let nearest: Station | undefined;
    let nearestKm = 0.075;
    for (const candidate of osm) {
      if (!unused.has(candidate.id)) continue;
      const distance = distanceKm(station, candidate);
      if (distance < nearestKm) { nearest = candidate; nearestKm = distance; }
    }
    if (!nearest) return station;
    // Different named brands more than 30 m apart might be separate forecourts.
    const a = station.name.toLowerCase();
    const b = nearest.name.toLowerCase();
    if (nearestKm > 0.03 && a !== "fuel station" && b !== "fuel station" && !a.includes(b) && !b.includes(a)) return station;
    unused.delete(nearest.id);
    return {
      ...station,
      name: station.name === "Fuel station" ? nearest.name : station.name,
      address: station.address || nearest.address,
      hours: station.hours || nearest.hours,
    };
  });
  return [...combined, ...osm.filter((station) => unused.has(station.id))];
}

export async function findNearbyFuelStations(center: Coordinates, radiusKm: number, signal: AbortSignal): Promise<Station[]> {
  const result = await searchOpenStreetMap(center, radiusKm, "fuel", signal);
  return result.stations.sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function findNearbyStations(center: Coordinates, radiusKm: number, kind: StationKind, signal: AbortSignal): Promise<StationSearchResult> {
  const locationRequest = searchOpenStreetMap(center, radiusKm, kind, signal);
  const priceRequests: Promise<PriceFeedResult>[] = [];
  if (kind === "fuel") {
    if (withinBox(center, radiusKm, 41, 51.5, -5.5, 9.8)) priceRequests.push(frenchPrices(center, radiusKm, signal));
    if (withinBox(center, radiusKm, 27, 44.3, -18.5, 4.6)) priceRequests.push(fuelWidePrices("spain", center, radiusKm, signal));
    if (withinBox(center, radiusKm, 35, 47.2, 6, 19)) priceRequests.push(fuelWidePrices("italy", center, radiusKm, signal));
    if (withinBox(center, radiusKm, -36, -12, 111, 130)) priceRequests.push(fuelWidePrices("australia", center, radiusKm, signal));
  }

  const [locationResult, ...feedResults] = await Promise.allSettled([locationRequest, ...priceRequests]);
  if (signal.aborted) throw new DOMException("Search cancelled", "AbortError");
  const osm = locationResult.status === "fulfilled" ? locationResult.value.stations : [];
  const feeds = feedResults.flatMap((result) => result.status === "fulfilled" ? [result.value as PriceFeedResult] : []);
  const priced = feeds.flatMap((feed) => feed.stations).filter((station) => station.distanceKm <= radiusKm + 0.1);
  const stations = mergeStations(osm, priced).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 100);
  const sourceFailed = priceRequests.length > feeds.length;
  const hasPrices = priced.some((station) => Object.keys(station.prices).length > 0);
  return {
    stations,
    priceSources: feeds.filter((feed) => feed.stations.length > 0).map((feed) => feed.source),
    locationSource: locationResult.status === "fulfilled" ? locationResult.value.source : "unavailable",
    priceCoverage: kind === "charging" ? "not-applicable"
      : hasPrices ? sourceFailed ? "partial" : "available"
      : sourceFailed ? "error" : "none",
  };
}