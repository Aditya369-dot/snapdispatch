import { flowIndex } from "@/lib/flow";
import { driverBalance } from "@/lib/finance";
import { PITCH_CONTAINER, PITCH_DRIVER_ID, PITCH_LOAD_ID, PITCH_TRUCK_ID } from "@/lib/reference";
import type { DemoData, TourState, WalkthroughState } from "@/lib/types";

export interface WalkContext {
  data: DemoData;
  view: "owner" | "driver";
  actingDriverId: string;
  tour: TourState;
  walkthrough: WalkthroughState;
  pathname: string;
}

export interface WalkStep {
  title: string;
  body: string;
  target?: string;
  href?: string;
  view?: "owner" | "driver";
  ready: (ctx: WalkContext) => boolean;
}

function pitchLoad(ctx: WalkContext) {
  return ctx.data.loads.find((load) => load.id === PITCH_LOAD_ID);
}

function pitchToll(ctx: WalkContext) {
  return ctx.data.expenses.find(
    (expense) =>
      expense.loadId === PITCH_LOAD_ID &&
      expense.category === "tolls" &&
      expense.amount === 45 &&
      expense.paidBy === "driver" &&
      expense.reimbursementRequested &&
      expense.attachmentIds.length > 0,
  );
}

function pastPickup(ctx: WalkContext) {
  const load = pitchLoad(ctx);
  if (!load) return false;
  const picked = flowIndex({ type: "import", status: "picked_up" });
  return flowIndex(load) >= picked;
}

function pastDelivery(ctx: WalkContext) {
  const load = pitchLoad(ctx);
  if (!load) return false;
  return flowIndex(load) >= flowIndex({ type: "import", status: "empty_return_pending" });
}

export const WALK_STEPS: WalkStep[] = [
  {
    title: "Find the unassigned container",
    body: `Northbay Foods has container ${PITCH_CONTAINER} with no driver. It is on the dispatch list, filtered to unassigned loads. Select that row.`,
    target: "pitch-load",
    href: "/dispatch?assignment=unassigned",
    view: "owner",
    ready: (ctx) => ctx.tour.selectedLoadId === PITCH_LOAD_ID || ctx.tour.financialsLoadId === PITCH_LOAD_ID,
  },
  {
    title: "Assign Rosa Delgado and WS-119",
    body: "Open Assign on that container. Choose Rosa Delgado and truck WS-119. Andre is off, so WS-119 is sitting in the Oakland yard. Out-of-service trucks and overlapping appointments stay blocked.",
    target: "assign-pitch",
    ready: (ctx) => {
      const load = pitchLoad(ctx);
      return Boolean(load && load.driverId === PITCH_DRIVER_ID && load.truckId === PITCH_TRUCK_ID && load.status !== "created");
    },
  },
  {
    title: "Switch to Rosa's phone",
    body: "Use the view switcher at the top and open Rosa Delgado. This is the same load, seen from the driver's side.",
    target: "demo-switcher",
    ready: (ctx) => ctx.view === "driver" && ctx.actingDriverId === PITCH_DRIVER_ID,
  },
  {
    title: "Accept the load and record the pickup",
    body: "On Rosa's phone, tap Accept Load, then Arrived at Port, then Picked Up. Each tap updates the dispatch board and the load timeline.",
    target: "next-step",
    ready: pastPickup,
  },
  {
    title: "Submit a $45 toll Rosa paid",
    body: "Add an expense on this load: Tolls, $45, FasTrak, paid by the driver personally, reimbursement requested. Use the sample receipt, then submit.",
    target: "add-expense",
    ready: (ctx) => Boolean(pitchToll(ctx)),
  },
  {
    title: "Approve the toll as the owner",
    body: "Switch back to the owner view and open Expenses. Approve Rosa's $45 FasTrak receipt. Approval and reimbursement are tracked separately.",
    target: "approve-toll",
    href: "/expenses?status=awaiting_approval",
    ready: (ctx) => pitchToll(ctx)?.status === "approved",
  },
  {
    title: "Look at the load cost and her reimbursement",
    body: "Open the load's Financials tab. The $45 toll is now a direct cost. The reimbursement owed to Rosa is listed beside it and is not counted a second time. Contribution is before overhead and taxes.",
    target: "load-financials",
    href: `/loads/${PITCH_LOAD_ID}?tab=financials`,
    view: "owner",
    ready: (ctx) => ctx.tour.financialsLoadId === PITCH_LOAD_ID && pitchToll(ctx)?.status === "approved",
  },
  {
    title: "Mark the delivery and upload the blue POD",
    body: "Switch to Rosa again. Continue the next step until the container is Delivered, then upload the sample blue delivery document. It shows up immediately for the owner to review.",
    target: "next-step",
    ready: (ctx) =>
      pastDelivery(ctx) &&
      ctx.data.documents.some((doc) => doc.loadId === PITCH_LOAD_ID && doc.type === "pod"),
  },
  {
    title: "Empty return is a separate step",
    body: "Delivery does not close an import. Rosa still has to bring the empty container back before the deadline. That requirement is on her phone and on the load.",
    target: "empty-return",
    ready: (ctx) => pastDelivery(ctx) && Boolean(ctx.tour.sawEmptyReturn),
  },
  {
    title: "Record the empty return",
    body: "Tap Empty Returned. The timeline records it apart from the delivery, and the empty-return portion of her flat pay posts.",
    target: "next-step",
    ready: (ctx) => {
      const load = pitchLoad(ctx);
      if (!load) return false;
      return flowIndex(load) >= flowIndex({ type: "import", status: "empty_returned" });
    },
  },
  {
    title: "Review the settlement and record a partial payment",
    body: "Open Rosa's pay ledger. Approve the settlement, then record a partial payment of $400. It reduces her balance in the demo only. Nothing is sent to a bank.",
    target: "record-payment",
    href: `/drivers/${PITCH_DRIVER_ID}`,
    view: "owner",
    ready: (ctx) =>
      ctx.data.ledger.some(
        (entry) =>
          entry.type === "payment" &&
          entry.driverId === PITCH_DRIVER_ID &&
          entry.at >= ctx.walkthrough.startedAt,
      ),
  },
  {
    title: "Balance and the Excel preview",
    body: "Open the Excel page. Rosa's balance matches the spreadsheet because both use the same demo records. Download the file or run the simulated sync. Nothing is sent to Excel or a Microsoft account.",
    target: "excel-preview",
    href: "/excel",
    view: "owner",
    ready: (ctx) => ctx.pathname.startsWith("/excel"),
  },
];

export function walkBalanceHint(data: DemoData) {
  return driverBalance(data.ledger, PITCH_DRIVER_ID);
}
