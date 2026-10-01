"use client";

import { clearFiles } from "@/lib/files";
import { ensureLedger, validateAssignment } from "@/lib/finance";
import { nextDriverAction, type DriverActionName } from "@/lib/flow";
import { addDays, addMinutes } from "@/lib/format";
import { PITCH_DRIVER_ID } from "@/lib/reference";
import { buildSeed } from "@/lib/seed";
import type {
  Activity,
  DelayReason,
  DemoData,
  DocumentRecord,
  ExpenseCategory,
  ExpenseStatus,
  LoadStatus,
  PaidBy,
  PayMethod,
  ReviewStatus,
  SampleKey,
  TourState,
  WalkthroughState,
} from "@/lib/types";
import { WALK_STEPS } from "@/lib/walkthrough";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Result = { ok: true } | { ok: false; reason: string };

interface UiState {
  view: "owner" | "driver";
  actingDriverId: string;
  walkthrough: WalkthroughState | null;
  tour: TourState;
}

interface Actions {
  resetDemo: () => void;
  startWalkthrough: () => void;
  setWalkStep: (step: number) => void;
  endWalkthrough: () => void;
  markTour: (patch: Partial<TourState>) => void;
  setView: (view: "owner" | "driver", driverId?: string) => void;
  createLoad: (input: CreateLoadInput) => Result & { id?: string };
  assignLoad: (loadId: string, driverId: string, truckId: string) => Result;
  driverAction: (loadId: string, action: DriverActionName) => Result;
  reportDelay: (loadId: string, reason: DelayReason, note: string) => Result;
  addExpense: (input: AddExpenseInput) => Result & { id?: string };
  reviewExpense: (id: string, decision: "approved" | "rejected" | "correction_requested", note?: string) => Result;
  resubmitExpense: (id: string) => Result;
  addDocument: (input: AddDocumentInput) => Result & { id?: string };
  reviewDocument: (id: string, decision: ReviewStatus, reason?: string) => Result;
  approveSettlement: (driverId: string) => Result;
  recordPayment: (driverId: string, amount: number, method: PayMethod, reference: string) => Result;
  scheduleService: (truckId: string, date: string, notes: string) => Result;
  completeService: (truckId: string, odometer: number, cost: number, notes: string) => Result;
  setThresholds: (miles: number, days: number) => void;
  simulateExcelSync: () => void;
}

export interface CreateLoadInput {
  type: "import" | "export";
  containerNumber: string;
  bookingNumber: string;
  customerId: string;
  pickupKey: string;
  destinationKey: string;
  appointmentStart: string;
  appointmentEnd: string;
  customerRate: number;
  lastFreeDay?: string;
  emptyReturnDeadline?: string;
  cutoff?: string;
  notes: string;
}

export interface AttachmentInput {
  fileName: string;
  mimeType: string;
  blobId?: string;
  sampleKey?: SampleKey;
  sampleParams?: Record<string, string>;
  isSample: boolean;
}

export interface AddExpenseInput {
  loadId?: string;
  driverId: string;
  truckId?: string;
  category: ExpenseCategory;
  amount: number;
  merchant: string;
  date: string;
  notes: string;
  paidBy: PaidBy;
  reimbursementRequested: boolean;
  missingReceiptReason?: string;
  attachments: AttachmentInput[];
}

export interface AddDocumentInput {
  loadId?: string;
  driverId?: string;
  expenseId?: string;
  type: DocumentRecord["type"];
  attachment: AttachmentInput;
}

type DemoState = DemoData & UiState & Actions;

const storage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: (name: string) => localStorage.removeItem(name),
};

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function freshUi(): UiState {
  return {
    view: "owner",
    actingDriverId: PITCH_DRIVER_ID,
    walkthrough: null,
    tour: {},
  };
}

function stamp(data: DemoData) {
  return { at: data.clock, data: { ...data, clock: addMinutes(data.clock, 1) } };
}

