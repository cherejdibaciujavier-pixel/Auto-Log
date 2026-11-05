/* ------------------------------------------------------------------ */
/*  AutoLog — application shell.                                       */
/*                                                                     */
/*  Root decides between the auth screen and the app itself. Each      */
/*  signed-in account gets its own cloud garage; guest data stays only  */
/*  in memory for the current session.                                 */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import {
  Bell,
  Car,
  Check,
  ChevronDown,
  Crown,
  FileText,
  Fuel,
  Gauge,
  Plus,
  Settings as SettingsIcon,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { DataProvider, useData, type TabKey } from "./store/DataContext";
import {
  AuthProvider,
  FREE_VEHICLE_LIMIT,
  avatarGradient,
  initialsOf,
  useAuth,
} from "./store/AuthContext";
import { computeAlerts, fmtDistance, vehicleName } from "./lib/utils";
import { PlateChip } from "./components/ui";
import {
  DocumentFormModal,
  FuelFormModal,
  ServiceFormModal,
  SettingsModal,
  VehicleFormModal,
} from "./components/forms";
import AuthScreen from "./components/AuthScreen";
import PricingModal from "./components/PricingModal";
import AccountModal from "./components/AccountModal";
import GarageView from "./views/Garage";
import ServiceView from "./views/Service";
import FuelView from "./views/Fuel";
import DocumentsView from "./views/Documents";
import StatsView from "./views/Stats";
import { cn } from "./utils/cn";

/* ------------------------------ bottom nav ------------------------------ */
const TABS: { key: TabKey; label: string; Icon: typeof Car }[] = [
  { key: "garage", label: "Garage", Icon: Car },
  { key: "service", label: "Service", Icon: Wrench },
  { key: "fuel", label: "Fuel", Icon: Fuel },
  { key: "documents", label: "Documents", Icon: FileText },
  { key: "stats", label: "Stats", Icon: TrendingUp },
];

const TAB_TITLES: Record<Exclude<TabKey, "garage">, string> = {
  service: "Service & Maintenance",
  fuel: "Fuel & Efficiency",
  documents: "Documents & Expiry",
  stats: "Expense Analytics",
};

function BottomNav() {
  const { tab, setTab } = useData();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white/85 p-1.5 shadow-[0_10px_36px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] backdrop-blur-xl">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex min-w-[58px] flex-col items-center gap-0.5 rounded-full px-2.5 py-2 transition-all sm:min-w-[68px]",
                active
                  ? "bg-[#0071e3] text-white shadow-md"
                  : "text-neutral-500 hover:text-neutral-800",
              )}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[9.5px] font-semibold leading-none">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* --------------------------- vehicle switcher --------------------------- */
