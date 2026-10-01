import { CATEGORY_LABEL, PAID_BY_LABEL } from "@/lib/labels";
import { maintenanceTone } from "@/lib/metrics";
import { customer, place } from "@/lib/reference";
import { statusLabel } from "@/lib/flow";
import { driverBalance } from "@/lib/finance";
import type { DemoData } from "@/lib/types";
import * as XLSX from "xlsx";

function driverName(data: DemoData, id?: string) {
  return data.drivers.find((driver) => driver.id === id)?.name ?? "";
}

function truckUnit(data: DemoData, id?: string) {
  return data.trucks.find((truck) => truck.id === id)?.unit ?? "";
}

export function workbookRows(data: DemoData) {
  const loads = data.loads.map((load) => ({
    "Load ID": load.id,
    Container: load.containerNumber,
    Booking: load.bookingNumber,
    Type: load.type,
    Customer: customer(load.customerId)?.name ?? "",
    Pickup: place(load.pickupKey)?.name ?? "",
    Destination: place(load.destinationKey)?.name ?? "",
    Appointment: load.appointmentStart,
    Driver: driverName(data, load.driverId),
    Truck: truckUnit(data, load.truckId),
    Status: statusLabel(load),
    "Customer rate": load.customerRate,
    Accessorials: load.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0),
    "Last free day": load.lastFreeDay ?? "",
    "Empty return deadline": load.emptyReturnDeadline ?? "",
    Notes: load.notes,
  }));
  const drivers = data.drivers.map((driver) => ({
    Driver: driver.name,
    Phone: driver.phone,
    Truck: truckUnit(data, driver.truckId),
    "Pay rule": driver.pay.kind,
    Availability: driver.availability,
    "Completed loads": data.loads.filter((load) => load.driverId === driver.id && load.status === "complete").length,
    "Outstanding balance": driverBalance(data.ledger, driver.id),
  }));
  const expenses = data.expenses.map((expense) => ({
    Expense: expense.id,
    Date: expense.date,
    Load: expense.loadId ?? "",
    Driver: driverName(data, expense.driverId),
    Truck: truckUnit(data, expense.truckId),
    Category: CATEGORY_LABEL[expense.category],
    Merchant: expense.merchant,
    Amount: expense.amount,
    "Paid by": PAID_BY_LABEL[expense.paidBy],
    "Reimbursement requested": expense.reimbursementRequested ? "Yes" : "No",
    Approval: expense.status,
    Notes: expense.notes,
  }));
  const payments = data.ledger
    .filter((entry) => entry.type === "payment" || entry.type === "earning" || entry.type === "reimbursement" || entry.type === "advance" || entry.type === "adjustment" || entry.type === "opening")
    .map((entry) => ({
      When: entry.at,
      Driver: driverName(data, entry.driverId),
      Type: entry.type,
      Amount: entry.amount,
      Load: entry.loadId ?? "",
      Method: entry.method ?? "",
      Reference: entry.reference ?? "",
      Memo: entry.memo,
    }));
  const maintenance = data.trucks.map((truck) => ({
    Unit: truck.unit,
    "Make / model": `${truck.year} ${truck.make} ${truck.model}`,
    Driver: driverName(data, truck.driverId),
    Odometer: truck.odometer,
    Operational: truck.operational,
    "Maintenance status": maintenanceTone(truck, data.thresholds),
    "Next service date": truck.nextServiceDate,
    "Next service miles": truck.nextServiceMiles,
    "Open issues": data.issues.filter((issue) => issue.truckId === truck.id && issue.status === "open").map((issue) => issue.summary).join("; "),
  }));
  return { loads, drivers, expenses, payments, maintenance };
}

export function downloadWorkbook(data: DemoData) {
  const rows = workbookRows(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.loads), "Loads");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.drivers), "Drivers");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.expenses), "Expenses");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.payments), "Payments");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.maintenance), "Maintenance");
  XLSX.writeFile(book, "SnapDispatch-Westshore-demo.xlsx");
}

export function downloadCsv(name: string, rows: Record<string, string | number>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SnapDispatch-${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const SAMPLE_IMPORT_ROWS = [
  { Load: "LD-SAMPLE-1", Container: "MSCU1002003", Customer: "Northbay Foods", Driver: "Rosa Delgado", Status: "Unassigned", Rate: 615 },
  { Load: "LD-SAMPLE-2", Container: "CMAU1002004", Customer: "Apex Home Goods", Driver: "", Status: "Unassigned", Rate: 980 },
  { Load: "LD-SAMPLE-3", Container: "OOLU1002005", Customer: "Lumen Electronics", Driver: "Elena Vasquez", Status: "Assigned", Rate: 540 },
];
