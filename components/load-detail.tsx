"use client";

import { AssignSheet } from "@/components/assign-sheet";
import { DocumentPreview } from "@/components/document-preview";
import { PageHeader, StatusBadge, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { flowFor } from "@/lib/flow";
import { driverPayView, loadFinancials, loadRevenue } from "@/lib/finance";
import { formatDateTime, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { earningMemo, fill, statusText } from "@/lib/i18n/say";
import { customer, place } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import { cn } from "cn";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export function LoadDetail({ id, initialTab = "overview" }: { id: string; initialTab?: string }) {
  const { c, lang, text } = useI18n();
  const L = c.load;
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
        <PageHeader title={L.missing} description={L.missingBody} />
        <Button asChild variant="outline">
          <Link href="/loads">{L.back}</Link>
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
        description={`${load.type === "import" ? c.import : c.export} · ${customer(load.customerId)?.name} · ${load.bookingNumber}`}
        actions={
          load.status !== "complete" ? (
            <Button onClick={() => setAssignOpen(true)}>{load.driverId ? L.reassign : L.assign}</Button>
          ) : null
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge load={load} />
        {load.delays.length ? <TonePill tone="warn">{fill(L.delayed, { reason: c.delay[load.delays.at(-1)!.reason] })}</TonePill> : null}
        <span className="text-sm text-[#5c6b80]">{fill(L.customerTotal, { amount: money(loadRevenue(load)) })}</span>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{L.tabOverview}</TabsTrigger>
          <TabsTrigger value="timeline">{L.tabTimeline}</TabsTrigger>
          <TabsTrigger value="expenses">{L.tabExpenses}</TabsTrigger>
          <TabsTrigger value="documents">{L.tabDocuments}</TabsTrigger>
          <TabsTrigger value="financials">{L.tabFinancials}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title={L.move}>
              <Info label={L.pickup} value={`${place(load.pickupKey)?.name}`} extra={place(load.pickupKey)?.address} />
              <Info label={L.destination} value={`${place(load.destinationKey)?.name}`} extra={place(load.destinationKey)?.address} />
              <Info label={L.appointment} value={`${formatDateTime(load.appointmentStart)} – ${formatDateTime(load.appointmentEnd).split(", ").pop()}`} />
              {load.lastFreeDay ? <Info label={L.lastFree} value={load.lastFreeDay} /> : null}
              {load.emptyReturnDeadline ? <Info label={L.emptyDeadline} value={load.emptyReturnDeadline} /> : null}
              {load.cutoff ? <Info label={L.cutoff} value={load.cutoff} /> : null}
              <Info label={L.driver} value={driver?.name ?? c.unassigned} />
              <Info label={L.truck} value={truck ? `${truck.unit} · ${truck.make} ${truck.model}` : "—"} />
            </Card>
            <Card title={L.notes}>
              <p className="text-sm">{load.notes ? text(load.notes) : L.noNotes}</p>
              {load.type === "import" && load.status !== "created" ? (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {fill(L.emptySeparate, {
                    place: place(load.pickupKey)?.name ?? "",
                    deadline: load.emptyReturnDeadline ? fill(L.byDate, { date: load.emptyReturnDeadline }) : "",
                  })}
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
                    <p className={event ? "font-medium" : "text-[#5c6b80]"}>{statusText(lang, { type: load.type, status: step.status })}</p>
                    <p className="text-xs text-[#5c6b80]">{event ? formatDateTime(event.at) : L.notYet}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {load.delays.length ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">{L.delays}</h3>
              {load.delays.map((delay) => (
                <p key={delay.id} className="text-sm text-amber-900">
                  {formatDateTime(delay.at)} · {c.delay[delay.reason]} · {text(delay.note)}
                </p>
              ))}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="expenses" className="mt-3 space-y-3">
          {fin.approved.concat(fin.pending).length === 0 ? <p className="text-sm text-[#5c6b80]">{L.noExpenses}</p> : null}
          {demo.expenses
            .filter((expense) => expense.loadId === load.id)
            .map((expense) => (
              <div key={expense.id} className="rounded-lg border bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {c.category[expense.category]} · {expense.merchant}
                  </p>
                  <p className="font-semibold">{money(expense.amount)}</p>
                </div>
                <p className="text-xs text-[#5c6b80]">
                  {expense.date} · {c.paidBy[expense.paidBy]} · {c.expenseStatus[expense.status]}
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
            <p className="text-sm text-[#5c6b80]">{L.noDocuments}</p>
          ) : null}
          {demo.documents
            .filter((doc) => doc.loadId === load.id)
            .map((doc) => (
              <div key={doc.id} className="rounded-lg border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <p>
                    {c.doc[doc.type]} · {doc.fileName}
                  </p>
                  <TonePill tone={doc.reviewStatus === "approved" ? "ok" : doc.reviewStatus === "rejected" ? "late" : "warn"}>{c.review[doc.reviewStatus]}</TonePill>
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
  const { c, lang } = useI18n();
  const L = c.load;
  const demo = useDemo();
  const load = demo.loads.find((item) => item.id === loadId);
  if (!load) return null;
  const driver = demo.drivers.find((item) => item.id === load.driverId);
  const fin = loadFinancials(load, demo.expenses, demo.ledger, driver);
  const pay = driverPayView(load, driver, demo.ledger);
  return (
    <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-lg border bg-white p-3 text-sm">
        <Line label={L.linehaul} value={money(fin.linehaul)} />
        <Line label={L.accessorials} value={money(fin.accessorials)} />
        <Line label={L.customerTotalLine} value={money(fin.revenue)} strong />
        <Line label={L.driverPay} value={driver ? money(fin.driverCost) : "—"} />
        <p className="mb-2 text-[11px] text-[#5c6b80]">
          {driver
            ? pay.lines.map((line) => `${earningMemo(lang, line.memo)} · ${line.posted ? L.posted : L.notPosted}`).join(" · ")
            : L.unassignedPay}
        </p>
        <Line label={L.fuel} value={money(fin.fuel)} />
        <Line label={L.tolls} value={money(fin.tolls)} />
        <Line label={L.other} value={money(fin.other)} />
        <Line label={L.pending} value={money(fin.pendingTotal)} />
        <p className="mb-2 text-[11px] text-[#5c6b80]">{L.pendingHint}</p>
        <Line label={L.contribution} value={money(fin.contribution)} strong />
        <p className="text-[11px] text-[#5c6b80]">{L.contributionHint}</p>
        <p className="mt-2 text-[11px] text-[#5c6b80]">{fill(L.reimburseHint, { amount: money(fin.reimbursement) })}</p>
      </div>
      <div className="space-y-2">
        {demo.expenses.filter((expense) => expense.loadId === load.id).map((expense) => (
          <div key={expense.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{expense.merchant}</p>
              <p className="text-xs text-[#5c6b80]">
                {c.category[expense.category]} · {c.expenseStatus[expense.status]} · {c.paidBy[expense.paidBy]}
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
