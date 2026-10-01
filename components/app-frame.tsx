"use client";

import { DriverApp } from "@/components/driver-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DEMO_DAY, formatLongDate, money } from "@/lib/format";
import { COMPANY, PITCH_DRIVER_ID } from "@/lib/reference";
import { useDemo, useHydrated } from "@/lib/store";
import { WALK_STEPS, walkBalanceHint } from "@/lib/walkthrough";
import { cn } from "cn";
import {
  BarChart3,
  ClipboardList,
  Container,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Map,
  Menu,
  Receipt,
  RotateCcw,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/dispatch", label: "Dispatch", icon: ClipboardList },
  { href: "/loads", label: "Loads", icon: Container },
  { href: "/fleet", label: "Fleet Map", icon: Map },
  { href: "/drivers", label: "Drivers & Pay", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/trucks", label: "Trucks & Maintenance", icon: Truck },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/excel", label: "Excel", icon: FileSpreadsheet },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const view = useDemo((state) => state.view);
  const [menu, setMenu] = useState(false);
  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0c2340] text-white">
        <div className="text-center">
          <p className="text-lg font-semibold">SnapDispatch</p>
          <p className="mt-1 text-sm text-[#c5d4e8]">Opening Westshore Drayage</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-dvh overflow-hidden bg-[#f4f6f9] text-[#152033]">
      {view === "owner" ? (
        <aside className="hidden w-[220px] shrink-0 flex-col bg-[#0c2340] text-white md:flex">
          <Brand />
          <Nav onNavigate={() => undefined} />
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenu(true)} />
        <main className={cn("min-h-0 flex-1 overflow-auto", view === "driver" && "bg-[#d5deea]")}>
          {view === "driver" ? (
            <div className="flex min-h-full justify-center px-2 py-3 lg:items-center lg:px-6">
              <div className="flex h-[calc(100dvh-4.5rem)] w-full max-w-[420px] flex-col overflow-hidden bg-white lg:h-[min(840px,calc(100dvh-6.5rem))] lg:rounded-[2rem] lg:border-[10px] lg:border-[#0c2340] lg:shadow-2xl">
                <p className="hidden py-1 text-center text-[11px] text-[#5c6b80] lg:block">Driver phone preview</p>
                <DriverApp />
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1280px] px-3 py-3 md:px-4 md:py-4">{children}</div>
          )}
        </main>
      </div>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-[240px] bg-[#0c2340] p-0 text-white sm:max-w-[240px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <Brand />
          <Nav onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <TourNav />
      <WalkthroughPanel />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <div className="grid size-8 place-items-center rounded-md bg-[#1d6fe8] text-xs font-bold">SD</div>
      <div>
        <p className="text-sm font-semibold leading-tight">SnapDispatch</p>
        <p className="text-[10px] text-[#8eabc9]">Powered by SnapBiz Data</p>
      </div>
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-3">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
              active ? "bg-white/12 text-white" : "text-[#c5d4e8] hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <p className="mt-auto px-2 pt-4 text-[10px] leading-4 text-[#8eabc9]">
        {COMPANY.name}
        <br />
        {COMPANY.city}
      </p>
    </nav>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const view = useDemo((state) => state.view);
  const actingDriverId = useDemo((state) => state.actingDriverId);
  const drivers = useDemo((state) => state.drivers);
  const setView = useDemo((state) => state.setView);
  const resetDemo = useDemo((state) => state.resetDemo);
  const startWalkthrough = useDemo((state) => state.startWalkthrough);
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const step = useDemo((state) => state.walkthrough?.step);
  const active = useDemo((state) => state.walkthrough?.active);
  const highlight = active && WALK_STEPS[step ?? 0]?.target === "demo-switcher";

  return (
    <header className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">Westshore Drayage</p>
        <p className="text-[11px] text-[#5c6b80]">{formatLongDate(DEMO_DAY)}</p>
      </div>
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200 ring-inset">
        Demo data
      </span>
      <div className={cn("ml-auto flex flex-wrap items-center gap-2", highlight && "rounded-lg ring-2 ring-[#1d6fe8] ring-offset-2")} data-tour="demo-switcher">
        <div className="flex rounded-lg bg-[#eef2f6] p-0.5">
          <button
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium", view === "owner" ? "bg-white shadow-sm" : "text-[#5c6b80]")}
            onClick={() => setView("owner")}
          >
            Owner
          </button>
          <button
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium", view === "driver" ? "bg-white shadow-sm" : "text-[#5c6b80]")}
            onClick={() => setView("driver", actingDriverId || PITCH_DRIVER_ID)}
          >
            Driver
          </button>
        </div>
        <Select
          value={actingDriverId}
          onValueChange={(driverId) => setView("driver", driverId)}
        >
          <SelectTrigger className="h-8 w-[180px]" aria-label="Driver preview">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" variant="outline" onClick={() => setWalkOpen(true)}>
        Start walkthrough
      </Button>
      <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}>
        <RotateCcw />
        Reset demo
      </Button>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#5c6b80]">This restores the original Westshore records in this browser, including assignments, receipts, and payments you’ve changed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                router.push("/");
              }}
            >
              Reset demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={walkOpen} onOpenChange={setWalkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start the pitch walkthrough?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#5c6b80]">
            The story starts again with unassigned container TCLU4829137. Demo changes in this browser are restored so the twelve steps can be repeated.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                startWalkthrough();
                setWalkOpen(false);
                router.push("/dispatch?assignment=unassigned");
              }}
            >
              Start walkthrough
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function TourNav() {
  const walk = useDemo((state) => state.walkthrough);
  const setView = useDemo((state) => state.setView);
  const router = useRouter();
  useEffect(() => {
    if (!walk?.active) return;
    const step = WALK_STEPS[walk.step];
    if (!step) return;
    if (step.view) setView(step.view);
    if (step.href) router.push(step.href);
  }, [router, setView, walk?.active, walk?.step]);
  return null;
}

function WalkthroughPanel() {
  const walk = useDemo((state) => state.walkthrough);
  const data = useDemo();
  const setWalkStep = useDemo((state) => state.setWalkStep);
  const endWalkthrough = useDemo((state) => state.endWalkthrough);
  const pathname = usePathname();
  if (!walk?.active) return null;
  const step = WALK_STEPS[walk.step];
  if (!step) return null;
  const ready = step.ready({
    data,
    view: data.view,
    actingDriverId: data.actingDriverId,
    tour: data.tour,
    walkthrough: walk,
    pathname,
  });
  const last = walk.step === WALK_STEPS.length - 1;
  return (
    <div className="fixed top-14 left-1/2 z-40 w-[min(420px,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-[#1d6fe8] uppercase">
          Walkthrough {walk.step + 1} / {WALK_STEPS.length}
        </p>
        <button className="text-xs text-[#5c6b80]" onClick={endWalkthrough}>
          Exit
        </button>
      </div>
      <h2 className="mt-1 text-sm font-semibold">{step.title}</h2>
      <p className="mt-1 text-sm leading-5 text-[#3d4d63]">{step.body}</p>
      {walk.step >= 10 ? (
        <p className="mt-2 text-sm font-medium">Rosa’s balance {money(walkBalanceHint(data))}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={walk.step === 0} onClick={() => setWalkStep(walk.step - 1)}>
          Back
        </Button>
        <Button size="sm" data-testid="walk-next" disabled={!ready} onClick={() => setWalkStep(walk.step + 1)}>
          {last ? "Finish" : "Next"}
        </Button>
        {!ready ? (
          <button className="text-xs text-[#5c6b80] underline" onClick={() => setWalkStep(walk.step + 1)}>
            Skip
          </button>
        ) : (
          <span className="text-xs text-emerald-700">Ready</span>
        )}
      </div>
    </div>
  );
}
