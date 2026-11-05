/* ------------------------------------------------------------------ */
/*  AutoLog — all create/edit form modals + settings.                  */
/*  Forms work in the user's *display* units and convert to the        */
/*  canonical storage units (km / litres) on save.                     */
/* ------------------------------------------------------------------ */

import { useMemo, useState, type ReactNode } from "react";
import {
  ClipboardCheck,
  Crown,
  Download,
  Receipt,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  CurrencyCode,
  DocumentType,
  FuelType,
  ServiceCategory,
} from "../types";
import { DOCUMENT_META, SERVICE_CATEGORIES } from "../types";
import { useData } from "../store/DataContext";
import { useAuth } from "../store/AuthContext";
import { getMakes, getModels, getMotorisations } from "../lib/vehicleCatalog";
import NearbyStations, { type StationSelection } from "./NearbyStations";
import { FUEL_GRADES, formatStationPrice } from "../lib/stations";
import {
  computeFuelStats,
  distanceUnitLabel,
  fmtCurrency,
  fmtDistance,
  fmtNum,
  fmtUnitPrice,
  kmToUnit,
  todayISO,
  unitToKm,
  unitToVolume,
  volumeToUnit,
  volumeUnitLabel,
} from "../lib/utils";
import { ConfirmDialog, Field, inputCls, Modal, PrimaryButton } from "./ui";
import { cn } from "../utils/cn";

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

const num = (v: string): number => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------- Segmented control ------------------------- */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-full bg-[#f5f5f7] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-full py-1.5 text-[13.5px] font-medium transition",
            value === o.value
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-red-50 py-3 text-[14.5px] font-semibold text-red-600 transition hover:bg-red-100"
    >
      <Trash2 size={16} /> Delete record
    </button>
  );
}

