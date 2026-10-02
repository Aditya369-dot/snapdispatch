import { copy, type Copy, type Lang } from "@/lib/i18n/copy";
import { phrase } from "@/lib/i18n/phrases";
import type { ExpenseCategory, ExpenseStatus, LoadType, PaidBy, PayProfile, ReviewStatus } from "@/lib/types";
import type { DriverActionName } from "@/lib/flow";

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function bundle(lang: Lang): Copy {
  return copy[lang];
}

export function statusText(lang: Lang, load: { type: LoadType; status: string }) {
  const status = bundle(lang).status;
  if (load.type === "export" && load.status === "at_customer") return status.at_shipper;
  if (load.type === "export" && load.status === "picked_up") return status.loaded;
  if (load.status === "gated_in") return status.gated_in;
  return status[load.status as keyof typeof status] ?? load.status;
}

const STATUS_EN_TO_KEY: Record<string, keyof Copy["status"]> = {
  Created: "created",
  Assigned: "assigned",
  Reassigned: "reassigned",
  Accepted: "accepted",
  "At port": "at_port",
  "Picked up": "picked_up",
  "At customer": "at_customer",
  Delivered: "delivered",
  "Empty return pending": "empty_return_pending",
  "Empty returned": "empty_returned",
  "Full container gated in": "gated_in",
  Complete: "complete",
  "At shipper": "at_shipper",
  Loaded: "loaded",
};

export function translateStatusLabel(lang: Lang, label: string) {
  const key = STATUS_EN_TO_KEY[label];
  if (!key) return phrase(lang, label);
  return bundle(lang).status[key];
}

export function actionText(lang: Lang, load: { type: LoadType }, action: DriverActionName) {
  const labels = bundle(lang).action;
  if (load.type === "export" && action === "arrive_customer") return labels.arrive_shipper;
  if (load.type === "export" && action === "pick_up") return labels.container_loaded;
  return labels[action];
}

export function payRuleLabel(pay: PayProfile, lang: Lang = "en") {
  const c = bundle(lang).pay;
  if (pay.kind === "flat") {
    return fill(c.flat, {
      delivery: pay.importDelivery.toFixed(0),
      empty: pay.importEmpty.toFixed(0),
      exportMove: pay.exportMove.toFixed(0),
    });
  }
  if (pay.kind === "hourly") return fill(c.hourly, { rate: `$${pay.rate.toFixed(2)}` });
  return fill(c.percent, { percent: pay.percent });
}

export function payRuleDetail(pay: PayProfile, lang: Lang = "en") {
  const c = bundle(lang).pay;
  if (pay.kind === "flat") {
    return fill(c.flatDetail, {
      delivery: `$${pay.importDelivery.toFixed(2)}`,
      empty: `$${pay.importEmpty.toFixed(2)}`,
      exportMove: `$${pay.exportMove.toFixed(2)}`,
    });
  }
  if (pay.kind === "hourly") return fill(c.hourlyDetail, { rate: `$${pay.rate.toFixed(2)}` });
  return fill(c.percentDetail, { percent: pay.percent });
}

export function earningMemo(lang: Lang, memo: string) {
  if (lang === "en") return memo;
  const c = bundle(lang).pay;
  const delivery = memo.match(/^Import delivery flat rate \(\$([0-9.]+)\)$/);
  if (delivery) return fill(c.deliveryMemo, { amount: `$${delivery[1]}` });
  const empty = memo.match(/^Empty return flat rate \(\$([0-9.]+)\)$/);
  if (empty) return fill(c.emptyMemo, { amount: `$${empty[1]}` });
  const exported = memo.match(/^Export gate-in flat rate \(\$([0-9.]+)\)$/);
  if (exported) return fill(c.exportMemo, { amount: `$${exported[1]}` });
  const hourly = memo.match(/^\$([0-9.]+) × ([0-9.]+) h$/);
  if (hourly) return fill(c.hourlyMemo, { rate: `$${hourly[1]}`, hours: hourly[2] });
  const percent = memo.match(/^([0-9.]+)% × \$([0-9.]+) linehaul$/);
  if (percent) return fill(c.percentMemo, { percent: percent[1], amount: `$${percent[2]}` });
  return phrase(lang, memo);
}

export function localizeMemo(lang: Lang, memo: string) {
  if (lang === "en") return memo;
  const c = bundle(lang).pay;
  const line = memo.match(/^(LD-\d+) · (.+)$/);
  if (line) return fill(c.lineMemo, { load: line[1], memo: earningMemo(lang, line[2]) });
  const reimburse = memo.match(/^(EX-\d+) · (.+) reimbursement$/);
  if (reimburse) return fill(c.reimburseMemo, { id: reimburse[1], merchant: reimburse[2] });
  return phrase(lang, memo);
}