function VehicleSwitcher() {
  const { data, vehicle, setActiveVehicle, openModal, settings, setTab } =
    useData();
  const { isPremium } = useAuth();
  const [open, setOpen] = useState(false);

  // Free plan: first vehicle included, extras need Premium.
  const handleAddVehicle = () => {
    setOpen(false);
    setTab("garage");
    if (!isPremium && data.vehicles.length >= FREE_VEHICLE_LIMIT) {
      openModal("pricing");
    } else {
      openModal("vehicle");
    }
  };

  if (!vehicle) {
    return (
      <button
        onClick={() => openModal("vehicle")}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-[13.5px] font-semibold text-white"
      >
        <Plus size={15} strokeWidth={2.5} /> Add vehicle
      </button>
    );
  }

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[42vw] items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-2 ring-1 ring-black/[0.06] transition hover:ring-black/10 sm:max-w-xs"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Car size={16} className="shrink-0 text-[#0071e3]" />
        <span className="truncate text-[13.5px] font-semibold text-neutral-900">
          {vehicleName(vehicle)}
        </span>
        <ChevronDown
          size={15}
          className={cn(
            "shrink-0 text-neutral-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <button
            aria-label="Close vehicle menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="animate-pop absolute left-0 top-full z-20 mt-2 w-80 max-w-[86vw] overflow-hidden rounded-[24px] bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06]">
            <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              Switch vehicle
            </p>
            {data.vehicles.map((v) => {
              const active = v.id === vehicle.id;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveVehicle(v.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                    active ? "bg-blue-50" : "hover:bg-[#f5f5f7]",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-neutral-900">
                      {vehicleName(v)}
                    </span>
                    <span className="block truncate text-[12px] text-neutral-400">
                      {v.year} · {v.motorisation || v.fuelType} · {fmtDistance(v.mileage, settings)}
                    </span>
                  </span>
                  <PlateChip plate={v.plate} />
                  {active && (
                    <Check
                      size={16}
                      className="shrink-0 text-[#0071e3]"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
            <button
              onClick={handleAddVehicle}
              className="mt-1 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-[#0071e3] transition hover:bg-blue-50"
            >
              {!isPremium && data.vehicles.length >= FREE_VEHICLE_LIMIT ? (
                <Crown size={16} className="text-amber-500" />
              ) : (
                <Plus size={16} strokeWidth={2.5} />
              )}
              Add another vehicle
              {!isPremium && data.vehicles.length >= FREE_VEHICLE_LIMIT && (
                <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-600">
                  PREMIUM
                </span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------- header -------------------------------- */
function Header() {
  const { data, vehicle, settings, openModal, setTab } = useData();
  const { user, status, isPremium } = useAuth();
  const alertCount = vehicle ? computeAlerts(vehicle, data, settings).length : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.05] bg-[#f5f5f7]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] w-full max-w-5xl items-center gap-2 px-4">
        <button
          onClick={() => setTab("garage")}
          className="flex shrink-0 items-center gap-2"
          aria-label="AutoLog home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#0071e3] text-white shadow-sm">
            <Gauge size={19} strokeWidth={2.2} />
          </span>
          <span className="hidden text-[17px] font-bold tracking-tight text-neutral-900 min-[420px]:block">
            AutoLog
          </span>
        </button>

        <div className="flex flex-1 justify-center sm:justify-start sm:pl-3">
          <VehicleSwitcher />
        </div>

        {isPremium && (
          <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-amber-600 ring-1 ring-amber-200/60 sm:inline-flex">
            <Crown size={12} /> Premium
          </span>
        )}
        <button
          onClick={() => setTab("garage")}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-600 ring-1 ring-black/[0.06] transition hover:text-neutral-900"
          aria-label="Alerts"
        >
          <Bell size={18} />
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#f5f5f7]">
              {alertCount}
            </span>
          )}
        </button>
        <button
          onClick={() => openModal("settings")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-600 ring-1 ring-black/[0.06] transition hover:text-neutral-900"
          aria-label="Settings"
        >
          <SettingsIcon size={18} />
        </button>
        <button
          onClick={() => openModal("account")}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-sm transition hover:opacity-90"
          style={{
            background:
              status === "authed" && user
                ? avatarGradient(user.email)
                : "linear-gradient(135deg,#aeaeb2,#8e8e93)",
          }}
          aria-label="Account"
          title={status === "authed" ? user?.name : "Guest account"}
        >
          {status === "authed" && user ? initialsOf(user.name) : "G"}
          {isPremium && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-amber-400 text-white ring-2 ring-[#f5f5f7]">
              <Crown size={9} strokeWidth={3} />
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

/* --------------------------------- shell --------------------------------- */
function Shell() {
  const { tab, vehicle, modal, toast, setTab } = useData();

  return (
    <div className="min-h-dvh">
      <Header />

      <main className="mx-auto w-full max-w-5xl px-4 pb-36 pt-5 sm:pt-7">
        {tab !== "garage" && vehicle && (
          <div className="animate-fade-up mb-5">
            <h1 className="text-[27px] font-bold tracking-tight text-neutral-900">
              {tab === "fuel" && vehicle.fuelType === "Electric"
                ? "Charging & Energy"
                : TAB_TITLES[tab]}
            </h1>
            <p className="mt-0.5 text-[13.5px] text-neutral-400">
              {vehicleName(vehicle)} · {vehicle.motorisation || vehicle.fuelType} ·{" "}
              {vehicle.plate || "No plate"} · {vehicle.year}
            </p>
          </div>
        )}

        {!vehicle && tab !== "garage" ? (
          <div className="animate-fade-up rounded-[24px] bg-white px-6 py-10 text-center ring-1 ring-black/[0.04]">
            <p className="text-[15.5px] font-semibold text-neutral-900">
              Add a vehicle first
            </p>
            <p className="mx-auto mt-1 max-w-xs text-[13.5px] text-neutral-500">
              Your logs, documents and statistics are kept per vehicle.
            </p>
            <button
              onClick={() => setTab("garage")}
              className="mt-4 rounded-full bg-[#0071e3] px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              Go to garage
            </button>
          </div>
        ) : (
          <>
            {tab === "garage" && <GarageView />}
            {tab === "service" && <ServiceView />}
            {tab === "fuel" && <FuelView />}
            {tab === "documents" && <DocumentsView />}
            {tab === "stats" && <StatsView />}
          </>
        )}
      </main>

      <BottomNav />

      {/* ------------------------- global modals ------------------------- */}
      {modal.kind === "vehicle" && <VehicleFormModal />}
      {modal.kind === "service" && <ServiceFormModal />}
      {modal.kind === "fuel" && <FuelFormModal />}
      {modal.kind === "document" && <DocumentFormModal />}
      {modal.kind === "settings" && <SettingsModal />}
      {modal.kind === "pricing" && <PricingModal />}
      {modal.kind === "account" && <AccountModal />}

      {/* ------------------------------ toast ------------------------------ */}
      {toast && (
        <div className="animate-pop fixed inset-x-0 bottom-28 z-[80] flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-neutral-900/95 py-2.5 pl-3.5 pr-5 text-[13.5px] font-medium text-white shadow-xl backdrop-blur">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34c759]">
              <Check size={12} strokeWidth={3.5} />
            </span>
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- cloud data gate ---------------------------- */
function DataScreen() {
  const { loadStatus, loadError, retryLoad, isSaving, saveError, retrySave } = useData();

  if (loadStatus === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] text-[14px] font-medium text-neutral-500">
        Loading your garage…
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] px-5">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-black/[0.05]">
          <h1 className="text-lg font-bold text-neutral-900">Couldn't load your cloud garage</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{loadError}</p>
          <button
            onClick={retryLoad}
            className="mt-5 rounded-full bg-[#0071e3] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0077ed]"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <Shell />
      {(isSaving || saveError) && (
        <div className="fixed left-1/2 top-[70px] z-[90] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-neutral-900 px-4 py-2.5 text-[12px] font-medium text-white shadow-xl">
          <span className="truncate">{saveError ? "Couldn't save your changes to the cloud." : "Saving to your cloud garage…"}</span>
          {saveError && (
            <button onClick={retrySave} className="shrink-0 font-bold text-sky-300 underline">
              Retry
            </button>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------------------------- root ---------------------------------- */
function Root() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] text-[14px] font-medium text-neutral-500">
        Loading AutoLog…
      </div>
    );
  }

  // Not signed in and not browsing as guest → auth gate.
  if (status === "anon") return <AuthScreen />;

  const cloudUserId = status === "authed" && user ? user.id : undefined;
  return (
    <DataProvider
      key={cloudUserId ?? "guest"}
      cloudUserId={cloudUserId}
      cloudEmail={cloudUserId ? user?.email : undefined}
    >
      <DataScreen />
    </DataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
