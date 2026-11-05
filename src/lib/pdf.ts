/* ------------------------------------------------------------------ */
/*  AutoLog — client-side PDF generation (jsPDF + AutoTable).          */
/*  Produces a clean, buyer-ready "Service History Report" that        */
/*  owners can hand to prospective buyers when reselling the car.      */
/* ------------------------------------------------------------------ */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppData, Settings, Vehicle } from "../types";
import {
  computeExpenses,
  computeFuelStats,
  fmtConsumption,
  fmtCurrency,
  fmtDate,
  fmtDistance,
  fmtNum,
  getDocumentStatus,
  todayISO,
  vehicleName,
} from "./utils";
import { DOCUMENT_META } from "../types";

const BLUE: [number, number, number] = [0, 113, 227];
const INK: [number, number, number] = [29, 29, 31];
const GREY: [number, number, number] = [110, 110, 115];

export function generateServiceReport(
  vehicle: Vehicle,
  data: AppData,
  settings: Settings,
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 18;

  const services = data.services
    .filter((r) => r.vehicleId === vehicle.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const fuelRecs = data.fuel.filter((r) => r.vehicleId === vehicle.id);
  const documents = data.documents.filter((r) => r.vehicleId === vehicle.id);
  const expenses = computeExpenses(vehicle.id, data);
  const fuelStats = computeFuelStats(fuelRecs);
  const isEV = vehicle.fuelType === "Electric";
  const today = fmtDate(todayISO());

  /* ------------------------------ header ------------------------------ */
  doc.setFillColor(...BLUE);
  doc.roundedRect(margin, y - 6, 9, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("A", margin + 4.5, y + 0.5, { align: "center" });

  doc.setTextColor(...INK);
  doc.setFontSize(17);
  doc.text("AutoLog", margin + 12, y + 1);
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text("VEHICLE SERVICE HISTORY REPORT", pageW - margin, y - 1.5, {
    align: "right",
  });
  doc.text(`Generated ${today}`, pageW - margin, y + 2.5, { align: "right" });

  y += 8;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  doc.setTextColor(...INK);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(vehicleName(vehicle), margin, y);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GREY);
  doc.text(
    "Complete, owner-verified maintenance & running-cost history — prepared for prospective buyers.",
    margin,
    y + 5.5,
  );
  y += 12;

  /* ---------------------------- vehicle specs ---------------------------- */
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: { top: 1.6, bottom: 1.6 } },
    columnStyles: {
      0: { textColor: GREY, cellWidth: 34 },
      1: { textColor: INK, fontStyle: "bold", cellWidth: 55 },
      2: { textColor: GREY, cellWidth: 34 },
      3: { textColor: INK, fontStyle: "bold" },
    },
    body: [
      ["Make", vehicle.make, "Model", vehicle.model],
      ["Year", String(vehicle.year), "Fuel type", vehicle.fuelType],
      [
        "Motorisation",
        vehicle.motorisation || "Not specified",
        "Odometer",
        fmtDistance(vehicle.mileage, settings),
      ],
      [
        "License plate",
        vehicle.plate || "—",
        "Service records",
        String(services.length),
      ],
      ["VIN", vehicle.vin || "—", "", ""],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  /* ----------------------------- summary boxes ----------------------------- */
  const boxes: Array<[string, string]> = [
    ["Total invested", fmtCurrency(expenses.allTime, settings.currency)],
    ["Maintenance", fmtCurrency(expenses.maintenance, settings.currency)],
    [
      isEV ? "Charging cost" : "Fuel cost",
      fmtCurrency(expenses.fuel, settings.currency),
    ],
    [
      "Avg. running cost",
      expenses.costPerKm
        ? `${fmtCurrency(expenses.costPerKm, settings.currency)}/${settings.unit}`
        : "—",
    ],
  ];
  const boxW = (pageW - margin * 2 - 9) / 4;
  boxes.forEach(([label, value], i) => {
    const x = margin + i * (boxW + 3);
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(x, y, boxW, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x + 3.5, y + 5.5);
    doc.setFontSize(11.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, x + 3.5, y + 12);
    doc.setFont("helvetica", "normal");
  });
  y += 23;

  /* ---------------------------- service history ---------------------------- */
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Service & Maintenance History", margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Date", "Odometer", "Category", "Workshop", "Notes", "Cost"]],
    headStyles: {
      fillColor: BLUE,
      textColor: 255,
      fontSize: 8.5,
      fontStyle: "bold",
    },
    styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2 } },
    alternateRowStyles: { fillColor: [245, 245, 247] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 24, halign: "right" },
      2: { cellWidth: 30 },
      3: { cellWidth: 32 },
      5: { cellWidth: 20, halign: "right", fontStyle: "bold" },
    },
    body:
      services.length > 0
        ? services.map((r) => [
            fmtDate(r.date),
            fmtDistance(r.mileage, settings),
            r.category,
            r.workshop || "—",
            r.notes || "—",
            fmtCurrency(r.cost, settings.currency),
          ])
        : [["—", "—", "No service records logged yet", "", "", ""]],
    foot: [
      [
        "",
        "",
        "",
        "",
        "Total maintenance",
        fmtCurrency(expenses.maintenance, settings.currency),
      ],
    ],
    footStyles: { fontStyle: "bold", textColor: INK, fillColor: [235, 240, 250] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

  /* ------------------------- fuel & legal sections ------------------------- */
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(isEV ? "Charging & Efficiency" : "Fuel & Efficiency", margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: { top: 1.6, bottom: 1.6 } },
    columnStyles: {
      0: { textColor: GREY, cellWidth: 52 },
      1: { textColor: INK, fontStyle: "bold", cellWidth: 52 },
      2: { textColor: GREY, cellWidth: 40 },
      3: { textColor: INK, fontStyle: "bold" },
    },
    body: [
      [
        isEV ? "Charging sessions" : "Fill-ups logged",
        String(fuelStats.fillUps),
        "Total distance logged",
        fmtDistance(fuelStats.totalDistance, settings),
      ],
      [
        isEV ? "Energy used" : "Fuel used",
        `${fmtNum(fuelStats.totalVolume, 1)} ${isEV ? "kWh" : "L"}`,
        "Average consumption",
        fuelStats.avgConsumption
          ? fmtConsumption(fuelStats.avgConsumption, settings, isEV)
          : "—",
      ],
      [
        isEV ? "Total charging spend" : "Total fuel spend",
        fmtCurrency(fuelStats.totalCost, settings.currency),
        isEV ? "Cost per km" : "Fuel cost per km",
        fuelStats.costPerKm
          ? `${fmtCurrency(fuelStats.costPerKm, settings.currency)}/${settings.unit}`
          : "—",
      ],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

  if (documents.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text("Legal Documents Status", margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Document", "Provider", "Reference", "Valid until", "Status"]],
      headStyles: { fillColor: BLUE, textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2 } },
      alternateRowStyles: { fillColor: [245, 245, 247] },
      body: documents.map((d) => {
        const st = getDocumentStatus(d, 90);
        return [
          DOCUMENT_META[d.type].label,
          d.provider || "—",
          d.reference || "—",
          fmtDate(d.expiryDate),
          st.state === "overdue"
            ? "EXPIRED"
            : st.state === "soon"
              ? `Expires in ${st.daysRemaining}d`
              : "Valid",
        ];
      }),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  /* ------------------------------ disclaimer ------------------------------ */
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  const disclaimer =
    "This report was generated by AutoLog from records maintained by the vehicle owner. " +
    "Figures are provided in good faith to support a transparent sale; buyers should verify " +
    "details against original workshop invoices. Odometer readings are owner-reported.";
  doc.text(doc.splitTextToSize(disclaimer, pageW - margin * 2), margin, y);

  /* ------------------------------ page footer ------------------------------ */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(
      `AutoLog · ${vehicleName(vehicle)} · ${vehicle.plate || ""}`,
      margin,
      h - 8,
    );
    doc.text(`Page ${i} of ${pages}`, pageW - margin, h - 8, {
      align: "right",
    });
  }

  doc.save(
    `AutoLog-Service-History-${vehicle.make}-${vehicle.model}-${vehicle.plate || vehicle.id}.pdf`
      .replace(/\s+/g, "-"),
  );
}