export function localizeActivity(lang: Lang, message: string) {
  if (lang === "en") return message;
  const c = bundle(lang).activity;
  const created = message.match(/^(LD-\d+) created · ([A-Z]{4}\d{7})$/);
  if (created) return fill(c.created, { id: created[1], container: created[2] });
  const status = message.match(/^(.+) · ([A-Z]{4}\d{7}) · (.+)$/);
  if (status) return fill(c.status, { driver: status[1], container: status[2], label: translateStatusLabel(lang, status[3]) });
  const submittedAmount = message.match(/^(.+) submitted (.+) · \$([0-9.]+) for approval$/);
  if (submittedAmount) {
    return fill(c.submittedAmount, { driver: submittedAmount[1], merchant: submittedAmount[2], amount: `$${submittedAmount[3]}` });
  }
  const submitted = message.match(/^(.+) submitted (.+) for approval$/);
  if (submitted) return fill(c.submitted, { driver: submitted[1], merchant: submitted[2] });
  const reassigned = message.match(/^([A-Z]{4}\d{7}) assigned to (.+) · (WS-\d+) from (.+)$/);
  if (reassigned) return fill(c.reassigned, { container: reassigned[1], driver: reassigned[2], unit: reassigned[3], from: reassigned[4] });
  const assigned = message.match(/^([A-Z]{4}\d{7}) assigned to (.+) · (WS-\d+)$/);
  if (assigned) return fill(c.assigned, { container: assigned[1], driver: assigned[2], unit: assigned[3] });
  const delay = message.match(/^(.+) reported a delay on ([A-Z]{4}\d{7})$/);
  if (delay) return fill(c.delay, { driver: delay[1], container: delay[2] });
  const decision = message.match(/^(EX-\d+) (approved|rejected|sent back) · (.+)$/);
  if (decision) {
    const verb = decision[2] === "approved" ? c.approved : decision[2] === "rejected" ? c.rejected : c.sentBack;
    return fill(c.decision, { id: decision[1], verb, merchant: decision[3] });
  }
  const resubmitted = message.match(/^(EX-\d+) resubmitted for approval$/);
  if (resubmitted) return fill(c.resubmitted, { id: resubmitted[1] });
  const uploaded = message.match(/^(.+) uploaded (.+)$/);
  if (uploaded) return fill(c.uploaded, { driver: uploaded[1], file: uploaded[2] });
  const doc = message.match(/^(.+) (approved|rejected)$/);
  if (doc && (doc[1].includes(".") || doc[1].includes("-"))) {
    const verb = doc[2] === "approved" ? c.approved : c.rejected;
    return fill(c.docDecision, { file: doc[1], verb });
  }
  const payment = message.match(/^Recorded (ACH|Check|Cash) payment of \$([0-9.]+) for (.+)$/);
  if (payment) {
    const method = payment[1] === "Check" ? bundle(lang).drivers.check : payment[1] === "Cash" ? bundle(lang).drivers.cash : "ACH";
    return fill(c.payment, { method, amount: `$${payment[2]}`, driver: payment[3] });
  }
  const scheduled = message.match(/^Service scheduled for (WS-\d+) on (\d{4}-\d{2}-\d{2})$/);
  if (scheduled) return fill(c.scheduled, { unit: scheduled[1], date: scheduled[2] });
  const done = message.match(/^(WS-\d+) service marked complete$/);
  if (done) return fill(c.serviceDone, { unit: done[1] });
  return phrase(lang, message);
}

const REASON_EXACT: Record<string, keyof Copy["reason"]> = {
  "Container number should look like MSCU1234567.": "container",
  "Choose a customer, pickup, and destination.": "chooseEnds",
  "Set an appointment.": "appointment",
  "Enter the customer rate.": "rate",
  "Load not found.": "loadMissing",
  "This load belongs to another driver.": "otherDriver",
  "That step isn't available on this load.": "step",
  "Add a short note about the delay.": "delayNote",
  "Enter an amount greater than zero.": "amount",
  "Enter the merchant.": "merchant",
  "Enter the date.": "date",
  "Attach a receipt, use a sample, or say why the receipt is missing.": "receipt",
  "Expense not found.": "expenseMissing",
  "Add a reason for the rejection.": "rejectReason",
  "Say what needs to be corrected.": "correction",
  "Only a receipt sent back for correction can be resubmitted.": "resubmitOnly",
  "Choose approve or reject.": "chooseReview",
  "Document not found.": "docMissing",
  "Review and approve the settlement before recording a payment.": "settleFirst",
  "Enter a payment amount.": "payAmount",
  "That amount is higher than the outstanding balance.": "overBalance",
  "Choose a service date.": "serviceDate",
  "Truck not found.": "truckMissing",
  "Enter the odometer.": "odometer",
  "Choose a load, driver, and truck.": "chooseAll",
  "This load is already complete.": "alreadyComplete",
  "Driver pay is already posted for this load, so it can't be moved to another driver.": "payPosted",
  "Choose a driver and a truck.": "chooseDriverTruck",
};