/* ------------------------------ Vehicle ------------------------------ */
export function VehicleFormModal() {
  const { data, modal, closeModal, addVehicle, updateVehicle, deleteVehicle, settings } =
    useData();
  const editing = data.vehicles.find((v) => v.id === modal.editId) ?? null;

  const [make, setMake] = useState(editing?.make ?? "");
  const [model, setModel] = useState(editing?.model ?? "");
  const [motorisation, setMotorisation] = useState(editing?.motorisation ?? "");
  const [motorisationChoice, setMotorisationChoice] = useState(() => {
    if (!editing?.motorisation) return "";
    const match = getMotorisations(editing.make, editing.model, data.vehicles).find(
      (option) => option.label.toLowerCase() === editing.motorisation?.trim().toLowerCase(),
    );
    return match?.label ?? "__custom__";
  });
  const [year, setYear] = useState(String(editing?.year ?? new Date().getFullYear()));
  const [fuelType, setFuelType] = useState<FuelType>(editing?.fuelType ?? "Petrol");
  const [mileage, setMileage] = useState(
    editing ? String(Math.round(kmToUnit(editing.mileage, settings))) : "",
  );
  const [plate, setPlate] = useState(editing?.plate ?? "");
  const [vin, setVin] = useState(editing?.vin ?? "");
  const [image, setImage] = useState(editing?.image ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const makes = getMakes(data.vehicles);
  const models = getModels(make, data.vehicles);
  const motorisations = getMotorisations(make, model, data.vehicles);
  const valid = make.trim() !== "" && model.trim() !== "" && motorisation.trim() !== "";

  const changeMake = (value: string) => {
    if (value.trim().toLowerCase() !== make.trim().toLowerCase()) {
      setModel("");
      setMotorisation("");
      setMotorisationChoice("");
    }
    setMake(value);
  };

  const changeModel = (value: string) => {
    if (value.trim().toLowerCase() !== model.trim().toLowerCase()) {
      setMotorisation("");
      setMotorisationChoice("");
    }
    setModel(value);
  };

  const changeMotorisation = (value: string) => {
    setMotorisationChoice(value);
    const option = motorisations.find((entry) => entry.label === value);
    setMotorisation(option?.label ?? "");
    if (option) setFuelType(option.fuelType);
  };

  const submit = () => {
    if (!valid) return;
    const payload = {
      make: make.trim(),
      model: model.trim(),
      motorisation: motorisation.trim(),
      year: Math.min(2100, Math.max(1950, num(year) || new Date().getFullYear())),
      fuelType,
      mileage: Math.max(0, Math.round(unitToKm(num(mileage), settings))),
      plate: plate.trim().toUpperCase(),
      vin: vin.trim().toUpperCase(),
      image: image.trim() || undefined,
    };
    if (editing) updateVehicle(editing.id, payload);
    else addVehicle(payload);
    closeModal();
  };

  return (
    <>
      <Modal
        open
        onClose={closeModal}
        title={editing ? "Edit vehicle" : "Add vehicle"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make" hint="Or type any brand">
              <input className={inputCls} list="autolog-makes" value={make} onChange={(e) => changeMake(e.target.value)} placeholder="e.g. Honda" autoComplete="off" autoFocus={!editing} />
              <datalist id="autolog-makes">
                {makes.map((entry) => <option key={entry} value={entry} />)}
              </datalist>
            </Field>
            <Field label="Model" hint="Suggestions match the make">
              <input className={inputCls} list="autolog-models" value={model} onChange={(e) => changeModel(e.target.value)} placeholder="e.g. Civic" autoComplete="off" />
              <datalist id="autolog-models">
                {models.map((entry) => <option key={entry} value={entry} />)}
              </datalist>
            </Field>
          </div>
          {motorisations.length > 0 ? (
            <>
              <Field label="Motorisation" hint="Suggestions vary by year and market. Choose yours or enter it manually.">
                <select
                  className={inputCls}
                  value={motorisationChoice}
                  onChange={(e) => changeMotorisation(e.target.value)}
                >
                  <option value="" disabled>Select your engine or drivetrain</option>
                  {motorisations.map((entry) => (
                    <option key={`${entry.label}-${entry.fuelType}`} value={entry.label}>
                      {entry.label} · {entry.fuelType}
                    </option>
                  ))}
                  <option value="__custom__">Other / enter exact motorisation</option>
                </select>
              </Field>
              {motorisationChoice === "__custom__" && (
                <Field label="Exact motorisation">
                  <input className={inputCls} value={motorisation} onChange={(e) => setMotorisation(e.target.value)} placeholder="e.g. 2.0 TDI 150 hp" autoComplete="off" />
                </Field>
              )}
            </>
          ) : (
            <Field label="Motorisation" hint="Enter the exact engine or drivetrain from your vehicle documents.">
              <input className={inputCls} value={motorisation} onChange={(e) => setMotorisation(e.target.value)} placeholder="e.g. 2.0 TDI 150 hp" autoComplete="off" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input className={inputCls} type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2022" />
            </Field>
            <Field label={`Odometer (${distanceUnitLabel(settings)})`}>
              <input className={inputCls} type="number" inputMode="decimal" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="78,400" />
            </Field>
          </div>
          <Field label="Fuel type">
            <Segmented
              value={fuelType}
              onChange={setFuelType}
              options={(["Petrol", "Diesel", "Hybrid", "Electric"] as FuelType[]).map(
                (f) => ({ value: f, label: f }),
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="License plate">
              <input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="HD CTR 22" />
            </Field>
            <Field label="VIN" hint="17-character vehicle ID">
              <input className={inputCls} value={vin} onChange={(e) => setVin(e.target.value)} placeholder="SHHFK8G40NU…" maxLength={17} />
            </Field>
          </div>
          <Field label="Photo URL (optional)">
            <input className={inputCls} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
          </Field>
          <PrimaryButton type="submit" disabled={!valid}>
            {editing ? "Save changes" : "Add to garage"}
          </PrimaryButton>
          {editing && (
            <DeleteButton onDelete={() => setConfirmDelete(true)} />
          )}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this vehicle?"
        message="The vehicle and all of its service, fuel and document records will be permanently removed."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteVehicle(editing!.id);
          setConfirmDelete(false);
          closeModal();
        }}
      />
    </>
  );
}

/* ------------------------------ Service ------------------------------ */
export function ServiceFormModal() {
  const { data, modal, closeModal, vehicle, addService, updateService, deleteService, settings } =
    useData();
  const editing = data.services.find((r) => r.id === modal.editId) ?? null;

  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [mileage, setMileage] = useState(
    editing
      ? String(Math.round(kmToUnit(editing.mileage, settings)))
      : vehicle
        ? String(Math.round(kmToUnit(vehicle.mileage, settings)))
        : "",
  );
  const [category, setCategory] = useState<ServiceCategory>(
    editing?.category ?? "Oil & Filters",
  );
  const [cost, setCost] = useState(editing ? String(editing.cost) : "");
  const [workshop, setWorkshop] = useState(editing?.workshop ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!vehicle) return null;
  const valid = date !== "" && mileage !== "";

  const submit = () => {
    if (!valid) return;
    const payload = {
      vehicleId: vehicle.id,
      date,
      mileage: Math.max(0, Math.round(unitToKm(num(mileage), settings))),
      category,
      cost: Math.max(0, num(cost)),
      workshop: workshop.trim(),
      notes: notes.trim(),
    };
    if (editing) updateService(editing.id, payload);
    else addService(payload);
    closeModal();
  };

  return (
    <>
      <Modal open onClose={closeModal} title={editing ? "Edit service" : "Log service"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <Field label="Service category">
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium ring-1 transition",
                    category === c
                      ? "bg-blue-50 text-[#0071e3] ring-[#0071e3]/40"
                      : "bg-[#f5f5f7] text-neutral-600 ring-transparent hover:bg-neutral-100",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={`Odometer (${distanceUnitLabel(settings)})`}>
              <input className={inputCls} type="number" inputMode="decimal" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="0" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Total cost (${CURRENCY_SYMBOL[settings.currency]})`}>
              <input className={inputCls} type="number" inputMode="decimal" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Workshop / mechanic">
              <input className={inputCls} value={workshop} onChange={(e) => setWorkshop(e.target.value)} placeholder="Honda Zentrum" />
            </Field>
          </div>
          <Field label="Notes" hint={`Next service is auto-predicted at +${fmtNum(kmToUnit(settings.serviceIntervalKm, settings))} ${settings.unit} or ${settings.serviceIntervalDays} days.`}>
            <textarea className={cn(inputCls, "min-h-[76px] resize-none")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Parts used, warranty, observations…" />
          </Field>
          <PrimaryButton type="submit" disabled={!valid}>
            {editing ? "Save changes" : "Save service record"}
          </PrimaryButton>
          {editing && <DeleteButton onDelete={() => setConfirmDelete(true)} />}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete service record?"
        message="This entry will be removed from the service history and expense totals."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteService(editing!.id);
          setConfirmDelete(false);
          closeModal();
        }}
      />
    </>
  );
}

/* -------------------------------- Fuel -------------------------------- */
export function FuelFormModal() {
  const { data, modal, closeModal, vehicle, addFuel, updateFuel, deleteFuel, settings } =
    useData();
  const editing = data.fuel.find((r) => r.id === modal.editId) ?? null;
  const isEV = vehicle?.fuelType === "Electric";
  const volLabel = vehicle ? volumeUnitLabel(settings, isEV) : "L";

  // Form works in display units; convert back to litres/kWh on save.
  const initVol = editing
    ? volumeToUnit(editing.volume, settings, isEV)
    : 0;
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [odometer, setOdometer] = useState(
    editing
      ? String(Math.round(kmToUnit(editing.odometer, settings)))
      : vehicle
        ? String(Math.round(kmToUnit(vehicle.mileage, settings)))
        : "",
  );
  /**
   * The pump calculator is money-first: the driver enters what they paid and
   * the pump price, and the litres/kWh are derived (amount ÷ price).
   * "volume" mode is the mirror image for receipts that only list litres.
   */
  const [mode, setMode] = useState<"amount" | "volume">("amount");
  const [amount, setAmount] = useState(editing ? String(editing.totalCost) : "");
  const [price, setPrice] = useState(
    editing && initVol > 0 ? String(round3(editing.totalCost / initVol)) : "",
  );
  const [volume, setVolume] = useState(editing ? String(round2(initVol)) : "");
  const [fullTank, setFullTank] = useState(editing?.fullTank ?? true);
  const [stationNote, setStationNote] = useState<{
    tone: "ok" | "warn";
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // History powers the "typical fill" shortcut and the range estimate.
  const history = useMemo(
    () =>
      vehicle
        ? data.fuel
            .filter((r) => r.vehicleId === vehicle.id)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [data.fuel, vehicle],
  );
  const fuelStats = useMemo(() => computeFuelStats(history), [history]);
  const typicalVolume = useMemo(() => {
    const recent = history.slice(0, 5).map((r) => volumeToUnit(r.volume, settings, isEV));
    if (recent.length < 2) return null;
    return recent.reduce((t, v) => t + v, 0) / recent.length;
  }, [history, settings, isEV]);

  const priceNum = num(price);
  const amountNum = num(amount);
  const volumeNum = num(volume);

  // Derived figures — the value the user did *not* type.
  const derivedVolume =
    mode === "amount" && amountNum > 0 && priceNum > 0 ? amountNum / priceNum : null;
  const derivedAmount =
    mode === "volume" && volumeNum > 0 && priceNum > 0 ? volumeNum * priceNum : null;

  const volumeValue = mode === "amount" ? (derivedVolume ?? 0) : volumeNum;
  const amountValue = mode === "amount" ? amountNum : (derivedAmount ?? 0);
  const volumeStored = unitToVolume(volumeValue, settings, isEV);

  // Rough distance this fill-up buys, from the driver's own average.
  const rangeKm =
    fuelStats.avgConsumption && volumeStored > 0
      ? volumeStored / (fuelStats.avgConsumption / 100)
      : null;

  const gaugePct = typicalVolume
    ? Math.min(100, Math.max(0, (volumeValue / typicalVolume) * 100))
    : volumeValue > 0
      ? 100
      : 0;

  if (!vehicle) return null;
  const valid =
    date !== "" && odometer !== "" && priceNum > 0 && volumeValue > 0 && amountValue > 0;

  /**
   * Copy the pump price of the station tapped on the map into the form.
   * Prices are never currency-converted and never overwrite a receipt
   * silently — the note always tells the user what happened.
   */
  const applyStationSelection = ({ station, grade, quote }: StationSelection) => {
    const gradeLabel =
      FUEL_GRADES.find((g) => g.value === grade)?.label ?? "Fuel";
    if (isEV) {
      setStationNote({
        tone: "ok",
        text: `${station.name} selected. Charging prices aren't published, so enter the price from your receipt or app below.`,
      });
      return;
    }
    if (!quote) {
      setStationNote({
        tone: "warn",
        text: `${station.name} selected — no ${gradeLabel} price is reported for it. Enter the pump price from your receipt.`,
      });
      return;
    }
    if (quote.currency !== settings.currency) {
      setStationNote({
        tone: "warn",
        text: `${station.name} reports ${formatStationPrice(quote)}/L in ${quote.currency}. Your log uses ${settings.currency} and prices aren't converted, so enter the receipt price.`,
      });
      return;
    }
    // Station prices are per litre; the form may display per gallon.
    const displayPrice =
      settings.unit === "mi" ? quote.amount * 3.78541 : quote.amount;
    setPrice(String(round3(displayPrice)));
    // The amount the driver paid decides the litres, so recompute the preview.
    const previewVolume =
      mode === "amount" && num(amount) > 0 ? num(amount) / displayPrice : null;
    setStationNote({
      tone: "ok",
      text: previewVolume
        ? `${station.name} · ${gradeLabel} ${formatStationPrice(quote)}/${volLabel} copied → ${fmtNum(previewVolume, 1)} ${volLabel} for ${fmtCurrency(num(amount), settings.currency)}. Check it against your receipt.`
        : `${station.name} · ${gradeLabel} ${formatStationPrice(quote)}/${volLabel} copied. Now enter what you paid and the ${isEV ? "kWh" : "litres"} are worked out for you.`,
    });
  };

  const submit = () => {
    if (!valid) return;
    const totalCost = Math.max(0, round2(amountValue));
    const payload = {
      vehicleId: vehicle.id,
      date,
      volume: Math.round(volumeStored * 100) / 100,
      pricePerUnit: volumeStored > 0 ? totalCost / volumeStored : 0,
      totalCost,
      odometer: Math.max(0, Math.round(unitToKm(num(odometer), settings))),
      fullTank,
    };
    if (editing) updateFuel(editing.id, payload);
    else addFuel(payload);
    closeModal();
  };

  return (
    <>
      <Modal
        open
        onClose={closeModal}
        title={editing ? (isEV ? "Edit charge" : "Edit fill-up") : isEV ? "Log charging" : "Log fill-up"}
        className={editing ? undefined : "sm:max-w-3xl"}
      >
        <div className="space-y-4">
          {/* Nearby-station picker — also how the Garage "Fuel" shortcut
              surfaces the live map before logging. New logs only: editing a
              historical record shouldn't re-price it from today's map. */}
          {!editing && (
            <NearbyStations
              key={vehicle.id}
              fuelType={vehicle.fuelType}
              unit={settings.unit}
              variant="picker"
              onStationSelect={applyStationSelection}
            />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
          {stationNote && (
            <p
              role="status"
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                stationNote.tone === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              {stationNote.text}
            </p>
          )}
          {/* --------------------- pump calculator --------------------- */}
          <div className="overflow-hidden rounded-[22px] bg-[#f5f5f7] ring-1 ring-black/[0.05]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pt-3.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                {isEV ? "Charging calculator" : "Pump calculator"}
              </p>
              <div
                className="flex rounded-full bg-white p-0.5 ring-1 ring-black/[0.06]"
                role="group"
                aria-label="What you are entering"
              >
                {(
                  [
                    ["amount", `Money → ${volLabel}`],
                    ["volume", `${volLabel} → Money`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition",
                      mode === value
                        ? "bg-[#0071e3] text-white shadow-sm"
                        : "text-neutral-500 hover:text-neutral-800",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* the two numbers the driver actually knows */}
            <div className="grid grid-cols-2 gap-3 px-3.5 pt-3">
              {mode === "amount" ? (
                <Field label={`Amount spent (${CURRENCY_SYMBOL[settings.currency]})`} hint="What the pump charged you">
                  <input
                    className={cn(inputCls, "font-display text-[19px] font-bold tabular-nums")}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus={!editing}
                    aria-describedby="fuel-derived"
                  />
                </Field>
              ) : (
                <Field label={isEV ? `Energy (${volLabel})` : `Volume (${volLabel})`} hint="From your receipt">
                  <input
                    className={cn(inputCls, "font-display text-[19px] font-bold tabular-nums")}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="45.0"
                    autoFocus={!editing}
                    aria-describedby="fuel-derived"
                  />
                </Field>
              )}
              <Field label={`Price per ${volLabel} (${CURRENCY_SYMBOL[settings.currency]})`} hint="Shown on the pump">
                <input
                  className={cn(inputCls, "font-display text-[19px] font-bold tabular-nums")}
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1.79"
                />
              </Field>
            </div>

            {/* quick amounts + typical fill */}
            <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-3">
              {[20, 40, 60, 80].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode("amount");
                    setAmount(String(value));
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition active:scale-95",
                    mode === "amount" && amountNum === value
                      ? "bg-white text-[#0071e3] ring-[#0071e3]/40"
                      : "bg-white/60 text-neutral-500 ring-black/[0.06] hover:bg-white hover:text-neutral-800",
                  )}
                >
                  {CURRENCY_SYMBOL[settings.currency]}{value}
                </button>
              ))}
              {typicalVolume && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("volume");
                    setVolume(String(round2(typicalVolume)));
                  }}
                  className={cn(
                    "ml-auto rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition active:scale-95",
                    mode === "volume"
                      ? "bg-white text-[#0071e3] ring-[#0071e3]/40"
                      : "bg-white/60 text-neutral-500 ring-black/[0.06] hover:bg-white hover:text-neutral-800",
                  )}
                >
                  Typical {fmtNum(typicalVolume, 1)} {volLabel}
                </button>
              )}
            </div>

            {/* derived readout */}
            <div id="fuel-derived" className="relative mt-3.5 overflow-hidden bg-[#14161a] px-4 py-4 text-white">
              {/* ambient corner glow, kept inside the panel bounds */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(115%_120%_at_100%_0%,rgba(10,132,255,0.30),transparent_58%)]"
              />
              <p className="relative text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/60">
                {mode === "amount"
                  ? isEV
                    ? "Calculated energy"
                    : "Calculated volume"
                  : "Calculated amount"}
              </p>
              <div className="relative mt-1.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                <p
                  key={`${mode}-${round2(mode === "amount" ? volumeValue : amountValue)}`}
                  className="animate-num font-display text-[34px] font-bold leading-none tracking-tight tabular-nums"
                >
                  {mode === "amount" ? (
                    <>
                      {fmtNum(volumeValue, volumeValue >= 100 ? 0 : 1)}
                      <span className="ml-1.5 text-[15px] font-semibold text-white/60">
                        {volLabel}
                      </span>
                    </>
                  ) : (
                    fmtCurrency(amountValue, settings.currency)
                  )}
                </p>
                <p className="text-right text-[12px] leading-snug text-white/65">
                  {priceNum > 0
                    ? // Pump prices carry three decimals; totals carry two.
                      mode === "amount"
                      ? `${fmtCurrency(amountValue, settings.currency)} ÷ ${fmtUnitPrice(priceNum, settings.currency)}/${volLabel}`
                      : `${fmtNum(volumeValue, 1)} ${volLabel} × ${fmtUnitPrice(priceNum, settings.currency)}`
                    : `Enter the price per ${volLabel} to continue`}
                </p>
              </div>

              {/* fill gauge against the driver's own typical fill-up */}
              <div className="relative mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/[0.14]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0a84ff] to-[#30d158] transition-[width] duration-500 ease-out"
                  style={{ width: `${gaugePct}%` }}
                />
              </div>
              <div className="relative mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11.5px] text-white/60">
                <span>
                  {rangeKm
                    ? `≈ ${fmtDistance(rangeKm, settings)} on your average ${fmtNum(fuelStats.avgConsumption!, 1)} ${isEV ? "kWh" : "L"}/100 ${settings.unit}`
                    : `Log two fill-ups to see the range this buys you`}
                </span>
                {typicalVolume && volumeValue > 0 && (
                  <span className="tabular-nums">
                    {Math.round(gaugePct)}% of your typical {fmtNum(typicalVolume, 1)} {volLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={`Odometer (${distanceUnitLabel(settings)})`}>
              <input className={inputCls} type="number" inputMode="decimal" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="0" />
            </Field>
          </div>
          <button
            type="button"
            onClick={() => setFullTank((f) => !f)}
            className="flex w-full items-center justify-between rounded-xl bg-[#f5f5f7] px-3.5 py-3"
          >
            <span className="text-left">
              <span className="block text-[14px] font-medium text-neutral-800">
                {isEV ? "Charged to 100%" : "Filled to full tank"}
              </span>
              <span className="block text-[12px] text-neutral-400">
                Improves consumption accuracy
              </span>
            </span>
            <span
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition",
                fullTank ? "bg-[#34c759]" : "bg-neutral-300",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all",
                  fullTank ? "left-[22px]" : "left-0.5",
                )}
              />
            </span>
          </button>
          <PrimaryButton type="submit" disabled={!valid}>
            {editing
              ? "Save changes"
              : valid
                ? // Confirm the derived figures right on the action itself.
                  `Save ${fmtNum(volumeValue, 1)} ${volLabel} · ${fmtCurrency(amountValue, settings.currency)}`
                : isEV
                  ? "Save charging log"
                  : "Save fill-up"}
          </PrimaryButton>
          {editing && <DeleteButton onDelete={() => setConfirmDelete(true)} />}
          </form>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this log?"
        message="Consumption and cost-per-kilometre statistics will be recalculated."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteFuel(editing!.id);
          setConfirmDelete(false);
          closeModal();
        }}
      />
    </>
  );
}

