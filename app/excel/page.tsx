"use client";

import { PageHeader } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SAMPLE_IMPORT_ROWS, downloadCsv, downloadWorkbook, workbookRows } from "@/lib/excel";
import { formatDateTime } from "@/lib/format";
import { useDemo } from "@/lib/store";
import { useState } from "react";

const TABS = [
  ["loads", "Loads"],
  ["drivers", "Drivers"],
  ["expenses", "Expenses"],
  ["payments", "Payments"],
  ["maintenance", "Maintenance"],
] as const;

export default function ExcelPage() {
  const demo = useDemo();
  const rows = workbookRows(demo);
  const [preview, setPreview] = useState(false);
  return (
    <div data-tour="excel-preview">
      <PageHeader
        title="Excel"
        description="A spreadsheet view of the current demo records. Download them, or run a simulated sync. This does not connect to Excel or a Microsoft account."
        actions={
          <>
            <Button onClick={() => downloadWorkbook(demo)}>Download workbook</Button>
            <Button variant="outline" onClick={() => demo.simulateExcelSync()}>
              Simulate Excel sync
            </Button>
            <Button variant="outline" onClick={() => setPreview((value) => !value)}>
              {preview ? "Hide sample import" : "Preview sample import"}
            </Button>
          </>
        }
      />
      <div className="mb-3 rounded-lg border bg-white px-3 py-2 text-sm">
        {demo.excelSync ? (
          <p>
            <span className="font-medium">{demo.excelSync.message}.</span> {formatDateTime(demo.excelSync.at)} · {demo.excelSync.loads} loads · {demo.excelSync.expenses} expenses · {demo.excelSync.payments} payments. Nothing was written to a real workbook.
          </p>
        ) : (
          <p className="text-[#5c6b80]">No simulated sync yet. The grid below is the live demo data.</p>
        )}
      </div>
      <Tabs defaultValue="loads">
        <TabsList>
          {TABS.map(([id, label]) => (
            <TabsTrigger key={id} value={id}>{label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(([id]) => (
          <TabsContent key={id} value={id} className="mt-3">
            <div className="mb-2">
              <Button size="sm" variant="outline" onClick={() => downloadCsv(id, rows[id] as Record<string, string | number>[])}>
                Download CSV
              </Button>
            </div>
            <Grid rows={rows[id] as Record<string, string | number>[]} />
          </TabsContent>
        ))}
      </Tabs>
      {preview ? (
        <section className="mt-3 rounded-lg border bg-white p-3">
          <h2 className="text-sm font-semibold">Sample import preview</h2>
          <p className="mb-2 text-xs text-[#5c6b80]">Built-in sample rows. They are not added to the live records.</p>
          <Grid rows={SAMPLE_IMPORT_ROWS} />
        </section>
      ) : null}
    </div>
  );
}

function Grid({ rows }: { rows: Record<string, string | number>[] }) {
  const columns = Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-auto rounded-md border bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="bg-[#eef2f6]">
            <th className="border px-2 py-1 font-medium text-[#5c6b80]">#</th>
            {columns.map((column) => (
              <th key={column} className="border px-2 py-1 font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 40).map((row, index) => (
            <tr key={index}>
              <td className="border bg-[#f8fafc] px-2 py-1 text-[#5c6b80]">{index + 1}</td>
              {columns.map((column) => (
                <td key={column} className="border px-2 py-1 whitespace-nowrap">{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
