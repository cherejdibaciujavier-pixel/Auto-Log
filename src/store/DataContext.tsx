/* ------------------------------------------------------------------ */
/*  AutoLog — global data store.                                       */
/*  Persists the whole AppData object to localStorage (zero-backend    */
/*  MVP). The CRUD surface below is intentionally shaped like a REST   */
/*  client so it can be swapped for Supabase later without touching    */
/*  the views.                                                         */
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

/** Every account starts with a completely empty garage. */
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

function storageKeyFor(storageId: string): string {
  return `autolog-db-v2:${storageId}`;
}

function loadInitialData(storageId: string): AppData {
  try {
    const raw = localStorage.getItem(storageKeyFor(storageId));
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && Array.isArray(parsed.vehicles)) {
        return { ...emptyAppData(), ...parsed };
      }
    }
  } catch {
    /* corrupted storage → start empty */
  }
  return emptyAppData();
}

export function DataProvider({
  children,
  storageId,
}: {
  children: ReactNode;
  /** Account id (or "guest") — isolates each user's database. */
  storageId: string;
}) {
  const [data, setData] = useState<AppData>(() => loadInitialData(storageId));
  const [tab, setTab] = useState<TabKey>("garage");
  const [modal, setModal] = useState<ModalState>({ kind: null });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  /* Persist every mutation (debounce-free: payloads are tiny). */
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyFor(storageId), JSON.stringify(data));
    } catch {
      /* storage full / private mode — app keeps working in-memory */
    }
  }, [data, storageId]);

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
