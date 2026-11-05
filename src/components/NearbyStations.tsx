import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import {
  ArrowDownUp,
  ExternalLink,
  Fuel,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import type { DistanceUnit, FuelType } from "../types";
import {
  FUEL_GRADES,
  findNearbyStations,
  formatPriceTime,
  formatStationPrice,
  isPriceOutdated,
  searchLocation,
  type Coordinates,
  type FuelGrade,
  type PriceQuote,
  type PriceSource,
  type Station,
  type StationKind,
  type StationSearchResult,
} from "../lib/stations";
import { cn } from "../utils/cn";

interface SearchCenter {
  point: Coordinates;
  label: string;
  origin: "gps" | "search" | "map";
}

const pumpSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 7h5v5H7zM15 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-3-3M23 9h-2"/></svg>';
const chargeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-12h-7l1-8z"/></svg>';
const EMPTY_PRICE_SOURCES: PriceSource[] = [];

/** A station tapped in picker mode, with the quote for the chosen grade. */
export interface StationSelection {
  station: Station;
  grade: FuelGrade;
  quote?: PriceQuote;
}

function stationIcon(kind: StationKind, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "autolog-map-marker",
    html: `<span class="autolog-map-pin${selected ? " is-selected" : ""}">${kind === "fuel" ? pumpSvg : chargeSvg}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -19],
  });
}

function directionsUrl(station: Station): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({ api: "1", destination: `${station.lat},${station.lon}` }).toString();
  return url.toString();
}

function mapPopup(station: Station, grade: FuelGrade, kind: StationKind, source?: PriceSource): HTMLElement {
  const content = document.createElement("div");
  content.className = "autolog-map-popup";
  const title = document.createElement("strong");
  title.textContent = station.name;
  content.append(title);
  if (station.address) {
    const address = document.createElement("p");
    address.textContent = station.address;
    content.append(address);
  }
  const price = document.createElement("p");
  const quote = station.prices[grade];
  price.className = "autolog-map-popup-price";
  price.textContent = kind === "charging" ? "Charging price unavailable"
    : quote ? `${formatStationPrice(quote)} / L · ${FUEL_GRADES.find((item) => item.value === grade)?.label}`
    : "Price not reported";
  content.append(price);
  if (quote) {
    const timestamp = quote.updatedAt || source?.reportedAt;
    const stamp = document.createElement("p");
    stamp.textContent = timestamp
      ? `${quote.updatedAt ? "Reported" : "Feed"} ${formatPriceTime(timestamp)}${isPriceOutdated(timestamp) ? " (older)" : ""}`
      : "Price update time unavailable";
    if (isPriceOutdated(timestamp)) stamp.className = "autolog-map-popup-old";
    content.append(stamp);
  }
  const link = document.createElement("a");
  link.href = directionsUrl(station);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Get directions";
  content.append(link);
  return content;
}

function StationMap({
  center,
  stations,
  priceSources,
  kind,
  grade,
  selectedId,
  radius,
  onSelect,
  onMapDrag,
}: {
  center: SearchCenter | null;
  stations: Station[];
  priceSources: PriceSource[];
  kind: StationKind;
  grade: FuelGrade;
  selectedId: string | null;
  radius: number;
  onSelect: (id: string) => void;
  onMapDrag: (point: Coordinates) => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const locationGroupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  const onMapDragRef = useRef(onMapDrag);
  onSelectRef.current = onSelect;
  onMapDragRef.current = onMapDrag;

  useEffect(() => {
    if (!elementRef.current) return;
    const map = L.map(elementRef.current, { zoomControl: false, scrollWheelZoom: false, worldCopyJump: true })
      .setView([28, 10], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    locationGroupRef.current = L.layerGroup().addTo(map);
    groupRef.current = L.markerClusterGroup({
      maxClusterRadius: 42,
      disableClusteringAtZoom: 17,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => L.divIcon({
        className: "autolog-map-cluster",
        html: `<span>${cluster.getChildCount()}</span>`,
        iconSize: [38, 38],
      }),
    }).addTo(map);
    map.on("dragend", () => {
      const point = map.getCenter();
      onMapDragRef.current({ lat: point.lat, lon: point.lng });
    });
    mapRef.current = map;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.invalidateSize());
    observer?.observe(elementRef.current);
    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      locationGroupRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const zoom = radius >= 20 ? 11 : radius >= 10 ? 12 : radius >= 5 ? 13 : 14;
    map.setView([center.point.lat, center.point.lon], zoom);
  }, [center?.point.lat, center?.point.lon, radius]);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    const locationGroup = locationGroupRef.current;
    if (!map || !group || !locationGroup) return;
    group.clearLayers();
    locationGroup.clearLayers();
    markersRef.current.clear();
    if (center) {
      const here: L.LatLngExpression = [center.point.lat, center.point.lon];
      L.circleMarker(here, { radius: 14, color: "#0071e3", weight: 1, opacity: 0.25, fillOpacity: 0.12, interactive: false }).addTo(locationGroup);
      L.circleMarker(here, { radius: 6, color: "#fff", weight: 2.5, fillColor: "#0071e3", fillOpacity: 1 })
        .bindTooltip(center.origin === "gps" ? "Your location" : "Search location")
        .addTo(locationGroup);
    }
    stations.forEach((station) => {
      const marker = L.marker([station.lat, station.lon], {
        icon: stationIcon(kind, false), title: station.name, keyboard: true,
      });
      marker.bindPopup(mapPopup(station, grade, kind, priceSources.find((source) => source.id === station.sourceId)));
      marker.on("click", () => onSelectRef.current(station.id));
      marker.addTo(group);
      markersRef.current.set(station.id, marker);
    });
  }, [center, stations, grade, kind, priceSources]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => marker.setIcon(stationIcon(kind, id === selectedId)));
    const marker = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (marker && mapRef.current && groupRef.current) {
      groupRef.current.zoomToShowLayer(marker, () => marker.openPopup());
    }
  }, [selectedId, stations, kind, grade]);

  return <div ref={elementRef} className="h-full w-full" role="region" aria-label="Interactive map of nearby stations" />;
}

function distanceLabel(km: number, unit: DistanceUnit): string {
  const distance = unit === "mi" ? km * 0.621371 : km;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} ${unit}`;
}

function locationError(error: GeolocationPositionError): string {
  if (error.code === 1) return "Location permission was denied. Allow it in your browser or search for a city or postcode.";
  if (error.code === 3) return "Your location took too long to find. Try again or search for a city or postcode.";
  return "Your location is unavailable. Search for a city or postcode instead.";
}

export default function NearbyStations({
  fuelType,
  unit,
  variant = "full",
  onStationSelect,
}: {
  fuelType: FuelType;
  unit: DistanceUnit;
  /**
   * "full" renders the Fuel-tab finder; "picker" renders a compact version
   * for the log form that reports the tapped station (and its price) back.
   */
  variant?: "full" | "picker";
  onStationSelect?: (selection: StationSelection) => void;
}) {
  const picker = variant === "picker";
  const reactId = useId().replace(/:/g, "");
  const titleId = `${reactId}-nearby-title`;
  const gradeId = `${reactId}-nearby-fuel-grade`;
  const radiusId = `${reactId}-nearby-radius`;
  const [kind, setKind] = useState<StationKind>(fuelType === "Electric" ? "charging" : "fuel");
  const [grade, setGrade] = useState<FuelGrade>(fuelType === "Diesel" ? "diesel" : "petrol95");
  const [radius, setRadius] = useState(10);
  const [sort, setSort] = useState<"distance" | "price">("distance");
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<SearchCenter | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
  const [result, setResult] = useState<StationSearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<"locating" | "address" | "stations" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);

  useEffect(() => () => {
    operationRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  const runSearch = useCallback(async (nextCenter: SearchCenter, nextRadius: number, nextKind: StationKind, operation: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setCenter(nextCenter);
    setMapCenter(null);
    setSelectedId(null);
    setResult(null);
    setCheckedAt(null);
    setError(null);
    setLoading("stations");
    try {
      const data = await findNearbyStations(nextCenter.point, nextRadius, nextKind, controller.signal);
      if (operation !== operationRef.current || controller.signal.aborted) return;
      setResult(data);
      setCheckedAt(new Date());
      if (data.locationSource === "unavailable" && !data.stations.length) {
        setError("Station data could not be reached. Check your connection and try again.");
      }
    } catch {
      if (operation === operationRef.current && !controller.signal.aborted) {
        setError("Could not load nearby stations. Check your connection and try again.");
      }
    } finally {
      if (operation === operationRef.current) setLoading(null);
    }
  }, []);

  const startSearch = (nextCenter: SearchCenter, nextRadius = radius, nextKind = kind) => {
    const operation = ++operationRef.current;
    void runSearch(nextCenter, nextRadius, nextKind, operation);
  };

  const useLocation = () => {
    const operation = ++operationRef.current;
    controllerRef.current?.abort();
    setError(null);
    if (!navigator.geolocation) {
      setLoading(null);
      setError("Location is not supported by this browser. Search for a city or postcode instead.");
      return;
    }
    setLoading("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (operation !== operationRef.current) return;
        void runSearch({ point: { lat: coords.latitude, lon: coords.longitude }, label: "Your current location", origin: "gps" }, radius, kind, operation);
      },
      (issue) => {
        if (operation !== operationRef.current) return;
        setLoading(null);
        setError(locationError(issue));
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  };

  const submitAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    const operation = ++operationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setLoading("address");
    try {
      const place = await searchLocation(query.trim(), controller.signal);
      if (operation !== operationRef.current || controller.signal.aborted) return;
      if (!place) {
        setError("No matching location found. Try a city and country or a full postcode.");
        setLoading(null);
        return;
      }
      void runSearch({ point: place.point, label: place.label, origin: "search" }, radius, kind, operation);
    } catch {
      if (operation === operationRef.current && !controller.signal.aborted) {
        setError("Location search is unavailable. Please check your connection and try again.");
        setLoading(null);
      }
    }
  };

  const stations = useMemo(() => {
    const items = [...(result?.stations ?? [])];
    if (sort === "price" && kind === "fuel") {
      items.sort((a, b) => {
        const aPrice = a.prices[grade];
        const bPrice = b.prices[grade];
        if (!aPrice && !bPrice) return a.distanceKm - b.distanceKm;
        if (!aPrice) return 1;
        if (!bPrice) return -1;
        if (aPrice.currency !== bPrice.currency) return a.distanceKm - b.distanceKm;
        return aPrice.amount - bPrice.amount || a.distanceKm - b.distanceKm;
      });
    }
    return items;
  }, [result, sort, kind, grade]);

  const priceCount = kind === "fuel" ? stations.filter((station) => station.prices[grade]).length : 0;
  const gradeLabel = FUEL_GRADES.find((item) => item.value === grade)?.label ?? "Fuel";
  const busy = loading !== null;

  // Picker mode shows only the closest handful to keep the form compact.
  const visibleStations = picker ? stations.slice(0, 6) : stations;

  const selectStation = useCallback(
    (station: Station, nextGrade: FuelGrade = grade) => {
      setSelectedId(station.id);
      if (picker) {
        onStationSelect?.({
          station,
          grade: nextGrade,
          quote: station.prices[nextGrade],
        });
      }
    },
    [grade, onStationSelect, picker],
  );

  const handleMapSelect = useCallback(
    (id: string) => {
      const station = stations.find((s) => s.id === id);
      if (station) selectStation(station);
      else setSelectedId(id);
    },
    [selectStation, stations],
  );

  useEffect(() => {
    setGrade(fuelType === "Diesel" ? "diesel" : "petrol95");
  }, [fuelType]);

  const changeKind = (next: StationKind) => {
    if (next === kind) return;
    setKind(next);
    setSort("distance");
    if (center) startSearch(center, radius, next);
  };

  return (
    <section
      className={cn(
        "nearby-section overflow-hidden bg-white ring-1",
        picker ? "rounded-[22px] ring-black/[0.06]" : "rounded-[24px] ring-black/[0.05]",
      )}
      aria-labelledby={titleId}
    >
      <div className="sr-only" role="status" aria-live="polite">
        {busy ? "Searching for nearby stations." : result ? `Found ${stations.length} nearby stations.` : ""}
      </div>
      <div className={picker ? "px-4 pb-3 pt-4" : "px-4 pb-4 pt-5 sm:px-5"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#eaf3fd] text-[#0071e3]">
              <MapPin size={19} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0071e3]">On the road</p>
              <h2 id={titleId} className="mt-0.5 text-[19px] font-bold tracking-tight text-neutral-900 sm:text-[21px]">
                {picker ? "Choose your station" : "Find your next stop"}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-neutral-500">
                {picker
                  ? kind === "charging"
                    ? "Tap where you charged, then enter the receipt price below."
                    : "Tap a station to copy its reported pump price into the log."
                  : "Nearby stations and the latest prices available."}
              </p>
            </div>
          </div>
          <button type="button" onClick={useLocation} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#0071e3] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#0077ed] active:scale-[0.98] disabled:opacity-50">
            <LocateFixed size={15} /> {loading === "locating" ? "Locating..." : "Use my location"}
          </button>
        </div>

        <form onSubmit={submitAddress} className="mt-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input aria-label="Search by city, postcode or address" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a city, postcode or address" className="h-11 w-full rounded-xl bg-[#f5f5f7] pl-10 pr-3 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#0071e3]/30" />
          </div>
          <button type="submit" disabled={busy || !query.trim()} className="h-11 rounded-xl bg-neutral-900 px-4 text-[13px] font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-35">Search</button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!picker && (
            <div className="flex rounded-xl bg-[#f5f5f7] p-1" aria-label="Station type">
              <button type="button" aria-pressed={kind === "fuel"} onClick={() => changeKind("fuel")} disabled={busy} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50", kind === "fuel" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}><Fuel size={14} /> Fuel</button>
              <button type="button" aria-pressed={kind === "charging"} onClick={() => changeKind("charging")} disabled={busy} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50", kind === "charging" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}><Zap size={14} /> Charging</button>
            </div>
          )}
          {kind === "fuel" && (
            <label className="sr-only" htmlFor={gradeId}>Fuel grade</label>
          )}
          {kind === "fuel" && (
            <select
              id={gradeId}
              aria-label="Fuel grade"
              value={grade}
              onChange={(event) => {
                const nextGrade = event.target.value as FuelGrade;
                setGrade(nextGrade);
                // Keep the copied price in sync with the newly chosen grade.
                const selected = stations.find((s) => s.id === selectedId);
                if (picker && selected) selectStation(selected, nextGrade);
              }}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-[12px] font-semibold text-neutral-700 outline-none focus:ring-2 focus:ring-[#0071e3]/30"
            >
              {FUEL_GRADES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
          <label className="sr-only" htmlFor={radiusId}>Search radius</label>
          <select id={radiusId} aria-label="Search radius" value={radius} disabled={busy} onChange={(event) => { const next = Number(event.target.value); setRadius(next); if (center) startSearch(center, next, kind); }} className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-[12px] font-semibold text-neutral-700 outline-none focus:ring-2 focus:ring-[#0071e3]/30 disabled:opacity-50">
            {[3, 5, 10, 20].map((value) => <option key={value} value={value}>Within {distanceLabel(value, unit)}</option>)}
          </select>
          {center && (
            <button type="button" onClick={() => startSearch(center)} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#0071e3] hover:bg-blue-50 disabled:opacity-50">
              <RefreshCw size={13} className={loading === "stations" ? "animate-spin" : ""} /> Refresh
            </button>
          )}
        </div>
        {error && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-800">{error}</p>}
      </div>

      <div
        className={cn(
          "grid grid-cols-1 border-t border-neutral-100",
          // Picker stacks map over list so rows stay readable inside a modal.
          !picker && "lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]",
        )}
      >
        <div
          className={cn(
            "relative isolate min-w-0 overflow-hidden bg-[#e5ebe9]",
            picker ? "h-[240px] sm:h-[280px] lg:h-[340px]" : "h-[290px] sm:h-[360px] lg:h-[420px]",
          )}
        >
          <StationMap center={center} stations={stations} priceSources={result?.priceSources ?? EMPTY_PRICE_SOURCES} kind={kind} grade={grade} selectedId={selectedId} radius={radius} onSelect={handleMapSelect} onMapDrag={setMapCenter} />
          {mapCenter && !busy && (
            <button type="button" onClick={() => startSearch({ point: mapCenter, label: "Selected map area", origin: "map" })} className="absolute left-1/2 top-3 z-[400] -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-neutral-800 shadow-lg ring-1 ring-black/10 transition hover:bg-neutral-50">
              Search this area
            </button>
          )}
          {!center && !mapCenter && (
            <div className="pointer-events-none absolute inset-x-4 bottom-8 z-[400] mx-auto max-w-[310px] rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
              <p className="text-[13px] font-semibold text-neutral-900">Your map, your starting point</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">Use your location, search a place, or drag the map to find stations.</p>
            </div>
          )}
          {loading === "stations" && (
            <div className="absolute inset-0 z-[450] flex items-center justify-center bg-white/45 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[12.5px] font-semibold text-neutral-700 shadow-lg"><RefreshCw size={15} className="animate-spin text-[#0071e3]" /> Finding nearby stops...</div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex min-h-[230px] min-w-0 flex-col border-t border-neutral-100 lg:border-l lg:border-t-0",
            picker ? "lg:h-auto lg:border-l-0 lg:border-t" : "lg:h-[420px]",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3.5">
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-bold text-neutral-900">{kind === "fuel" ? "Nearby stations" : "Nearby charging"}</h3>
              <p className="truncate text-[11.5px] text-neutral-400" title={center?.label}>{center ? center.label : "Choose a location to get started"}</p>
            </div>
            {center && kind === "fuel" && (
              <button type="button" onClick={() => setSort((current) => current === "distance" ? "price" : "distance")} className="flex shrink-0 items-center gap-1 rounded-lg bg-[#f5f5f7] px-2.5 py-2 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100" aria-label={`Sort by ${sort === "distance" ? "lowest price" : "distance"}`}>
                <ArrowDownUp size={12} /> {sort === "distance" ? "Nearest" : "Price"}
              </button>
            )}
          </div>

          <div className={cn("flex-1 overflow-y-auto", picker ? "max-h-[280px] lg:max-h-none" : "max-h-[360px] lg:max-h-none")}>
            {!center ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-neutral-400"><Navigation size={19} /></span>
                <p className="mt-3 text-[13.5px] font-semibold text-neutral-800">Find a stop near you</p>
                <p className="mt-1 max-w-[230px] text-[12px] leading-relaxed text-neutral-400">Choose a location to see the nearest stations on the map.</p>
              </div>
            ) : busy ? (
              <div className="flex min-h-[180px] items-center justify-center gap-2 text-[12.5px] text-neutral-400"><RefreshCw size={15} className="animate-spin" /> Looking for stations...</div>
            ) : stations.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center">
                <MapPin size={22} className="text-neutral-300" />
                <p className="mt-3 text-[13.5px] font-semibold text-neutral-800">No stations found</p>
                <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">Try a larger radius or search another location.</p>
              </div>
            ) : (
              visibleStations.map((station) => {
                const quote = station.prices[grade];
                const source = result?.priceSources.find((item) => item.id === station.sourceId);
                const updated = formatPriceTime(quote?.updatedAt || source?.reportedAt);
                const outdated = isPriceOutdated(quote?.updatedAt || source?.reportedAt);
                return (
                  <div key={station.id} className={cn("group flex items-center border-b border-neutral-100 transition last:border-b-0", selectedId === station.id ? "bg-blue-50/70" : "hover:bg-neutral-50")}>
                    <button type="button" onClick={() => selectStation(station)} aria-pressed={selectedId === station.id} className="flex min-w-0 flex-1 items-start gap-2.5 px-4 py-3.5 text-left">
                      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", selectedId === station.id ? "bg-[#0071e3] text-white" : "bg-[#edf5fd] text-[#0071e3]")}>{kind === "fuel" ? <Fuel size={15} /> : <Zap size={15} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-neutral-900">{station.name}</span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-neutral-400">{station.address || "Address not listed"}</span>
                        <span className="mt-1 block text-[11px] font-medium text-neutral-500">
                          {distanceLabel(station.distanceKm, unit)} away{station.hours ? ` · ${station.hours}` : ""}
                          {picker && selectedId === station.id && (
                            <span className="font-semibold text-[#0071e3]"> · Selected for this log</span>
                          )}
                        </span>
                      </span>
                      <span className="ml-1 max-w-[105px] shrink-0 text-right sm:max-w-[130px]">
                        {kind === "fuel" && quote ? (
                          <><span className="block text-[14px] font-bold tracking-tight text-neutral-900">{formatStationPrice(quote)}<span className="text-[10px] font-medium text-neutral-400"> / L</span></span><span className={cn("mt-0.5 block text-[10px] leading-snug", outdated ? "text-amber-700" : "text-neutral-400")} title={outdated ? "This price is more than seven days old" : undefined}>{quote.updatedAt ? "Reported" : "Feed"} {updated || "time unavailable"}{outdated ? " (older)" : ""}</span></>
                        ) : <span className="block max-w-[72px] text-[11px] leading-tight text-neutral-400">Price not reported</span>}
                      </span>
                    </button>
                    <a href={directionsUrl(station)} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${station.name}`} title="Get directions" className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white hover:text-[#0071e3]"><Navigation size={15} /></a>
                  </div>
                );
              })
            )}
          </div>
          {center && result && stations.length > 0 && (
            <div className="border-t border-neutral-100 px-4 py-2.5 text-[11px] text-neutral-400">
              {picker && visibleStations.length < stations.length
                ? `Showing ${visibleStations.length} nearest of ${stations.length} stops`
                : `${stations.length === 100 ? "Showing " : ""}${stations.length} ${stations.length === 1 ? "stop" : "stops"}`}{" "}
              within {distanceLabel(radius, unit)}
              {kind === "fuel" ? ` · ${priceCount} ${gradeLabel} ${priceCount === 1 ? "price" : "prices"}` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-neutral-100 bg-[#fafafa] px-4 py-3 text-[11px] leading-relaxed text-neutral-500 sm:px-5">
        {center && result?.priceCoverage === "none" && <p>Station-level prices are not available here. Locations are shown without a price.</p>}
        {center && result?.priceCoverage === "error" && <p>Some price sources could not be reached. Locations may still be available; try refreshing.</p>}
        {center && result?.priceCoverage === "partial" && <p>Some price sources could not be reached, so prices may be missing.</p>}
        {center && (result?.priceCoverage === "available" || result?.priceCoverage === "partial") && priceCount === 0 && <p>No {gradeLabel} prices were reported for these stations. Try another fuel grade.</p>}
        {center && kind === "charging" && <p>Charging locations are from OpenStreetMap. Charging prices are not provided by these sources.</p>}
        {center && result?.locationSource === "photon" && <p>OpenStreetMap results are limited; some stations may be missing.</p>}
        {center && result?.locationSource === "unavailable" && result.stations.length > 0 && <p>Map station data is unavailable; showing stations from available price feeds only.</p>}
        <p className="flex flex-wrap items-center gap-x-1.5"><Radio size={12} className="shrink-0 text-[#0071e3]" /> <span>Prices are reported, may be delayed, and are not converted. Verify at the pump.{checkedAt ? ` Checked ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(checkedAt)}.` : ""}</span></p>
        <p>Price coverage: mainland France and Corsica, Spain, Italy and Western Australia. Distances are straight-line estimates.</p>
        <p>
          Locations and map: <a className="font-medium text-[#0071e3] hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>
          {result?.locationSource === "photon" && <span> · Search via <a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer" className="font-medium text-[#0071e3] hover:underline">Photon</a></span>}
          {result?.priceSources.map((source) => <span key={source.id}> · <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0071e3] hover:underline">{source.attribution} <ExternalLink className="inline" size={10} /></a></span>)}
          {result?.priceSources.some((source) => source.id !== "france") && <span> · via <a href="https://fuelwide.com/fuel-prices-api" target="_blank" rel="noopener noreferrer" className="font-medium text-[#0071e3] hover:underline">FuelWide</a></span>}
        </p>
        <p>Your search location is sent to map and price providers to find nearby stops. It is not stored by AutoLog.</p>
      </div>
    </section>
  );
}