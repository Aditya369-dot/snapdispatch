"use client";

import { DocumentPreview } from "@/components/document-preview";
import { ReasonDialog } from "@/components/reason-dialog";
import { PageHeader, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import type { DocType } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

export default function DocumentsPage() {
  const { c } = useI18n();
  return (
    <Suspense fallback={<p className="text-sm">{c.loadingDocuments}</p>}>
      <DocumentsScreen />
    </Suspense>
  );
}

function DocumentsScreen() {
  const { c, text } = useI18n();
  const d = c.documents;
  const demo = useDemo();
  const loadFilter = useSearchParams().get("load") ?? "all";
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const rows = demo.documents.filter((doc) => {
    if (loadFilter !== "all" && doc.loadId !== loadFilter) return false;
    if (type !== "all" && doc.type !== type) return false;
    return true;
  });
  const current = demo.documents.find((doc) => doc.id === selected) ?? rows[0];
  return (
    <div>
      <PageHeader title={d.title} description={d.description} />
      <div className="mb-3 w-56">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{d.all}</SelectItem>
            {(Object.keys(c.doc) as DocType[]).map((id) => (
              <SelectItem key={id} value={id}>{c.doc[id]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
              <tr>
                {[d.load, d.driver, d.type, d.uploaded, d.review, ""].map((label) => (
                  <th key={label || "actions"} className="px-2 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="px-2 py-1.5">{doc.loadId ? <Link className="text-[#1d6fe8]" href={`/loads/${doc.loadId}`}>{doc.loadId}</Link> : "—"}</td>
                  <td className="px-2 py-1.5">{demo.drivers.find((driver) => driver.id === doc.driverId)?.name ?? "—"}</td>
                  <td className="px-2 py-1.5">{c.doc[doc.type]}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatDateTime(doc.uploadedAt)}</td>
                  <td className="px-2 py-1.5">
                    <TonePill tone={doc.reviewStatus === "approved" ? "ok" : doc.reviewStatus === "rejected" ? "late" : "warn"}>{c.review[doc.reviewStatus]}</TonePill>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(doc.id)}>{d.view}</Button>
                    {doc.reviewStatus === "pending" ? (
                      <>
                        <Button size="sm" onClick={() => {
                          const result = demo.reviewDocument(doc.id, "approved");
                          if (!result.ok) toast.error(text(result.reason));
                          else toast.success(d.approvedToast);
                        }}>{d.approve}</Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectId(doc.id)}>{d.reject}</Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border bg-white p-3">
          {current ? (
            <>
              <p className="mb-2 text-sm font-medium">{current.fileName}</p>
              {current.rejectionReason ? <p className="mb-2 text-xs text-red-700">{text(current.rejectionReason)}</p> : null}
              {current.isSample ? <p className="mb-2 text-xs text-[#5c6b80]">{d.sample}</p> : null}
              <DocumentPreview doc={current} />
            </>
          ) : (
            <p className="text-sm text-[#5c6b80]">{d.empty}</p>
          )}
        </div>
      </div>
      <ReasonDialog
        open={Boolean(rejectId)}
        onOpenChange={(open) => !open && setRejectId(null)}
        title={d.rejectTitle}
        label={d.reason}
        confirm={d.reject}
        onConfirm={(reason) => {
          if (!rejectId) return;
          const result = demo.reviewDocument(rejectId, "rejected", reason);
          if (!result.ok) toast.error(text(result.reason));
          else {
            toast.success(d.rejectedToast);
            setRejectId(null);
          }
        }}
      />
    </div>
  );
}