export function localizeReason(lang: Lang, reason: string) {
  if (lang === "en" || !reason) return reason;
  const key = REASON_EXACT[reason];
  if (key) return bundle(lang).reason[key];
  const c = bundle(lang).reason;
  const out = reason.match(/^(WS-\d+) is out of service and can't be dispatched\.$/);
  if (out) return fill(c.outOfService, { unit: out[1] });
  const off = reason.match(/^(.+) is off today(?: \((.+)\))?\.$/);
  if (off) {
    const note = off[2] ? ` (${phrase(lang, off[2])})` : "";
    return fill(c.offToday, { name: off[1], note });
  }
  const conflict = reason.match(/^(.+) already has (LD-\d+) during that appointment window\.$/);
  if (conflict) return fill(c.conflict, { who: conflict[1], id: conflict[2] });
  return phrase(lang, reason);
}

export function localize(lang: Lang, value: string) {
  if (!value) return value;
  const reason = localizeReason(lang, value);
  if (reason !== value) return reason;
  const activity = localizeActivity(lang, value);
  if (activity !== value) return activity;
  const memo = localizeMemo(lang, value);
  if (memo !== value) return memo;
  return phrase(lang, value);
}

const EXCEL_COLUMNS: Record<string, string> = {
  "Load ID": "ID de carga",
  Container: "Contenedor",
  Booking: "Booking",
  Type: "Tipo",
  Customer: "Cliente",
  Pickup: "Recolección",
  Destination: "Destino",
  Appointment: "Cita",
  Driver: "Operador",
  Truck: "Unidad",
  Status: "Estado",
  "Customer rate": "Tarifa del cliente",
  Accessorials: "Accesorios",
  "Last free day": "Último día libre",
  "Empty return deadline": "Límite del vacío",
  Notes: "Notas",
  Phone: "Teléfono",
  "Pay rule": "Regla de pago",
  Availability: "Disponibilidad",
  "Completed loads": "Cargas completadas",
  "Outstanding balance": "Saldo pendiente",
  Expense: "Gasto",
  Date: "Fecha",
  Load: "Carga",
  Category: "Categoría",
  Merchant: "Comercio",
  Amount: "Monto",
  "Paid by": "Pagado por",
  "Reimbursement requested": "Reembolso solicitado",
  Approval: "Aprobación",
  When: "Cuándo",
  Method: "Método",
  Reference: "Referencia",
  Memo: "Concepto",
  Unit: "Unidad",
  "Make / model": "Marca / modelo",
  Odometer: "Odómetro",
  Operational: "Operación",
  "Maintenance status": "Estado de mantenimiento",
  "Next service date": "Fecha del próximo servicio",
  "Next service miles": "Millas del próximo servicio",
  "Open issues": "Fallas abiertas",
  "As of": "Fecha de corte",
  Gallons: "Galones",
  "Period miles": "Millas del periodo",
  Expenses: "Gastos",
  Rate: "Tarifa",
};

export function excelColumn(lang: Lang, column: string) {
  if (lang === "en") return column;
  return EXCEL_COLUMNS[column] ?? column;
}

export function excelCell(lang: Lang, column: string, value: string | number) {
  const text = String(value ?? "");
  if (lang === "en" || text === "") return text;
  const c = bundle(lang);
  if (column === "Notes" || column === "Memo" || column === "Open issues") {
    return text
      .split("; ")
      .map((part) => localize(lang, part))
      .join("; ");
  }
  if (column === "Type" && (text === "import" || text === "export")) return text === "import" ? c.import : c.export;
  if (column === "Status" || column === "Status") {
    if (text === "Unassigned") return c.unassigned;
    if (text === "Assigned") return c.status.assigned;
    if (STATUS_EN_TO_KEY[text]) return translateStatusLabel(lang, text);
  }
  if (column === "Category") {
    const match = (Object.keys(c.category) as ExpenseCategory[]).find((key) => copy.en.category[key] === text);
    if (match) return c.category[match];
  }
  if (column === "Paid by") {
    const match = (Object.keys(c.paidBy) as PaidBy[]).find((key) => copy.en.paidBy[key] === text);
    if (match) return c.paidBy[match];
  }
  if (column === "Approval") {
    const match = (Object.keys(c.expenseStatus) as ExpenseStatus[]).find((key) => key === text);
    if (match) return c.expenseStatus[match];
  }
  if (column === "Reimbursement requested") return text === "Yes" ? c.yes : text === "No" ? c.no : text;
  if (column === "Availability") return text === "available" ? c.available : text === "off" ? c.off : text;
  if (column === "Pay rule") {
    if (text === "flat") return "Fijo";
    if (text === "hourly") return "Por hora";
    if (text === "percentage") return "Porcentaje";
  }
  if (column === "Type" && c.ledger[text as keyof Copy["ledger"]]) return c.ledger[text as keyof Copy["ledger"]];
  if (column === "Operational") return text === "in_service" ? c.trucks.inService : text === "out_of_service" ? c.trucks.out : text;
  if (column === "Maintenance status") {
    if (text === "healthy") return c.trucks.healthy;
    if (text === "due_soon") return c.trucks.dueSoon;
    if (text === "overdue") return c.trucks.overdue;
    if (text === "out_of_service") return c.trucks.out;
  }
  if (column === "Method") {
    if (text === "Check") return c.drivers.check;
    if (text === "Cash") return c.drivers.cash;
  }
  if (column === "Review" || text === "pending" || text === "approved" || text === "rejected") {
    if (c.review[text as ReviewStatus]) return c.review[text as ReviewStatus];
  }
  return localize(lang, text);
}
