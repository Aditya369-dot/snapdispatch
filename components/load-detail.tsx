"use client";

import { AssignSheet } from "@/components/assign-sheet";
import { DocumentPreview } from "@/components/document-preview";
import { PageHeader, StatusBadge, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { flowFor } from "@/lib/flow";
import { driverPayView, loadFinancials, loadRevenue } from "@/lib/finance";
import { formatDateTime, money } from "@/lib/format";
import { CATEGORY_LABEL, DELAY_LABEL, DOC_LABEL, PAID_BY_LABEL } from "@/lib/labels";
import { customer, place } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import { cn } from "cn";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export function LoadDetail({ id, initialTab = "overview" }: { id: string; initialTab?: string }) {
  const demo = useDemo();
  const load = demo.loads.find((item) => item.id === id);
  const [tab, setTab] = useState(initialTab);
  const [seenTab, setSeenTab] = useState(initialTab);
  if (seenTab !== initialTab) {
    setSeenTab(initialTab);
    setTab(initialTab);
  }
  const [assignOpen, setAssignOpen] = useState(false);
  const markTour = demo.markTour;
  useEffect(() => {
    if (tab === "financials" && load) markTour({ financialsLoadId: load.id });
  }, [tab, load, markTour]);

  if (!load) {
    return (
      <div>
        <PageHeader title="Load not found" description="That load isn’t in the demo company." />
        <Button asChild variant="outline">
          <Link href="/loads">Back to loads</Link>
        </Button>
      </div>
    );
  }
  const driver = demo.drivers.find((item) => item.id === load.driverId);
  const truck = demo.trucks.find((item) => item.id === load.truckId);
  const fin = loadFinancials(load, demo.expenses, demo.ledger, driver);
  const flow = flowFor(load.type);

  return (
    <div>
      <PageHeader
        title={`${load.id} · ${load.containerNumber}`}
        description={`${load.type === "import" ? "Import" : "Export"} · ${customer(load.customerId)?.name} · ${load.bookingNumber}`}
        actions={
          load.status !== "complete" ? (
            <Button onClick={() => setAssignOpen(true)}>{load.driverId ? "Reassign" : "Assign driver"}</Button>
          ) : null
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge load={load} />
        {load.delays.length ? <TonePill tone="warn">Delayed · {DELAY_LABEL[load.delays.at(-1)!.reason]}</TonePill> : null}
        <span className="text-sm text-[#5c6b80]">Customer total {money(loadRevenue(load))}</span>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Move">
              <Info label="Pickup" value={`${place(load.pickupKey)?.name}`} extra={place(load.pickupKey)?.address} />
              <Info label="Destination" value={`${place(load.destinationKey)?.name}`} extra={place(load.destinationKey)?.address} />
              <Info label="Appointment" value={`${formatDateTime(load.appointmentStart)} – ${formatDateTime(load.appointmentEnd).split(", ").pop()}`} />
              {load.lastFreeDay ? <Info label="Last free day" value={load.lastFreeDay} /> : null}
              {load.emptyReturnDeadline ? <Info label="Empty return deadline" value={load.emptyReturnDeadline} /> : null}
              {load.cutoff ? <Info label="Cutoff" value={load.cutoff} /> : null}
              <Info label="Driver" value={driver?.name ?? "Unassigned"} />
              <Info label="Truck" value={truck ? `${truck.unit} · ${truck.make} ${truck.model}` : "—"} />
            </Card>
            <Card title="Notes">
              <p className="text-sm">{load.notes || "No notes."}</p>
              {load.type === "import" && load.status !== "created" ? (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Empty return is separate from delivery. The container still has to go back to {place(load.pickupKey)?.name}
                  {load.emptyReturnDeadline ? ` by ${load.emptyReturnDeadline}` : ""}.
                </p>
              ) : null}
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="mt-3">
          <ol className="space-y-2">
            {flow.map((step) => {
              const event = [...load.timeline].reverse().find((item) => item.status === step.status);
              return (
                <li key={step.status} className="flex gap-3 text-sm">
                  <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", event ? "bg-emerald-600" : "bg-slate-300")} />
                  <div>
                    <p className={event ? "font-medium" : "text-[#5c6b80]"}>{step.label}</p>
                    <p className="text-xs text-[#5c6b80]">{event ? formatDateTime(event.at) : "Not yet"}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {load.delays.length ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">Delays</h3>
              {load.delays.map((delay) => (
                <p key={delay.id} className="text-sm text-amber-900">
                  {formatDateTime(delay.at)} · {DELAY_LABEL[delay.reason]} · {delay.note}
                </p>
              ))}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="expenses" className="mt-3 space-y-3">
          {fin.approved.concat(fin.pending).length === 0 ? <p className="text-sm text-[#5c6b80]">No expenses on this load.</p> : null}
          {demo.expenses
            .filter((expense) => expense.loadId === load.id)
            .map((expense) => (
              <div key={expense.id} className="rounded-lg border bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {CATEGORY_LABEL[expense.category]} · {expense.merchant}
                  </p>
                  <p className="font-semibold">{money(expense.amount)}</p>
                </div>
                <p className="text-xs text-[#5c6b80]">
                  {expense.date} · {PAID_BY_LABEL[expense.paidBy]} · {expense.status.replaceAll("_", " ")}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {expense.attachmentIds.map((docId) => {
                    const doc = demo.documents.find((item) => item.id === docId);
                    return doc ? <DocumentPreview key={doc.id} doc={doc} /> : null;
                  })}
                </div>
              </div>
            ))}
        </TabsContent>
        <TabsContent value="documents" className="mt-3 space-y-3">
          {demo.documents.filter((doc) => doc.loadId === load.id).length === 0 ? (
            <p className="text-sm text-[#5c6b80]">No documents yet.</p>
          ) : null}
          {demo.documents
            .filter((doc) => doc.loadId === load.id)
            .map((doc) => (
              <div key={doc.id} className="rounded-lg border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <p>
                    {DOC_LABEL[doc.type]} · {doc.fileName}
                  </p>
                  <TonePill tone={doc.reviewStatus === "approved" ? "ok" : doc.reviewStatus === "rejected" ? "late" : "warn"}>{doc.reviewStatus}</TonePill>
                </div>
                <DocumentPreview doc={doc} />
              </div>
            ))}
        </TabsContent>
        <TabsContent value="financials" className="mt-3" data-tour="load-financials">
          <Financials loadId={load.id} />
        </TabsContent>
      </Tabs>
      <AssignSheet load={load} open={assignOpen} onOpenChange={setAssignOpen} />
    </div>
  );
}

function Financials({ loadId }: { loadId: string }) {
  const demo = useDemo();
  const load = demo.loads.find((item) => item.id === loadId);
  if (!load) return null;
  const driver = demo.drivers.find((item) => item.id === load.driverId);
  const fin = loadFinancials(load, demo.expenses, demo.ledger, driver);
  const pay = driverPayView(load, driver, demo.ledger);
  return (
    <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-lg border bg-white p-3 text-sm">
        <Line label="Customer linehaul" value={money(fin.linehaul)} />
        <Line label="Additional charges" value={money(fin.accessorials)} />
        <Line label="Customer total" value={money(fin.revenue)} strong />
        <Line label={driver ? "Driver pay" : "Driver pay"} value={driver ? money(fin.driverCost) : "—"} />
        <p className="mb-2 text-[11px] text-[#5c6b80]">{pay.detail}</p>
        <Line label="Fuel" value={money(fin.fuel)} />
        <Line label="Tolls" value={money(fin.tolls)} />
        <Line label="Other approved expenses" value={money(fin.other)} />
        <Line label="Pending expenses" value={money(fin.pendingTotal)} />
        <p className="mb-2 text-[11px] text-[#5c6b80]">Pending receipts are not in the contribution until they are approved.</p>
        <Line label="Estimated contribution" value={money(fin.contribution)} strong />
        <p className="text-[11px] text-[#5c6b80]">Estimated contribution—before overhead and taxes.</p>
        <p className="mt-2 text-[11px] text-[#5c6b80]">
          Reimbursement owed to the driver ({money(fin.reimbursement)}) is not counted again as an operating expense. Company-paid expenses are included once.
        </p>
      </div>
      <div className="space-y-2">
        {demo.expenses.filter((expense) => expense.loadId === load.id).map((expense) => (
          <div key={expense.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{expense.merchant}</p>
              <p className="text-xs text-[#5c6b80]">
                {CATEGORY_LABEL[expense.category]} · {expense.status.replaceAll("_", " ")} · {PAID_BY_LABEL[expense.paidBy]}
              </p>
            </div>
            <p className="font-medium">{money(expense.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 py-1", strong && "font-semibold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-3">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] font-medium tracking-wide text-[#5c6b80] uppercase">{label}</p>
      <p className="text-sm">{value}</p>
      {extra ? <p className="text-xs text-[#5c6b80]">{extra}</p> : null}
    </div>
  );
}
