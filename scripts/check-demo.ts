import { driverBalance, driverReimbursementDue, loadFinancials, validateAssignment, windowsOverlap } from "../lib/finance";
import { maintenanceTone, overviewMetrics } from "../lib/metrics";
import { PITCH_DRIVER_ID, PITCH_LOAD_ID, PITCH_TRUCK_ID } from "../lib/reference";
import { TARGET_BALANCES, buildSeed } from "../lib/seed";

const data = buildSeed();
const problems: string[] = [];

if (data.loads.length !== 40) problems.push(`loads ${data.loads.length}`);
if (data.drivers.length !== 16) problems.push(`drivers ${data.drivers.length}`);
if (data.trucks.length !== 12) problems.push(`trucks ${data.trucks.length}`);

const ids = new Set(data.loads.map((load) => load.id));
if (ids.size !== 40) problems.push("duplicate load ids");
const containers = new Set(data.loads.map((load) => load.containerNumber));
if (containers.size !== 40) problems.push("duplicate containers");

const pitch = data.loads.find((load) => load.id === PITCH_LOAD_ID);
if (!pitch || pitch.driverId || pitch.status !== "created" || pitch.containerNumber !== "TCLU4829137") {
  problems.push("pitch load is not the unassigned Northbay container");
}

const oos = data.trucks.filter((truck) => truck.operational === "out_of_service");
if (oos.length !== 1) problems.push(`oos ${oos.length}`);
const tones = data.trucks.map((truck) => maintenanceTone(truck, data.thresholds));
if (tones.filter((tone) => tone === "overdue").length !== 1) problems.push("overdue count");
if (tones.filter((tone) => tone === "due_soon").length !== 1) problems.push("due soon count");

for (const driver of data.drivers) {
  const actual = driverBalance(data.ledger, driver.id);
  const target = TARGET_BALANCES[driver.id];
  if (Math.abs(actual - target) > 0.02) problems.push(`${driver.name} balance ${actual} != ${target}`);
}

const ledgerIds = data.ledger.map((entry) => entry.id);
if (new Set(ledgerIds).size !== ledgerIds.length) problems.push("duplicate ledger ids");

for (const expense of data.expenses) {
  const reimbs = data.ledger.filter((entry) => entry.id === `reimb-${expense.id}`);
  if (driverReimbursementDue(expense) && reimbs.length !== 1) problems.push(`missing reimb ${expense.id}`);
  if (!driverReimbursementDue(expense) && reimbs.length !== 0) problems.push(`extra reimb ${expense.id}`);
}

const open = data.loads.filter((load) => load.status !== "complete" && load.status !== "created");
for (let i = 0; i < open.length; i += 1) {
  for (let j = i + 1; j < open.length; j += 1) {
    const a = open[i];
    const b = open[j];
    const shared = (a.driverId && a.driverId === b.driverId) || (a.truckId && a.truckId === b.truckId);
    if (shared && windowsOverlap(a, b)) problems.push(`overlap ${a.id} ${b.id}`);
  }
}

const metrics = overviewMetrics(data);
if (metrics.unassigned.length < 4) problems.push("unassigned count");
if (metrics.completedToday.length !== 3) problems.push(`completed today ${metrics.completedToday.length}`);
if (metrics.weekRevenue < 5000) problems.push(`week revenue ${metrics.weekRevenue}`);
if (metrics.service.length !== 3) problems.push(`service trucks ${metrics.service.length}`);

const rosa = data.drivers.find((driver) => driver.id === PITCH_DRIVER_ID);
const truck = data.trucks.find((item) => item.id === PITCH_TRUCK_ID);
if (!rosa || !truck || !pitch) problems.push("pitch actors missing");
if (rosa && truck && pitch) {
  const assign = validateAssignment(data, pitch.id, rosa.id, truck.id);
  if (!assign.ok) problems.push(`pitch assign blocked: ${assign.reason}`);
}

const sample = data.loads.find((load) => load.id === "LD-10401");
const marcus = data.drivers.find((driver) => driver.id === "drv-marcus");
if (sample && marcus) {
  const fin = loadFinancials(sample, data.expenses, data.ledger, marcus);
  const toll = data.expenses.find((expense) => expense.loadId === sample.id && expense.category === "fuel");
  if (toll && fin.approvedOperating < toll.amount) problems.push("fuel missing from operating cost");
  if (Math.abs(fin.contribution - (fin.revenue - fin.driverCost - fin.approvedOperating)) > 0.02) {
    problems.push("contribution formula");
  }
}

const companyPaid = data.expenses.find((expense) => expense.id === "EX-3101");
if (companyPaid && data.ledger.some((entry) => entry.expenseId === companyPaid.id)) {
  problems.push("company fuel created a driver reimbursement");
}

console.log(
  JSON.stringify(
    {
      loads: data.loads.length,
      active: metrics.active.length,
      unassigned: metrics.unassigned.length,
      completedToday: metrics.completedToday.length,
      weekRevenue: metrics.weekRevenue,
      outstanding: metrics.outstanding,
      service: metrics.service.map((truckItem) => truckItem.unit),
      expenses: data.expenses.length,
      documents: data.documents.length,
      problems,
    },
    null,
    2,
  ),
);

if (problems.length) process.exit(1);
