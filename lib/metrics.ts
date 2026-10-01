import { reached } from "@/lib/flow";
import {
  DEMO_DAY,
  WEEK_END,
  WEEK_START,
  dayKey,
  isThisWeek,
  roundMoney,
} from "@/lib/format";
import {
  countsAsRevenue,
  driverBalance,
  loadRevenue,
  revenueStamp,
} from "@/lib/finance";
import { place } from "@/lib/reference";
import type { DemoData, Driver, Load, Truck } from "@/lib/types";

export type MaintenanceTone = "out_of_service" | "overdue" | "due_soon" | "healthy";

export function maintenanceTone(truck: Truck, thresholds: DemoData["thresholds"], today = DEMO_DAY): MaintenanceTone {
  if (truck.operational === "out_of_service") return "out_of_service";
  const milesLeft = truck.nextServiceMiles - truck.odometer;
  const daysLeft = Math.round(
    (new Date(`${truck.nextServiceDate}T12:00:00-07:00`).getTime() -
      new Date(`${today}T12:00:00-07:00`).getTime()) /
      86_400_000,
  );
  if (milesLeft <= 0 || daysLeft < 0) return "overdue";
  if (milesLeft <= thresholds.miles || daysLeft <= thresholds.days) return "due_soon";
  return "healthy";
}

export function needsService(truck: Truck, thresholds: DemoData["thresholds"]) {
  const tone = maintenanceTone(truck, thresholds);
  return tone === "overdue" || tone === "due_soon" || tone === "out_of_service";
}

export function overviewMetrics(data: DemoData) {
  const active = data.loads.filter((load) => load.status !== "complete");
  const unassigned = data.loads.filter((load) => load.status === "created");
  const completedToday = data.loads.filter(
    (load) => load.status === "complete" && load.completedAt && dayKey(load.completedAt) === DEMO_DAY,
  );
  const weekLoads = data.loads.filter((load) => {
    const stamp = revenueStamp(load);
    return Boolean(stamp && countsAsRevenue(load) && isThisWeek(stamp));
  });
  const weekRevenue = roundMoney(weekLoads.reduce((sum, load) => sum + loadRevenue(load), 0));
  const outstanding = roundMoney(
    data.drivers.reduce((sum, driver) => sum + Math.max(0, driverBalance(data.ledger, driver.id)), 0),
  );
  const service = data.trucks.filter((truck) => needsService(truck, data.thresholds));
  return { active, unassigned, completedToday, weekLoads, weekRevenue, outstanding, service };
}

export function weekSeries(data: DemoData) {
  const days = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];
  return days.map((day) => {
    const revenue = roundMoney(
      data.loads
        .filter((load) => {
          const stamp = revenueStamp(load);
          return Boolean(stamp && countsAsRevenue(load) && dayKey(stamp) === day);
        })
        .reduce((sum, load) => sum + loadRevenue(load), 0),
    );
    const earnings = roundMoney(
      data.ledger
        .filter((entry) => entry.type === "earning" && dayKey(entry.at) === day)
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const expenses = roundMoney(
      data.expenses
        .filter((expense) => expense.status === "approved" && expense.date === day)
        .reduce((sum, expense) => sum + expense.amount, 0),
    );
    return { day, revenue, costs: roundMoney(earnings + expenses), earnings, expenses };
  });
}

export function todayLoads(loads: Load[]) {
  return loads
    .filter((load) => dayKey(load.appointmentStart) === DEMO_DAY)
    .sort((a, b) => a.appointmentStart.localeCompare(b.appointmentStart));
}

function deliveryTime(load: Load) {
  if (load.type === "import") return load.timeline.find((event) => event.status === "delivered")?.at;
  return load.timeline.find((event) => event.status === "gated_in")?.at;
}

export function driverReport(data: DemoData) {
  return data.drivers
    .map((driver) => {
      const mine = data.loads.filter((load) => load.driverId === driver.id);
      const completed = mine.filter((load) => load.status === "complete");
      const settledWindow = mine.filter((load) => dayKey(load.appointmentStart) <= DEMO_DAY);
      const finished = settledWindow.filter(
        (load) => load.status === "complete" || (load.type === "import" && reached(load, "delivered")) || (load.type === "export" && reached(load, "gated_in")),
      );
      const onTimePool = finished.filter((load) => deliveryTime(load));
      const onTime = onTimePool.filter((load) => {
        const stamp = deliveryTime(load);
        return stamp ? new Date(stamp).getTime() <= new Date(load.appointmentEnd).getTime() : false;
      });
      const podPool = mine.filter((load) => load.type === "import" && reached(load, "delivered"));
      const podOk = podPool.filter((load) =>
        data.documents.some(
          (doc) => doc.loadId === load.id && doc.type === "pod" && doc.reviewStatus === "approved",
        ),
      );
      const delays = mine.flatMap((load) => load.delays);
      const completionRate = settledWindow.length === 0 ? null : completed.length / settledWindow.length;
      return {
        driver,
        completed: completed.length,
        assignedInWindow: settledWindow.length,
        completionRate,
        onTimeRate: onTimePool.length === 0 ? null : onTime.length / onTimePool.length,
        onTimeCount: onTime.length,
        onTimePool: onTimePool.length,
        podRate: podPool.length === 0 ? null : podOk.length / podPool.length,
        podOk: podOk.length,
        podPool: podPool.length,
        delays,
        active: mine.filter((load) => load.status !== "complete").length,
      };
    })
    .sort((a, b) => b.completed - a.completed || a.driver.name.localeCompare(b.driver.name));
}

