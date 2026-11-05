/* ------------------------------------------------------------------ */
/*  Fuel — fill-up / charging log with efficiency statistics.          */
/*  Consumption is derived from odometer deltas (full-to-full).        */
/* ------------------------------------------------------------------ */

import { useMemo } from "react";
import {
  CircleDollarSign,
  Fuel as FuelIcon,
  Gauge,
  Leaf,
  Plus,
  Route,
  Zap,
} from "lucide-react";
import { useData } from "../store/DataContext";
import { useVehicleRecords } from "../components/forms";
import { ConsumptionChart } from "../components/charts";
import NearbyStations from "../components/NearbyStations";
import {
  computeFuelStats,
  fmtCurrency,
  fmtDate,
  fmtDistance,
  fmtConsumption,
  fmtCostPerDistance,
  fmtNum,
  fmtUnitPrice,
  volumeUnitLabel,
} from "../lib/utils";
import { EmptyState, SectionTitle, StatCard } from "../components/ui";

/** Convert stored L/100km into the display metric (MPG for imperial). */
function displayConsumption(
  lPer100: number,
  unit: "km" | "mi",
  isEV: boolean,
): number {
  return unit === "mi" && !isEV ? 235.214 / lPer100 : lPer100;
}

export default function FuelView() {
  const { vehicle, settings, openModal } = useData();
  const { fuel } = useVehicleRecords();
  const stats = useMemo(() => computeFuelStats(fuel), [fuel]);
  const isEV = vehicle?.fuelType === "Electric";

  if (!vehicle) return null;
  const volLabel = volumeUnitLabel(settings, isEV);
  const consSuffix =
    settings.unit === "mi" && !isEV ? "MPG" : `${isEV ? "kWh" : "L"}/100 ${settings.unit}`;

  // Trend points oldest → newest (by odometer), one per fill after the first.
  const points = useMemo(() => {
    const byOdo = [...fuel].sort((a, b) => a.odometer - b.odometer);
    return byOdo
      .filter((r) => stats.perRecord.has(r.id))
      .map((r) => ({
        label: fmtDate(r.date).replace(/ \d{4}$/, ""),
        value:
          Math.round(
            displayConsumption(stats.perRecord.get(r.id)!, settings.unit, isEV) *
              10,
          ) / 10,
      }));
  }, [fuel, stats, settings.unit, isEV]);

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <NearbyStations key={vehicle.id} fuelType={vehicle.fuelType} unit={settings.unit} />
      </div>

      {/* ------------------------------- stats ------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={isEV ? "Avg consumption" : "Avg consumption"}
          value={
            stats.avgConsumption
              ? fmtConsumption(stats.avgConsumption, settings, isEV)
              : "—"
          }
          sub={
            stats.avgConsumption
              ? `Over ${fmtDistance(stats.totalDistance, settings)}`
              : "Needs 2+ logs"
          }
          icon={isEV ? <Leaf size={18} /> : <FuelIcon size={18} />}
        />
        <StatCard
          label={isEV ? "Cost per km" : "Fuel cost / km"}
          value={
            stats.costPerKm
              ? fmtCostPerDistance(stats.costPerKm, settings)
              : "—"
          }
          sub={isEV ? "Charging only" : "Fuel only"}
          icon={<Route size={18} />}
          accent="bg-violet-50 text-violet-500"
        />
        <StatCard
          label={isEV ? "Total energy" : "Total fuel"}
          value={`${fmtNum(stats.totalVolume, isEV ? 0 : 1)} ${volLabel}`}
          sub={`${stats.fillUps} ${isEV ? "charges" : "fill-ups"} logged`}
          icon={isEV ? <Zap size={18} /> : <Gauge size={18} />}
          accent="bg-amber-50 text-amber-500"
        />
        <StatCard
          label={isEV ? "Avg price / kWh" : "Avg price"}
          value={
            stats.avgPricePerUnit
              ? `${fmtUnitPrice(stats.avgPricePerUnit, settings.currency)}/${volLabel}`
              : "—"
          }
          sub={`${fmtCurrency(stats.totalCost, settings.currency)} total`}
          icon={<CircleDollarSign size={18} />}
          accent="bg-emerald-50 text-emerald-500"
        />
      </div>

      {/* ------------------------------- chart ------------------------------- */}
      <SectionTitle>Consumption trend</SectionTitle>
      <div className="rounded-[24px] bg-white p-4 ring-1 ring-black/[0.04]">
        <ConsumptionChart points={points} unitSuffix={consSuffix} />
      </div>

      {/* ------------------------------- history ------------------------------- */}
      <SectionTitle
        action={
          <button
            onClick={() => openModal("fuel")}
            className="inline-flex items-center gap-1 rounded-full bg-[#0071e3] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#0077ed]"
          >
            <Plus size={14} strokeWidth={2.5} /> {isEV ? "Log charge" : "Log fuel"}
          </button>
        }
      >
        {isEV ? "Charging history" : "Fuel history"}
      </SectionTitle>

      {fuel.length === 0 ? (
        <EmptyState
          icon={isEV ? <Zap size={22} /> : <FuelIcon size={22} />}
          title={isEV ? "No charges logged" : "No fill-ups logged"}
          body={
            isEV
              ? "Log each charging session and AutoLog will work out your real kWh/100 km and cost per kilometre."
              : "Log each fill-up with the odometer reading and AutoLog will calculate your true consumption and running costs."
          }
          action={
            <button
              onClick={() => openModal("fuel")}
              className="rounded-full bg-[#0071e3] px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              {isEV ? "Log first charge" : "Log first fill-up"}
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.04]">
          {fuel.map((r, i) => {
            const cons = stats.perRecord.get(r.id);
            return (
              <button
                key={r.id}
                onClick={() => openModal("fuel", r.id)}
                className={
                  "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-[#f5f5f7] " +
                  (i > 0 ? "border-t border-black/[0.04]" : "")
                }
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0071e3]">
                  {isEV ? <Zap size={17} /> : <FuelIcon size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-neutral-900">
                    {fmtNum(r.volume, 1)} {volLabel}
                    <span className="font-normal text-neutral-400">
                      {" "}
                      @ {fmtUnitPrice(r.pricePerUnit * (settings.unit === "mi" && !isEV ? 3.78541 : 1), settings.currency)}/{volLabel}
                    </span>
                  </span>
                  <span className="block text-[12.5px] text-neutral-400">
                    {fmtDate(r.date)} · {fmtDistance(r.odometer, settings)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14.5px] font-bold text-neutral-900">
                    {fmtCurrency(r.totalCost, settings.currency)}
                  </span>
                  {cons !== undefined && (
                    <span className="block text-[12px] font-medium text-[#0071e3]">
                      {fmtConsumption(cons, settings, isEV)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
