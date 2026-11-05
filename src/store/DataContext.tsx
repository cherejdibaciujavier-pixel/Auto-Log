/* ------------------------------------------------------------------ */
/*  AutoLog — global data store.                                       */
/*  Signed-in users load and save their garage in Supabase. Guest data */
/*  exists only for the current in-memory session.                      */
/* ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppData,
  FuelRecord,
  ServiceRecord,
  Settings,
  Vehicle,
  VehicleDocument,
} from "../types";
import { latestKnownMileage, uid } from "../lib/utils";
import { supabase } from "../lib/supabase";

export type TabKey = "garage" | "service" | "fuel" | "documents" | "stats";
export type ModalKind =
  | "vehicle"
  | "service"
  | "fuel"
  | "document"
  | "settings"
  | "pricing"
  | "account"
  | null;

interface ModalState {
  kind: ModalKind;
  /** Record id when the modal is opened in edit mode. */
  editId?: string;
}

interface DataContextValue {
  data: AppData;
  loadStatus: "loading" | "ready" | "error";
  loadError: string | null;
  isSaving: boolean;
  saveError: string | null;
  retryLoad: () => void;
  retrySave: () => void;
  vehicle: Vehicle | null;
  settings: Settings;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  modal: ModalState;
  openModal: (kind: Exclude<ModalKind, null>, editId?: string) => void;
  closeModal: () => void;
  toast: string | null;
  notify: (msg: string) => void;

  setActiveVehicle: (id: string) => void;
  addVehicle: (v: Omit<Vehicle, "id" | "createdAt">) => void;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;

  addService: (r: Omit<ServiceRecord, "id">) => void;
  updateService: (id: string, patch: Partial<ServiceRecord>) => void;
  deleteService: (id: string) => void;

  addFuel: (r: Omit<FuelRecord, "id">) => void;
  updateFuel: (id: string, patch: Partial<FuelRecord>) => void;
  deleteFuel: (id: string) => void;

  addDocument: (d: Omit<VehicleDocument, "id">) => void;
  updateDocument: (id: string, patch: Partial<VehicleDocument>) => void;
  deleteDocument: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  clearAll: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function emptyAppData(): AppData {
  return {
    vehicles: [],
    services: [],
    fuel: [],
    documents: [],
    settings: {
      currency: "EUR",
      unit: "km",
      serviceIntervalKm: 15000,
      serviceIntervalDays: 365,
    },
    activeVehicleId: null,
  };
}

const CLOUD_DATA_TABLE = "user_app_data";
const LEGACY_USERS_KEY = "autolog-users-v2";

function storageKeyFor(storageId: string): string {
  return `autolog-db-v2:${storageId}`;
}

function parseAppData(value: unknown): AppData | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<AppData>;
  if (
    !Array.isArray(parsed.vehicles) ||
    !Array.isArray(parsed.services) ||
    !Array.isArray(parsed.fuel) ||
    !Array.isArray(parsed.documents)
  ) return null;

  const defaults = emptyAppData();
  return {
    ...defaults,
    ...parsed,
    settings: { ...defaults.settings, ...parsed.settings },
  };
}

function readLocalData(key: string): AppData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseAppData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function findLegacyAccountData(email: string): { storageKey: string; data: AppData } | null {
  try {
    const rawUsers = localStorage.getItem(LEGACY_USERS_KEY);
    const users = rawUsers ? JSON.parse(rawUsers) as Array<{ id?: string; email?: string }> : [];
    const legacyUser = users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (!legacyUser?.id) return null;
    const storageKey = storageKeyFor(legacyUser.id);
    const data = readLocalData(storageKey);
    return data ? { storageKey, data } : null;
  } catch {
    return null;
  }
}

function removeMigratedLegacyAccount(email: string, storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
    const rawUsers = localStorage.getItem(LEGACY_USERS_KEY);
    const users = rawUsers ? JSON.parse(rawUsers) as Array<{ email?: string }> : [];
    const remaining = users.filter((candidate) => candidate.email?.toLowerCase() !== email.toLowerCase());
    if (remaining.length) localStorage.setItem(LEGACY_USERS_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(LEGACY_USERS_KEY);
  } catch {
    // Cloud data is already saved; cleanup of old demo credentials is best-effort.
  }
}

