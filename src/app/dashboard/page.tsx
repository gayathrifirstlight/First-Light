import Link from "next/link";
import { rupees } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Overview · First Light" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const { data: orders } = await supabase
    .from("orders")
    .select("channel, total_amount, payment_status, status, review_notes")
    .eq("status", "active");

  const list = orders ?? [];
  const business = (user.user_metadata?.business_name as string | undefined) || "your business";
  const total = list.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const unpaid = list.filter((o) => o.payment_status === "unpaid" || o.payment_status === "partial");
  const byChannel = new Map<string, { count: number; total: number }>();
  for (const o of list) {
    const key = o.channel ?? "Not set";
    const cur = byChannel.get(key) ?? { count: 0, total: 0 };
    byChannel.set(key, { count: cur.count + 1, total: cur.total + Number(o.total_amount ?? 0) });
  }
  const channels = [...byChannel.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Hi, {business}</h1>

      {list.length === 0 ? (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Start by bringing in your orders</h2>
          <p className="text-muted">
            Upload the Excel or Google Sheet where you log Instagram, WhatsApp and word-of-mouth orders. First Light
            will suggest what each column means, and you confirm it.
          </p>
          <Link href="/import" className="btn">
            Import a spreadsheet
          </Link>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Orders" value={String(list.length)} />
            <Stat label="Sales" value={rupees(total)} />
            <Stat label="Waiting for payment" value={`${unpaid.length} ${unpaid.length === 1 ? "order" : "orders"}`} />
          </div>
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Sales by channel</h2>
            <table className="w-full text-sm">
              <tbody>
                {channels.map(([name, v]) => (
                  <tr key={name} className="border-t border-line first:border-0">
                    <td className="py-2">{name}</td>
                    <td className="py-2 text-right text-muted">{v.count} {v.count === 1 ? "order" : "orders"}</td>
                    <td className="py-2 text-right font-medium">{rupees(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-sm text-muted">
            Shopify, Instagram and ads connections and the weekly AI brief are coming next.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
