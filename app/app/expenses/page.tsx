"use client";

import { pilotFetch, type Me } from "@/components/pilot/client";
import { useEffect, useState } from "react";

type Expense = {
  id: string;
  amountCents: number;
  correctedAmountCents: number | null;
  memo: string;
  source: string;
};

type Example = {
  id: string;
  label: string;
  assumptionNote: string;
  exampleAmountCents: number | null;
  nonProduction: boolean;
};

export default function ExpensesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    const [expenseResult, exampleResult, meResult] = await Promise.all([
      pilotFetch<{ expenses: Expense[] }>("/api/v1/expenses"),
      pilotFetch<{ examples: Example[]; note: string }>("/api/v1/pay-examples"),
      pilotFetch<Me>("/api/v1/me"),
    ]);
    if (meResult.status === 200) setMe(meResult.body);
    if (expenseResult.status === 200) setExpenses(expenseResult.body.expenses ?? []);
    if (exampleResult.status === 200) setExamples(exampleResult.body.examples ?? []);
  }

  useEffect(() => {
    pilotFetch<Me>("/api/v1/me").then((result) => {
      if (result.status === 200) setMe(result.body);
    });
    pilotFetch<{ expenses: Expense[] }>("/api/v1/expenses").then((result) => {
      if (result.status === 200) setExpenses(result.body.expenses ?? []);
    });
    pilotFetch<{ examples: Example[] }>("/api/v1/pay-examples").then((result) => {
      if (result.status === 200) setExamples(result.body.examples ?? []);
    });
  }, []);

  async function correct(expenseId: string) {
    const result = await pilotFetch(`/api/v1/expenses/${expenseId}/corrections`, {
      method: "POST",
      body: JSON.stringify({
        amountCents: Number(amount),
        note,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    setMessage(result.status === 200 ? "Typed amount corrected. No pay was posted." : (result.body.error?.message ?? "Correction failed."));
    await reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Typed amounts</h1>
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        Driver-pay calculations are disabled until Q4. Nothing on this page is earnings, a ledger, or a reimbursement.
      </p>
      <ul className="rounded-lg border bg-white text-sm">
        {expenses.map((expense) => (
          <li key={expense.id} className="flex flex-wrap items-center gap-2 border-b px-3 py-2 last:border-b-0">
            <span>{expense.source}</span>
            <span>{expense.amountCents} cents typed</span>
            <span>{expense.correctedAmountCents == null ? "no correction" : `${expense.correctedAmountCents} cents corrected`}</span>
            <span className="text-[#5c6b80]">{expense.memo}</span>
            {me?.role === "owner" ? (
              <button className="rounded-md border px-2 py-1" type="button" onClick={() => void correct(expense.id)}>
                Correct
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {me?.role === "owner" ? (
        <div className="rounded-lg border bg-white p-3 text-sm">
          <label>
            Corrected cents
            <input className="ml-2 rounded-md border px-2 py-1" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="mt-2 block">
            Note
            <input className="mt-1 w-full rounded-md border px-2 py-1" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
      <section className="rounded-lg border bg-white p-3 text-sm">
        <h2 className="font-medium">Fixture pay examples</h2>
        <ul className="mt-2 space-y-2">
          {examples.map((example) => (
            <li key={example.id}>
              <p className="font-medium">{example.label}</p>
              <p>{example.assumptionNote}</p>
              <p>{example.exampleAmountCents} cents · non-production {String(example.nonProduction)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