/* ------------------------------ Document ------------------------------ */
const DOC_ICONS: Record<DocumentType, typeof ShieldCheck> = {
  inspection: ClipboardCheck,
  insurance: ShieldCheck,
  roadtax: Receipt,
};

export function DocumentFormModal() {
  const { data, modal, closeModal, vehicle, addDocument, updateDocument, deleteDocument, settings } =
    useData();
  const editing = data.documents.find((r) => r.id === modal.editId) ?? null;

  const [type, setType] = useState<DocumentType>(editing?.type ?? "insurance");
  const [provider, setProvider] = useState(editing?.provider ?? "");
  const [expiryDate, setExpiryDate] = useState(editing?.expiryDate ?? todayISO());
  const [cost, setCost] = useState(editing ? String(editing.cost) : "");
  const [reference, setReference] = useState(editing?.reference ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!vehicle) return null;
  const valid = expiryDate !== "";

  const submit = () => {
    if (!valid) return;
    const payload = {
      vehicleId: vehicle.id,
      type,
      provider: provider.trim(),
      expiryDate,
      cost: Math.max(0, num(cost)),
      reference: reference.trim(),
      notes: notes.trim(),
    };
    if (editing) updateDocument(editing.id, payload);
    else addDocument(payload);
    closeModal();
  };

  return (
    <>
      <Modal open onClose={closeModal} title={editing ? "Edit document" : "Add document"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <Field label="Document type">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DOCUMENT_META) as DocumentType[]).map((t) => {
                const Icon = DOC_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 ring-1 transition",
                      type === t
                        ? "bg-blue-50 text-[#0071e3] ring-[#0071e3]/40"
                        : "bg-[#f5f5f7] text-neutral-500 ring-transparent hover:bg-neutral-100",
                    )}
                  >
                    <Icon size={19} />
                    <span className="text-center text-[11.5px] font-medium leading-tight">
                      {DOCUMENT_META[t].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={type === "insurance" ? "Insurer" : type === "inspection" ? "Test centre / authority" : "Authority"}>
            <input className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={type === "insurance" ? "Allianz" : type === "inspection" ? "TÜV SÜD" : "Tax office"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry date">
              <input className={inputCls} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </Field>
            <Field label={`Amount paid (${CURRENCY_SYMBOL[settings.currency]})`} hint="Counted in Insurance & Taxes">
              <input className={inputCls} type="number" inputMode="decimal" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
          <Field label="Policy / reference no.">
            <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="POL-12345" />
          </Field>
          <Field label="Notes">
            <textarea className={cn(inputCls, "min-h-[64px] resize-none")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cover level, excess, remarks…" />
          </Field>
          <PrimaryButton type="submit" disabled={!valid}>
            {editing ? "Save changes" : "Save document"}
          </PrimaryButton>
          {editing && <DeleteButton onDelete={() => setConfirmDelete(true)} />}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete document?"
        message="Expiration reminders for this document will stop."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteDocument(editing!.id);
          setConfirmDelete(false);
          closeModal();
        }}
      />
    </>
  );
}

