import type { Load, LoadStatus, LoadType } from "@/lib/types";

export const IMPORT_FLOW: { status: LoadStatus; label: string }[] = [
  { status: "created", label: "Created" },
  { status: "assigned", label: "Assigned" },
  { status: "accepted", label: "Accepted" },
  { status: "at_port", label: "At port" },
  { status: "picked_up", label: "Picked up" },
  { status: "at_customer", label: "At customer" },
  { status: "delivered", label: "Delivered" },
  { status: "empty_return_pending", label: "Empty return pending" },
  { status: "empty_returned", label: "Empty returned" },
  { status: "complete", label: "Complete" },
];

export const EXPORT_FLOW: { status: LoadStatus; label: string }[] = [
  { status: "created", label: "Created" },
  { status: "assigned", label: "Assigned" },
  { status: "accepted", label: "Accepted" },
  { status: "at_customer", label: "At shipper" },
  { status: "picked_up", label: "Loaded" },
  { status: "at_port", label: "At port" },
  { status: "gated_in", label: "Full container gated in" },
  { status: "complete", label: "Complete" },
];

export function flowFor(type: LoadType) {
  return type === "import" ? IMPORT_FLOW : EXPORT_FLOW;
}

export function flowIndex(load: Pick<Load, "type" | "status">) {
  return flowFor(load.type).findIndex((step) => step.status === load.status);
}

export function reached(load: Pick<Load, "type" | "status">, status: LoadStatus) {
  const flow = flowFor(load.type);
  const target = flow.findIndex((step) => step.status === status);
  if (target < 0) return false;
  return flowIndex(load) >= target;
}

export function statusLabel(load: Pick<Load, "type" | "status">) {
  return flowFor(load.type).find((step) => step.status === load.status)?.label ?? load.status;
}

export type DriverActionName =
  | "accept"
  | "arrive_port"
  | "pick_up"
  | "arrive_customer"
  | "deliver"
  | "empty_returned"
  | "gate_in"
  | "complete";

export function nextDriverAction(load: Load): { action: DriverActionName; label: string } | null {
  if (load.type === "import") {
    switch (load.status) {
      case "assigned":
        return { action: "accept", label: "Accept Load" };
      case "accepted":
        return { action: "arrive_port", label: "Arrived at Port" };
      case "at_port":
        return { action: "pick_up", label: "Picked Up" };
      case "picked_up":
        return { action: "arrive_customer", label: "Arrived at Customer" };
      case "at_customer":
        return { action: "deliver", label: "Delivered" };
      case "empty_return_pending":
        return { action: "empty_returned", label: "Empty Returned" };
      case "empty_returned":
        return { action: "complete", label: "Mark Complete" };
      default:
        return null;
    }
  }
  switch (load.status) {
    case "assigned":
      return { action: "accept", label: "Accept Load" };
    case "accepted":
      return { action: "arrive_customer", label: "Arrived at Shipper" };
    case "at_customer":
      return { action: "pick_up", label: "Container Loaded" };
    case "picked_up":
      return { action: "arrive_port", label: "Arrived at Port" };
    case "at_port":
      return { action: "gate_in", label: "Gated In at Port" };
    case "gated_in":
      return { action: "complete", label: "Mark Complete" };
    default:
      return null;
  }
}