function withActivity(data: DemoData, activity: Omit<Activity, "id">): DemoData {
  const id = `ACT-${data.counters.activity}`;
  return {
    ...data,
    counters: { ...data.counters, activity: data.counters.activity + 1 },
    activity: [{ ...activity, id }, ...data.activity].slice(0, 400),
  };
}

function heal(data: DemoData): DemoData {
  return { ...data, ledger: ensureLedger(data) };
}

function driverName(data: DemoData, id?: string) {
  return data.drivers.find((driver) => driver.id === id)?.name ?? "Driver";
}

export const useDemo = create<DemoState>()(
  persist(
    (set, get) => {
      const seed = buildSeed();
      const commit = (data: DemoData, ui?: Partial<UiState>) => {
        set({ ...heal(data), ...ui });
      };
      return {
        ...seed,
        ...freshUi(),
        resetDemo: () => {
          void clearFiles();
          set({ ...buildSeed(), ...freshUi() });
        },
        startWalkthrough: () => {
          void clearFiles();
          const next = buildSeed();
          set({
            ...next,
            ...freshUi(),
            walkthrough: { active: true, step: 0, startedAt: next.clock },
          });
        },
        setWalkStep: (step) => {
          const current = get().walkthrough;
          if (!current?.active) return;
          if (step < 0) return;
          if (step >= WALK_STEPS.length) {
            set({ walkthrough: null });
            return;
          }
          set({ walkthrough: { ...current, step } });
        },
        endWalkthrough: () => set({ walkthrough: null }),
        markTour: (patch) => {
          const tour = { ...get().tour, ...patch };
          const prev = get().tour;
          if (
            prev.selectedLoadId === tour.selectedLoadId &&
            prev.financialsLoadId === tour.financialsLoadId &&
            prev.sawEmptyReturn === tour.sawEmptyReturn
          ) {
            return;
          }
          set({ tour });
        },
        setView: (view, driverId) => {
          const actingDriverId = driverId ?? get().actingDriverId;
          if (get().view === view && get().actingDriverId === actingDriverId) return;
          set({ view, actingDriverId });
        },
        createLoad: (input) => {
          const container = input.containerNumber.toUpperCase().replace(/\s+/g, "");
          if (!/^[A-Z]{4}\d{7}$/.test(container)) {
            return { ok: false, reason: "Container number should look like MSCU1234567." };
          }
          if (!input.customerId || !input.pickupKey || !input.destinationKey) {
            return { ok: false, reason: "Choose a customer, pickup, and destination." };
          }
          if (!input.appointmentStart) return { ok: false, reason: "Set an appointment." };
          if (!(input.customerRate > 0)) return { ok: false, reason: "Enter the customer rate." };
          const current = get();
          const { at, data } = stamp(current);
          const id = `LD-${data.counters.load}`;
          const load = {
            id,
            containerNumber: container,
            bookingNumber: input.bookingNumber || `BK-${data.counters.load}`,
            type: input.type,
            customerId: input.customerId,
            pickupKey: input.pickupKey,
            destinationKey: input.destinationKey,
            appointmentStart: input.appointmentStart,
            appointmentEnd: input.appointmentEnd || addMinutes(input.appointmentStart, 180),
            lastFreeDay: input.lastFreeDay || undefined,
            emptyReturnDeadline: input.emptyReturnDeadline || undefined,
            cutoff: input.cutoff || undefined,
            status: "created" as LoadStatus,
            customerRate: input.customerRate,
            additionalCharges: [],
            estimatedHours: input.type === "export" ? 6 : 5.5,
            notes: input.notes,
            timeline: [{ id: `${id}-tl-created`, at, status: "created" as const, label: "Created" }],
            delays: [],
            createdAt: at,
          };
          commit(
            withActivity(
              {
                ...data,
                counters: { ...data.counters, load: data.counters.load + 1 },
                loads: [load, ...data.loads],
              },
              { at, loadId: id, kind: "status", message: `${id} created · ${container}` },
            ),
          );
          return { ok: true, id };
        },
        assignLoad: (loadId, driverId, truckId) => {
          const current = get();
          const check = validateAssignment(current, loadId, driverId, truckId);
          if (!check.ok) return check;
          const { at, data } = stamp(current);
          const previous = check.load.driverId;
          const status: LoadStatus = check.load.status === "created" ? "assigned" : check.load.status;
          const label = previous ? "Reassigned" : "Assigned";
          const loads = data.loads.map((load) =>
            load.id === loadId
              ? {
                  ...load,
                  driverId,
                  truckId,
                  status,
                  timeline: [
                    ...load.timeline,
                    { id: `${load.id}-tl-${label}-${at}`, at, status, label },
                  ],
                }
              : load,
          );
          const from = previous ? ` from ${driverName(data, previous)}` : "";
          commit(
            withActivity(
              { ...data, loads },
              {
                at,
                loadId,
                driverId,
                truckId,
                kind: "assign",
                message: `${check.load.containerNumber} assigned to ${check.driver.name} · ${check.truck.unit}${from}`,
              },
            ),
          );
          return { ok: true };
        },
        driverAction: (loadId, action) => {
          const current = get();
          const load = current.loads.find((item) => item.id === loadId);
          if (!load) return { ok: false, reason: "Load not found." };
          if (current.view === "driver" && load.driverId !== current.actingDriverId) {
            return { ok: false, reason: "This load belongs to another driver." };
          }
          const expected = nextDriverAction(load);
          if (!expected || expected.action !== action) {
            return { ok: false, reason: "That step isn't available on this load." };
          }
          const { at, data } = stamp(current);
          const timeline = [...load.timeline];
          let status: LoadStatus = load.status;
          let clock = data.clock;
          const push = (nextStatus: LoadStatus, label: string, when: string) => {
            timeline.push({ id: `${load.id}-tl-${nextStatus}-${when}`, at: when, status: nextStatus, label });
          };
          if (action === "accept") push((status = "accepted"), "Accepted", at);
          if (action === "arrive_port") push((status = "at_port"), "At port", at);
          if (action === "pick_up") push((status = "picked_up"), load.type === "export" ? "Loaded" : "Picked up", at);
          if (action === "arrive_customer") {
            push((status = "at_customer"), load.type === "export" ? "At shipper" : "At customer", at);
          }
          if (action === "deliver") {
            push("delivered", "Delivered", at);
            const later = addMinutes(at, 1);
            push((status = "empty_return_pending"), "Empty return pending", later);
            clock = addMinutes(at, 2);
          }
          if (action === "empty_returned") push((status = "empty_returned"), "Empty returned", at);
          if (action === "gate_in") push((status = "gated_in"), "Full container gated in", at);
          if (action === "complete") push((status = "complete"), "Complete", at);
          const loads = data.loads.map((item) =>
            item.id === loadId
              ? { ...item, status, timeline, completedAt: status === "complete" ? at : item.completedAt }
              : item,
          );
          commit(
            withActivity(
              { ...data, clock, loads },
              {
                at,
                loadId,
                driverId: load.driverId,
                truckId: load.truckId,
                kind: "status",
                message: `${driverName(data, load.driverId)} · ${load.containerNumber} · ${timeline.at(-1)?.label ?? expected.label}`,
              },
            ),
          );
          return { ok: true };
        },
        reportDelay: (loadId, reason, note) => {
          const current = get();
          const load = current.loads.find((item) => item.id === loadId);
          if (!load) return { ok: false, reason: "Load not found." };
          if (!note.trim()) return { ok: false, reason: "Add a short note about the delay." };
          const { at, data } = stamp(current);
          const loads = data.loads.map((item) =>
            item.id === loadId
              ? { ...item, delays: [...item.delays, { id: `${loadId}-delay-${at}`, at, reason, note: note.trim() }] }
              : item,
          );
          commit(
            withActivity(
              { ...data, loads },
              {
                at,
                loadId,
                driverId: load.driverId,
                truckId: load.truckId,
                kind: "delay",
                message: `${driverName(data, load.driverId)} reported a delay on ${load.containerNumber}`,
              },
            ),
          );
          return { ok: true };
        },
        addExpense: (input) => {
          if (!(input.amount > 0)) return { ok: false, reason: "Enter an amount greater than zero." };
          if (!input.merchant.trim()) return { ok: false, reason: "Enter the merchant." };
          if (!input.date) return { ok: false, reason: "Enter the date." };
          if (input.attachments.length === 0 && !input.missingReceiptReason?.trim()) {
            return { ok: false, reason: "Attach a receipt, use a sample, or say why the receipt is missing." };
          }
          const current = get();
          const { at, data } = stamp(current);
          const expenseId = `EX-${data.counters.expense}`;
          let docCounter = data.counters.doc;
          const documents = [...data.documents];
          const attachmentIds: string[] = [];
          for (const attachment of input.attachments) {
            const id = `DOC-${docCounter++}`;
            attachmentIds.push(id);
            documents.unshift({
              id,
              loadId: input.loadId,
              driverId: input.driverId,
              expenseId,
              type: "expense_receipt",
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              uploadedAt: at,
              reviewStatus: "pending",
              sampleKey: attachment.sampleKey,
              sampleParams: attachment.sampleParams,
              blobId: attachment.blobId,
              isSample: attachment.isSample,
            });
          }
          const expense = {
            id: expenseId,
            loadId: input.loadId,
            driverId: input.driverId,
            truckId: input.truckId,
            category: input.category,
            amount: Math.round(input.amount * 100) / 100,
            merchant: input.merchant.trim(),
            date: input.date,
            notes: input.notes.trim(),
            paidBy: input.paidBy,
            reimbursementRequested: input.paidBy === "driver" && input.reimbursementRequested,
            status: "awaiting_approval" as ExpenseStatus,
            missingReceiptReason: input.missingReceiptReason?.trim() || undefined,
            attachmentIds,
            createdAt: at,
          };
          commit(
            withActivity(
              {
                ...data,
                documents,
                expenses: [expense, ...data.expenses],
                counters: { ...data.counters, expense: data.counters.expense + 1, doc: docCounter },
              },
              {
                at,
                loadId: input.loadId,
                driverId: input.driverId,
                truckId: input.truckId,
                kind: "expense",
                message: `${driverName(data, input.driverId)} submitted ${expense.merchant} · $${expense.amount.toFixed(2)} for approval`,
              },
            ),
          );
          return { ok: true, id: expenseId };
        },
        reviewExpense: (id, decision, note) => {
          const current = get();
          const expense = current.expenses.find((item) => item.id === id);
          if (!expense) return { ok: false, reason: "Expense not found." };
          if (decision === "rejected" && !note?.trim()) return { ok: false, reason: "Add a reason for the rejection." };
          if (decision === "correction_requested" && !note?.trim()) {
            return { ok: false, reason: "Say what needs to be corrected." };
          }
          const { at, data } = stamp(current);
          const expenses = data.expenses.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: decision,
                  reviewedAt: at,
                  rejectionReason: decision === "rejected" ? note?.trim() : undefined,
                  correctionNote: decision === "correction_requested" ? note?.trim() : undefined,
                }
              : item,
          );
          const documents =
            decision === "approved"
              ? data.documents.map((doc) =>
                  doc.expenseId === id && doc.reviewStatus === "pending" ? { ...doc, reviewStatus: "approved" as const } : doc,
                )
              : data.documents;
          const verb =
            decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "sent back";
          commit(
            withActivity(
              { ...data, expenses, documents },
              {
                at,
                loadId: expense.loadId,
                driverId: expense.driverId,
                kind: "expense",
                message: `${expense.id} ${verb} · ${expense.merchant}`,
              },
            ),
          );
          return { ok: true };
        },
        resubmitExpense: (id) => {
          const current = get();
          const expense = current.expenses.find((item) => item.id === id);
          if (!expense) return { ok: false, reason: "Expense not found." };
          if (expense.status !== "correction_requested") {
            return { ok: false, reason: "Only a receipt sent back for correction can be resubmitted." };
          }
          const { at, data } = stamp(current);
          commit(
            withActivity(
              {
                ...data,
                expenses: data.expenses.map((item) =>
                  item.id === id ? { ...item, status: "awaiting_approval", correctionNote: undefined } : item,
                ),
              },
              {
                at,
                loadId: expense.loadId,
                driverId: expense.driverId,
                kind: "expense",
                message: `${expense.id} resubmitted for approval`,
              },
            ),
          );
          return { ok: true };
        },
        addDocument: (input) => {
          const current = get();
          const { at, data } = stamp(current);
          const id = `DOC-${data.counters.doc}`;
          const document: DocumentRecord = {
            id,
            loadId: input.loadId,
            driverId: input.driverId,
            expenseId: input.expenseId,
            type: input.type,
            fileName: input.attachment.fileName,
            mimeType: input.attachment.mimeType,
            uploadedAt: at,
            reviewStatus: "pending",
            sampleKey: input.attachment.sampleKey,
            sampleParams: input.attachment.sampleParams,
            blobId: input.attachment.blobId,
            isSample: input.attachment.isSample,
          };
          commit(
            withActivity(
              {
                ...data,
                documents: [document, ...data.documents],
                counters: { ...data.counters, doc: data.counters.doc + 1 },
              },
              {
                at,
                loadId: input.loadId,
                driverId: input.driverId,
                kind: "document",
                message: `${driverName(data, input.driverId)} uploaded ${input.attachment.fileName}`,
              },
            ),
          );
          return { ok: true, id };
        },
        reviewDocument: (id, decision, reason) => {
          if (decision === "pending") return { ok: false, reason: "Choose approve or reject." };
          if (decision === "rejected" && !reason?.trim()) return { ok: false, reason: "Add a reason for the rejection." };
          const current = get();
          const document = current.documents.find((item) => item.id === id);
          if (!document) return { ok: false, reason: "Document not found." };
          const { at, data } = stamp(current);
          commit(
            withActivity(
              {
                ...data,
                documents: data.documents.map((item) =>
                  item.id === id
                    ? { ...item, reviewStatus: decision, rejectionReason: decision === "rejected" ? reason?.trim() : undefined }
                    : item,
                ),
              },
              {
                at,
                loadId: document.loadId,
                driverId: document.driverId,
                kind: "document",
                message: `${document.fileName} ${decision === "approved" ? "approved" : "rejected"}`,
              },
            ),
          );
          return { ok: true };
        },
        approveSettlement: (driverId) => {
          const current = get();
          if (current.settlementApprovals.some((item) => item.driverId === driverId)) return { ok: true };
          const { at, data } = stamp(current);
          commit({
            ...data,
            settlementApprovals: [...data.settlementApprovals, { driverId, at }],
          });
          return { ok: true };
        },
        recordPayment: (driverId, amount, method, reference) => {
          const current = get();
          if (!current.settlementApprovals.some((item) => item.driverId === driverId)) {
            return { ok: false, reason: "Review and approve the settlement before recording a payment." };
          }
          const balance = current.ledger
            .filter((entry) => entry.driverId === driverId)
            .reduce((sum, entry) => sum + entry.amount, 0);
          const rounded = Math.round(amount * 100) / 100;
          if (!(rounded > 0)) return { ok: false, reason: "Enter a payment amount." };
          if (rounded > Math.round(balance * 100) / 100 + 0.001) {
            return { ok: false, reason: "That amount is higher than the outstanding balance." };
          }
          const { at, data } = stamp(current);
          const driver = data.drivers.find((item) => item.id === driverId);
          commit(
            withActivity(
              {
                ...data,
                ledger: [
                  ...data.ledger,
                  {
                    id: `pay-${driverId}-${at}`,
                    driverId,
                    at,
                    type: "payment",
                    amount: -rounded,
                    memo: rounded + 0.009 < balance ? "Partial settlement payment" : "Settlement payment",
                    method,
                    reference: reference.trim() || `${method}-${String(data.counters.activity)}`,
                  },
                ],
              },
              {
                at,
                driverId,
                kind: "payment",
                message: `Recorded ${method} payment of $${rounded.toFixed(2)} for ${driver?.name ?? "driver"}`,
              },
            ),
          );
          return { ok: true };
        },
        scheduleService: (truckId, date, notes) => {
          if (!date) return { ok: false, reason: "Choose a service date." };
          const current = get();
          const truck = current.trucks.find((item) => item.id === truckId);
          if (!truck) return { ok: false, reason: "Truck not found." };
          const { at, data } = stamp(current);
          commit(
            withActivity(
              {
                ...data,
                trucks: data.trucks.map((item) =>
                  item.id === truckId ? { ...item, nextServiceDate: date, scheduledNote: notes.trim() || item.scheduledNote } : item,
                ),
              },
              { at, truckId, kind: "maintenance", message: `Service scheduled for ${truck.unit} on ${date}` },
            ),
          );
          return { ok: true };
        },
        completeService: (truckId, odometer, cost, notes) => {
          const current = get();
          const truck = current.trucks.find((item) => item.id === truckId);
          if (!truck) return { ok: false, reason: "Truck not found." };
          if (!(odometer > 0)) return { ok: false, reason: "Enter the odometer." };
          const { at, data } = stamp(current);
          const day = at.slice(0, 10);
          commit(
            withActivity(
              {
                ...data,
                trucks: data.trucks.map((item) =>
                  item.id === truckId
                    ? {
                        ...item,
                        odometer: Math.max(item.odometer, Math.round(odometer)),
                        operational: "in_service",
                        nextServiceDate: addDays(day, 90),
                        nextServiceMiles: Math.max(item.odometer, Math.round(odometer)) + 10000,
                        scheduledNote: undefined,
                        staleLocation: false,
                      }
                    : item,
                ),
                serviceRecords: [
                  {
                    id: `SVC-${truckId}-${at}`,
                    truckId,
                    date: day,
                    odometer: Math.round(odometer),
                    kind: "preventive",
                    summary: notes.trim() || "Service completed",
                    cost: Math.max(0, cost),
                    shop: "Oakland Fleet Services",
                  },
                  ...data.serviceRecords,
                ],
                issues: data.issues.map((issue) =>
                  issue.truckId === truckId && issue.status === "open" ? { ...issue, status: "closed" } : issue,
                ),
              },
              { at, truckId, kind: "maintenance", message: `${truck.unit} service marked complete` },
            ),
          );
          return { ok: true };
        },
        setThresholds: (miles, days) => {
          if (!(miles > 0) || !(days > 0)) return;
          set({ thresholds: { miles: Math.round(miles), days: Math.round(days) } });
        },
        simulateExcelSync: () => {
          const current = get();
          const { at, data } = stamp(current);
          const payments = data.ledger.filter((entry) => entry.type === "payment").length;
          commit({
            ...data,
            excelSync: {
              at,
              loads: data.loads.length,
              drivers: data.drivers.length,
              expenses: data.expenses.length,
              payments,
              maintenance: data.trucks.length,
              message: "Demo sync completed",
            },
          });
        },
      };
    },
    {
      name: "snapdispatch-demo-v1",
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : storage)),
      partialize: (state) => ({
        drivers: state.drivers,
        trucks: state.trucks,
        loads: state.loads,
        expenses: state.expenses,
        documents: state.documents,
        ledger: state.ledger,
        activity: state.activity,
        serviceRecords: state.serviceRecords,
        issues: state.issues,
        thresholds: state.thresholds,
        clock: state.clock,
        excelSync: state.excelSync,
        settlementApprovals: state.settlementApprovals,
        counters: state.counters,
        view: state.view,
        actingDriverId: state.actingDriverId,
        walkthrough: state.walkthrough,
        tour: state.tour,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.loads || !state.drivers) return;
        state.ledger = ensureLedger(state);
      },
    },
  ),
);

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const finish = () => setHydrated(true);
    if (useDemo.persist.hasHydrated()) finish();
    const unsub = useDemo.persist.onFinishHydration(finish);
    const timer = window.setTimeout(finish, 400);
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
  return hydrated;
}
