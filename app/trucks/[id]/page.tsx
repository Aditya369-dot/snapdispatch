"use client";

import { PageHeader, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { miles, money } from "@/lib/format";
import { maintenanceTone } from "@/lib/metrics";
import { useDemo } from "@/lib/store";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function TruckDetailPage() {
  const params = useParams<{ id: string }>();
  const demo = useDemo();
  const truck = demo.trucks.find((item) => item.id === params.id);
  const [date, setDate] = useState(truck?.nextServiceDate ?? "");
  const [note, setNote] = useState("");
  const [odometer, setOdometer] = useState(String(truck?.odometer ?? ""));
  const [cost, setCost] = useState("680");
  const [work, setWork] = useState("PM service, oil, filters");
  if (!truck) return <PageHeader title="Truck not found" />;
  const tone = maintenanceTone(truck, demo.thresholds);
  const history = demo.serviceRecords.filter((record) => record.truckId === truck.id);
  const issues = demo.issues.filter((issue) => issue.truckId === truck.id);
  return (
    <div>
      <PageHeader
        title={`${truck.unit} · ${truck.year} ${truck.make} ${truck.model}`}
        description={`${miles(truck.odometer)} · Plate ${truck.plate}`}
      />
      <div className="mb-3">
        <TonePill tone={tone === "healthy" ? "ok" : tone === "due_soon" ? "warn" : "late"}>
          {tone === "out_of_service" ? "Out of service" : tone === "overdue" ? "Service overdue" : tone === "due_soon" ? "Service approaching" : "Healthy"}
        </TonePill>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-3">
          <h2 className="text-sm font-semibold">Open issues</h2>
          {issues.filter((issue) => issue.status === "open").length === 0 ? <p className="mt-2 text-sm text-[#5c6b80]">No open issues.</p> : null}
          {issues.map((issue) => (
            <div key={issue.id} className="mt-2 text-sm">
              <p className="font-medium">{issue.summary}</p>
              <p className="text-[#5c6b80]">{issue.detail}</p>
              {issue.estimatedCost ? <p>Sample cost {money(issue.estimatedCost)}</p> : null}
            </div>
          ))}
        </section>
        <section className="space-y-3 rounded-lg border bg-white p-3">
          <h2 className="text-sm font-semibold">Schedule service</h2>
          <Label>Date<Input className="mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What should the shop do?" />
          <Button
            variant="outline"
            onClick={() => {
              const result = demo.scheduleService(truck.id, date, note);
              if (!result.ok) toast.error(result.reason);
              else toast.success("Service scheduled");
            }}
          >
            Schedule service
          </Button>
          <h2 className="pt-2 text-sm font-semibold">Mark service complete</h2>
          <div className="grid grid-cols-2 gap-2">
            <Label>Odometer<Input className="mt-1" value={odometer} onChange={(event) => setOdometer(event.target.value)} /></Label>
            <Label>Cost<Input className="mt-1" value={cost} onChange={(event) => setCost(event.target.value)} /></Label>
          </div>
          <Textarea value={work} onChange={(event) => setWork(event.target.value)} />
          <Button
            onClick={() => {
              const result = demo.completeService(truck.id, Number(odometer), Number(cost), work);
              if (!result.ok) toast.error(result.reason);
              else toast.success(`${truck.unit} marked back in service`);
            }}
          >
            Mark service complete
          </Button>
        </section>
      </div>
      <section className="mt-3 rounded-lg border bg-white">
        <h2 className="border-b px-3 py-2 text-sm font-semibold">Service history</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {history.map((record) => (
              <tr key={record.id} className="border-t">
                <td className="px-3 py-1.5">{record.date}</td>
                <td className="px-3 py-1.5">{record.summary}</td>
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
