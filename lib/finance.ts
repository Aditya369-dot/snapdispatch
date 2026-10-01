import { flowIndex, reached } from "@/lib/flow";
import { roundMoney } from "@/lib/format";
import type {
  DemoData,
  Driver,
  EarningLine,
  Expense,
  LedgerEntry,
  Load,
} from "@/lib/types";

export function loadAccessorials(load: Load) {
  return roundMoney(load.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0));
}

export function loadRevenue(load: Load) {
  return roundMoney(load.customerRate + loadAccessorials(load));
}

export function earningPlan(load: Load, driver: Driver): EarningLine[] {
  if (driver.pay.kind === "flat") {
    if (load.type === "import") {
      return [
        {
          leg: "delivery",
          amount: driver.pay.importDelivery,
          memo: `Import delivery flat rate ($${driver.pay.importDelivery.toFixed(2)})`,
          postWhen: "delivered",
        },
        {
          leg: "empty",
          amount: driver.pay.importEmpty,
          memo: `Empty return flat rate ($${driver.pay.importEmpty.toFixed(2)})`,
          postWhen: "empty",
        },
      ];
    }
    return [
      {
        leg: "move",
        amount: driver.pay.exportMove,
        memo: `Export gate-in flat rate ($${driver.pay.exportMove.toFixed(2)})`,
        postWhen: "done",
      },
    ];
  }
  if (driver.pay.kind === "hourly") {
    const amount = roundMoney(driver.pay.rate * load.estimatedHours);
    return [
      {
        leg: "move",
        amount,
        memo: `$${driver.pay.rate.toFixed(2)} × ${load.estimatedHours} h`,
        postWhen: "done",
      },
    ];
  }
  const amount = roundMoney((load.customerRate * driver.pay.percent) / 100);
  return [
    {
      leg: "move",
      amount,
      memo: `${driver.pay.percent}% × $${load.customerRate.toFixed(2)} linehaul`,
      postWhen: load.type === "import" ? "delivered" : "done",
    },
  ];
}

export function earningShouldPost(load: Load, line: EarningLine) {
  if (line.postWhen === "delivered") return load.type === "import" && reached(load, "delivered");
  if (line.postWhen === "empty") return load.type === "import" && reached(load, "empty_returned");
  if (load.type === "import") return reached(load, "empty_returned");
  return reached(load, "gated_in");
}

export function earningStamp(load: Load, line: EarningLine) {
  if (line.postWhen === "delivered") {
    return load.timeline.find((event) => event.status === "delivered")?.at;
  }
  if (line.postWhen === "empty") {
    return (
      load.timeline.find((event) => event.status === "empty_returned")?.at ??
      load.completedAt
    );
  }
  if (load.type === "export") {
    return load.timeline.find((event) => event.status === "gated_in")?.at ?? load.completedAt;
  }
  return (
    load.timeline.find((event) => event.status === "empty_returned")?.at ?? load.completedAt
  );
}

export function earningId(loadId: string, leg: EarningLine["leg"]) {
  return `earn-${loadId}-${leg}`;
}

export function reimbursementId(expenseId: string) {
  return `reimb-${expenseId}`;
}

export function ensureLedger(data: Pick<DemoData, "loads" | "drivers" | "expenses" | "ledger">) {
  const ledger = [...data.ledger];
  const known = new Set(ledger.map((entry) => entry.id));
  for (const load of data.loads) {
    if (!load.driverId) continue;
    const driver = data.drivers.find((item) => item.id === load.driverId);
    if (!driver) continue;
    for (const line of earningPlan(load, driver)) {
      if (!earningShouldPost(load, line)) continue;
      const id = earningId(load.id, line.leg);
      if (known.has(id)) continue;
      known.add(id);
      ledger.push({
        id,
        driverId: driver.id,
        loadId: load.id,
        at: earningStamp(load, line) ?? load.timeline.at(-1)?.at ?? load.createdAt,
        type: "earning",
        amount: line.amount,
        memo: `${load.id} · ${line.memo}`,
      });
    }
  }
  for (const expense of data.expenses) {
    if (!driverReimbursementDue(expense)) continue;
    const id = reimbursementId(expense.id);
    if (known.has(id)) continue;
    known.add(id);
    ledger.push({
      id,
      driverId: expense.driverId,
      loadId: expense.loadId,
      expenseId: expense.id,
      at: expense.reviewedAt ?? expense.createdAt,
      type: "reimbursement",
      amount: expense.amount,
      memo: `${expense.id} · ${expense.merchant} reimbursement`,
    });
  }
  return ledger;
}

export function driverReimbursementDue(expense: Expense) {
  return (
    expense.status === "approved" &&
    expense.paidBy === "driver" &&
    expense.reimbursementRequested
  );
}

export function driverBalance(ledger: LedgerEntry[], driverId: string) {
  return roundMoney(
    ledger.filter((entry) => entry.driverId === driverId).reduce((sum, entry) => sum + entry.amount, 0),
  );
}

export function driverPayView(load: Load, driver: Driver | undefined, ledger: LedgerEntry[]) {
  if (!driver) {
    return {
      expected: 0,
      posted: 0,
      lines: [] as Array<EarningLine & { posted: boolean }>,
      detail: "Driver pay is calculated after a driver is assigned.",
    };
  }
  const lines = earningPlan(load, driver).map((line) => ({
    ...line,
    posted: ledger.some((entry) => entry.id === earningId(load.id, line.leg)),
  }));
  const expected = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  const posted = roundMoney(
    lines.filter((line) => line.posted).reduce((sum, line) => sum + line.amount, 0),
  );
  const detail = lines
    .map((line) => `${line.memo}${line.posted ? " · posted" : " · not posted yet"}`)
    .join(" · ");
  return { expected, posted, lines, detail };
}

