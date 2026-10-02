"use client";

import { PageHeader, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { driverBalance } from "@/lib/finance";
import { formatDateTime, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { fill, localizeMemo, payRuleDetail } from "@/lib/i18n/say";
import { COMPANY } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import type { PayMethod } from "@/lib/types";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function DriverDetailPage() {
  const { c, lang, text } = useI18n();
  const d = c.drivers;
  const params = useParams<{ id: string }>();
  const demo = useDemo();
  const driver = demo.drivers.find((item) => item.id === params.id);
  const [amount, setAmount] = useState("400");
  const [method, setMethod] = useState<PayMethod>("ACH");
  const [reference, setReference] = useState("DEMO-400");
  const [preview, setPreview] = useState(false);
  if (!driver) return <PageHeader title={d.missing} />;
  const lines = demo.ledger.filter((entry) => entry.driverId === driver.id).sort((a, b) => a.at.localeCompare(b.at));
  const balance = driverBalance(demo.ledger, driver.id);
  const approved = demo.settlementApprovals.some((item) => item.driverId === driver.id);
  const truck = demo.trucks.find((item) => item.id === driver.truckId);
  const availability = driver.availability === "off" ? text(driver.availabilityNote ?? c.off) : c.available;
  return (
    <div>
      <PageHeader title={driver.name} description={`${driver.phone} · ${truck ? truck.unit : d.noTruck} · ${availability}`} />
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-[11px] tracking-wide text-[#5c6b80] uppercase">{d.outstanding}</p>
          <p className="text-2xl font-semibold tabular-nums">{money(balance)}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 text-sm md:col-span-2">
          <p className="font-medium">{d.how}</p>
          <p className="mt-1 text-[#3d4d63]">{payRuleDetail(driver.pay, lang)}</p>
          <p className="mt-2 text-xs text-[#5c6b80]">{d.payFollows}</p>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3" data-tour="record-payment">
        {approved ? <TonePill tone="ok">{d.reviewed}</TonePill> : <TonePill tone="warn">{d.draft}</TonePill>}
        {!approved ? (
          <Button
            onClick={() => {
              const result = demo.approveSettlement(driver.id);
              if (!result.ok) toast.error(text(result.reason));
              else toast.success(d.approvedToast);
            }}
          >
            {d.approve}
          </Button>
        ) : (
          <>
            <Label>
              {d.amount}
              <Input className="mt-1 w-28" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Label>
            <Label>
              {d.method}
              <Select value={method} onValueChange={(value) => setMethod(value as PayMethod)}>
                <SelectTrigger className="mt-1 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Check">{d.check}</SelectItem>
                  <SelectItem value="Cash">{d.cash}</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Label>
              {d.reference}
              <Input className="mt-1 w-36" value={reference} onChange={(event) => setReference(event.target.value)} />
            </Label>
            <Button
              onClick={() => {
                const result = demo.recordPayment(driver.id, Number(amount), method, reference);
                if (!result.ok) toast.error(text(result.reason));
                else toast.success(d.recordedToast);
              }}
            >
              {d.record}
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => setPreview(true)}>
          {d.preview}
        </Button>
        <p className="basis-full text-xs text-[#5c6b80]">{d.demoOnly}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {[d.when, d.type, d.memo, d.amount].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((entry) => (
              <tr key={entry.id} className="border-t">
                <td className="px-3 py-1.5 whitespace-nowrap">{formatDateTime(entry.at)}</td>
                <td className="px-3 py-1.5">{c.ledger[entry.type]}</td>
                <td className="px-3 py-1.5">{localizeMemo(lang, entry.memo)}</td>
                <td className="px-3 py-1.5 tabular-nums">{money(entry.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{d.statement}</DialogTitle>
          </DialogHeader>
          <div className="text-sm" id="statement">
            <p className="font-semibold">{COMPANY.name}</p>
            <p className="text-xs text-[#5c6b80]">{COMPANY.mc} · {COMPANY.dot}</p>
            <p className="mt-2 font-medium">{driver.name}</p>
            <p className="text-xs text-[#5c6b80]">{d.demoStatement}</p>
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto">
              {lines.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 border-b py-1">
                  <span>{localizeMemo(lang, entry.memo)}</span>
                  <span className="tabular-nums">{money(entry.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between font-semibold">
              <span>{d.balance}</span>
              <span>{money(balance)}</span>
            </p>
          </div>
          <Button
            onClick={() => {
              const popup = window.open("", "_blank", "noopener,noreferrer");
              if (!popup) return;
              const rows = lines
                .map(
                  (entry) =>
                    `<tr><td>${escapeHtml(localizeMemo(lang, entry.memo))}</td><td style="text-align:right">${money(entry.amount)}</td></tr>`,
                )
                .join("");
              popup.document.write(`<!doctype html><title>${escapeHtml(d.printTitle)}</title><body style="font-family:sans-serif"><h1>${COMPANY.name}</h1><p>${escapeHtml(fill(d.printIntro, { name: driver.name }))}</p><table style="width:100%;border-collapse:collapse">${rows}</table><p><strong>${escapeHtml(d.balance)} ${money(balance)}</strong></p></body>`);
              popup.document.close();
              popup.focus();
              popup.print();
            }}
          >
            {d.print}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