export function delayTotals(data: DemoData) {
  const counts = new Map<string, number>();
  for (const load of data.loads) {
    for (const delay of load.delays) {
      counts.set(delay.reason, (counts.get(delay.reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function attentionItems(data: DemoData) {
  const items: {
    id: string;
    tone: "late" | "warn" | "ok";
    title: string;
    detail: string;
    href: string;
  }[] = [];
  for (const truck of data.trucks) {
    const tone = maintenanceTone(truck, data.thresholds);
    if (tone === "out_of_service") {
      items.push({
        id: `oos-${truck.id}`,
        tone: "late",
        title: `${truck.unit} is out of service`,
        detail: data.issues.find((issue) => issue.truckId === truck.id && issue.status === "open")?.summary ?? "Open repair",
        href: `/trucks/${truck.id}`,
      });
    } else if (tone === "overdue") {
      items.push({
        id: `overdue-${truck.id}`,
        tone: "late",
        title: `${truck.unit} service is overdue`,
        detail: `Due ${truck.nextServiceDate} or ${truck.nextServiceMiles.toLocaleString()} mi`,
        href: `/trucks/${truck.id}`,
      });
    } else if (tone === "due_soon") {
      items.push({
        id: `soon-${truck.id}`,
        tone: "warn",
        title: `${truck.unit} service is coming due`,
        detail: `Next service ${truck.nextServiceDate}`,
        href: `/trucks/${truck.id}`,
      });
    }
  }
  for (const load of data.loads) {
    if (load.type === "import" && load.lastFreeDay && !reached(load, "picked_up")) {
      if (load.lastFreeDay <= DEMO_DAY) {
        items.push({
          id: `lfd-${load.id}`,
          tone: "late",
          title: `${load.containerNumber} last free day is today`,
          detail: `${load.id} is still not picked up`,
          href: `/loads/${load.id}`,
        });
      } else if (load.lastFreeDay === "2026-10-02") {
        items.push({
          id: `lfd-${load.id}`,
          tone: "warn",
          title: `${load.containerNumber} last free day is tomorrow`,
          detail: `${load.id} · pickup deadline approaching`,
          href: `/loads/${load.id}`,
        });
      }
    }
    if (load.status === "empty_return_pending" && load.emptyReturnDeadline && load.emptyReturnDeadline <= DEMO_DAY) {
      items.push({
        id: `empty-${load.id}`,
        tone: "late",
        title: `Empty return due · ${load.containerNumber}`,
        detail: `${load.id} should be back at the terminal today`,
        href: `/loads/${load.id}`,
      });
    }
    if (load.type === "import" && reached(load, "delivered")) {
      const pod = data.documents.find((doc) => doc.loadId === load.id && doc.type === "pod");
      if (!pod || pod.reviewStatus !== "approved") {
        items.push({
          id: `pod-${load.id}`,
          tone: "warn",
          title: `POD missing · ${load.containerNumber}`,
          detail: pod?.reviewStatus === "rejected" ? "Blue document was rejected" : `${load.id} has no approved blue document`,
          href: `/documents?load=${load.id}`,
        });
      }
    }
  }
  for (const expense of data.expenses) {
    if (expense.status === "awaiting_approval") {
      const driver = data.drivers.find((item) => item.id === expense.driverId);
      items.push({
        id: `exp-${expense.id}`,
        tone: "warn",
        title: `Receipt awaiting approval · ${expense.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        detail: `${driver?.name ?? "Driver"} · ${expense.merchant}`,
        href: `/expenses?status=awaiting_approval`,
      });
    }
  }
  const rank = { late: 0, warn: 1, ok: 2 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

export function laneLabel(load: Load) {
  const from = place(load.pickupKey);
  const to = place(load.destinationKey);
  return `${from?.city ?? "Pickup"} → ${to?.city ?? "Drop"}`;
}

export function driverName(drivers: Driver[], id?: string) {
  return drivers.find((driver) => driver.id === id)?.name ?? "Unassigned";
}

export function truckUnit(trucks: Truck[], id?: string) {
  return trucks.find((truck) => truck.id === id)?.unit ?? "—";
}

export function inWeek(day: string) {
  return day >= WEEK_START && day <= WEEK_END;
}