export function expenseBucket(category: Expense["category"]) {
  if (category === "fuel") return "fuel" as const;
  if (category === "tolls") return "tolls" as const;
  return "other" as const;
}

export function loadFinancials(
  load: Load,
  expenses: Expense[],
  ledger: LedgerEntry[],
  driver: Driver | undefined,
) {
  const related = expenses.filter((expense) => expense.loadId === load.id);
  const approved = related.filter((expense) => expense.status === "approved");
  const pending = related.filter(
    (expense) => expense.status === "awaiting_approval" || expense.status === "correction_requested",
  );
  const pay = driverPayView(load, driver, ledger);
  const fuel = roundMoney(
    approved.filter((expense) => expense.category === "fuel").reduce((sum, expense) => sum + expense.amount, 0),
  );
  const tolls = roundMoney(
    approved.filter((expense) => expense.category === "tolls").reduce((sum, expense) => sum + expense.amount, 0),
  );
  const other = roundMoney(
    approved
      .filter((expense) => expense.category !== "fuel" && expense.category !== "tolls")
      .reduce((sum, expense) => sum + expense.amount, 0),
  );
  const approvedOperating = roundMoney(fuel + tolls + other);
  const pendingTotal = roundMoney(pending.reduce((sum, expense) => sum + expense.amount, 0));
  const revenue = loadRevenue(load);
  const driverCost = driver ? pay.expected : 0;
  const contribution = roundMoney(revenue - driverCost - approvedOperating);
  const reimbursement = roundMoney(
    approved
      .filter((expense) => driverReimbursementDue(expense))
      .reduce((sum, expense) => sum + expense.amount, 0),
  );
  return {
    linehaul: load.customerRate,
    accessorials: loadAccessorials(load),
    revenue,
    fuel,
    tolls,
    other,
    approvedOperating,
    pendingTotal,
    pending,
    approved,
    driverCost,
    pay,
    contribution,
    reimbursement,
  };
}

export function windowsOverlap(a: Load, b: Load) {
  const aStart = new Date(a.appointmentStart).getTime();
  const aEnd = new Date(a.appointmentEnd).getTime();
  const bStart = new Date(b.appointmentStart).getTime();
  const bEnd = new Date(b.appointmentEnd).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function validateAssignment(
  data: Pick<DemoData, "loads" | "drivers" | "trucks" | "ledger">,
  loadId: string,
  driverId: string,
  truckId: string,
) {
  const load = data.loads.find((item) => item.id === loadId);
  const driver = data.drivers.find((item) => item.id === driverId);
  const truck = data.trucks.find((item) => item.id === truckId);
  if (!load || !driver || !truck) return { ok: false as const, reason: "Choose a load, driver, and truck." };
  if (load.status === "complete") {
    return { ok: false as const, reason: "This load is already complete." };
  }
  const posted = data.ledger.some(
    (entry) => entry.type === "earning" && entry.loadId === load.id && entry.driverId !== driverId,
  );
  if (posted) {
    return {
      ok: false as const,
      reason: "Driver pay is already posted for this load, so it can't be moved to another driver.",
    };
  }
  if (truck.operational === "out_of_service") {
    return { ok: false as const, reason: `${truck.unit} is out of service and can't be dispatched.` };
  }
  if (driver.availability === "off") {
    return {
      ok: false as const,
      reason: `${driver.name} is off today${driver.availabilityNote ? ` (${driver.availabilityNote})` : ""}.`,
    };
  }
  const conflict = data.loads.find((other) => {
    if (other.id === load.id) return false;
    if (other.status === "complete" || other.status === "created") return false;
    const sameResource = other.driverId === driverId || other.truckId === truckId;
    return sameResource && windowsOverlap(load, other);
  });
  if (conflict) {
    const who =
      conflict.driverId === driverId ? driver.name : truck.unit;
    return {
      ok: false as const,
      reason: `${who} already has ${conflict.id} during that appointment window.`,
    };
  }
  return { ok: true as const, load, driver, truck };
}

export function openLoadWarning(
  loads: Load[],
  loadId: string,
  driverId: string,
  truckId: string,
) {
  return loads.find((other) => {
    if (other.id === loadId) return false;
    if (other.status === "complete" || other.status === "created") return false;
    return other.driverId === driverId || other.truckId === truckId;
  });
}

export function currentLoad(loads: Load[], driverId: string) {
  const open = loads.filter(
    (load) => load.driverId === driverId && load.status !== "complete" && load.status !== "created",
  );
  return [...open].sort(
    (a, b) => flowIndex(b) - flowIndex(a) || a.appointmentStart.localeCompare(b.appointmentStart),
  )[0];
}

export function revenueStamp(load: Load) {
  if (load.type === "import") {
    return load.timeline.find((event) => event.status === "delivered")?.at ?? load.completedAt;
  }
  return load.timeline.find((event) => event.status === "gated_in")?.at ?? load.completedAt;
}

export function countsAsRevenue(load: Load) {
  if (load.type === "import") return reached(load, "delivered");
  return reached(load, "gated_in");
}
