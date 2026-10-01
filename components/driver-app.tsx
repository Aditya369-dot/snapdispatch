"use client";

import { DocumentPreview } from "@/components/document-preview";
import { ExpenseSheet } from "@/components/expense-sheet";
import { StatusBadge, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { putFile } from "@/lib/files";
import { currentLoad, driverBalance, driverPayView } from "@/lib/finance";
import { nextDriverAction, reached } from "@/lib/flow";
import { formatDate, formatTime, money } from "@/lib/format";
import { DELAY_LABEL, DELAY_OPTIONS, EXPENSE_STATUS_LABEL, payRuleDetail } from "@/lib/labels";
import { customer, place } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import type { DelayReason, Load } from "@/lib/types";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Tab = "today" | "loads" | "expenses" | "earnings" | "profile";

export function DriverApp() {
  const [tab, setTab] = useState<Tab>("today");
  const driverId = useDemo((state) => state.actingDriverId);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "today" ? <Today onJump={setTab} /> : null}
        {tab === "loads" ? <MyLoads /> : null}
        {tab === "expenses" ? <MyExpenses /> : null}
        {tab === "earnings" ? <Earnings /> : null}
        {tab === "profile" ? <Profile /> : null}
      </div>
      <nav className="grid grid-cols-5 border-t bg-white text-[11px]">
        {(
          [
            ["today", "Today"],
            ["loads", "My Loads"],
            ["expenses", "Expenses"],
            ["earnings", "Earnings"],
            ["profile", "Profile"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={cn("px-1 py-2", tab === id ? "font-semibold text-[#1d6fe8]" : "text-[#5c6b80]")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <span className="sr-only">{driverId}</span>
    </div>
  );
}

function Today({ onJump }: { onJump: (tab: Tab) => void }) {
  const demo = useDemo();
  const driver = demo.drivers.find((item) => item.id === demo.actingDriverId);
  const truck = demo.trucks.find((item) => item.id === driver?.truckId);
  const load = driver ? currentLoad(demo.loads, driver.id) : undefined;
  const [delayOpen, setDelayOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const showEmpty = Boolean(load && load.type === "import" && reached(load, "empty_return_pending"));
  const markTour = demo.markTour;
  useEffect(() => {
    if (showEmpty) markTour({ sawEmptyReturn: true });
  }, [showEmpty, markTour]);

  if (!driver) return null;
  const assignedTruck = demo.trucks.find((item) => item.id === (load?.truckId ?? driver.truckId));
  const pay = load ? driverPayView(load, driver, demo.ledger) : undefined;
  const action = load ? nextDriverAction(load) : null;

  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="text-xs text-[#5c6b80]">Good morning</p>
        <h1 className="text-xl font-semibold">{driver.name}</h1>
        <p className="text-sm text-[#5c6b80]">{assignedTruck ? `${assignedTruck.unit} · ${assignedTruck.make} ${assignedTruck.model}` : "No truck assigned"}</p>
      </div>
      {driver.availability === "off" ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{driver.availabilityNote ?? "Off today"}</p>
      ) : null}
      {!load ? (
        <div className="rounded-xl border bg-[#f8fafc] p-4">
          <p className="font-medium">No active load</p>
          <p className="mt-1 text-sm text-[#5c6b80]">You’re clear for the next dispatch. New work will show up here as soon as it’s assigned.</p>
        </div>
      ) : (
        <article className="space-y-3 rounded-xl border p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[#5c6b80]">{load.id} · {load.type === "import" ? "Import" : "Export"}</p>
              <p className="text-lg font-semibold tracking-tight">{load.containerNumber}</p>
              <p className="text-sm">{customer(load.customerId)?.name}</p>
            </div>
            <StatusBadge load={load} />
          </div>
          <Stop label={load.type === "export" ? "Shipper" : "Pickup"} name={place(load.pickupKey)?.name} address={place(load.pickupKey)?.address} />
          <Stop label={load.type === "export" ? "Port" : "Delivery"} name={place(load.destinationKey)?.name} address={place(load.destinationKey)?.address} />
          <p className="text-sm">
            Appointment {formatTime(load.appointmentStart)}–{formatTime(load.appointmentEnd)}
          </p>
          {pay ? (
            <p className="text-sm">
              Expected earnings <span className="font-semibold">{money(pay.expected)}</span>
              <span className="mt-0.5 block text-xs text-[#5c6b80]">{pay.detail}</span>
            </p>
          ) : null}
          {load.delays.length ? (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              Delay reported · {DELAY_LABEL[load.delays.at(-1)!.reason]}
            </p>
          ) : null}
          {showEmpty ? <EmptyReturn load={load} /> : null}
          {action ? (
            <Button
              data-tour="next-step"
              className="h-12 w-full text-base"
              onClick={() => {
                const result = demo.driverAction(load.id, action.action);
                if (!result.ok) toast.error(result.reason);
                else toast.success(action.label);
              }}
            >
              {action.label}
            </Button>
          ) : (
            <p className="text-sm text-emerald-800">This move is complete.</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => setDelayOpen(true)}>
              Report delay
            </Button>
            <Button data-tour="add-expense" variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
              Add expense
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPodOpen(true)} disabled={load.type === "import" && !reached(load, "at_customer")}>
              {load.type === "import" ? "Upload POD" : "Upload doc"}
            </Button>
          </div>
        </article>
      )}
      <button className="text-sm text-[#1d6fe8]" onClick={() => onJump("loads")}>
        See all of your loads
      </button>
      <DelaySheet open={delayOpen} onOpenChange={setDelayOpen} loadId={load?.id} />
      <ExpenseSheet open={expenseOpen} onOpenChange={setExpenseOpen} driverId={driver.id} loadId={load?.id} truckId={load?.truckId ?? truck?.id} />
      <PodSheet open={podOpen} onOpenChange={setPodOpen} load={load} driverName={driver.name} />
    </div>
  );
}

function EmptyReturn({ load }: { load: Load }) {
  const returned = reached(load, "empty_returned");
  return (
    <div data-tour="empty-return" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-semibold text-amber-950">Empty return {returned ? "recorded" : "still required"}</p>
      <p className="mt-1 text-amber-950">
        Delivery and the empty return are separate. Bring {load.containerNumber} back to {place(load.pickupKey)?.name}.
      </p>
      <p className="mt-1 text-xs text-amber-900">
        Deadline {load.emptyReturnDeadline ? formatDate(`${load.emptyReturnDeadline}T12:00:00-07:00`) : "not set"}
      </p>
    </div>
  );
}

function Stop({ label, name, address }: { label: string; name?: string; address?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-[#5c6b80] uppercase">{label}</p>
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs text-[#5c6b80]">{address}</p>
    </div>
  );
}

function DelaySheet({ open, onOpenChange, loadId }: { open: boolean; onOpenChange: (open: boolean) => void; loadId?: string }) {
  const reportDelay = useDemo((state) => state.reportDelay);
  const [reason, setReason] = useState<DelayReason>("port_congestion");
  const [note, setNote] = useState("");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Report a delay</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 px-4">
          {DELAY_OPTIONS.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <input type="radio" name="delay" checked={reason === item} onChange={() => setReason(item)} />
              {DELAY_LABEL[item]}
            </label>
          ))}
          <Label htmlFor="delay-note">What happened</Label>
          <Textarea id="delay-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </div>
        <SheetFooter>
          <Button
            onClick={() => {
              if (!loadId) return;
              const result = reportDelay(loadId, reason, note);
              if (!result.ok) {
                toast.error(result.reason);
                return;
              }
              toast.success("Delay reported");
              setNote("");
              onOpenChange(false);
            }}
          >
            Submit delay
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PodSheet({
  open,
  onOpenChange,
  load,
  driverName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load?: Load;
  driverName: string;
}) {
  const addDocument = useDemo((state) => state.addDocument);
  const documents = useDemo((state) => state.documents);
  const docs = documents.filter((doc) => doc.loadId === load?.id && (doc.type === "pod" || doc.type === "gate_receipt"));
  if (!load) return null;
  const type = load.type === "import" ? "pod" : "gate_receipt";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{load.type === "import" ? "Upload blue POD" : "Upload gate receipt"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                const result = addDocument({
                  loadId: load.id,
                  driverId: load.driverId,
                  type,
                  attachment: {
                    fileName: load.type === "import" ? `Blue-POD-${load.containerNumber}.svg` : `Gate-${load.containerNumber}.svg`,
                    mimeType: "image/svg+xml",
                    isSample: true,
                    sampleKey: load.type === "import" ? "blue-pod" : "generic",
                    sampleParams: {
                      container: load.containerNumber,
                      loadId: load.id,
                      customer: customer(load.customerId)?.name ?? "",
                      driver: driverName,
                      when: "Oct 1, 2026",
                      destination: place(load.destinationKey)?.name ?? "",
                      merchant: "Port gate",
                      memo: "Full container gate-in",
                      reference: load.containerNumber,
                      amount: "$0.00",
                    },
                  },
                });
                if (!result.ok) toast.error(result.reason);
                else toast.success("Document sent for review");
              }}
            >
              {load.type === "import" ? "Use sample blue POD" : "Use sample gate receipt"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <label>
                Choose file
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    void (async () => {
                      const blobId = `blob-${crypto.randomUUID()}`;
                      await putFile(blobId, file);
                      const result = addDocument({
                        loadId: load.id,
                        driverId: load.driverId,
                        type,
                        attachment: { fileName: file.name, mimeType: file.type || "application/octet-stream", blobId, isSample: false },
                      });
                      if (!result.ok) toast.error(result.reason);
                      else toast.success("Document sent for review");
                    })();
                  }}
                />
              </label>
            </Button>
          </div>
          <p className="text-xs text-[#5c6b80]">The sample blue document is marked synthetic. It is not a real proof of delivery.</p>
          {docs.map((doc) => (
            <div key={doc.id} className="space-y-2 rounded-md border p-2">
              <div className="flex items-center justify-between text-xs">
                <span>{doc.fileName}</span>
                <TonePill tone={doc.reviewStatus === "approved" ? "ok" : doc.reviewStatus === "rejected" ? "late" : "warn"}>{doc.reviewStatus}</TonePill>
              </div>
              <DocumentPreview doc={doc} />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MyLoads() {
  const demo = useDemo();
  const mine = demo.loads.filter((load) => load.driverId === demo.actingDriverId);
  const groups = [
    { title: "Now", loads: mine.filter((load) => load.status !== "complete" && load.status !== "created") },
    { title: "Upcoming", loads: mine.filter((load) => load.status === "assigned" || load.status === "accepted") },
    { title: "Done", loads: mine.filter((load) => load.status === "complete") },
  ];
  const now = groups[0].loads.filter((load) => !["assigned", "accepted"].includes(load.status));
  return (
    <div className="space-y-4 p-3">
      <h1 className="text-lg font-semibold">My loads</h1>
      <Section title="In progress" loads={now} />
      <Section title="Accepted or assigned" loads={groups[1].loads} />
      <Section title="Completed" loads={groups[2].loads} />
      {mine.length === 0 ? <p className="text-sm text-[#5c6b80]">No loads yet.</p> : null}
    </div>
  );
}

function Section({ title, loads }: { title: string; loads: Load[] }) {
  if (!loads.length) return null;
  return (
    <section>
      <h2 className="mb-1 text-xs font-medium tracking-wide text-[#5c6b80] uppercase">{title}</h2>
      <div className="space-y-2">
        {loads.map((load) => (
          <div key={load.id} className="rounded-lg border p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{load.containerNumber}</p>
              <StatusBadge load={load} />
            </div>
            <p className="text-xs text-[#5c6b80]">
              {load.id} · {customer(load.customerId)?.name} · {formatTime(load.appointmentStart)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MyExpenses() {
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const driver = demo.drivers.find((item) => item.id === demo.actingDriverId);
  const load = driver ? currentLoad(demo.loads, driver.id) : undefined;
  const rows = demo.expenses.filter((expense) => expense.driverId === demo.actingDriverId);
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Expenses</h1>
        <Button size="sm" disabled={!load} onClick={() => setOpen(true)}>
          Add
        </Button>
      </div>
      {!load ? <p className="text-xs text-[#5c6b80]">Add an expense when you have an active load.</p> : null}
      {rows.length === 0 ? <p className="text-sm text-[#5c6b80]">No expenses yet.</p> : null}
      {rows.map((expense) => (
        <div key={expense.id} className="rounded-lg border p-2 text-sm">
          <div className="flex justify-between gap-2">
            <p className="font-medium">{expense.merchant}</p>
            <p>{money(expense.amount)}</p>
          </div>
          <p className="text-xs text-[#5c6b80]">
            {expense.loadId} · {EXPENSE_STATUS_LABEL[expense.status]}
            {expense.paidBy === "driver" && expense.reimbursementRequested ? " · reimbursement requested" : ""}
          </p>
          {expense.rejectionReason ? <p className="mt-1 text-xs text-red-700">{expense.rejectionReason}</p> : null}
          {expense.correctionNote ? <p className="mt-1 text-xs text-amber-800">{expense.correctionNote}</p> : null}
          {expense.status === "correction_requested" ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                const result = demo.resubmitExpense(expense.id);
                if (!result.ok) toast.error(result.reason);
                else toast.success("Sent back for approval");
              }}
            >
              Resubmit
            </Button>
          ) : null}
        </div>
      ))}
      {driver ? (
        <ExpenseSheet open={open} onOpenChange={setOpen} driverId={driver.id} loadId={load?.id} truckId={load?.truckId ?? driver.truckId} />
      ) : null}
    </div>
  );
}

function Earnings() {
  const demo = useDemo();
  const driver = demo.drivers.find((item) => item.id === demo.actingDriverId);
  if (!driver) return null;
  const lines = demo.ledger.filter((entry) => entry.driverId === driver.id).sort((a, b) => a.at.localeCompare(b.at));
  const balance = driverBalance(demo.ledger, driver.id);
  return (
    <div className="space-y-3 p-3">
      <h1 className="text-lg font-semibold">Earnings</h1>
      <p className="text-3xl font-semibold tabular-nums">{money(balance)}</p>
      <p className="text-xs text-[#5c6b80]">Outstanding balance. Opening + earned pay + approved reimbursements + adjustments − advances − payments.</p>
      <div className="space-y-2">
        {lines.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3 border-b py-1.5 text-sm">
            <div>
              <p className="capitalize">{entry.type}</p>
              <p className="text-xs text-[#5c6b80]">{entry.memo}</p>
            </div>
            <p className={entry.amount < 0 ? "text-red-700" : "text-emerald-800"}>{money(entry.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Profile() {
  const demo = useDemo();
  const driver = demo.drivers.find((item) => item.id === demo.actingDriverId);
  const truck = demo.trucks.find((item) => item.id === driver?.truckId);
  if (!driver) return null;
  return (
    <div className="space-y-3 p-3 text-sm">
      <h1 className="text-lg font-semibold">{driver.name}</h1>
      <p>{driver.phone}</p>
      <p className="text-[#5c6b80]">{driver.email}</p>
      <p>Truck {truck ? truck.unit : "not assigned"}</p>
      <p>CDL {driver.cdl}</p>
      <p>Home terminal · Oakland</p>
      <p className="rounded-lg bg-[#f4f6f9] p-3 text-[#3d4d63]">{payRuleDetail(driver.pay)}</p>
    </div>
  );
}
