import type { AppData } from "../types";
import { DOCUMENT_META } from "../types";
import { addDaysISO, fmtDistance, getServiceStatus, todayISO, vehicleName } from "./utils";

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  const pieces: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const charBytes = new TextEncoder().encode(character).length;
    if (bytes + charBytes > 73 && current) {
      pieces.push(current);
      current = ` ${character}`;
      bytes = 1 + charBytes;
    } else {
      current += character;
      bytes += charBytes;
    }
  }
  if (current) pieces.push(current);
  return pieces.join("\r\n");
}

function dateValue(iso: string): string {
  return iso.replace(/-/g, "");
}

function eventLines(
  id: string,
  title: string,
  date: string,
  description: string,
  recurrenceDays?: number,
): string[] {
  const nextDay = addDaysISO(date, 1);
  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(id)}@autolog.app`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${dateValue(date)}`,
    `DTEND;VALUE=DATE:${dateValue(nextDay)}`,
    ...(recurrenceDays ? [`RRULE:FREQ=DAILY;INTERVAL=${Math.max(1, Math.round(recurrenceDays))}`] : []),
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P30D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`${title} is due in 30 days`)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-P7D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`${title} is due in 7 days`)}`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

/** Build an all-vehicle iCalendar with 30-day and 7-day event alarms. */
export function createMaintenanceCalendar(data: AppData): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoLog//Vehicle Maintenance Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const vehicle of data.vehicles) {
    const name = vehicleName(vehicle);
    for (const document of data.documents.filter((item) => item.vehicleId === vehicle.id)) {
      const reminderDate = document.expiryDate < todayISO() ? todayISO() : document.expiryDate;
      lines.push(...eventLines(
        `document-${document.id}`,
        `${DOCUMENT_META[document.type].label} expiry · ${name}`,
        reminderDate,
        `${DOCUMENT_META[document.type].label} ${document.expiryDate < todayISO() ? `expired on ${document.expiryDate}` : `expires on ${document.expiryDate}`}${document.provider ? ` (${document.provider})` : ""}. Vehicle: ${name}.`,
      ));
    }

    const service = getServiceStatus(vehicle, data.services, data.settings);
    if (service.nextDate) {
      const reminderDate = service.nextDate < todayISO() ? todayISO() : service.nextDate;
      lines.push(...eventLines(
        `service-${vehicle.id}`,
        `${service.nextDate < todayISO() ? "Overdue service" : "Scheduled service"} · ${name}`,
        reminderDate,
        `Predicted service interval for ${name}, originally due ${service.nextDate}. Target odometer: ${fmtDistance(service.nextMileage, data.settings)}.`,
      ));
    }

    for (const plan of data.maintenancePlans.filter((item) => item.vehicleId === vehicle.id && item.intervalDays !== null)) {
      const originalDueDate = addDaysISO(plan.lastCompletedDate, plan.intervalDays!);
      const dueDate = originalDueDate < todayISO() ? todayISO() : originalDueDate;
      const mileageNote = plan.intervalKm === null
        ? ""
        : ` Also check at ${fmtDistance(plan.lastCompletedMileage + plan.intervalKm, data.settings)}.`;
      lines.push(...eventLines(
        `plan-${plan.id}`,
        `${plan.title} · ${name}`,
        dueDate,
        `Recurring maintenance task for ${name}, due ${originalDueDate}.${mileageNote}`,
        plan.intervalDays ?? undefined,
      ));
    }
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
