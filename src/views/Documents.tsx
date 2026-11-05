/* ------------------------------------------------------------------ */
/*  Documents — legal paperwork expiration tracker with countdowns.    */
/* ------------------------------------------------------------------ */

import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  Plus,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { useData } from "../store/DataContext";
import { useAuth } from "../store/AuthContext";
import { useVehicleRecords } from "../components/forms";
import { DOCUMENT_META, type DocumentType } from "../types";
import {
  fmtCountdown,
  fmtCurrency,
  fmtDate,
  getDocumentStatus,
} from "../lib/utils";
import {
  EmptyState,
  InsuranceCta,
  SectionTitle,
  StatusPill,
} from "../components/ui";
import { cn } from "../utils/cn";

const DOC_ICONS: Record<DocumentType, typeof ShieldCheck> = {
  inspection: ClipboardCheck,
  insurance: ShieldCheck,
  roadtax: Receipt,
};

const DOC_TINT: Record<DocumentType, string> = {
  inspection: "bg-violet-50 text-violet-500",
  insurance: "bg-blue-50 text-[#0071e3]",
  roadtax: "bg-amber-50 text-amber-500",
};

export default function DocumentsView() {
  const { openModal, settings } = useData();
  const { isPremium } = useAuth();
  const warningDays = isPremium ? 90 : 30;
  const { documents } = useVehicleRecords();

  const trackedTypes = new Set(documents.map((d) => d.type));
  const missing = (Object.keys(DOCUMENT_META) as DocumentType[]).filter(
    (t) => !trackedTypes.has(t),
  );

  return (
    <div className="animate-fade-up">
      <SectionTitle
        action={
          <button
            onClick={() => openModal("document")}
            className="inline-flex items-center gap-1 rounded-full bg-[#0071e3] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#0077ed]"
          >
            <Plus size={14} strokeWidth={2.5} /> Add document
          </button>
        }
      >
        Legal documents
      </SectionTitle>
      <p className="mb-3 text-[12.5px] text-neutral-400">
        {isPremium
          ? "Premium expiry forecasts start 90 days before a document expires."
          : "Expiry reminders start 30 days before a document expires."}
      </p>

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="No documents tracked"
          body={`Add your inspection, insurance and road tax expiry dates — AutoLog will warn you ${warningDays} days ahead so you can plan renewals in time.`}
          action={
            <button
              onClick={() => openModal("document")}
              className="rounded-full bg-[#0071e3] px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              Add first document
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {documents.map((d) => {
            const st = getDocumentStatus(d, warningDays);
            const Icon = DOC_ICONS[d.type];
            return (
              <button
                key={d.id}
                onClick={() => openModal("document", d.id)}
                className="block w-full rounded-[24px] bg-white p-4 text-left ring-1 ring-black/[0.04] transition hover:ring-[#0071e3]/25"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      DOC_TINT[d.type],
                    )}
                  >
                    <Icon size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold text-neutral-900">
                        {DOCUMENT_META[d.type].label}
                      </p>
                      <StatusPill
                        state={st.state}
                        label={
                          st.state === "ok"
                            ? "Active"
                            : st.state === "soon"
                              ? `Within ${warningDays} days`
                              : "Expired"
                        }
                      />
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-neutral-400">
                      {d.provider || DOCUMENT_META[d.type].hint}
                      {d.reference && ` · ${d.reference}`}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <p
                          className={cn(
                            "text-[21px] font-bold leading-none tracking-tight",
                            st.state === "overdue"
                              ? "text-red-500"
                              : st.state === "soon"
                                ? "text-amber-500"
                                : "text-neutral-900",
                          )}
                        >
                          {st.daysRemaining >= 0
                            ? `${st.daysRemaining} days`
                            : `${Math.abs(st.daysRemaining)} days ago`}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-[12px] capitalize text-neutral-400">
                          <CalendarClock size={12} />
                          {fmtCountdown(st.daysRemaining)} · {fmtDate(d.expiryDate)}
                        </p>
                      </div>
                      {d.cost > 0 && (
                        <p className="text-right">
                          <span className="block text-[14px] font-bold text-neutral-900">
                            {fmtCurrency(d.cost, settings.currency)}
                          </span>
                          <span className="block text-[11px] text-neutral-400">
                            last paid
                          </span>
                        </p>
                      )}
                    </div>
                    {/* urgency bar */}
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          st.state === "overdue"
                            ? "w-full bg-red-500"
                            : st.state === "soon"
                              ? "bg-amber-400"
                              : "bg-emerald-400",
                        )}
                        style={
                          st.state === "ok"
                            ? {
                                width: `${Math.max(8, Math.min(100, 100 - st.daysRemaining / 3.65))}%`,
                              }
                            : st.state === "soon"
                              ? { width: `${Math.max(55, 100 - st.daysRemaining * 1.4)}%` }
                              : undefined
                        }
                      />
                    </div>
                    {d.notes && (
                      <p className="mt-2.5 line-clamp-2 text-[13px] leading-snug text-neutral-500">
                        {d.notes}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* quick-add chips for document types not tracked yet */}
      {missing.length > 0 && documents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {missing.map((t) => (
            <button
              key={t}
              onClick={() => openModal("document")}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3.5 py-2 text-[13px] font-medium text-neutral-500 transition hover:border-[#0071e3] hover:text-[#0071e3]"
            >
              <Plus size={13} /> Track {DOCUMENT_META[t].label.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {/* ----------------- affiliate slot: insurance ----------------- */}
      <div className="mt-6">
        <InsuranceCta />
      </div>
    </div>
  );
}
