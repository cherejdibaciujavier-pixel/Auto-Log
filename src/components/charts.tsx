/* ------------------------------------------------------------------ */
/*  AutoLog — Chart.js wrappers (expense doughnut, monthly bars,       */
/*  consumption trend). Charts are recreated on data change and        */
/*  destroyed on unmount to avoid canvas leaks.                        */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import type { CurrencyCode } from "../types";
import { fmtCurrency } from "../lib/utils";
import { cn } from "../utils/cn";

Chart.register(...registerables);
Chart.defaults.font.family =
  "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
Chart.defaults.color = "#86868b";

export const CHART_COLORS = {
  fuel: "#0071e3",
  maintenance: "#ff9f0a",
  documents: "#5e5ce6",
};

const tooltipBase = {
  backgroundColor: "#1d1d1f",
  titleFont: { size: 12, weight: "bold" as const },
  bodyFont: { size: 12 },
  padding: 12,
  cornerRadius: 12,
  displayColors: false,
};

function EmptyChart({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl bg-[#f5f5f7] text-[13px] text-neutral-400",
        className,
      )}
    >
      {label}
    </div>
  );
}

/* --------------------------- Expense doughnut --------------------------- */
export function ExpenseDoughnut({
  fuel,
  maintenance,
  documents,
  currency,
}: {
  fuel: number;
  maintenance: number;
  documents: number;
  currency: CurrencyCode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const total = fuel + maintenance + documents;

  useEffect(() => {
    if (!ref.current || total === 0) return;
    const chart = new Chart(ref.current, {
      type: "doughnut",
      data: {
        labels: ["Fuel / Charging", "Maintenance", "Insurance & Taxes"],
        datasets: [
          {
            data: [fuel, maintenance, documents],
            backgroundColor: [
              CHART_COLORS.fuel,
              CHART_COLORS.maintenance,
              CHART_COLORS.documents,
            ],
            borderColor: "#ffffff",
            borderWidth: 2.5,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              label: (item) =>
                ` ${item.label}: ${fmtCurrency(item.parsed, currency)}`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [fuel, maintenance, documents, currency, total]);

  if (total === 0) return <EmptyChart label="No expenses logged yet" className="h-52" />;

  return (
    <div className="relative h-52">
      <canvas ref={ref} aria-label="Expense breakdown chart" />
      {/* Centre label overlay (total spend) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Total spent
        </span>
        <span className="text-[20px] font-bold tracking-tight text-neutral-900">
          {fmtCurrency(total, currency)}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------- Monthly bars ---------------------------- */
export function MonthlyBarChart({
  labels,
  fuel,
  maintenance,
  documents,
  currency,
}: {
  labels: string[];
  fuel: number[];
  maintenance: number[];
  documents: number[];
  currency: CurrencyCode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hasData = [...fuel, ...maintenance, ...documents].some((v) => v > 0);
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "£";

  useEffect(() => {
    if (!ref.current || !hasData) return;
    const chart = new Chart(ref.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Fuel / Charging",
            data: fuel,
            backgroundColor: CHART_COLORS.fuel,
            borderRadius: 5,
            maxBarThickness: 26,
          },
          {
            label: "Maintenance",
            data: maintenance,
            backgroundColor: CHART_COLORS.maintenance,
            borderRadius: 5,
            maxBarThickness: 26,
          },
          {
            label: "Insurance & Taxes",
            data: documents,
            backgroundColor: CHART_COLORS.documents,
            borderRadius: 5,
            maxBarThickness: 26,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, border: { display: false } },
          y: {
            stacked: true,
            border: { display: false },
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: {
              maxTicksLimit: 5,
              callback: (v) =>
                `${symbol}${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : v}`,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              label: (item) =>
                ` ${item.dataset.label}: ${fmtCurrency(item.parsed.y ?? 0, currency)}`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [labels, fuel, maintenance, documents, currency, hasData, symbol]);

  if (!hasData) return <EmptyChart label="Not enough data for a trend yet" className="h-52" />;
  return (
    <div className="h-52">
      <canvas ref={ref} aria-label="Monthly expenses chart" />
    </div>
  );
}

/* -------------------------- Consumption trend -------------------------- */
export function ConsumptionChart({
  points,
  unitSuffix,
}: {
  points: { label: string; value: number }[];
  unitSuffix: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || points.length < 2) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 0, 190);
    gradient.addColorStop(0, "rgba(0,113,227,0.20)");
    gradient.addColorStop(1, "rgba(0,113,227,0)");

    const chart = new Chart(ref.current, {
      type: "line",
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            data: points.map((p) => p.value),
            borderColor: CHART_COLORS.fuel,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3.5,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: CHART_COLORS.fuel,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6 } },
          y: {
            border: { display: false },
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { maxTicksLimit: 5 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              label: (item) => ` ${item.parsed.y?.toFixed(1)} ${unitSuffix}`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [points, unitSuffix]);

  if (points.length < 2)
    return (
      <EmptyChart
        label="Log at least two fill-ups to see your consumption trend"
        className="h-44"
      />
    );
  return (
    <div className="h-44">
      <canvas ref={ref} aria-label="Fuel consumption trend chart" />
    </div>
  );
}
