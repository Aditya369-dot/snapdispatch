"use client";

import { UnitFigures } from "@/components/unit-figures";
import { PageHeader, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gallons, miles, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { maintenanceTone, needsService } from "@/lib/metrics";
import { useDemo } from "@/lib/store";
import { healTruck, unitCost } from "@/lib/units";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function TrucksPage() {
  const { c } = useI18n();
  return (
    <Suspense fallback={<p className="text-sm">{c.loadingTrucks}</p>}>
      <TrucksScreen />
    </Suspense>
  );
}

function TrucksScreen() {
  const { c } = useI18n();
  const demo = useDemo();
  const attention = useSearchParams().get("attention") === "service";
  const [mileWindow, setMileWindow] = useState(String(demo.thresholds.miles));
  const [dayWindow, setDayWindow] = useState(String(demo.thresholds.days));
  const rows = demo.trucks.filter((truck) => (attention ? needsService(truck, demo.thresholds) : true));
  const t = c.trucks;
  const toneLabel = {
    healthy: t.healthy,
    due_soon: t.dueSoon,
    overdue: t.overdue,
    out_of_service: t.outTone,
  } as const;
  return (
    <div>
      <PageHeader title={t.title} description={t.description} />
      <h2 className="mb-2 text-sm font-semibold">{t.cardsTitle}</h2>
      <div className="mb-3 grid gap-2 md:grid-cols-2">
        {rows.map((truck) => {
          const unit = healTruck(truck);
          const tone = maintenanceTone(unit, demo.thresholds);
          const driver = demo.drivers.find((item) => item.id === unit.driverId)?.name ?? "—";
          return (
            <Link key={unit.id} href={`/trucks/${unit.id}`} className="rounded-lg border bg-white p-3 transition-colors hover:border-[#1d6fe8]">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{unit.unit}</p>
                  <p className="text-xs text-[#5c6b80]">{unit.year} {unit.make} {unit.model} · {driver}</p>
                </div>
                <TonePill tone={tone === "healthy" ? "ok" : tone === "due_soon" ? "warn" : "late"}>{toneLabel[tone]}</TonePill>
              </div>
              <UnitFigures truck={unit} />
            </Link>
          );
        })}
      </div>
      <form
        className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          demo.setThresholds(Number(mileWindow), Number(dayWindow));
        }}
      >
        <Label>
          {t.milesWithin}
          <Input className="mt-1 w-28" value={mileWindow} onChange={(event) => setMileWindow(event.target.value)} />
        </Label>
        <Label>
          {t.orDays}
          <Input className="mt-1 w-24" value={dayWindow} onChange={(event) => setDayWindow(event.target.value)} />
        </Label>
        <Button type="submit" variant="outline">{t.update}</Button>
        <p className="text-xs text-[#5c6b80]">{t.sampleRule}</p>
      </form>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {[t.unit, t.equipment, t.driver, t.asOf, t.gallons, t.miles, t.expenses, t.status, t.nextService, t.maintenance].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((truck) => {
              const unit = healTruck(truck);
              const tone = maintenanceTone(unit, demo.thresholds);
              const cost = unitCost(unit.id, demo.expenses, demo.serviceRecords, demo.issues);
              return (
                <tr key={unit.id} className="border-t">
                  <td className="px-3 py-1.5">
                    <Link className="font-medium text-[#1d6fe8]" href={`/trucks/${unit.id}`}>{unit.unit}</Link>
                  </td>
                  <td className="px-3 py-1.5">{unit.year} {unit.make} {unit.model}</td>
                  <td className="px-3 py-1.5">{demo.drivers.find((driver) => driver.id === unit.driverId)?.name ?? "—"}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{unit.asOf}</td>
                  <td className="px-3 py-1.5 tabular-nums">{gallons(unit.gallons)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{miles(unit.periodMiles)} · {miles(unit.odometer)}</td>
                  <td className="px-3 py-1.5 font-medium tabular-nums">{money(cost.total)}</td>
                  <td className="px-3 py-1.5">{unit.operational === "out_of_service" ? t.out : t.inService}</td>
                  <td className="px-3 py-1.5">{unit.nextServiceDate} · {miles(unit.nextServiceMiles)}</td>
                  <td className="px-3 py-1.5">
                    <TonePill tone={tone === "healthy" ? "ok" : tone === "due_soon" ? "warn" : "late"}>{toneLabel[tone]}</TonePill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
