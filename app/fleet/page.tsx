"use client";

import { FleetMap } from "@/components/fleet-map";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { fleetMarkers } from "@/lib/fleet";
import { useDemo } from "@/lib/store";
import { cn } from "cn";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function FleetPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading fleet…</p>}>
      <FleetScreen />
    </Suspense>
  );
}

function FleetScreen() {
  const demo = useDemo();
  const params = useSearchParams();
  const [selected, setSelected] = useState(params.get("truck") ?? undefined);
  const markers = fleetMarkers(demo.trucks, demo.loads, demo.clock);
  return (
    <div>
      <PageHeader title="Fleet map" description="Twelve trucks between the Port of Oakland and the valley. Movement is simulated." />
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ul className="max-h-[640px] overflow-auto rounded-lg border bg-white">
          {markers.map((marker) => (
            <li key={marker.truck.id}>
              <button
                className={cn("flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm", selected === marker.truck.id && "bg-[#e8f1fd]")}
                onClick={() => setSelected(marker.truck.id)}
              >
                <span>
                  <span className="block font-medium">{marker.truck.unit}</span>
                  <span className="text-xs text-[#5c6b80]">{demo.drivers.find((driver) => driver.id === marker.truck.driverId)?.name ?? "No home driver"}</span>
                </span>
                {marker.stale ? <span className="text-[11px] text-amber-800">Stale</span> : marker.load ? <StatusBadge load={marker.load} /> : <span className="text-[11px] text-[#5c6b80]">Idle</span>}
              </button>
            </li>
          ))}
        </ul>
        <FleetMap selectedId={selected} onSelect={setSelected} />
      </div>
    </div>
  );
}
