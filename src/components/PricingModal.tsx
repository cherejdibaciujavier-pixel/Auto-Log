/* ------------------------------------------------------------------ */
/*  AutoLog Premium — pricing, mock checkout and plan management.      */
/*  Checkout is simulated client-side (no real charge). Connect        */
/*  Stripe Checkout here in production and mirror the resulting        */
/*  subscription onto the user record via webhook.                     */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import {
  BadgeCheck,
  Check,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import {
  FREE_FEATURES,
  PLAN_PRICES,
  PREMIUM_FEATURES,
  useAuth,
  type PlanCycle,
} from "../store/AuthContext";
import { useData } from "../store/DataContext";
import { fmtDate } from "../lib/utils";
import { Field, Modal, inputCls } from "./ui";
import { cn } from "../utils/cn";

type Step = "plans" | "checkout" | "processing" | "success";

/* input formatters for the mock card form */
const fmtCard = (v: string) =>
  v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const fmtExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export default function PricingModal() {
  const { closeModal, notify } = useData();
  const {
    user,
    status,
    isPremium,
    lifetimePremium,
    redeemLifetimeCode,
    subscribe,
    setAutoRenew,
    exitToAuth,
  } = useAuth();

  const [cycle, setCycle] = useState<PlanCycle>(
    user?.subscription?.cycle ?? "yearly",
  );
  const [step, setStep] = useState<Step>("plans");
  const [cardName, setCardName] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [redeemingCode, setRedeemingCode] = useState(false);

  const sub = user?.subscription ?? null;

  const startCheckout = () => {
    if (!user) return; // guests are prompted to create an account first
    setError(null);
    setStep("checkout");
  };

  const pay = () => {
    const digits = cardNum.replace(/\D/g, "");
    if (cardName.trim().length < 2) return setError("Enter the name on the card.");
    if (digits.length < 15) return setError("Enter a valid card number (try 4242 4242 4242 4242).");
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError("Enter the expiry as MM/YY.");
    if (cvc.replace(/\D/g, "").length < 3) return setError("Enter the 3-digit CVC.");
    setError(null);
    setStep("processing");
    // Simulated payment processing → activate subscription.
    window.setTimeout(() => {
      subscribe(cycle);
      setStep("success");
    }, 1400);
  };

  return (
    <Modal open onClose={closeModal} title="AutoLog Premium">
      {/* ------------------------- manage current plan ------------------------- */}
      {lifetimePremium ? (
        <div className="rounded-[22px] bg-gradient-to-br from-[#0071e3] to-[#42a5f5] p-5 text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
            <Crown size={14} /> Lifetime Premium
          </p>
          <h3 className="mt-2 text-[22px] font-bold tracking-tight">Premium is yours for life</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-white/85">
            This benefit is saved to your account and follows you across devices.
          </p>
          <ul className="mt-4 space-y-2">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-[13px] text-white/95">
                <Check size={15} className="mt-0.5 shrink-0" strokeWidth={3} />
                {feature}
              </li>
            ))}
          </ul>
          <button
            onClick={closeModal}
            className="mt-5 w-full rounded-full bg-white py-3 text-[15px] font-semibold text-[#0071e3] transition hover:bg-blue-50"
          >
            Done
          </button>
        </div>
      ) : isPremium && sub ? (
        <div>
          <div className="rounded-[22px] bg-gradient-to-br from-[#0071e3] to-[#42a5f5] p-5 text-white">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
              <Crown size={14} /> Premium · {sub.cycle}
            </p>
            <p className="mt-2 text-[24px] font-bold tracking-tight">
              €{PLAN_PRICES[sub.cycle].total.toFixed(2)}
              <span className="text-[14px] font-medium text-white/75">
                /{sub.cycle === "monthly" ? "month" : "year"}
              </span>
            </p>
            <p className="mt-1 text-[13px] text-white/85">
              {sub.autoRenew
                ? `Renews on ${fmtDate(sub.currentPeriodEnd)}`
                : `Active until ${fmtDate(sub.currentPeriodEnd)} — will not renew`}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[12.5px] font-medium uppercase tracking-wide text-neutral-400">
              Billing cycle
            </p>
            <div className="flex rounded-full bg-[#f5f5f7] p-1">
              {(["monthly", "yearly"] as PlanCycle[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={cn(
                    "flex-1 rounded-full py-2 text-[13.5px] font-medium capitalize transition",
                    cycle === c
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500",
                  )}
                >
                  {c} · €{PLAN_PRICES[c].total.toFixed(2)}
                </button>
              ))}
            </div>
            {cycle !== sub.cycle && (
              <button
                onClick={() => {
                  subscribe(cycle);
                  notify(`Billing switched to ${cycle}`);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] py-3 text-[14.5px] font-semibold text-white transition hover:bg-[#0077ed]"
              >
                <RefreshCcw size={15} /> Switch to {cycle} billing
              </button>
            )}
            {sub.autoRenew ? (
              <button
                onClick={() => {
                  setAutoRenew(false);
                  notify("Auto-renew turned off");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-red-50 py-3 text-[14.5px] font-semibold text-red-600 transition hover:bg-red-100"
              >
                <XCircle size={15} /> Cancel subscription
              </button>
            ) : (
              <button
                onClick={() => {
                  setAutoRenew(true);
                  notify("Auto-renew resumed");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-50 py-3 text-[14.5px] font-semibold text-emerald-600 transition hover:bg-emerald-100"
              >
                <RefreshCcw size={15} /> Resume auto-renew
              </button>
            )}
            <p className="pt-1 text-center text-[12px] leading-relaxed text-neutral-400">
              Cancelling keeps Premium until {fmtDate(sub.currentPeriodEnd)}.
              No questions asked.
            </p>
          </div>
          <div className="mt-5 rounded-2xl bg-[#f5f5f7] p-4">
            <p className="text-[13.5px] font-semibold text-neutral-800">Have a lifetime Premium code?</p>
            <div className="mt-2 flex gap-2">
              <input
                className={cn(inputCls, "min-w-0 uppercase")}
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value)}
                placeholder="Enter promo code"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={40}
                aria-label="Lifetime Premium promo code"
              />
              <button
                disabled={redeemingCode || !promoCode.trim()}
                onClick={async () => {
                  setRedeemingCode(true);
                  setError(null);
                  try {
                    const redeemError = await redeemLifetimeCode(promoCode);
                    if (redeemError) setError(redeemError);
                  } catch {
                    setError("Couldn't redeem that code. Check your connection and try again.");
                  } finally {
                    setRedeemingCode(false);
                  }
                }}
                className="shrink-0 rounded-xl bg-[#0071e3] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-50"
              >
                {redeemingCode ? <Loader2 size={16} className="animate-spin" /> : "Redeem"}
              </button>
            </div>
            {error && <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-600">{error}</p>}
          </div>
        </div>
      ) : step === "plans" ? (
        /* -------------------------------- plans -------------------------------- */
        <div>
          <p className="text-[14px] leading-relaxed text-neutral-500">
            Unlock the full garage: unlimited vehicles, buyer-ready PDF
            reports and complete data backups.
          </p>

          <div className="mt-4 rounded-2xl bg-[#f5f5f7] p-4">
            <p className="text-[13.5px] font-semibold text-neutral-800">Have a lifetime Premium code?</p>
            {user ? (
              <div className="mt-2 flex gap-2">
                <input
                  className={cn(inputCls, "min-w-0 uppercase")}
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder="Enter promo code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={40}
                  aria-label="Lifetime Premium promo code"
                />
                <button
                  disabled={redeemingCode || !promoCode.trim()}
                  onClick={async () => {
                    setRedeemingCode(true);
                    setError(null);
                    try {
                      const redeemError = await redeemLifetimeCode(promoCode);
                      if (redeemError) setError(redeemError);
                    } catch {
                      setError("Couldn't redeem that code. Check your connection and try again.");
                    } finally {
                      setRedeemingCode(false);
                    }
                  }}
                  className="shrink-0 rounded-xl bg-[#0071e3] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-50"
                >
                  {redeemingCode ? <Loader2 size={16} className="animate-spin" /> : "Redeem"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  closeModal();
                  exitToAuth();
                }}
                className="mt-2 text-[13px] font-semibold text-[#0071e3]"
              >
                Sign in to redeem a code
              </button>
            )}
            {error && step === "plans" && (
              <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-600">{error}</p>
            )}
          </div>

          {/* billing toggle */}
          <div className="mt-4 flex rounded-full bg-[#f5f5f7] p-1">
            {(["monthly", "yearly"] as PlanCycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn(
                  "flex-1 rounded-full py-2 text-[13.5px] font-medium transition",
                  cycle === c
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500",
                )}
              >
                {c === "monthly" ? "Monthly" : "Yearly"}
                {c === "yearly" && (
                  <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                    −33%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* premium card */}
          <div className="relative mt-4 overflow-hidden rounded-[22px] ring-2 ring-[#0071e3]">
            <div className="bg-gradient-to-br from-[#0071e3] to-[#42a5f5] px-5 py-4 text-white">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                <Crown size={14} /> Premium
              </p>
              <p className="mt-1.5">
                <span className="text-[30px] font-bold tracking-tight">
                  €{PLAN_PRICES[cycle].perMonth.toFixed(2)}
                </span>
                <span className="text-[14px] text-white/80"> /month</span>
              </p>
              <p className="text-[12.5px] text-white/80">
                {cycle === "yearly"
                  ? "Billed yearly · €39.99"
                  : "Billed monthly · €4.99"}{" "}
                · cancel anytime
              </p>
            </div>
            <ul className="space-y-2 px-5 py-4">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13.5px] text-neutral-700">
                  <Check size={15} className="mt-0.5 shrink-0 text-[#0071e3]" strokeWidth={3} />
                  {f}
                </li>
              ))}
            </ul>
            <div className="px-5 pb-5">
              {status === "guest" ? (
                <>
                  <button
                    onClick={() => {
                      closeModal();
                      exitToAuth();
                    }}
                    className="w-full rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0077ed]"
                  >
                    Create a free account to upgrade
                  </button>
                  <p className="mt-2 text-center text-[12px] text-neutral-400">
                    Premium is tied to your account. Your guest data stays saved
                    on this device.
                  </p>
                </>
              ) : (
                <button
                  onClick={startCheckout}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0077ed]"
                >
                  <Crown size={16} /> Upgrade to Premium
                </button>
              )}
            </div>
          </div>

          {/* free card */}
          <div className="mt-3 rounded-[22px] bg-[#f5f5f7] px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold text-neutral-900">Free</p>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-500 ring-1 ring-black/5">
                Current plan
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-neutral-500">
                  <Check size={14} className="mt-0.5 shrink-0 text-neutral-400" strokeWidth={3} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : step === "checkout" || step === "processing" ? (
        /* ------------------------------- checkout ------------------------------- */
        <div>
          <div className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <span className="text-[13.5px] font-medium text-neutral-600">
              AutoLog Premium · {cycle}
            </span>
            <span className="text-[15px] font-bold text-neutral-900">
              €{PLAN_PRICES[cycle].total.toFixed(2)}
            </span>
          </div>

          <div className="mt-4 space-y-3.5">
            <Field label="Name on card">
              <div className="relative">
                <CreditCard size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input className={cn(inputCls, "pl-10")} placeholder="Alex Morgan" value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" />
              </div>
            </Field>
            <Field label="Card number" hint="Demo checkout — use 4242 4242 4242 4242. Nothing is charged.">
              <input className={inputCls} placeholder="4242 4242 4242 4242" inputMode="numeric" value={cardNum} onChange={(e) => setCardNum(fmtCard(e.target.value))} autoComplete="cc-number" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry">
                <input className={inputCls} placeholder="MM/YY" inputMode="numeric" value={expiry} onChange={(e) => setExpiry(fmtExpiry(e.target.value))} autoComplete="cc-exp" />
              </Field>
              <Field label="CVC">
                <input className={inputCls} placeholder="123" inputMode="numeric" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="cc-csc" />
              </Field>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={pay}
            disabled={step === "processing"}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-60"
          >
            {step === "processing" ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Processing payment…
              </>
            ) : (
              <>
                <Lock size={15} /> Subscribe · €{PLAN_PRICES[cycle].total.toFixed(2)}
              </>
            )}
          </button>
          <button
            onClick={() => setStep("plans")}
            disabled={step === "processing"}
            className="mt-2 w-full py-2 text-[13.5px] font-medium text-neutral-500 transition hover:text-neutral-800 disabled:opacity-50"
          >
            Back to plans
          </button>
          <p className="text-center text-[11.5px] text-neutral-400">
            Secure demo checkout · Auto-renews · Cancel anytime
          </p>
        </div>
      ) : (
        /* ------------------------------- success ------------------------------- */
        <div className="py-4 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <BadgeCheck size={32} />
          </span>
          <h3 className="mt-4 text-[20px] font-bold tracking-tight text-neutral-900">
            Welcome to Premium
          </h3>
          <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-neutral-500">
            Unlimited vehicles, PDF resale reports and full backups are now
            unlocked on your account.
          </p>
          <button
            onClick={() => {
              closeModal();
              notify("AutoLog Premium activated");
            }}
            className="mt-5 w-full rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0077ed]"
          >
            Start exploring
          </button>
        </div>
      )}
    </Modal>
  );
}
