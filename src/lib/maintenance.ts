import type { MaintenancePlan, Vehicle } from "../types";
import { addDaysISO, daysUntil } from "./utils";

export interface MaintenancePlanStatus {
  dueDate: string | null;
  dueMileage: number | null;
  daysRemaining: number | null;
  distanceRemaining: number | null;
  overdue: boolean;
  dueSoon: boolean;
}

export function getMaintenancePlanStatus(
  plan: MaintenancePlan,
  vehicle: Vehicle,
): MaintenancePlanStatus {
  const dueDate = plan.intervalDays === null
    ? null
    : addDaysISO(plan.lastCompletedDate, plan.intervalDays);
  const dueMileage = plan.intervalKm === null
    ? null
    : plan.lastCompletedMileage + plan.intervalKm;
  const daysRemaining = dueDate ? daysUntil(dueDate) : null;
  const distanceRemaining = dueMileage === null ? null : dueMileage - vehicle.mileage;
  const overdue = (daysRemaining !== null && daysRemaining < 0)
    || (distanceRemaining !== null && distanceRemaining <= 0);
  const dueSoon = !overdue && (
    (daysRemaining !== null && daysRemaining <= 30)
    || (distanceRemaining !== null && distanceRemaining <= 1500)
  );
  return { dueDate, dueMileage, daysRemaining, distanceRemaining, overdue, dueSoon };
}
