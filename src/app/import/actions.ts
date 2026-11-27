"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { ORDER_FIELDS } from "@/lib/import/types";

const nullableText = z.string().trim().max(500).nullable();
const nullableNumber = z.number().finite().nullable();

const OrderInput = z.object({
  rowNumber: z.number().int(),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  customer_name: nullableText,
  customer_contact: nullableText,
  channel: nullableText,
  product: nullableText,
  variant: nullableText,
  quantity: z.number().int().nullable(),
  unit_price: nullableNumber,
  discount: nullableNumber,
  total_amount: nullableNumber,
  payment_status: z.enum(["paid", "unpaid", "partial", "unknown"]),
  payment_method: nullableText,
  delivery_status: nullableText,
  notes: nullableText,
  status: z.enum(["active", "cancelled"]),
  flags: z.array(z.string()),
  raw: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

const SaveInput = z.object({
  fileName: z.string().max(300),
  sheetName: z.string().max(300).nullable(),
  mappingSource: z.enum(["ai", "rules"]),
  mapping: z.array(
    z.object({ columnIndex: z.number().int(), header: z.string(), target: z.enum([...ORDER_FIELDS, "ignore"]) }),
  ),
  orders: z.array(OrderInput).max(5000),
  skippedCount: z.number().int(),
});

export type SaveImportInput = z.infer<typeof SaveInput>;

/** Final step: save the orders the seller chose to import. */
export async function saveImport(input: SaveImportInput): Promise<{ error?: string; imported?: number }> {
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { error: "Some of the order data didn't look right. Please try again." };
  const data = parsed.data;
  const { supabase, user } = await requireUser();

  const { data: imp, error: impError } = await supabase
    .from("imports")
    .insert({
      user_id: user.id,
      file_name: data.fileName,
      sheet_name: data.sheetName,
      column_mapping: data.mapping,
      mapping_source: data.mappingSource,
      imported_count: data.orders.length,
      skipped_count: data.skippedCount,
    })
    .select("id")
    .single();
  if (impError || !imp) {
    console.error(impError);
    return { error: "Couldn't save the import. Has the database been set up? (See SETUP.md)" };
  }

  if (data.orders.length > 0) {
    const rows = data.orders.map((o) => ({
      user_id: user.id,
      import_id: imp.id,
      source: "spreadsheet",
      source_row: o.rowNumber,
      order_date: o.order_date,
      customer_name: o.customer_name,
      customer_contact: o.customer_contact,
      channel: o.channel,
      product: o.product,
      variant: o.variant,
      quantity: o.quantity,
      unit_price: o.unit_price,
      discount: o.discount,
      total_amount: o.total_amount,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      delivery_status: o.delivery_status,
      notes: o.notes,
      status: o.status,
      review_notes: o.flags,
      raw: o.raw,
    }));
    const { error } = await supabase.from("orders").insert(rows);
    if (error) {
      console.error(error);
      await supabase.from("imports").delete().eq("id", imp.id);
      return { error: "Couldn't save the orders. Nothing was imported, so you can safely try again." };
    }
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { imported: data.orders.length };
}
