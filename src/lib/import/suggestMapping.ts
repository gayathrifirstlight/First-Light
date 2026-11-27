import type { Cell, ColumnMapping, DataRow, MappingSuggestion, MappingTarget } from "./types";

// Simple keyword rules. These are the backup when the AI isn't set up or fails,
// and a sanity check for tests. Order matters: earlier rules win.
const RULES: { target: MappingTarget; pattern: RegExp }[] = [
  { target: "order_date", pattern: /\b(date|day|ordered on|when)\b/ },
  { target: "customer_contact", pattern: /(insta|ig\b|handle|phone|mobile|whatsapp no|contact|number)/ },
  { target: "customer_name", pattern: /(customer|client|buyer|name)/ },
  { target: "channel", pattern: /(channel|source|platform|via|came from)/ },
  { target: "variant", pattern: /(size|variant|colou?r)/ },
  { target: "quantity", pattern: /\b(qty|quantity|pcs|pieces|units|no\. of)\b/ },
  { target: "discount", pattern: /(discount|off\b|coupon)/ },
  { target: "total_amount", pattern: /(total|amount|amt|value|paid amount|bill)/ },
  { target: "unit_price", pattern: /(price|rate|mrp|cost)/ },
  { target: "payment_method", pattern: /(payment mode|pay mode|payment method|mode|upi|method)/ },
  { target: "payment_status", pattern: /(paid|payment|pay)/ },
  { target: "delivery_status", pattern: /(deliver|ship|sent|dispatch|status|courier)/ },
  { target: "product", pattern: /(product|item|what|order|description|design|style)/ },
  { target: "notes", pattern: /(note|remark|comment)/ },
];

export function suggestMappingByRules(headers: string[], rows: DataRow[]): MappingSuggestion {
  const used = new Set<MappingTarget>();
  const columns: ColumnMapping[] = headers.map((header, columnIndex) => {
    const h = header.toLowerCase();
    const rule = RULES.find((r) => r.pattern.test(h) && !used.has(r.target));
    if (rule) {
      used.add(rule.target);
      return {
        columnIndex,
        header,
        target: rule.target,
        confidence: "medium",
        reason: `The header "${header}" usually means this.`,
      };
    }
    return {
      columnIndex,
      header,
      target: "ignore",
      confidence: "low",
      reason: "Couldn't tell what this column is. Pick one if it should be imported.",
    };
  });

  // Column with "@handles" or 10-digit numbers is probably the contact column.
  const contactIdx = columns.findIndex((c) => c.target === "customer_contact");
  if (contactIdx < 0) {
    const guess = columns.findIndex(
      (c) => c.target === "ignore" && sampleValues(rows, c.columnIndex).some(looksLikeContact),
    );
    if (guess >= 0) {
      columns[guess] = {
        ...columns[guess],
        target: "customer_contact",
        confidence: "low",
        reason: "Values look like Instagram handles or phone numbers.",
      };
    }
  }
  return { source: "rules", columns };
}

export function sampleValues(rows: DataRow[], columnIndex: number, n = 8): Cell[] {
  return rows
    .map((r) => r.cells[columnIndex])
    .filter((c) => c !== null && c !== undefined)
    .slice(0, n);
}

function looksLikeContact(c: Cell): boolean {
  const s = String(c).trim();
  return /^@[\w.]+$/.test(s) || /^(\+?91)?[6-9]\d{9}$/.test(s.replace(/[\s-]/g, ""));
}
