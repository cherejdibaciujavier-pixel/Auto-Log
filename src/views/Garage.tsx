/* ------------------------------------------------------------------ */
/*  Garage — fleet overview: vehicle hero, alerts, quick actions,      */
/*  health snapshot and the multi-vehicle switcher list.               */
/* ------------------------------------------------------------------ */

import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  Cog,
  Crown,
  Download,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Route,
  Wrench,
} from "lucide-react";
import { useData } from "../store/DataContext";
import { VehiclePhoto } from "../components/VehiclePhoto";
import { FREE_VEHICLE_LIMIT, useAuth } from "../store/AuthContext";
import {
  computeAlerts,
  computeExpenses,
  fmtCurrency,
  fmtDate,
  fmtDistance,
  fmtCostPerDistance,
  getDocumentStatus,
  getServiceStatus,
  vehicleName,
} from "../lib/utils";
import { DOCUMENT_META } from "../types";
import { generateServiceReport } from "../lib/pdf";
import { PlateChip, SectionTitle, StatCard, StatusPill } from "../components/ui";
import { cn } from "../utils/cn";

export default function GarageView() {
  const { data, vehicle, settings, setTab, openModal, setActiveVehicle, notify } =
    useData();
  const { isPremium } = useAuth();
  const atVehicleLimit = !isPremium && data.vehicles.length >= FREE_VEHICLE_LIMIT;

  const handleAddVehicle = () =>
    atVehicleLimit ? openModal("pricing") : openModal("vehicle");

  /* ------------------------- no vehicles yet ------------------------- */
  if (!vehicle) {
    return (
      <div className="animate-fade-up">
        <div className="overflow-hidden rounded-[28px] bg-neutral-900 text-white">
          <div className="bg-gradient-to-br from-[#0071e3] via-[#0a84ff] to-[#30b0c7] px-6 py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Gauge size={24} />
            </div>
            <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight">
              Welcome to AutoLog
            </h1>
            <p className="mt-1.5 max-w-sm text-[14.5px] leading-relaxed text-white/85">
              Track maintenance, fuel, documents and running costs for every
              car you own — and export a resale-ready history in one tap.
            </p>
            <button
              onClick={() => openModal("vehicle")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14.5px] font-semibold text-[#0071e3] transition hover:bg-white/90"
            >
              <Plus size={17} strokeWidth={2.5} /> Add your first vehicle
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: <Wrench size={18} />, label: "Service predictor" },
            { icon: <Fuel size={18} />, label: "Fuel efficiency" },
            { icon: <Download size={18} />, label: "PDF resale report" },
          ].map((f) => (
            <div
              key={f.label}
              className="rounded-[20px] bg-white px-2 py-4 ring-1 ring-black/[0.04]"
            >
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0071e3]">
                {f.icon}
              </div>
              <p className="text-[11.5px] font-medium leading-tight text-neutral-500">
                {f.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const alerts = computeAlerts(vehicle, data, settings, isPremium ? 90 : 30);
  const expenses = computeExpenses(vehicle.id, data);
  const svc = getServiceStatus(vehicle, data.services, settings);
  const docs = data.documents
    .filter((d) => d.vehicleId === vehicle.id)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const nextDoc = docs[0];

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
      {/* --------------------------- vehicle hero --------------------------- */}
      <div className="relative overflow-hidden rounded-[28px] bg-neutral-900 text-white shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
        <VehiclePhoto
          path={vehicle.imagePath}
          src={vehicle.image}
          alt={vehicleName(vehicle)}
          className="h-60 w-full object-cover sm:h-72"
          fallback={(
            <div className="flex h-60 w-full items-center justify-center bg-gradient-to-br from-neutral-700 to-neutral-900 sm:h-72">
              <Car size={72} className="text-white/25" strokeWidth={1.2} />
            </div>
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
        <button
          onClick={() => openModal("vehicle", vehicle.id)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/50"
          aria-label="Edit vehicle"
        >
          <Pencil size={15} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/70">
                {vehicle.year} · {vehicle.fuelType}
              </p>
              <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight">
                {vehicleName(vehicle)}
              </h1>
              {vehicle.motorisation ? (
                <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-white/90">
                  <Cog size={14} className="shrink-0" />
                  <span className="truncate">{vehicle.motorisation}</span>
                </p>
              ) : (
                <button
                  onClick={() => openModal("vehicle", vehicle.id)}
                  className="mt-1 text-[13px] font-medium text-white/90 underline underline-offset-2 hover:text-white"
                >
                  Add motorisation
                </button>
              )}
              <p className="mt-0.5 text-[14px] text-white/80">
                {fmtDistance(vehicle.mileage, settings)}
                {vehicle.vin && (
                  <span className="text-white/50"> · VIN …{vehicle.vin.slice(-6)}</span>
                )}
              </p>
            </div>
            <PlateChip plate={vehicle.plate} dark />
          </div>
        </div>
      </div>

      {/* ---------------------------- quick actions ---------------------------- */}
      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {[
          { icon: <Wrench size={18} />, label: "Service", locked: false, run: () => openModal("service") },
          {
            icon: <Fuel size={18} />,
            label: vehicle.fuelType === "Electric" ? "Charge" : "Fuel",
            locked: false,
            run: () => openModal("fuel"),
          },
          { icon: <CalendarClock size={18} />, label: "Document", locked: false, run: () => openModal("document") },
          { icon: <Download size={18} />, label: "PDF report", locked: !isPremium, run: exportPdf },
        ].map((a) => (
          <button
            key={a.label}
            onClick={a.run}
            className="relative flex flex-col items-center gap-1.5 rounded-[20px] bg-white py-3.5 ring-1 ring-black/[0.04] transition hover:ring-[#0071e3]/30 active:scale-[0.98]"
          >
            {a.locked && (
              <span className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-amber-400 text-white">
                <Crown size={10} strokeWidth={3} />
              </span>
            )}
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0071e3]">
              {a.icon}
            </span>
            <span className="text-[11.5px] font-medium text-neutral-600">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ------------------------------- alerts ------------------------------- */}
      {alerts.length > 0 && (
        <>
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <BellRing size={18} className="text-[#0071e3]" /> Needs attention
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {alerts.length}
              </span>
            </span>
          </SectionTitle>
          <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.04]">
            {alerts.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setTab(a.kind === "service" ? "service" : "documents")}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#f5f5f7]",
                  i > 0 && "border-t border-black/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    a.state === "overdue"
                      ? "bg-red-50 text-red-500"
                      : "bg-amber-50 text-amber-500",
                  )}
                >
                  <AlertTriangle size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-neutral-900">
                    {a.title}
                  </span>
                  <span className="block text-[12.5px] capitalize text-neutral-400">
                    {a.detail}
                  </span>
                </span>
                <ChevronRight size={17} className="shrink-0 text-neutral-300" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---------------------------- key figures ---------------------------- */}
      <SectionTitle>Overview</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total spent"
          value={fmtCurrency(expenses.allTime, settings.currency)}
          sub={`${fmtCurrency(expenses.thisMonth, settings.currency)} this month`}
          icon={<CircleDollarSign size={18} />}
        />
        <StatCard
          label="Cost per km"
          value={
            expenses.costPerKm
              ? fmtCostPerDistance(expenses.costPerKm, settings)
              : "—"
          }
          sub="All-in running cost"
          icon={<Route size={18} />}
          accent="bg-violet-50 text-violet-500"
        />
        <button onClick={() => setTab("service")} className="text-left">
          <div className="h-full rounded-[22px] bg-white p-4 ring-1 ring-black/[0.04] transition hover:ring-[#0071e3]/30">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
              <Wrench size={18} />
            </div>
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-neutral-400">
              Next service
            </p>
            <div className="mt-1">
              <StatusPill state={svc.state} />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-neutral-400">
              {svc.state === "none"
                ? "Log a service to start predictions"
                : `Due at ${fmtDistance(svc.nextMileage, settings)} · ${fmtDate(svc.nextDate)}`}
            </p>
          </div>
        </button>
        <button onClick={() => setTab("documents")} className="text-left">
          <div className="h-full rounded-[22px] bg-white p-4 ring-1 ring-black/[0.04] transition hover:ring-[#0071e3]/30">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
              <CalendarClock size={18} />
            </div>
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-neutral-400">
              Next expiry
            </p>
            {nextDoc ? (
              <>
                <div className="mt-1">
                  <StatusPill state={getDocumentStatus(nextDoc, isPremium ? 90 : 30).state} />
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-neutral-400">
                  {DOCUMENT_META[nextDoc.type].label} · {fmtDate(nextDoc.expiryDate)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[12px] leading-snug text-neutral-400">
                No documents tracked yet
              </p>
            )}
          </div>
        </button>
      </div>

      {/* ------------------------------ my garage ------------------------------ */}
      <SectionTitle
        action={
          <button
            onClick={handleAddVehicle}
            className="inline-flex items-center gap-1 rounded-full bg-[#0071e3] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#0077ed]"
          >
            {atVehicleLimit ? (
              <Crown size={14} className="text-amber-300" />
            ) : (
              <Plus size={14} strokeWidth={2.5} />
            )}{" "}
            Add car
          </button>
        }
      >
        Your garage
      </SectionTitle>
      <div className="space-y-2.5">
        {data.vehicles.map((v) => {
          const active = v.id === vehicle.id;
          return (
            <button
              key={v.id}
              onClick={() => setActiveVehicle(v.id)}
              className={cn(
                "flex w-full items-center gap-3.5 rounded-[22px] bg-white p-3 text-left ring-1 transition",
                active
                  ? "ring-2 ring-[#0071e3]"
                  : "ring-black/[0.04] hover:ring-black/10",
              )}
            >
              <VehiclePhoto
                path={v.imagePath}
                src={v.image}
                alt={vehicleName(v)}
                className="h-14 w-[76px] shrink-0 rounded-2xl object-cover"
                fallback={(
                  <span className="flex h-14 w-[76px] shrink-0 items-center justify-center rounded-2xl bg-[#f5f5f7] text-neutral-400">
                    <Car size={22} />
                  </span>
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-neutral-900">
                  {vehicleName(v)}
                </span>
                <span className="block truncate text-[12.5px] font-medium text-neutral-600">
                  {v.motorisation || "Motorisation not added"}
                </span>
                <span className="block truncate text-[11.5px] text-neutral-400">
                  {v.year} · {v.fuelType} · {fmtDistance(v.mileage, settings)}
                </span>
              </span>
              <PlateChip plate={v.plate} />
              {active && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
