"use client";

import { DocumentPreview } from "@/components/document-preview";
import { ReasonDialog } from "@/components/reason-dialog";
import { PageHeader, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { driverReimbursementDue } from "@/lib/finance";
import { money } from "@/lib/format";
import { CATEGORY_LABEL, EXPENSE_STATUS_LABEL, PAID_BY_LABEL } from "@/lib/labels";
import { PITCH_LOAD_ID } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import type { Expense } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

export default function ExpensesPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading expenses…</p>}>
      <ExpensesScreen />
    </Suspense>
  );
}

function ExpensesScreen() {
  const demo = useDemo();
  const initial = useSearchParams().get("status") ?? "all";
  const [status, setStatus] = useState(initial);
  const [seenStatus, setSeenStatus] = useState(initial);
  if (seenStatus !== initial) {
    setSeenStatus(initial);
    setStatus(initial);
  }
  const [reasonFor, setReasonFor] = useState<{ id: string; decision: "rejected" | "correction_requested" } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = demo.expenses.filter((expense) => status === "all" || expense.status === status);
  const open = demo.expenses.find((expense) => expense.id === openId);
  return (
    <div>
      <PageHeader title="Expenses" description="Approval is separate from reimbursement. Company-paid receipts do not increase driver pay." />
      <div className="mb-3 w-52">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(EXPENSE_STATUS_LABEL).map(([id, label]) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {["Date", "Load", "Driver", "Category", "Merchant", "Amount", "Paid by", "Approval", "Reimbursement", ""].map((label) => (
                <th key={label} className="px-2 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((expense) => {
              const highlight = expense.loadId === PITCH_LOAD_ID && expense.amount === 45 && expense.category === "tolls";
              return (
                <tr key={expense.id} className="border-t" data-tour={highlight ? "approve-toll" : undefined}>
                  <td className="px-2 py-1.5">{expense.date}</td>
                  <td className="px-2 py-1.5">{expense.loadId ? <Link className="text-[#1d6fe8]" href={`/loads/${expense.loadId}`}>{expense.loadId}</Link> : "—"}</td>
                  <td className="px-2 py-1.5">{demo.drivers.find((driver) => driver.id === expense.driverId)?.name}</td>
                  <td className="px-2 py-1.5">{CATEGORY_LABEL[expense.category]}</td>
                  <td className="px-2 py-1.5">{expense.merchant}</td>
                  <td className="px-2 py-1.5 tabular-nums">{money(expense.amount)}</td>
                  <td className="px-2 py-1.5">{PAID_BY_LABEL[expense.paidBy]}</td>
                  <td className="px-2 py-1.5"><TonePill tone={expense.status === "approved" ? "ok" : expense.status === "rejected" ? "late" : "warn"}>{EXPENSE_STATUS_LABEL[expense.status]}</TonePill></td>
                  <td className="px-2 py-1.5">{reimbursementLabel(expense)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(expense.id)}>Receipt</Button>
                      {expense.status === "awaiting_approval" || expense.status === "correction_requested" ? (
                        <>
                          <Button size="sm" onClick={() => review(demo.reviewExpense, expense.id, "approved")}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setReasonFor({ id: expense.id, decision: "correction_requested" })}>Correct</Button>
                          <Button size="sm" variant="outline" onClick={() => setReasonFor({ id: expense.id, decision: "rejected" })}>Reject</Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open ? (
        <div className="mt-3 rounded-lg border bg-white p-3">
          <p className="mb-2 text-sm font-medium">{open.merchant} · {money(open.amount)}</p>
          {open.missingReceiptReason ? <p className="mb-2 text-sm text-amber-800">Missing receipt: {open.missingReceiptReason}</p> : null}
          {open.attachmentIds.map((id) => {
            const doc = demo.documents.find((item) => item.id === id);
            return doc ? <DocumentPreview key={id} doc={doc} /> : null;
          })}
        </div>
      ) : null}
      <ReasonDialog
        open={Boolean(reasonFor)}
        onOpenChange={(next) => !next && setReasonFor(null)}
        title={reasonFor?.decision === "rejected" ? "Reject expense" : "Request a correction"}
        label="Reason"
        confirm="Save"
        onConfirm={(reason) => {
          if (!reasonFor) return;
          const result = demo.reviewExpense(reasonFor.id, reasonFor.decision, reason);
          if (!result.ok) toast.error(result.reason);
          else {
            toast.success(reasonFor.decision === "rejected" ? "Expense rejected" : "Correction requested");
            setReasonFor(null);
          }
        }}
      />
    </div>
  );
}

function reimbursementLabel(expense: Expense) {
  if (expense.paidBy !== "driver" || !expense.reimbursementRequested) return "Not owed";
  if (expense.status === "rejected") return "Rejected";
  if (expense.status === "approved" && driverReimbursementDue(expense)) return "Owed";
  if (expense.status === "correction_requested") return "On hold";
  return "Pending approval";
}

function review(action: (id: string, decision: "approved", note?: string) => { ok: boolean; reason?: string }, id: string, decision: "approved") {
  const result = action(id, decision);
  if (!result.ok) toast.error(result.reason);
  else toast.success("Expense approved");
}
