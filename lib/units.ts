import { roundMoney } from "@/lib/format";
import type { Expense, Issue, ServiceRecord, Truck } from "@/lib/types";

export interface UnitStats {
  asOf: string;
  periodStart: string;
  periodMiles: number;
  gallons: number;
}

/** Synthetic week-of fuel log. Gallons line up with drayage mpg, including idle time at the port. */
export const UNIT_STATS: Record<string, UnitStats> = {
  "trk-101": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 842, gallons: 138.2 },
  "trk-104": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 796, gallons: 128.4 },
  "trk-107": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 910, gallons: 162.8 },
  "trk-110": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 754, gallons: 121.6 },
  "trk-113": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 688, gallons: 109.4 },
  "trk-116": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 724, gallons: 118.7 },
  "trk-119": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 412, gallons: 66.8 },
  "trk-122": { asOf: "2026-09-27", periodStart: "2026-09-21", periodMiles: 186, gallons: 34.1 },
  "trk-125": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 803, gallons: 131.5 },
  "trk-128": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 771, gallons: 124.2 },
  "trk-131": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 640, gallons: 104.9 },
  "trk-134": { asOf: "2026-10-01", periodStart: "2026-09-28", periodMiles: 705, gallons: 116.0 },
};

export function healTruck(truck: Truck): Truck {
  const stats = UNIT_STATS[truck.id];
  return {
    ...truck,
    asOf: truck.asOf || stats?.asOf || "2026-10-01",
    periodStart: truck.periodStart || stats?.periodStart || "2026-09-28",
    periodMiles: truck.periodMiles ?? stats?.periodMiles ?? 0,
    gallons: truck.gallons ?? stats?.gallons ?? 0,
  };
}

export interface UnitCost {
  fuel: number;
  tolls: number;
  other: number;
  operating: number;
  pending: number;
  maintenance: number;
  openEstimate: number;
  total: number;
  receiptCount: number;
}

function sum(values: number[]) {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

export function unitCost(
  truckId: string,
  expenses: Expense[],
  serviceRecords: ServiceRecord[],
  issues: Issue[],
): UnitCost {
  const rows = expenses.filter((expense) => expense.truckId === truckId);
  const approved = rows.filter((expense) => expense.status === "approved");
  const fuel = sum(approved.filter((expense) => expense.category === "fuel").map((expense) => expense.amount));
  const tolls = sum(approved.filter((expense) => expense.category === "tolls").map((expense) => expense.amount));
  const other = sum(
    approved
      .filter((expense) => expense.category !== "fuel" && expense.category !== "tolls")
      .map((expense) => expense.amount),
  );
  const pending = sum(
    rows
      .filter((expense) => expense.status === "awaiting_approval" || expense.status === "correction_requested")
      .map((expense) => expense.amount),
  );
  const maintenance = sum(serviceRecords.filter((record) => record.truckId === truckId).map((record) => record.cost));
  const openEstimate = sum(
    issues
      .filter((issue) => issue.truckId === truckId && issue.status === "open" && issue.estimatedCost)
      .map((issue) => issue.estimatedCost ?? 0),
  );
  return {
    fuel,
    tolls,
    other,
    operating: roundMoney(fuel + tolls + other),
    pending,
    maintenance,
    openEstimate,
    total: roundMoney(fuel + tolls + other + maintenance),
    receiptCount: rows.length,
  };
}
