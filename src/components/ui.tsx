/* ------------------------------------------------------------------ */
/*  AutoLog — shared UI primitives (Apple-style design system).        */
/* ------------------------------------------------------------------ */

import type { ReactNode } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cog,
  Disc3,
  Droplets,
  ExternalLink,
  LifeBuoy,
  MoveVertical,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { HealthState, ServiceCategory } from "../types";
import { cn } from "../utils/cn";

/* ------------------------------- Modal ------------------------------- */
/** Bottom-sheet on mobile, centered dialog on larger screens. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional panel width override, e.g. "sm:max-w-3xl" for wide modals. */
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:mx-4 sm:rounded-[28px]",
          className,
        )}
      >
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2 className="text-[19px] font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200"
            aria-label="Close dialog"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-7 pt-2">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------- Confirm dialog --------------------------- */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div className="animate-pop relative w-full max-w-xs rounded-[24px] bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlertTriangle size={20} />
        </div>
        <h3 className="text-[16px] font-semibold text-neutral-900">{title}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-neutral-500">
          {message}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-full bg-neutral-100 py-2.5 text-[14px] font-medium text-neutral-700 transition hover:bg-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-red-500 py-2.5 text-[14px] font-semibold text-white transition hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Form bits ------------------------------ */
export const inputCls =
  "w-full rounded-xl bg-[#f5f5f7] px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none ring-[#0071e3]/30 transition focus:bg-white focus:ring-4";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[12px] text-neutral-400">{hint}</span>
      )}
    </label>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#0077ed] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Status pill ----------------------------- */
const STATE_STYLES: Record<
  HealthState,
  { pill: string; label: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    pill: "bg-emerald-50 text-emerald-600 ring-emerald-600/15",
    label: "OK",
    Icon: CheckCircle2,
  },
  soon: {
    pill: "bg-amber-50 text-amber-600 ring-amber-600/20",
    label: "Due soon",
    Icon: Clock,
  },
  overdue: {
    pill: "bg-red-50 text-red-600 ring-red-600/15",
    label: "Overdue",
    Icon: AlertTriangle,
  },
  none: {
    pill: "bg-neutral-100 text-neutral-500 ring-neutral-500/10",
    label: "No data",
    Icon: Clock,
  },
};

export function StatusPill({
  state,
  label,
}: {
  state: HealthState;
  label?: string;
}) {
  const s = STATE_STYLES[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1",
        s.pill,
      )}
    >
      <s.Icon size={12} strokeWidth={2.5} />
      {label ?? s.label}
    </span>
  );
}

/* ------------------------------ Stat card ------------------------------ */
export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "bg-blue-50 text-[#0071e3]",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]">
      <div
        className={cn(
          "mb-3 flex h-9 w-9 items-center justify-center rounded-xl",
          accent,
        )}
      >
        {icon}
      </div>
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-0.5 truncate font-display text-[21px] font-bold tracking-tight tabular-nums text-neutral-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[12px] text-neutral-400">{sub}</p>}
    </div>
  );
}

/* ----------------------------- Section head ----------------------------- */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between first:mt-0">
      <h2 className="text-[19px] font-bold tracking-tight text-neutral-900">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ------------------------------ Empty state ------------------------------ */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[24px] bg-white px-6 py-10 text-center ring-1 ring-black/[0.04]">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f7] text-neutral-400">
        {icon}
      </div>
      <p className="text-[15.5px] font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 max-w-xs text-[13.5px] leading-relaxed text-neutral-500">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* --------------------------- Category icon --------------------------- */
const CATEGORY_ICONS: Record<ServiceCategory, typeof Droplets> = {
  "Oil & Filters": Droplets,
  "Brake Pads/Discs": Disc3,
  "Timing Belt": Cog,
  Battery: BatteryCharging,
  Tyres: LifeBuoy,
  Suspension: MoveVertical,
  "General Inspection": ClipboardCheck,
  Other: Wrench,
};

export function CategoryIcon({
  category,
  size = 17,
}: {
  category: ServiceCategory;
  size?: number;
}) {
  const Icon = CATEGORY_ICONS[category] ?? Wrench;
  return <Icon size={size} strokeWidth={2} />;
}

/* ----------------------------- License plate ----------------------------- */
/** EU-style plate chip. */
export function PlateChip({ plate, dark = false }: { plate: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md text-[12px] font-bold tracking-widest ring-1",
        dark
          ? "bg-white/95 text-neutral-900 ring-white/40"
          : "bg-white text-neutral-900 ring-black/15",
      )}
    >
      <span className="flex items-center bg-[#003399] px-1 text-[8px] font-semibold tracking-normal text-white">
        EU
      </span>
      <span className="px-2 py-0.5">{plate || "—"}</span>
    </span>
  );
}

/* --------------------- Monetization placeholders --------------------- */
/**
 * AFFILIATE SLOT — parts marketplace.
 * Replace the "#" href with your affiliate link (e.g. Amazon Associates,
 * AUTODOC / eBay Partner Network) when going live.
 */
export function PartsBanner({ vehicleName }: { vehicleName: string }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0071e3] to-[#42a5f5] p-5 text-white shadow-[0_8px_24px_rgba(0,113,227,0.25)]">
      <Sparkles
        className="absolute -right-3 -top-3 text-white/15"
        size={110}
        strokeWidth={1}
      />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">
        Sponsored · Parts marketplace
      </p>
      <h3 className="mt-1.5 max-w-[85%] text-[17px] font-bold leading-snug tracking-tight">
        Need replacement parts for this service?
      </h3>
      <p className="mt-1 max-w-[85%] text-[13px] leading-relaxed text-white/85">
        Compare compatible filters &amp; oil for your {vehicleName} and save up
        to 30%.
      </p>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#0071e3] transition hover:bg-white/90"
      >
        Compare compatible parts <ExternalLink size={14} />
      </a>
    </div>
  );
}

/**
 * AFFILIATE SLOT — insurance comparison.
 * Replace the "#" href with your comparison-partner link (e.g. Check24,
 * CompareTheMarket) when going live.
 */
export function InsuranceCta() {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0a84ff] via-[#30b0c7] to-[#30d158] p-5 text-white shadow-[0_8px_24px_rgba(10,132,255,0.22)]">
      <ShieldCheck
        className="absolute -right-3 -top-3 text-white/15"
        size={110}
        strokeWidth={1}
      />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">
        Sponsored · Insurance comparison
      </p>
      <h3 className="mt-1.5 max-w-[85%] text-[17px] font-bold leading-snug tracking-tight">
        Your policy could be cheaper
      </h3>
      <p className="mt-1 max-w-[85%] text-[13px] leading-relaxed text-white/85">
        Drivers save an average of €214/yr by switching. Compare 100+ insurers
        in under 3 minutes.
      </p>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#0a7d8c] transition hover:bg-white/90"
      >
        Compare &amp; renew policy <ExternalLink size={14} />
      </a>
    </div>
  );
}
