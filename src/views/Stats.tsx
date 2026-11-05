/* ------------------------------------------------------------------ */
/*  Stats — analytics & expense dashboard + resale PDF export.         */
/* ------------------------------------------------------------------ */

import { useMemo } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  Crown,
  Download,
  Fuel as FuelIcon,
  Route,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { useData } from "../store/DataContext";
import { useAuth } from "../store/AuthContext";
import { useVehicleRecords } from "../components/forms";
import { ExpenseDoughnut, MonthlyBarChart, CHART_COLORS } from "../components/charts";
import {
  computeExpenses,
  computeFuelStats,
  fmtCurrency,
  fmtDate,
  fmtDistance,
  fmtConsumption,
  fmtCostPerDistance,
  monthlySeries,
  vehicleName,
} from "../lib/utils";
import { generateServiceReport } from "../lib/pdf";
import { SectionTitle, StatCard } from "../components/ui";
import { cn } from "../utils/cn";

export default function StatsView() {
  const { data, vehicle, settings, notify, openModal } = useData();
  const { isPremium } = useAuth();
  const { services, fuel, documents } = useVehicleRecords();

  const expenses = useMemo(
    () => (vehicle ? computeExpenses(vehicle.id, data) : null),
    [vehicle, data],
  );
  const fuelStats = useMemo(() => computeFuelStats(fuel), [fuel]);
  const series = useMemo(
    () => (vehicle ? monthlySeries(vehicle.id, data, 6) : null),
    [vehicle, data],
  );

  if (!vehicle || !expenses || !series) return null;
  const isEV = vehicle.fuelType === "Electric";

  const legend = [
    { label: isEV ? "Charging" : "Fuel", value: expenses.fuel, color: CHART_COLORS.fuel },
    { label: "Maintenance", value: expenses.maintenance, color: CHART_COLORS.maintenance },
    { label: "Insurance & Taxes", value: expenses.documents, color: CHART_COLORS.documents },
  ];

  // Latest 5 events across all record types.
  const recent = [
    ...services.map((r) => ({
      id: `s-${r.id}`,
      date: r.date,
      title: r.category,
      detail: "Maintenance",
      amount: r.cost,
      color: CHART_COLORS.maintenance,
      Icon: Wrench,
    })),
    ...fuel.map((r) => ({
      id: `f-${r.id}`,
      date: r.date,
      title: isEV ? "Charging session" : "Fuel fill-up",
      detail: `${r.volume.toFixed(1)} ${isEV ? "kWh" : "L"}`,
      amount: r.totalCost,
      color: CHART_COLORS.fuel,
      Icon: isEV ? Zap : FuelIcon,
    })),
    ...documents.map((r) => ({
      id: `d-${r.id}`,
      date: r.expiryDate,
      title: r.provider || "Document renewal",
      detail: "Insurance & Taxes",
      amount: r.cost,
      color: CHART_COLORS.documents,
      Icon: CircleDollarSign,
    })),
  ]
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const exportPdf = () => {
    if (!isPremium) {
      openModal("pricing");
      return;
    }
    generateServiceReport(vehicle, data, settings);
    notify("Resale history report downloaded");
  };

  return (
    <div className="animate-fade-up">
      {/* ------------------------------ stat cards ------------------------------ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total expenses"
          value={fmtCurrency(expenses.allTime, settings.currency)}
          sub="All time"
          icon={<CircleDollarSign size={18} />}
        />
        <StatCard
          label="This month"
          value={fmtCurrency(expenses.thisMonth, settings.currency)}
          sub={new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date())}
          icon={<CalendarDays size={18} />}
          accent="bg-emerald-50 text-emerald-500"
        />
        <StatCard
          label="Avg cost / km"
          value={
            expenses.costPerKm
              ? fmtCostPerDistance(expenses.costPerKm, settings)
              : "—"
          }
          sub="Fuel + maintenance + legal"
          icon={<Route size={18} />}
          accent="bg-violet-50 text-violet-500"
        />
        <StatCard
          label="Distance logged"
          value={fmtDistance(expenses.totalDistance, settings)}
          sub={`Odometer ${fmtDistance(vehicle.mileage, settings)}`}
          icon={<TrendingUp size={18} />}
          accent="bg-amber-50 text-amber-500"
        />
      </div>

      {/* ------------------------- breakdown + trend ------------------------- */}
      <div className="mt-3 grid gap-3 lg:grid-cols-5">
        <div className="rounded-[24px] bg-white p-5 ring-1 ring-black/[0.04] lg:col-span-2">
          <h3 className="text-[15.5px] font-bold tracking-tight text-neutral-900">
            Where the money goes
          </h3>
          <div className="mt-3">
            <ExpenseDoughnut
              fuel={expenses.fuel}
              maintenance={expenses.maintenance}
              documents={expenses.documents}
              currency={settings.currency}
            />
          </div>
          <div className="mt-4 space-y-2">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center gap-2.5 text-[13.5px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <span className="flex-1 text-neutral-600">{l.label}</span>
                <span className="font-semibold text-neutral-900">
                  {fmtCurrency(l.value, settings.currency)}
                </span>
                <span className="w-11 text-right text-neutral-400">
                  {expenses.allTime > 0
                    ? `${Math.round((l.value / expenses.allTime) * 100)}%`
                    : "—"}
                </span>
              </div>
            ))}
          </div>
          {fuelStats.avgConsumption && (
            <p className="mt-4 rounded-xl bg-[#f5f5f7] px-3.5 py-2.5 text-[12.5px] text-neutral-500">
              Efficiency:{" "}
              <span className="font-semibold text-neutral-800">
                {fmtConsumption(fuelStats.avgConsumption, settings, isEV)}
              </span>{" "}
              average across {fuelStats.fillUps} {isEV ? "charges" : "fill-ups"}.
            </p>
          )}
        </div>

        <div className="rounded-[24px] bg-white p-5 ring-1 ring-black/[0.04] lg:col-span-3">
          <h3 className="text-[15.5px] font-bold tracking-tight text-neutral-900">
            Monthly spending
          </h3>
          <p className="text-[12.5px] text-neutral-400">Last 6 months, stacked by category</p>
          <div className="mt-3">
            <MonthlyBarChart
              labels={series.labels}
              fuel={series.fuel}
              maintenance={series.maintenance}
              documents={series.documents}
              currency={settings.currency}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {legend.map((l) => (
              <span
                key={l.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-medium text-neutral-600"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------- resale report ---------------------------- */}
      <div className="relative mt-3 overflow-hidden rounded-[26px] bg-neutral-900 p-6 text-white">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#0071e3]/30 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
            Selling your {vehicle.make}?
          </p>
          <h3 className="mt-1.5 text-[20px] font-bold tracking-tight">
            Download the resale history report
          </h3>
          <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-white/75">
            A professional PDF with full specifications, chronological service
            history and total money invested in the{" "}
            {vehicleName(vehicle)} — exactly what buyers ask for.
          </p>
          <button
            onClick={exportPdf}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14.5px] font-semibold text-neutral-900 transition hover:bg-white/90 active:scale-[0.99]"
          >
            {isPremium ? <Download size={16} /> : <Crown size={16} className="text-amber-500" />}
            {isPremium ? "Download PDF report" : "Unlock PDF report with Premium"}
          </button>
        </div>
      </div>

      {/* ---------------------------- recent activity ---------------------------- */}
      {recent.length > 0 && (
        <>
          <SectionTitle>Recent expenses</SectionTitle>
          <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.04]">
            {recent.map((e, i) => (
              <div
                key={e.id}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3",
                  i > 0 && "border-t border-black/[0.04]",
                )}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${e.color}1a`, color: e.color }}
                >
                  <e.Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-neutral-900">
                    {e.title}
                  </span>
                  <span className="block text-[12px] text-neutral-400">
                    {e.detail} · {fmtDate(e.date)}
                  </span>
                </span>
                <span className="text-[14px] font-bold text-neutral-900">
                  {fmtCurrency(e.amount, settings.currency)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
