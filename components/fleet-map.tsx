"use client";

import { Button } from "@/components/ui/button";
import { fleetMarkers, type FleetMarker } from "@/lib/fleet";
import { formatTime } from "@/lib/format";
import { statusLabel } from "@/lib/flow";
import { PLACES, customer } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import { cn } from "cn";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CITIES = [
  { name: "Oakland", x: 200, y: 150 },
  { name: "San Leandro", x: 250, y: 270 },
  { name: "Hayward", x: 300, y: 318 },
  { name: "Fremont", x: 330, y: 430 },
  { name: "Tracy", x: 560, y: 286 },
  { name: "Stockton", x: 700, y: 180 },
  { name: "Modesto", x: 860, y: 348 },
];

export function FleetMap({
  variant = "full",
  selectedId,
  onSelect,
}: {
  variant?: "full" | "compact";
  selectedId?: string;
  onSelect?: (truckId: string) => void;
}) {
  const trucks = useDemo((state) => state.trucks);
  const loads = useDemo((state) => state.loads);
  const drivers = useDemo((state) => state.drivers);
  const clock = useDemo((state) => state.clock);
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<string | undefined>(selectedId);
  const [seenSelected, setSeenSelected] = useState(selectedId);
  if (selectedId !== seenSelected) {
    setSeenSelected(selectedId);
    setPicked(selectedId);
  }
  const localSelected = picked;
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 450);
    return () => window.clearInterval(id);
  }, [playing]);

  const markers = useMemo(() => fleetMarkers(trucks, loads, clock), [trucks, loads, clock]);
  const shift = playing ? ((tick % 24) / 24) * 18 - 9 : 0;
  const selected = markers.find((marker) => marker.truck.id === (localSelected ?? markers[0]?.truck.id));

  return (
    <div className={cn("grid gap-3", variant === "full" && "lg:grid-cols-[minmax(0,1fr)_280px]")}>
      <div className="overflow-hidden rounded-lg border bg-[#f7f4ee]">
        <div className="flex items-center justify-between gap-2 border-b bg-white px-3 py-2">
          <div>
            <p className="text-sm font-medium">Oakland corridor</p>
            <p className="text-[11px] text-[#5c6b80]">Schematic · simulated tracking, not a live GPS feed</p>
          </div>
          {variant === "full" ? (
            <Button size="sm" variant="outline" onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause" : "Play"} demo movement
            </Button>
          ) : null}
        </div>
        <svg viewBox="0 0 1000 520" className="h-auto w-full" role="img" aria-label="Fleet schematic from Oakland to Modesto">
          <rect width="1000" height="520" fill="#f6f3ec" />
          <path d="M0 40 L120 20 L180 80 L150 180 L90 260 L40 360 L0 420 Z" fill="#c5d7e8" />
          <text x="48" y="150" fill="#4d6d8a" fontSize="12">San Francisco Bay</text>
          <path d="M168 190 L248 286 L300 340 L328 410" fill="none" stroke="#8ea0b3" strokeWidth="10" strokeLinecap="round" />
          <path d="M300 340 L470 318 L560 300" fill="none" stroke="#8ea0b3" strokeWidth="10" strokeLinecap="round" />
          <path d="M560 300 L690 210 L720 230" fill="none" stroke="#8ea0b3" strokeWidth="8" strokeLinecap="round" />
          <path d="M560 300 L760 340 L860 370" fill="none" stroke="#8ea0b3" strokeWidth="8" strokeLinecap="round" />
          <text x="210" y="250" fill="#6d7f92" fontSize="11">I-880</text>
          <text x="400" y="312" fill="#6d7f92" fontSize="11">I-580</text>
          <text x="760" y="330" fill="#6d7f92" fontSize="11">SR-99</text>
          {CITIES.map((city) => (
            <g key={city.name}>
              <circle cx={city.x} cy={city.y} r="4" fill="#0c2340" />
              <text x={city.x + 8} y={city.y - 8} fontSize="13" fill="#152033" fontWeight="600">
                {city.name}
              </text>
            </g>
          ))}
          <text x={PLACES.trapac.x - 20} y={PLACES.trapac.y - 16} fontSize="11" fill="#1d4f91">
            Port
          </text>
          {markers.map((marker) => {
            const dx = marker.moving ? shift : 0;
            const active = marker.truck.id === selected?.truck.id;
            const fill = marker.stale ? "#a15c07" : marker.truck.operational === "out_of_service" ? "#b42318" : marker.moving ? "#1d6fe8" : "#0c2340";
            return (
              <g
                key={marker.truck.id}
                transform={`translate(${marker.x + dx} ${marker.y})`}
                className="cursor-pointer"
                onClick={() => {
                  setPicked(marker.truck.id);
                  onSelect?.(marker.truck.id);
                }}
              >
                {active ? <circle r="22" fill="none" stroke="#1d6fe8" strokeWidth="2" /> : null}
                <rect x="-24" y="-12" width="48" height="24" rx="6" fill={fill} />
                <text textAnchor="middle" y="4" fontSize="10" fill="white" fontWeight="700">
                  {marker.truck.unit.replace("WS-", "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {variant === "full" && selected ? <MarkerCard marker={selected} drivers={drivers} /> : null}
    </div>
  );
}

function MarkerCard({
  marker,
  drivers,
}: {
  marker: FleetMarker;
  drivers: { id: string; name: string }[];
}) {
  const driver = drivers.find((item) => item.id === (marker.load?.driverId ?? marker.truck.driverId));
  return (
    <div className="rounded-lg border bg-white p-3 text-sm">
      <p className="text-base font-semibold">{marker.truck.unit}</p>
      <p className="text-[#5c6b80]">
        {marker.truck.year} {marker.truck.make} {marker.truck.model}
      </p>
      <dl className="mt-3 space-y-2">
        <Row label="Driver" value={driver?.name ?? "Unassigned"} />
        <Row label="Load" value={marker.load ? `${marker.load.id} · ${marker.load.containerNumber}` : "No active load"} />
        <Row label="Status" value={marker.load ? statusLabel(marker.load) : marker.truck.operational === "out_of_service" ? "Out of service" : "Idle"} />
        <Row label="Customer" value={marker.load ? customer(marker.load.customerId)?.name ?? "—" : "—"} />
        <Row label="Next stop" value={marker.nextStop} />
        <Row label="ETA" value={marker.eta} />
        <Row label="Last update" value={formatTime(marker.lastUpdate)} />
      </dl>
      {marker.stale ? (
        <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          Location has not updated since 3:05 AM. This pin is stale.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-[#5c6b80]">Simulated tracking. Sample ETA is not from a routing provider.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#5c6b80]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
