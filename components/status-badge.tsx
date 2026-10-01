import { statusLabel } from "@/lib/flow";
import { cn } from "cn";
import type { Load, LoadStatus } from "@/lib/types";

export function statusTone(status: LoadStatus) {
  if (status === "complete" || status === "empty_returned" || status === "gated_in" || status === "delivered") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  if (status === "created" || status === "empty_return_pending") {
    return "bg-amber-50 text-amber-900 ring-amber-200";
  }
  return "bg-sky-50 text-sky-900 ring-sky-200";
}

export function StatusBadge({ load, className }: { load: Pick<Load, "type" | "status">; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", statusTone(load.status), className)}>
      {statusLabel(load)}
    </span>
  );
}

export function TonePill({ tone, children }: { tone: "ok" | "warn" | "late" | "info" | "muted"; children: React.ReactNode }) {
  const styles = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    late: "bg-red-50 text-red-800 ring-red-200",
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    muted: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", styles[tone])}>{children}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[#152033]">{title}</h1>
        {description ? <p className="mt-0.5 max-w-3xl text-sm text-[#5c6b80]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
