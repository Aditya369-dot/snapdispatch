"use client";

import { PageHeader } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SAMPLE_IMPORT_ROWS, downloadCsv, downloadWorkbook, workbookRows } from "@/lib/excel";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { excelCell, excelColumn, fill } from "@/lib/i18n/say";
import { useDemo } from "@/lib/store";
import { useState } from "react";

export default function ExcelPage() {
  const { c, lang, text } = useI18n();
  const x = c.excel;
  const demo = useDemo();
  const rows = workbookRows(demo);
  const [preview, setPreview] = useState(false);
  const tabs = [
    ["loads", x.loads],
    ["drivers", x.drivers],
    ["expenses", x.expenses],
    ["payments", x.payments],
    ["maintenance", x.maintenance],
  ] as const;
  return (
    <div data-tour="excel-preview">
      <PageHeader
        title={x.title}
        description={x.description}
        actions={
          <>
            <Button onClick={() => downloadWorkbook(demo)}>{x.download}</Button>
            <Button variant="outline" onClick={() => demo.simulateExcelSync()}>
              {x.simulate}
            </Button>
            <Button variant="outline" onClick={() => setPreview((value) => !value)}>
              {preview ? x.hide : x.preview}
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200 ring-inset">{c.demoData}</span>
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900 ring-1 ring-sky-200 ring-inset">{c.excelSyncBadge}</span>
      </div>
      <div className="mb-3 rounded-lg border bg-white px-3 py-2 text-sm">
        {demo.excelSync ? (
          <p>
            {fill(x.synced, {
              message: text(demo.excelSync.message),
              when: formatDateTime(demo.excelSync.at),
              loads: demo.excelSync.loads,
              expenses: demo.excelSync.expenses,
              payments: demo.excelSync.payments,
            })}
          </p>
        ) : (
          <p className="text-[#5c6b80]">{x.none}</p>
        )}
      </div>
      <Tabs defaultValue="loads">
        <TabsList>
          {tabs.map(([id, label]) => (
            <TabsTrigger key={id} value={id}>{label}</TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(([id]) => (
          <TabsContent key={id} value={id} className="mt-3">
            <div className="mb-2">
              <Button size="sm" variant="outline" onClick={() => downloadCsv(id, rows[id] as Record<string, string | number>[])}>
                {x.csv}
              </Button>
            </div>
            <Grid rows={rows[id] as Record<string, string | number>[]} lang={lang} />
          </TabsContent>
        ))}
      </Tabs>
      {preview ? (
        <section className="mt-3 rounded-lg border bg-white p-3">
          <h2 className="text-sm font-semibold">{x.sampleTitle}</h2>
          <p className="mb-2 text-xs text-[#5c6b80]">{x.sampleHint}</p>
          <Grid rows={SAMPLE_IMPORT_ROWS} lang={lang} />
        </section>
      ) : null}
    </div>
  );
}

function Grid({ rows, lang }: { rows: Record<string, string | number>[]; lang: "en" | "es" }) {
  const columns = Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-auto rounded-md border bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="bg-[#eef2f6]">
            <th className="border px-2 py-1 font-medium text-[#5c6b80]">#</th>
            {columns.map((column) => (
              <th key={column} className="border px-2 py-1 font-medium">{excelColumn(lang, column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 40).map((row, index) => (
            <tr key={index}>
              <td className="border bg-[#f8fafc] px-2 py-1 text-[#5c6b80]">{index + 1}</td>
              {columns.map((column) => (
                <td key={column} className="border px-2 py-1 whitespace-nowrap">{excelCell(lang, column, row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
