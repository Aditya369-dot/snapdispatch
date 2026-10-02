"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { putFile } from "@/lib/files";
import { DEMO_DAY, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/say";
import { PITCH_LOAD_ID } from "@/lib/reference";
import { useDemo, type AttachmentInput } from "@/lib/store";
import type { ExpenseCategory, PaidBy } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORIES = ["fuel", "tolls", "parking", "scales", "chassis", "repairs", "port_fees", "miscellaneous"] as ExpenseCategory[];

interface LocalFile {
  id: string;
  file?: File;
  sample?: boolean;
  name: string;
  mimeType: string;
  preview?: string;
}

export function ExpenseSheet({
  open,
  onOpenChange,
  driverId,
  loadId,
  truckId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  loadId?: string;
  truckId?: string;
}) {
  const { c, text } = useI18n();
  const f = c.expenseForm;
  const addExpense = useDemo((state) => state.addExpense);
  const walk = useDemo((state) => state.walkthrough);
  const [category, setCategory] = useState<ExpenseCategory>("tolls");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(DEMO_DAY);
  const [notes, setNotes] = useState("");
  const [paidBy, setPaidBy] = useState<PaidBy>("driver");
  const [reimburse, setReimburse] = useState(true);
  const [missing, setMissing] = useState(false);
  const [missingReason, setMissingReason] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [busy, setBusy] = useState(false);
  const pitch = Boolean(open && walk?.active && walk.step === 4 && loadId === PITCH_LOAD_ID);
  const formKey = open ? `${loadId ?? "none"}:${pitch ? "pitch" : "blank"}` : "closed";
  const [seenKey, setSeenKey] = useState(formKey);
  if (seenKey !== formKey) {
    setSeenKey(formKey);
    if (open) {
      setCategory(pitch ? "tolls" : "fuel");
      setAmount(pitch ? "45" : "");
      setMerchant(pitch ? "FasTrak" : "");
      setDate(DEMO_DAY);
      setNotes(pitch ? f.pitchNote : "");
      setPaidBy("driver");
      setReimburse(true);
      setMissing(false);
      setMissingReason("");
      setFiles([]);
      setBusy(false);
    }
  }

  function addLocal(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      next.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      });
    }
    setFiles(next);
    setMissing(false);
  }

  function useSample() {
    setFiles((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        sample: true,
        name: category === "fuel" ? "sample-fuel-receipt.svg" : "sample-toll-receipt.svg",
        mimeType: "image/svg+xml",
      },
    ]);
    setMissing(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{f.title}</SheetTitle>
          <p className="text-sm text-[#5c6b80]">{loadId ? fill(f.tied, { id: loadId }) : f.untied}</p>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{f.category}</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {c.category[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">{f.amount}</Label>
              <Input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="45.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="merchant">{f.merchant}</Label>
            <Input id="merchant" value={merchant} onChange={(event) => setMerchant(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">{f.date}</Label>
            <Input id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{f.paidBy}</Label>
            <Select value={paidBy} onValueChange={(value) => setPaidBy(value as PaidBy)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(c.paidBy) as PaidBy[]).map((item) => (
                  <SelectItem key={item} value={item}>
                    {c.paidBy[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {paidBy === "driver" ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reimburse} onCheckedChange={(checked) => setReimburse(checked === true)} />
              {f.reimburse}
            </label>
          ) : (
            <p className="text-xs text-[#5c6b80]">{f.companyPaid}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">{f.notes}</Label>
            <Textarea id="expense-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{f.receipt}</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={useSample}>
                {f.sample}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <label>
                  {f.choose}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(event) => {
                      addLocal(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <label>
                  {f.camera}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      addLocal(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
                <span className="truncate">{file.sample ? f.sampleName : file.name}</span>
                <button type="button" className="text-xs text-[#5c6b80]" onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}>
                  {c.remove}
                </button>
              </div>
            ))}
            {files.some((file) => file.preview) ? (
              // Local object URLs from the file picker are not next/image sources.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={files.find((file) => file.preview)?.preview} alt={f.previewAlt} className="max-h-40 rounded-md border object-contain" />
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={missing} onCheckedChange={(checked) => setMissing(checked === true)} />
              {f.missing}
            </label>
            {missing ? (
              <Textarea value={missingReason} onChange={(event) => setMissingReason(event.target.value)} placeholder={f.why} rows={2} />
            ) : null}
          </div>
        </div>
        <SheetFooter className="border-t bg-white">
          <Button
            className="w-full"
            data-tour="submit-expense"
            disabled={busy}
            onClick={() => {
              void submit();
            }}
          >
            {busy ? f.saving : amount ? fill(f.submit, { amount: money(Number(amount) || 0) }) : f.submitPlain}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  async function submit() {
    setBusy(true);
    try {
      const attachments: AttachmentInput[] = [];
      for (const file of files) {
        if (file.sample) {
          attachments.push({
            fileName: file.name,
            mimeType: file.mimeType,
            isSample: true,
            sampleKey: category === "fuel" ? "fuel" : category === "parking" ? "parking" : "toll",
            sampleParams: {
              merchant: merchant || "FasTrak",
              amount: money(Number(amount) || 0),
              date,
              unit: truckId ?? "",
              reference: loadId ?? "expense",
            },
          });
          continue;
        }
        if (!file.file) continue;
        const blobId = `blob-${file.id}`;
        await putFile(blobId, file.file);
        attachments.push({
          fileName: file.name,
          mimeType: file.mimeType,
          blobId,
          isSample: false,
        });
      }
      const result = addExpense({
        loadId,
        driverId,
        truckId,
        category,
        amount: Number(amount),
        merchant,
        date,
        notes,
        paidBy,
        reimbursementRequested: reimburse,
        missingReceiptReason: missing ? missingReason : undefined,
        attachments,
      });
      if (!result.ok) {
        toast.error(text(result.reason));
        return;
      }
      toast.success(f.toast);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }
}
