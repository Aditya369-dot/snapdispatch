import type {
  DelayReason,
  DocType,
  ExpenseCategory,
  ExpenseStatus,
  PaidBy,
  PayProfile,
  ReviewStatus,
} from "@/lib/types";

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  fuel: "Fuel",
  tolls: "Tolls",
  parking: "Parking",
  scales: "Scales",
  chassis: "Chassis",
  repairs: "Repairs",
  port_fees: "Port fees",
  miscellaneous: "Miscellaneous",
};

export const PAID_BY_LABEL: Record<PaidBy, string> = {
  driver: "Driver personally",
  company_card: "Company card",
  company_cash: "Company cash",
};

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  correction_requested: "Correction requested",
};

export const DOC_LABEL: Record<DocType, string> = {
  pod: "POD / blue document",
  bol: "BOL",
  gate_receipt: "Gate receipt",
  empty_return: "Empty return receipt",
  expense_receipt: "Expense receipt",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export const DELAY_LABEL: Record<DelayReason, string> = {
  port_congestion: "Port congestion",
  customer_delay: "Customer delay",
  container_unavailable: "Container unavailable",
  traffic: "Traffic",
  equipment_issue: "Equipment issue",
  other: "Other",
};

export const DELAY_OPTIONS: DelayReason[] = [
  "port_congestion",
  "customer_delay",
  "container_unavailable",
  "traffic",
  "equipment_issue",
  "other",
];

export function payRuleLabel(pay: PayProfile) {
  if (pay.kind === "flat") {
    return `Flat · ${pay.importDelivery.toFixed(0)} delivery + ${pay.importEmpty.toFixed(0)} empty · ${pay.exportMove.toFixed(0)} export`;
  }
  if (pay.kind === "hourly") {
    return `Hourly · $${pay.rate.toFixed(2)} / hour`;
  }
  return `${pay.percent}% of customer linehaul`;
}

export function payRuleDetail(pay: PayProfile) {
  if (pay.kind === "flat") {
    return `Import delivery pays $${pay.importDelivery.toFixed(2)} when the loaded container is delivered. Empty return pays $${pay.importEmpty.toFixed(2)} when the empty is returned. Export pays $${pay.exportMove.toFixed(2)} when the full container is gated in at the port. Accessorials billed to the customer are not added to driver pay.`;
  }
  if (pay.kind === "hourly") {
    return `$${pay.rate.toFixed(2)} per estimated hour on the load. The amount posts when the move is finished (empty returned on import, or full-container gate-in on export). Hours are the demo estimate stored on the load.`;
  }
  return `${pay.percent}% of the customer linehaul only. Chassis, pre-pull, and other accessorials are excluded. The amount posts when an import is delivered or an export is gated in. Empty return is included in the percentage and is not paid again.`;
}
