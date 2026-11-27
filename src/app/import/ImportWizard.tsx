"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { normalizeRows } from "@/lib/import/normalize";
import {
  FIELD_LABELS,
  ORDER_FIELDS,
  type ColumnMapping,
  type DetectedTable,
  type MappingSuggestion,
  type MappingTarget,
  type NormalizedOrder,
} from "@/lib/import/types";
import { saveImport } from "./actions";

type Preview = {
  sheets: { name: string; rowCount: number }[];
  sheetName: string;
  table: DetectedTable;
  suggestion: MappingSuggestion & { note?: string };
};

type Step = "upload" | "mapping" | "review" | "done";

const TARGETS: MappingTarget[] = [...ORDER_FIELDS, "ignore"];

export default function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [orders, setOrders] = useState<NormalizedOrder[]>([]);
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, startSaving] = useTransition();

  async function loadPreview(f: File, sheet?: string) {
    setLoading(true);
    setError(null);
    const body = new FormData();
    body.append("file", f);
    if (sheet) body.append("sheet", sheet);
    try {
      const res = await fetch("/api/import/preview", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      setPreview(json);
      setMapping(json.suggestion.columns);
      setStep("mapping");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function confirmMapping() {
    if (!preview) return;
    const result = normalizeRows(preview.table.dataRows, preview.table.headers, mapping);
    setOrders(result);
    // Clean rows are in by default. Flagged rows wait for the seller to decide.
    setIncluded(Object.fromEntries(result.map((o) => [o.rowNumber, o.flags.length === 0])));
    setStep("review");
  }

  function save() {
    if (!preview || !file) return;
    const chosen = orders.filter((o) => included[o.rowNumber]);
    startSaving(async () => {
      const res = await saveImport({
        fileName: file.name,
        sheetName: preview.sheetName,
        mappingSource: preview.suggestion.source,
        mapping: mapping.map(({ columnIndex, header, target }) => ({ columnIndex, header, target })),
        orders: chosen,
        skippedCount: orders.length - chosen.length + preview.table.skippedRows.length,
      });
      if (res.error) setError(res.error);
      else {
        setImported(res.imported ?? 0);
        setStep("done");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Steps step={step} />
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {step === "upload" && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">Upload your order sheet</h2>
          <p className="text-sm text-muted">
            Excel (.xlsx) or CSV. From Google Sheets, use File → Download → Microsoft Excel or CSV.
            Messy is fine: month blocks, notes and totals are handled.
          </p>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-white"
          />
          <button className="btn" disabled={!file || loading} onClick={() => file && loadPreview(file)}>
            {loading ? "Reading your sheet…" : "Continue"}
          </button>
        </section>
      )}

      {step === "mapping" && preview && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Check what each column means</h2>
            {preview.sheets.length > 1 && (
              <label className="text-sm">
                Tab:{" "}
                <select
                  className="input w-auto"
                  value={preview.sheetName}
                  disabled={loading}
                  onChange={(e) => file && loadPreview(file, e.target.value)}
                >
                  {preview.sheets.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.rowCount} rows)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="text-sm text-muted">
            {preview.suggestion.source === "ai"
              ? "First Light's AI suggested these. Change anything that's wrong, then confirm."
              : preview.suggestion.note ?? "Suggested from your column names. Change anything that's wrong."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 pr-4">Your column</th>
                  <th className="py-2 pr-4">Example values</th>
                  <th className="py-2 pr-4">Means</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((m, i) => (
                  <tr key={m.columnIndex} className="border-t border-line align-top">
                    <td className="py-2 pr-4 font-medium">{m.header}</td>
                    <td className="py-2 pr-4 text-muted">
                      {preview.table.dataRows
                        .map((r) => r.cells[m.columnIndex])
                        .filter((c) => c !== null)
                        .slice(0, 3)
                        .map(String)
                        .join(" · ")}
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        className={`input ${m.confidence === "low" ? "border-amber-400" : ""}`}
                        value={m.target}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = { ...m, target: e.target.value as MappingTarget, confidence: "high", reason: "You chose this." };
                          setMapping(next);
                        }}
                      >
                        {TARGETS.map((t) => (
                          <option key={t} value={t}>
                            {FIELD_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-xs text-muted">
                      {m.confidence === "low" && <span className="mr-1 font-semibold text-amber-700">Not sure.</span>}
                      {m.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DuplicateWarning mapping={mapping} />
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep("upload")}>
              Back
            </button>
            <button className="btn" onClick={confirmMapping} disabled={hasDuplicates(mapping)}>
              Looks right, continue
            </button>
          </div>
        </section>
      )}

      {step === "review" && preview && (
        <Review
          orders={orders}
          skipped={preview.table.skippedRows}
          included={included}
          setIncluded={setIncluded}
          setOrders={setOrders}
          onBack={() => setStep("mapping")}
          onSave={save}
          saving={saving}
        />
      )}

      {step === "done" && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Imported {imported} orders</h2>
          <p className="text-sm text-muted">They&apos;re now in one place with the rest of your sales.</p>
          <div className="flex gap-3">
            <Link className="btn" href="/orders">
              See orders
            </Link>
            <button
              className="btn-secondary"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setStep("upload");
              }}
            >
              Import another sheet
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function hasDuplicates(mapping: ColumnMapping[]) {
  const used = mapping.filter((m) => m.target !== "ignore").map((m) => m.target);
  return new Set(used).size !== used.length;
}

function DuplicateWarning({ mapping }: { mapping: ColumnMapping[] }) {
  if (!hasDuplicates(mapping)) return null;
  return (
    <p className="text-sm text-amber-800">Two columns are set to the same thing. Each meaning can only be used once.</p>
  );
}

function Steps({ step }: { step: Step }) {
  const labels: [Step, string][] = [
    ["upload", "1. Upload"],
    ["mapping", "2. Columns"],
    ["review", "3. Review"],
    ["done", "4. Done"],
  ];
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {labels.map(([s, label]) => (
        <li key={s} className={`rounded-full px-3 py-1 ${s === step ? "bg-brand text-white" : "bg-subtle text-muted"}`}>
          {label}
        </li>
      ))}
    </ol>
  );
}

const PAID_LABEL = { paid: "Paid", unpaid: "Not paid", partial: "Part paid", unknown: "Not sure" } as const;

function money(n: number | null) {
  return n === null ? "—" : `₹${n.toLocaleString("en-IN")}`;
}

function Review(props: {
  orders: NormalizedOrder[];
  skipped: DetectedTable["skippedRows"];
  included: Record<number, boolean>;
  setIncluded: (v: Record<number, boolean>) => void;
  setOrders: (v: NormalizedOrder[]) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { orders, included } = props;
  const clean = orders.filter((o) => o.flags.length === 0);
  const flagged = orders.filter((o) => o.flags.length > 0);
  const count = orders.filter((o) => included[o.rowNumber]).length;
  const total = useMemo(
    () =>
      orders
        .filter((o) => included[o.rowNumber] && o.status === "active")
        .reduce((sum, o) => sum + (o.total_amount ?? 0), 0),
    [orders, included],
  );

  function edit(rowNumber: number, patch: Partial<NormalizedOrder>) {
    props.setOrders(orders.map((o) => (o.rowNumber === rowNumber ? { ...o, ...patch } : o)));
  }

  return (
    <div className="space-y-6">
      {flagged.length > 0 && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">{flagged.length} rows need a look</h2>
          <p className="text-sm text-muted">
            We didn&apos;t want to guess on these. Fix anything that&apos;s wrong and tick the ones to import.
          </p>
          {flagged.map((o) => (
            <div key={o.rowNumber} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">Row {o.rowNumber}</p>
                  <ul className="list-disc pl-5 text-amber-900">
                    {o.flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted">
                    In your sheet:{" "}
                    {Object.entries(o.raw)
                      .filter(([, v]) => v !== null)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                </div>
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={!!included[o.rowNumber]}
                    onChange={(e) => props.setIncluded({ ...included, [o.rowNumber]: e.target.checked })}
                  />
                  Import this row
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Field label="Date">
                  <input
                    type="date"
                    className="input"
                    value={o.order_date ?? ""}
                    onChange={(e) => edit(o.rowNumber, { order_date: e.target.value || null })}
                  />
                </Field>
                <Field label="Customer">
                  <input
                    className="input"
                    value={o.customer_name ?? ""}
                    onChange={(e) => edit(o.rowNumber, { customer_name: e.target.value || null })}
                  />
                </Field>
                <Field label="Product">
                  <input
                    className="input"
                    value={o.product ?? ""}
                    onChange={(e) => edit(o.rowNumber, { product: e.target.value || null })}
                  />
                </Field>
                <Field label="Total (₹)">
                  <input
                    type="number"
                    className="input"
                    value={o.total_amount ?? ""}
                    onChange={(e) => edit(o.rowNumber, { total_amount: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Paid?">
                  <select
                    className="input"
                    value={o.payment_status}
                    onChange={(e) => edit(o.rowNumber, { payment_status: e.target.value as NormalizedOrder["payment_status"] })}
                  >
                    <option value="paid">Paid</option>
                    <option value="partial">Part paid</option>
                    <option value="unpaid">Not paid</option>
                    <option value="unknown">Not sure</option>
                  </select>
                </Field>
              </div>
              {o.status === "cancelled" && <p className="mt-2 text-xs">This will be saved as a cancelled order and left out of sales totals.</p>}
            </div>
          ))}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{clean.length} rows look good</h2>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-muted">
              <tr>
                <th className="py-1 pr-2">Row</th>
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Customer</th>
                <th className="py-1 pr-2">Channel</th>
                <th className="py-1 pr-2">Product</th>
                <th className="py-1 pr-2 text-right">Total</th>
                <th className="py-1">Paid</th>
              </tr>
            </thead>
            <tbody>
              {clean.map((o) => (
                <tr key={o.rowNumber} className="border-t border-line" title={o.assumptions.join("\n")}>
                  <td className="py-1 pr-2 text-muted">{o.rowNumber}</td>
                  <td className="py-1 pr-2">{o.order_date}</td>
                  <td className="py-1 pr-2">{o.customer_name ?? o.customer_contact}</td>
                  <td className="py-1 pr-2">{o.channel ?? "—"}</td>
                  <td className="py-1 pr-2">{[o.product, o.variant].filter(Boolean).join(", ")}</td>
                  <td className="py-1 pr-2 text-right">{money(o.total_amount)}</td>
                  <td className="py-1">{PAID_LABEL[o.payment_status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {props.skipped.length > 0 && (
          <p className="text-xs text-muted">
            Skipped on purpose: {props.skipped.map((s) => `row ${s.rowNumber} (${s.reason.toLowerCase()})`).join(", ")}.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secondary" onClick={props.onBack}>
          Back
        </button>
        <button className="btn" onClick={props.onSave} disabled={props.saving || count === 0}>
          {props.saving ? "Saving…" : `Import ${count} orders (${money(total)})`}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
