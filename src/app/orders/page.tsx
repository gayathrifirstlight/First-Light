import Link from "next/link";
import { rupees } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Orders · First Light" };

const PAID_LABEL: Record<string, string> = { paid: "Paid", unpaid: "Not paid", partial: "Part paid", unknown: "?" };

export default async function OrdersPage() {
  const { supabase } = await requireUser();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_date, customer_name, customer_contact, channel, product, variant, total_amount, payment_status, status, review_notes")
    .order("order_date", { ascending: false, nullsFirst: false })
    .limit(500);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/import" className="btn">
          Import more
        </Link>
      </div>
      {error && <p className="text-sm text-red-700">Couldn&apos;t load orders. Has the database been set up? (See SETUP.md)</p>}
      {orders && orders.length === 0 && <p className="text-muted">No orders yet. Import a spreadsheet to get started.</p>}
      {orders && orders.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-left text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Paid</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className={`border-t border-line ${o.status === "cancelled" ? "text-muted line-through" : ""}`}
                  title={o.review_notes?.length ? `Imported with a note: ${o.review_notes.join(" ")}` : undefined}
                >
                  <td className="px-3 py-2 whitespace-nowrap">{o.order_date ?? "—"}</td>
                  <td className="px-3 py-2">{o.customer_name ?? o.customer_contact ?? "—"}</td>
                  <td className="px-3 py-2">{o.channel ?? "—"}</td>
                  <td className="px-3 py-2">
                    {[o.product, o.variant].filter(Boolean).join(", ")}
                    {o.review_notes?.length ? <span className="ml-1 text-amber-700">•</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">{rupees(o.total_amount)}</td>
                  <td className="px-3 py-2">{PAID_LABEL[o.payment_status] ?? o.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
