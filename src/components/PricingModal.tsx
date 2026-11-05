/* ------------------------------------------------------------------ */
/*  AutoLog Premium — Stripe Checkout and subscription management.      */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { Check, Crown, ExternalLink, Loader2 } from "lucide-react";
import {
  FREE_FEATURES,
  PLAN_PRICES,
  PREMIUM_FEATURES,
  useAuth,
  type PlanCycle,
} from "../store/AuthContext";
import { useData } from "../store/DataContext";
import { fmtDate } from "../lib/utils";
import { Modal, inputCls } from "./ui";
import { cn } from "../utils/cn";


export default function PricingModal() {
  const { closeModal } = useData();
  const {
    user,
    status,
    isPremium,
    lifetimePremium,
    redeemLifetimeCode,
    createCheckoutSession,
    createBillingPortalSession,
    exitToAuth,
  } = useAuth();

  const [cycle, setCycle] = useState<PlanCycle>(
    user?.subscription?.cycle ?? "yearly",
  );
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  const sub = user?.subscription ?? null;

  const startCheckout = async () => {
    if (!user) return;
    setError(null);
    setCheckoutBusy(true);
    const result = await createCheckoutSession(cycle);
    if (result.error || !result.url) {
      setError(result.error ?? "Couldn't start secure checkout.");
      setCheckoutBusy(false);
      return;
    }
    window.location.assign(result.url);
  };

  const manageBilling = async () => {
    setError(null);
    setPortalBusy(true);
    const result = await createBillingPortalSession();
    if (result.error || !result.url) {
      setError(result.error ?? "Couldn't open billing management.");
      setPortalBusy(false);
      return;
    }
    window.location.assign(result.url);
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
          {sub && (
            <button
              onClick={manageBilling}
              disabled={portalBusy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white/15 py-3 text-[14px] font-semibold text-white transition hover:bg-white/25 disabled:opacity-60"
            >
              {portalBusy ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={15} />}
              Manage recurring subscription
            </button>
          )}
          {error && <p role="alert" className="mt-2 text-center text-[12.5px] font-medium text-red-600">{error}</p>}
          <button
            onClick={closeModal}
            className="mt-3 w-full rounded-full bg-white py-3 text-[15px] font-semibold text-[#0071e3] transition hover:bg-blue-50"
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
          <button
            onClick={manageBilling}
            disabled={portalBusy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] py-3 text-[14.5px] font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-60"
          >
            {portalBusy ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={15} />}
            Manage billing in Stripe
          </button>
          {error && <p role="alert" className="mt-2 text-center text-[12.5px] font-medium text-red-600">{error}</p>}
          <p className="mt-3 text-center text-[12px] leading-relaxed text-neutral-400">
            Update your payment method, change plans, or cancel securely through Stripe.
          </p>
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
          </div>
        </div>
      ) : sub && ["past_due", "unpaid"].includes(sub.status) ? (
        <div className="rounded-[22px] bg-amber-50 p-5 text-center ring-1 ring-amber-200">
          <h3 className="text-[18px] font-bold text-neutral-900">Payment needs attention</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-600">
            Update your payment method in Stripe to restore or keep Premium active.
          </p>
          <button
            onClick={manageBilling}
            disabled={portalBusy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] py-3 text-[14.5px] font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-60"
          >
            {portalBusy ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={15} />}
            Update billing in Stripe
          </button>
          {error && <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-600">{error}</p>}
        </div>
      ) : (
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
                  disabled={checkoutBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0077ed] disabled:opacity-60"
                >
                  {checkoutBusy ? <Loader2 size={17} className="animate-spin" /> : <Crown size={16} />}
                  {checkoutBusy ? "Opening secure checkout…" : `Continue to secure checkout · €${PLAN_PRICES[cycle].total.toFixed(2)}`}
                </button>
              )}
            </div>
          </div>

              {error && <p role="alert" className="mt-3 text-center text-[12.5px] font-medium text-red-600">{error}</p>}
              <p className="mt-2 text-center text-[11.5px] text-neutral-400">Payments are processed securely by Stripe. Auto-renews until cancelled.</p>
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
      )}
    </Modal>
  );
}
