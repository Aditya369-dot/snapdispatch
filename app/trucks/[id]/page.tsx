"use client";

import { UnitFigures } from "@/components/unit-figures";
import { PageHeader, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { miles, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/say";
import { maintenanceTone } from "@/lib/metrics";
import { useDemo } from "@/lib/store";
import { healTruck } from "@/lib/units";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function TruckDetailPage() {
  const { c, text } = useI18n();
  const params = useParams<{ id: string }>();
  const demo = useDemo();
  const found = demo.trucks.find((item) => item.id === params.id);
  const truck = found ? healTruck(found) : undefined;
  const t = c.trucks;
  const [date, setDate] = useState(truck?.nextServiceDate ?? "");
  const [note, setNote] = useState("");
  const [odometer, setOdometer] = useState(String(truck?.odometer ?? ""));
  const [cost, setCost] = useState("680");
  const [work, setWork] = useState("PM service, oil, filters");
  if (!truck) return <PageHeader title={t.missing} />;
  const tone = maintenanceTone(truck, demo.thresholds);
  const history = demo.serviceRecords.filter((record) => record.truckId === truck.id);
  const issues = demo.issues.filter((issue) => issue.truckId === truck.id);
  const toneText = tone === "out_of_service" ? t.outTone : tone === "overdue" ? t.serviceOverdue : tone === "due_soon" ? t.serviceSoon : t.healthy;
  return (
    <div>
      <PageHeader
        title={`${truck.unit} · ${truck.year} ${truck.make} ${truck.model}`}
        description={`${miles(truck.odometer)} · ${fill(t.plate, { plate: truck.plate })}`}
      />
      <div className="mb-3">
        <TonePill tone={tone === "healthy" ? "ok" : tone === "due_soon" ? "warn" : "late"}>{toneText}</TonePill>
      </div>
      <UnitFigures truck={truck} variant="detail" />
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-3">
          <h2 className="text-sm font-semibold">{t.openIssues}</h2>
          {issues.filter((issue) => issue.status === "open").length === 0 ? <p className="mt-2 text-sm text-[#5c6b80]">{t.noIssues}</p> : null}
          {issues.map((issue) => (
            <div key={issue.id} className="mt-2 text-sm">
              <p className="font-medium">{text(issue.summary)}</p>
              <p className="text-[#5c6b80]">{text(issue.detail)}</p>
              {issue.estimatedCost ? <p>{fill(t.sampleCost, { amount: money(issue.estimatedCost) })}</p> : null}
            </div>
          ))}
        </section>
        <section className="space-y-3 rounded-lg border bg-white p-3">
          <h2 className="text-sm font-semibold">{t.schedule}</h2>
          <Label>{t.date}<Input className="mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t.shopPlaceholder} />
          <Button
            variant="outline"
            onClick={() => {
              const result = demo.scheduleService(truck.id, date, note);
              if (!result.ok) toast.error(text(result.reason));
              else toast.success(t.scheduledToast);
            }}
          >
            {t.scheduleButton}
          </Button>
          <h2 className="pt-2 text-sm font-semibold">{t.completeTitle}</h2>
          <div className="grid grid-cols-2 gap-2">
            <Label>{t.odometer}<Input className="mt-1" value={odometer} onChange={(event) => setOdometer(event.target.value)} /></Label>
            <Label>{t.cost}<Input className="mt-1" value={cost} onChange={(event) => setCost(event.target.value)} /></Label>
          </div>
          <Textarea value={text(work)} onChange={(event) => setWork(event.target.value)} />
          <Button
            onClick={() => {
              const result = demo.completeService(truck.id, Number(odometer), Number(cost), work);
              if (!result.ok) toast.error(text(result.reason));
              else toast.success(fill(t.backInService, { unit: truck.unit }));
            }}
          >
            {t.completeButton}
          </Button>
        </section>
      </div>
      <section className="mt-3 rounded-lg border bg-white">
        <h2 className="border-b px-3 py-2 text-sm font-semibold">{t.history}</h2>
        {history.length === 0 ? <p className="px-3 py-2 text-sm text-[#5c6b80]">{t.noHistory}</p> : null}
        <table className="w-full text-left text-sm">
          <tbody>
            {history.map((record) => (
              <tr key={record.id} className="border-t">
                <td className="px-3 py-1.5">{record.date}</td>
                <td className="px-3 py-1.5">{text(record.summary)}</td>
                <td className="px-3 py-1.5">{record.shop}</td>
                <td className="px-3 py-1.5 tabular-nums">{money(record.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
