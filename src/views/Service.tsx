/* ------------------------------------------------------------------ */
/*  Service — maintenance log with the Dynamic Next-Service Predictor. */
/* ------------------------------------------------------------------ */

import {
  CalendarDays,
  Gauge,
  MapPin,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useData } from "../store/DataContext";
import { useVehicleRecords } from "../components/forms";
import {
  fmtCountdown,
  fmtCurrency,
  fmtDate,
  fmtDistance,
  fmtNum,
  getServiceStatus,
  kmToUnit,
} from "../lib/utils";
import type { ServiceCategory } from "../types";
import {
  CategoryIcon,
  EmptyState,
  PartsBanner,
  SectionTitle,
  StatusPill,
} from "../components/ui";
import { vehicleName } from "../lib/utils";
import { cn } from "../utils/cn";

const CATEGORY_TINT: Record<ServiceCategory, string> = {
  "Oil & Filters": "bg-blue-50 text-[#0071e3]",
  "Brake Pads/Discs": "bg-red-50 text-red-500",
  "Timing Belt": "bg-violet-50 text-violet-500",
  Battery: "bg-amber-50 text-amber-500",
  Tyres: "bg-neutral-100 text-neutral-600",
  Suspension: "bg-teal-50 text-teal-600",
  "General Inspection": "bg-emerald-50 text-emerald-500",
  Other: "bg-neutral-100 text-neutral-500",
};

function ProgressRow({
  label,
  progress,
  right,
  danger,
}: {
  label: string;
  progress: number;
  right: string;
  danger: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
        <span className="font-medium text-neutral-500">{label}</span>
        <span className={cn("font-semibold", danger ? "text-red-500" : "text-neutral-700")}>
          {right}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            progress >= 100
              ? "bg-red-500"
              : progress >= 85
                ? "bg-amber-400"
                : "bg-[#0071e3]",
          )}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}

export default function ServiceView() {
  const { vehicle, settings, openModal, data } = useData();
  const { services } = useVehicleRecords();

  if (!vehicle) return null;
  const svc = getServiceStatus(vehicle, data.services, settings);
  const totalMaintenance = services.reduce((t, r) => t + r.cost, 0);

  return (
    <div className="animate-fade-up">
      {/* ------------------------- next-service predictor ------------------------- */}
      <div className="overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[0.04]">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Next service predictor
              </p>
              <h2 className="mt-1 text-[20px] font-bold tracking-tight text-neutral-900">
                {svc.state === "none" && "No service history yet"}
                {svc.state === "ok" && "You're all set"}
                {svc.state === "soon" && "Service coming up"}
                {svc.state === "overdue" && "Service overdue"}
              </h2>
            </div>
            <StatusPill
              state={svc.state}
              label={
                svc.state === "ok"
                  ? "OK"
                  : svc.state === "soon"
                    ? "Due soon"
                    : svc.state === "overdue"
                      ? "Overdue"
                      : "No data"
              }
            />
          </div>

          {svc.state === "none" ? (
            <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-500">
              Log your first service and AutoLog will automatically predict the
              next one (+{fmtNum(kmToUnit(settings.serviceIntervalKm, settings))}{" "}
              {settings.unit} / {settings.serviceIntervalDays} days).
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-[13.5px] text-neutral-500">
                Based on your last service ({svc.lastService?.category} ·{" "}
                {fmtDate(svc.lastService?.date ?? "")}). Next due{" "}
                <span className="font-semibold text-neutral-800">
                  {fmtCountdown(svc.daysRemaining).toLowerCase()}
                </span>
                .
              </p>
              <div className="mt-4 space-y-4">
                <ProgressRow
                  label={`Distance — due at ${fmtDistance(svc.nextMileage, settings)}`}
                  progress={svc.kmProgress}
                  right={
                    svc.kmRemaining > 0
                      ? `${fmtNum(kmToUnit(svc.kmRemaining, settings))} ${settings.unit} left`
                      : `${fmtNum(kmToUnit(Math.abs(svc.kmRemaining), settings))} ${settings.unit} over`
                  }
                  danger={svc.kmRemaining <= 1500}
                />
                <ProgressRow
                  label={`Time — due ${fmtDate(svc.nextDate)}`}
                  progress={svc.daysProgress}
                  right={
                    svc.daysRemaining >= 0
                      ? `${svc.daysRemaining} days left`
                      : `${Math.abs(svc.daysRemaining)} days over`
                  }
                  danger={svc.daysRemaining <= 30}
                />
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => openModal("service")}
          className="flex w-full items-center justify-center gap-2 bg-[#0071e3] py-3 text-[14.5px] font-semibold text-white transition hover:bg-[#0077ed]"
        >
          <Plus size={16} strokeWidth={2.5} /> Log a service
        </button>
      </div>

      {/* --------------------- affiliate slot: parts --------------------- */}
      <div className="mt-4">
        <PartsBanner vehicleName={`${vehicleName(vehicle)}${vehicle.motorisation ? ` ${vehicle.motorisation}` : ""}`} />
      </div>

      {/* ------------------------------ history ------------------------------ */}
      <SectionTitle
        action={
          services.length > 0 ? (
            <span className="text-[13px] text-neutral-400">
              {services.length} records ·{" "}
              {fmtCurrency(totalMaintenance, settings.currency)}
            </span>
          ) : undefined
        }
      >
        Service history
      </SectionTitle>

      {services.length === 0 ? (
        <EmptyState
          icon={<Wrench size={22} />}
          title="No services logged"
          body="Keep every oil change, brake job and inspection in one place — it builds your car's resale value."
          action={
            <button
              onClick={() => openModal("service")}
              className="rounded-full bg-[#0071e3] px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              Log first service
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {services.map((r) => (
            <button
              key={r.id}
              onClick={() => openModal("service", r.id)}
              className="flex w-full gap-3.5 rounded-[22px] bg-white p-4 text-left ring-1 ring-black/[0.04] transition hover:ring-[#0071e3]/25"
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  CATEGORY_TINT[r.category],
                )}
              >
                <CategoryIcon category={r.category} size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold text-neutral-900">
                    {r.category}
                  </span>
                  <span className="shrink-0 text-[15px] font-bold text-neutral-900">
                    {fmtCurrency(r.cost, settings.currency)}
                  </span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={12} /> {fmtDate(r.date)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge size={12} /> {fmtDistance(r.mileage, settings)}
                  </span>
                  {r.workshop && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {r.workshop}
                    </span>
                  )}
                </span>
                {r.notes && (
                  <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-neutral-500">
                    {r.notes}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[12px] text-neutral-400">
        <Sparkles size={13} />
        Prediction interval: +{fmtNum(kmToUnit(settings.serviceIntervalKm, settings))}{" "}
        {settings.unit} or {settings.serviceIntervalDays} days — adjustable in Settings.
      </p>
    </div>
  );
}