/* ------------------------------ Settings ------------------------------ */
export function SettingsModal() {
  const { data, closeModal, openModal, settings, updateSettings, clearAll, notify } =
    useData();
  const { isPremium, user } = useAuth();
  const [intervalKm, setIntervalKm] = useState(
    String(Math.round(kmToUnit(settings.serviceIntervalKm, settings))),
  );
  const [intervalDays, setIntervalDays] = useState(
    String(settings.serviceIntervalDays),
  );
  const [confirmClear, setConfirmClear] = useState(false);

  /** Premium feature: full JSON backup of the active garage. */
  const exportBackup = () => {
    if (!isPremium) {
      openModal("pricing");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autolog-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Backup downloaded");
  };

  const dirty =
    num(intervalKm) !== Math.round(kmToUnit(settings.serviceIntervalKm, settings)) ||
    num(intervalDays) !== settings.serviceIntervalDays;

  return (
    <>
      <Modal open onClose={closeModal} title="Settings">
        <div className="space-y-5">
          <Field label="Currency">
            <Segmented
              value={settings.currency}
              onChange={(currency) => updateSettings({ currency })}
              options={[
                { value: "EUR" as CurrencyCode, label: "€ EUR" },
                { value: "USD" as CurrencyCode, label: "$ USD" },
                { value: "GBP" as CurrencyCode, label: "£ GBP" },
              ]}
            />
          </Field>
          <Field label="Distance unit" hint="Stored data stays in km — only the display changes.">
            <Segmented
              value={settings.unit}
              onChange={(unit) => updateSettings({ unit })}
              options={[
                { value: "km" as const, label: "Kilometres" },
                { value: "mi" as const, label: "Miles" },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Service interval (${settings.unit})`}>
              <input className={inputCls} type="number" inputMode="numeric" value={intervalKm} onChange={(e) => setIntervalKm(e.target.value)} />
            </Field>
            <Field label="…or every (days)">
              <input className={inputCls} type="number" inputMode="numeric" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
            </Field>
          </div>
          {dirty && (
            <PrimaryButton
              onClick={() => {
                updateSettings({
                  serviceIntervalKm: Math.max(
                    1000,
                    Math.round(unitToKm(num(intervalKm), settings)),
                  ),
                  serviceIntervalDays: Math.max(30, Math.round(num(intervalDays))),
                });
              }}
            >
              Save interval
            </PrimaryButton>
          )}

          <div className="rounded-2xl bg-[#f5f5f7] p-4">
            <p className="text-[13.5px] font-semibold text-neutral-800">Your data</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500">
              {user
                ? "Your garage is securely stored in Supabase and syncs with your account."
                : "Guest data is held only for this session and is not saved or uploaded."}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={exportBackup}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13.5px] font-medium text-neutral-700 ring-1 ring-black/5 transition hover:bg-neutral-50"
              >
                <Download size={14} />
                Backup (JSON)
                {!isPremium && <Crown size={13} className="text-amber-500" />}
              </button>
              <button
                onClick={() => setConfirmClear(true)}
                className="flex-1 rounded-full bg-white py-2.5 text-[13.5px] font-medium text-red-600 ring-1 ring-red-100 transition hover:bg-red-50"
              >
                Erase everything
              </button>
            </div>
          </div>
          <p className="text-center text-[11.5px] text-neutral-400">
            AutoLog v1.1 · Add to Home Screen for the full PWA experience
          </p>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmClear}
        title="Erase all data?"
        message="All vehicles and records in this garage will be permanently deleted. This cannot be undone."
        confirmLabel="Erase"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAll();
          setConfirmClear(false);
          closeModal();
          notify("All data erased");
        }}
      />
    </>
  );
}

/* ------------------------------ helpers ------------------------------ */
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Re-export for views that need memo-friendly derived lists.
export function useVehicleRecords() {
  const { data, vehicle } = useData();
  return useMemo(() => {
    if (!vehicle) return { services: [], fuel: [], documents: [] };
    return {
      services: data.services
        .filter((r) => r.vehicleId === vehicle.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
      fuel: data.fuel
        .filter((r) => r.vehicleId === vehicle.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
      documents: data.documents
        .filter((r) => r.vehicleId === vehicle.id)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    };
  }, [data, vehicle]);
}