export function DataProvider({
  children,
  cloudUserId,
  cloudEmail,
}: {
  children: ReactNode;
  cloudUserId?: string;
  cloudEmail?: string;
}) {
  const [data, setData] = useState<AppData>(emptyAppData);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    cloudUserId ? "loading" : "ready",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [tab, setTab] = useState<TabKey>("garage");
  const [modal, setModal] = useState<ModalState>({ kind: null });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!cloudUserId) {
      setData(emptyAppData());
      setLoadError(null);
      setLoadStatus("ready");
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);

    const loadCloudData = async () => {
      const { data: row, error } = await supabase
        .from(CLOUD_DATA_TABLE)
        .select("app_data")
        .eq("user_id", cloudUserId)
        .maybeSingle();
      if (error) throw error;

      let nextData: AppData;
      let migratedLegacy: { storageKey: string; data: AppData } | null = null;
      if (row) {
        const parsed = parseAppData(row.app_data);
        if (!parsed) throw new Error("The saved garage data is invalid and could not be loaded safely.");
        nextData = parsed;
      } else {
        migratedLegacy = cloudEmail ? findLegacyAccountData(cloudEmail) : null;
        nextData = readLocalData(storageKeyFor(cloudUserId)) ?? migratedLegacy?.data ?? emptyAppData();
        const { error: insertError } = await supabase
          .from(CLOUD_DATA_TABLE)
          .upsert({ user_id: cloudUserId, app_data: nextData, updated_at: new Date().toISOString() });
        if (insertError) throw insertError;

        // Remove old browser-only data only after the cloud copy succeeds.
        try {
          localStorage.removeItem(storageKeyFor(cloudUserId));
        } catch {
          // Cloud storage is already authoritative.
        }
        if (migratedLegacy && cloudEmail) {
          removeMigratedLegacyAccount(cloudEmail, migratedLegacy.storageKey);
        }
      }

      if (cancelled) return;
      setData(nextData);
      setLoadStatus("ready");
    };

    void loadCloudData().catch((error: unknown) => {
      if (cancelled) return;
      setLoadError(error instanceof Error ? error.message : "Unable to load your cloud garage.");
      setLoadStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [cloudUserId, cloudEmail, loadAttempt]);

  useEffect(() => {
    if (loadStatus !== "ready") return;

    if (!cloudUserId) return;

    const snapshot = data;
    const timeout = window.setTimeout(() => {
      setIsSaving(true);
      const request = saveQueue.current.catch(() => undefined).then(async () => {
        const { error } = await supabase
          .from(CLOUD_DATA_TABLE)
          .upsert({
            user_id: cloudUserId,
            app_data: snapshot,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      });
      saveQueue.current = request;
      void request.then(
        () => {
          setIsSaving(false);
          setSaveError(null);
        },
        (error: unknown) => {
          setIsSaving(false);
          setSaveError(error instanceof Error ? error.message : "Unable to save your cloud garage.");
        },
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [data, cloudUserId, loadStatus, saveAttempt]);

  const retryLoad = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);
  const retrySave = useCallback(() => {
    setSaveError(null);
    setSaveAttempt((attempt) => attempt + 1);
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const openModal = useCallback(
    (kind: Exclude<ModalKind, null>, editId?: string) =>
      setModal({ kind, editId }),
    [],
  );
  const closeModal = useCallback(() => setModal({ kind: null }), []);

  /* ------------------------------ vehicles ------------------------------ */
  const setActiveVehicle = useCallback((id: string) => {
    setData((d) => ({ ...d, activeVehicleId: id }));
  }, []);

  const addVehicle = useCallback(
    (v: Omit<Vehicle, "id" | "createdAt">) => {
      const vehicle: Vehicle = { ...v, id: uid(), createdAt: Date.now() };
      setData((d) => ({
        ...d,
        vehicles: [...d.vehicles, vehicle],
        activeVehicleId: vehicle.id,
      }));
      notify("Vehicle added to your garage");
    },
    [notify],
  );

  const updateVehicle = useCallback(
    (id: string, patch: Partial<Vehicle>) => {
      setData((d) => ({
        ...d,
        vehicles: d.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      }));
      notify("Vehicle updated");
    },
    [notify],
  );

  const deleteVehicle = useCallback(
    (id: string) => {
      setData((d) => {
        const vehicles = d.vehicles.filter((v) => v.id !== id);
        return {
          ...d,
          vehicles,
          services: d.services.filter((r) => r.vehicleId !== id),
          fuel: d.fuel.filter((r) => r.vehicleId !== id),
          documents: d.documents.filter((r) => r.vehicleId !== id),
          activeVehicleId:
            d.activeVehicleId === id
              ? (vehicles[0]?.id ?? null)
              : d.activeVehicleId,
        };
      });
      notify("Vehicle removed");
    },
    [notify],
  );

  /* ------------------------------ services ------------------------------ */
  /** Keep the vehicle odometer in sync with the newest evidence. */
  const bumpMileage = (d: AppData, vehicleId: string): AppData => {
    const known = latestKnownMileage(vehicleId, d);
    if (known === 0) return d;
    return {
      ...d,
      vehicles: d.vehicles.map((v) =>
        v.id === vehicleId && known > v.mileage ? { ...v, mileage: known } : v,
      ),
    };
  };

  const addService = useCallback(
    (r: Omit<ServiceRecord, "id">) => {
      setData((d) =>
        bumpMileage(
          { ...d, services: [...d.services, { ...r, id: uid() }] },
          r.vehicleId,
        ),
      );
      notify("Service record saved");
    },
    [notify],
  );
  const updateService = useCallback(
    (id: string, patch: Partial<ServiceRecord>) => {
      setData((d) => {
        const rec = d.services.find((r) => r.id === id);
        const next = {
          ...d,
          services: d.services.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        };
        return rec ? bumpMileage(next, rec.vehicleId) : next;
      });
      notify("Service record updated");
    },
    [notify],
  );
  const deleteService = useCallback(
    (id: string) => {
      setData((d) => ({ ...d, services: d.services.filter((r) => r.id !== id) }));
      notify("Service record deleted");
    },
    [notify],
  );

  /* -------------------------------- fuel -------------------------------- */
  const addFuel = useCallback(
    (r: Omit<FuelRecord, "id">) => {
      setData((d) =>
        bumpMileage({ ...d, fuel: [...d.fuel, { ...r, id: uid() }] }, r.vehicleId),
      );
      notify("Fuel log saved");
    },
    [notify],
  );
  const updateFuel = useCallback(
    (id: string, patch: Partial<FuelRecord>) => {
      setData((d) => {
        const rec = d.fuel.find((r) => r.id === id);
        const next = {
          ...d,
          fuel: d.fuel.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        };
        return rec ? bumpMileage(next, rec.vehicleId) : next;
      });
      notify("Fuel log updated");
    },
    [notify],
  );
  const deleteFuel = useCallback(
    (id: string) => {
      setData((d) => ({ ...d, fuel: d.fuel.filter((r) => r.id !== id) }));
      notify("Fuel log deleted");
    },
    [notify],
  );

  /* ------------------------------ documents ------------------------------ */
  const addDocument = useCallback(
    (doc: Omit<VehicleDocument, "id">) => {
      setData((d) => ({ ...d, documents: [...d.documents, { ...doc, id: uid() }] }));
      notify("Document saved");
    },
    [notify],
  );
  const updateDocument = useCallback(
    (id: string, patch: Partial<VehicleDocument>) => {
      setData((d) => ({
        ...d,
        documents: d.documents.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      }));
      notify("Document updated");
    },
    [notify],
  );
  const deleteDocument = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        documents: d.documents.filter((r) => r.id !== id),
      }));
      notify("Document deleted");
    },
    [notify],
  );

  /* ------------------------------- settings ------------------------------- */
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
      notify("Settings saved");
    },
    [notify],
  );

  const clearAll = useCallback(() => {
    setData((d) => ({
      ...d,
      vehicles: [],
      services: [],
      fuel: [],
      documents: [],
      activeVehicleId: null,
    }));
    notify("All data cleared");
  }, [notify]);

  const vehicle = useMemo(
    () =>
      data.vehicles.find((v) => v.id === data.activeVehicleId) ??
      data.vehicles[0] ??
      null,
    [data.vehicles, data.activeVehicleId],
  );

  const value: DataContextValue = {
    data,
    loadStatus,
    loadError,
    isSaving,
    saveError,
    retryLoad,
    retrySave,
    vehicle,
    settings: data.settings,
    tab,
    setTab,
    modal,
    openModal,
    closeModal,
    toast,
    notify,
    setActiveVehicle,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addService,
    updateService,
    deleteService,
    addFuel,
    updateFuel,
    deleteFuel,
    addDocument,
    updateDocument,
    deleteDocument,
    updateSettings,
    clearAll,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
