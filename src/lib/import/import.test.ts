import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectTable } from "./detectTable";
import { normalizeRows, parseDate } from "./normalize";
import { readSpreadsheet } from "./readSheet";
import { suggestMappingByRules } from "./suggestMapping";

const fixture = join(__dirname, "../../../test/fixtures/sample-orders-fake.xlsx");

async function loadSheet(name: string) {
  const buf = readFileSync(fixture);
  const sheets = await readSpreadsheet(
    "sample.xlsx",
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  const sheet = sheets.find((s) => s.name === name);
  if (!sheet) throw new Error(`no sheet ${name}`);
  return sheet;
}

async function importSheet(name: string) {
  const sheet = await loadSheet(name);
  const table = detectTable(sheet.rows)!;
  const mapping = suggestMappingByRules(table.headers, table.dataRows);
  const orders = normalizeRows(table.dataRows, table.headers, mapping.columns, { fallbackYear: 2026 });
  return { table, mapping, orders };
}

describe("tidy sheet", () => {
  it("maps every column with the keyword rules", async () => {
    const { mapping } = await importSheet("Orders (tidy)");
    expect(mapping.columns.map((c) => c.target)).toEqual([
      "order_date", "customer_name", "customer_contact", "channel", "product", "variant",
      "quantity", "unit_price", "discount", "total_amount", "payment_status",
      "payment_method", "delivery_status", "notes",
    ]);
  });

  it("imports all 60 orders cleanly", async () => {
    const { orders } = await importSheet("Orders (tidy)");
    expect(orders).toHaveLength(60);
    expect(orders.filter((o) => o.flags.length > 0)).toEqual([]);
    const first = orders[0];
    expect(first).toMatchObject({
      order_date: "2026-10-02",
      customer_name: "Zoya",
      customer_contact: "@zoya69",
      channel: "Instagram",
      quantity: 2,
      unit_price: 1499,
      total_amount: 2998,
      payment_status: "paid",
      payment_method: "Cash on delivery",
    });
    // "10%" discount is worked out from qty × price.
    expect(orders[3]).toMatchObject({ discount: 229.9, total_amount: 2069 });
  });

  it("skips the README tab", async () => {
    const sheet = await loadSheet("README");
    expect(detectTable(sheet.rows)).toBeNull();
  });
});

describe("messy sheet", () => {
  it("finds the header under the title and skips month headings, repeated headers and the total", async () => {
    const { table } = await importSheet("Orders (messy)");
    expect(table.headers).toEqual(["date", "name", "insta", "what", "amt", "paid", "sent?"]);
    expect(table.skippedRows.map((r) => r.reason)).toEqual([
      "Looks like a total row you typed, not an order",
      'Section heading "NOVEMBER"',
      "Repeated header row",
    ]);
    expect(table.dataRows).toHaveLength(15);
  });

  it("reads informal values and flags the unclear rows instead of guessing", async () => {
    const { orders } = await importSheet("Orders (messy)");
    const byRow = new Map(orders.map((o) => [o.rowNumber, o]));

    expect(byRow.get(4)).toMatchObject({ order_date: "2026-10-02", total_amount: 1798, payment_method: "UPI", flags: [] });
    expect(byRow.get(5)).toMatchObject({ order_date: "2026-10-02", customer_name: "Ananya", channel: "WhatsApp", total_amount: 1348, flags: [] });
    expect(byRow.get(8)).toMatchObject({ order_date: "2026-10-05", total_amount: 2800, payment_method: "Cash", flags: [] });
    expect(byRow.get(9)).toMatchObject({ payment_status: "unpaid", flags: [] });
    expect(byRow.get(12)).toMatchObject({ total_amount: 1198, payment_status: "paid", payment_method: "UPI" });
    expect(byRow.get(19)).toMatchObject({ order_date: "2026-11-01" });
    expect(byRow.get(20)).toMatchObject({ total_amount: 2500 });

    const flagged = orders.filter((o) => o.flags.length > 0).map((o) => [o.rowNumber, o.flags.join(" | ")]);
    expect(flagged).toEqual([
      [6, 'Only partly paid ("50% adv").'],
      [7, "No date. This looks like a follow-up payment for the order on row 6 (shreya), not a new order."],
      [10, "Marked as cancelled. Import it as a cancelled order, or skip it."],
      [11, 'Only the day was written ("8th"). We used October 2026 from the section heading. Please check.'],
      [12, 'Contact "98xxxxxx21" looks incomplete.'],
    ]);
    expect(byRow.get(10)?.status).toBe("cancelled");
  });
});

describe("parseDate", () => {
  const ctx = { defaultYear: 2026 };
  it.each([
    ["2/10", "2026-10-02"],
    ["3/10/26", "2026-10-03"],
    ["05-10-2026", "2026-10-05"],
    ["2 oct", "2026-10-02"],
    ["Oct 2", "2026-10-02"],
    ["2nd October 2025", "2025-10-02"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDate(input, null, ctx).date).toBe(expected);
  });

  it("flags impossible dates", () => {
    expect(parseDate("31/11", null, ctx)).toMatchObject({ date: null });
    expect(parseDate("31/11", null, ctx).flag).toBeTruthy();
  });

  it("flags a day with no month", () => {
    expect(parseDate("8th", null, ctx)).toMatchObject({ date: null });
  });
});
