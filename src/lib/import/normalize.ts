import { monthFromText } from "./detectTable";
import type {
  Cell,
  ColumnMapping,
  DataRow,
  NormalizedOrder,
  OrderField,
  PaymentStatus,
} from "./types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Ctx = { defaultYear: number };

/**
 * Turn spreadsheet rows into orders using the column mapping the seller confirmed.
 * Rule of thumb: if we'd have to guess, we flag the row for the seller instead.
 */
export function normalizeRows(
  rows: DataRow[],
  headers: string[],
  mapping: ColumnMapping[],
  options: { fallbackYear?: number } = {},
): NormalizedOrder[] {
  const colFor = new Map<OrderField, number>();
  for (const m of mapping) if (m.target !== "ignore") colFor.set(m.target, m.columnIndex);

  const ctx: Ctx = {
    defaultYear: guessYear(rows, colFor.get("order_date")) ?? options.fallbackYear ?? new Date().getFullYear(),
  };

  const orders: NormalizedOrder[] = [];
  for (const row of rows) {
    const get = (f: OrderField): Cell => {
      const idx = colFor.get(f);
      return idx === undefined ? null : (row.cells[idx] ?? null);
    };
    orders.push(normalizeRow(row, headers, get, ctx, orders[orders.length - 1]));
  }
  return orders;
}

function normalizeRow(
  row: DataRow,
  headers: string[],
  get: (f: OrderField) => Cell,
  ctx: Ctx,
  previous: NormalizedOrder | undefined,
): NormalizedOrder {
  const flags: string[] = [];
  const assumptions: string[] = [];
  const raw: Record<string, Cell> = {};
  headers.forEach((h, i) => (raw[h] = row.cells[i] ?? null));

  const allText = row.cells.filter((c) => typeof c === "string").join(" ");
  const cancelled = /\bcancel(l?ed)?\b/i.test(allText);

  // Customer name, and a channel hint like "Ananya (whatsapp)".
  let customer_name = text(get("customer_name"));
  let channelHint: string | null = null;
  if (customer_name) {
    const m = customer_name.match(/^(.*?)\s*\((whats ?app|wa|insta(gram)?|ig|shopify)\)\s*$/i);
    if (m) {
      customer_name = m[1].trim();
      channelHint = normalizeChannel(m[2]);
    }
  }

  // Contact
  const customer_contact = text(get("customer_contact"));
  if (customer_contact && /x{3,}/i.test(customer_contact)) {
    flags.push(`Contact "${customer_contact}" looks incomplete.`);
  }

  // Channel
  let channel = normalizeChannel(text(get("channel")));
  if (!channel && channelHint) {
    channel = channelHint;
    assumptions.push(`Channel taken from the name ("${channelHint}").`);
  } else if (!channel && customer_contact?.startsWith("@")) {
    channel = "Instagram";
    assumptions.push("Has an Instagram handle, so marked as an Instagram order.");
  }

  const product = text(get("product"));
  const variant = text(get("variant"));
  const notes = text(get("notes"));

  // Date
  const dateResult = parseDate(get("order_date"), row.sectionMonth, ctx);
  const order_date = dateResult.date;
  if (dateResult.flag) flags.push(dateResult.flag);
  if (dateResult.assumption) assumptions.push(dateResult.assumption);
  if (!order_date && get("order_date") === null) {
    const looksLikeBalance =
      /balance|remaining|rest\b/i.test(allText) ||
      (previous && customer_name && previous.customer_name?.toLowerCase() === customer_name.toLowerCase());
    flags.push(
      looksLikeBalance && previous
        ? `No date. This looks like a follow-up payment for the order on row ${previous.rowNumber}${previous.customer_name ? ` (${previous.customer_name})` : ""}, not a new order.`
        : "No order date.",
    );
  }

  // Money
  const quantity = parseQuantity(get("quantity"), flags);
  const unit_price = parseAmount(get("unit_price"), "Price", flags, assumptions);
  let total_amount = parseAmount(get("total_amount"), "Total", flags, assumptions);
  const discount = parseDiscount(get("discount"), quantity, unit_price, flags);

  if (quantity !== null && unit_price !== null) {
    const expected = round2(quantity * unit_price - (discount ?? 0));
    if (total_amount === null) {
      total_amount = expected;
      assumptions.push(`No total given, so used qty × price − discount = ${expected}.`);
    } else if (Math.abs(expected - total_amount) > Math.max(2, expected * 0.01)) {
      flags.push(`Total ${total_amount} doesn't match qty × price − discount (${expected}).`);
    }
  }
  if (total_amount === null && !cancelled && !flags.some((f) => f.startsWith("Total"))) {
    flags.push("No order amount.");
  }

  // Payment
  const payment = parsePayment(get("payment_status"));
  if (payment.flag) flags.push(payment.flag);
  if (payment.assumption) assumptions.push(payment.assumption);
  const payment_method = normalizePaymentMethod(text(get("payment_method"))) ?? payment.method;

  // Delivery
  const delivery_status = normalizeDelivery(text(get("delivery_status")));

  if (cancelled) {
    flags.push("Marked as cancelled. Import it as a cancelled order, or skip it.");
  }
  if (!customer_name && !customer_contact && !product) {
    flags.push("Not enough information to tell what this order is.");
  }

  return {
    rowNumber: row.rowNumber,
    order_date,
    customer_name,
    customer_contact,
    channel,
    product,
    variant: variant === "-" ? null : variant,
    quantity,
    unit_price,
    discount,
    total_amount,
    payment_status: payment.status,
    payment_method,
    delivery_status,
    notes,
    status: cancelled ? "cancelled" : "active",
    flags,
    assumptions,
    raw,
  };
}

// ---------- helpers ----------

function text(c: Cell): string | null {
  if (c === null || c === undefined) return null;
  const s = String(c).trim();
  return s === "" ? null : s;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function guessYear(rows: DataRow[], dateCol: number | undefined): number | null {
  if (dateCol === undefined) return null;
  const counts = new Map<number, number>();
  for (const r of rows) {
    const s = text(r.cells[dateCol]);
    if (!s) continue;
    const m = s.match(/^(\d{4})-\d{2}-\d{2}$/) ?? s.match(/^\d{1,2}[/.-]\d{1,2}[/.-](\d{2}|\d{4})$/);
    if (m) {
      const y = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  for (const [y, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = y;
  return best;
}

function isoIfValid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // e.g. 31/11
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type DateResult = { date: string | null; flag?: string; assumption?: string };

/** Dates are read day-first (2/10 = 2 October), the way most sellers in India write them. */
export function parseDate(c: Cell, sectionMonth: number | null, ctx: Ctx): DateResult {
  if (c === null) return { date: null };

  if (typeof c === "number") {
    // An Excel date that wasn't formatted as a date (days since 1899-12-30).
    if (c > 30000 && c < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + c * 86400000);
      return { date: dt.toISOString().slice(0, 10) };
    }
    if (c >= 1 && c <= 31) return dayOnly(c, sectionMonth, ctx, String(c));
    return { date: null, flag: `Couldn't read the date "${c}".` };
  }

  const s = c.trim().toLowerCase();
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    return { date: isoIfValid(+m[1], +m[2], +m[3]) };
  }
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const date = isoIfValid(y, +m[2], +m[1]);
    return date ? { date } : { date: null, flag: `Couldn't read the date "${c}".` };
  }
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/))) {
    const date = isoIfValid(ctx.defaultYear, +m[2], +m[1]);
    return date
      ? { date, assumption: `No year in "${c}", used ${ctx.defaultYear}.` }
      : { date: null, flag: `Couldn't read the date "${c}".` };
  }
  // "2 oct", "2nd October", "oct 2", "2 oct 2026"
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?\s*(\d{4})?$/)) || (m = matchMonthFirst(s))) {
    const month = monthFromText(m[2]);
    if (month) {
      const y = m[3] ? +m[3] : ctx.defaultYear;
      const date = isoIfValid(y, month, +m[1]);
      if (date) return { date, assumption: m[3] ? undefined : `No year in "${c}", used ${y}.` };
    }
  }
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?$/))) {
    return dayOnly(+m[1], sectionMonth, ctx, c);
  }
  return { date: null, flag: `Couldn't read the date "${c}".` };
}

function matchMonthFirst(s: string): RegExpMatchArray | null {
  const m = s.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?$/);
  // Reorder so group 1 = day, group 2 = month, like the day-first pattern.
  return m ? (Object.assign([m[0], m[2], m[1], m[3]], { index: 0, input: s }) as RegExpMatchArray) : null;
}

function dayOnly(day: number, sectionMonth: number | null, ctx: Ctx, original: string): DateResult {
  if (sectionMonth) {
    const date = isoIfValid(ctx.defaultYear, sectionMonth, day);
    if (date) {
      return {
        date,
        flag: `Only the day was written ("${original}"). We used ${MONTH_NAMES[sectionMonth - 1]} ${ctx.defaultYear} from the section heading. Please check.`,
      };
    }
  }
  return { date: null, flag: `Only the day was written ("${original}"), so the month is unclear.` };
}

/** "Rs 1,198" -> 1198, "₹2,500/-" -> 2500, "2800 (discount)" -> 2800. */
export function parseAmount(c: Cell, label: string, flags: string[], assumptions: string[]): number | null {
  if (c === null) return null;
  if (typeof c === "number") return c;
  const s = c.trim();
  if (/^[-–—]$/.test(s)) return null;
  if (/[~≈]|\bapprox|\babout\b/i.test(s) || /\d\s*k\b/i.test(s)) {
    flags.push(`${label} "${s}" is approximate.`);
    return null;
  }
  const cleaned = s.replace(/\b(rs|inr)\.?/gi, "").replace(/[₹,]/g, "").replace(/\/-/g, "");
  const nums = cleaned.match(/\d+(\.\d+)?/g);
  if (!nums) {
    flags.push(`Couldn't read the ${label.toLowerCase()} "${s}".`);
    return null;
  }
  if (nums.length > 1) {
    flags.push(`${label} "${s}" has more than one number in it.`);
    return null;
  }
  const leftover = cleaned.replace(nums[0], "").replace(/[\s()]/g, "");
  if (leftover) assumptions.push(`${label} "${s}" read as ${nums[0]}.`);
  return Number(nums[0]);
}

function parseQuantity(c: Cell, flags: string[]): number | null {
  if (c === null) return null;
  if (typeof c === "number" && Number.isInteger(c) && c > 0) return c;
  const m = String(c).trim().match(/^x?\s*(\d+)\s*(pcs?|nos?|x)?$/i);
  if (m && +m[1] > 0) return +m[1];
  flags.push(`Couldn't read the quantity "${c}".`);
  return null;
}

function parseDiscount(
  c: Cell,
  quantity: number | null,
  unitPrice: number | null,
  flags: string[],
): number | null {
  if (c === null) return null;
  if (typeof c === "number") return c;
  const s = c.trim();
  if (s === "-" || s === "0") return 0;
  const pct = s.match(/^(\d+(\.\d+)?)\s*%$/);
  if (pct) {
    if (quantity !== null && unitPrice !== null) return round2((quantity * unitPrice * +pct[1]) / 100);
    flags.push(`Discount "${s}" is a percentage but there's no price to work it out from.`);
    return null;
  }
  const n = s.replace(/[₹,]|rs\.?/gi, "").match(/^\s*(\d+(\.\d+)?)\s*$/);
  if (n) return +n[1];
  flags.push(`Couldn't read the discount "${s}".`);
  return null;
}

const METHOD_WORDS: [RegExp, string][] = [
  [/cash on delivery|\bcod\b/i, "Cash on delivery"],
  [/g ?pay|google ?pay|phone ?pe|paytm|bhim|\bupi\b/i, "UPI"],
  [/bank|neft|imps|rtgs|transfer/i, "Bank transfer"],
  [/payment link|\blink\b|razorpay|instamojo/i, "Payment link"],
  [/\bcard\b/i, "Card"],
  [/\bcash\b/i, "Cash"],
];

function normalizePaymentMethod(s: string | null): string | null {
  if (!s) return null;
  for (const [re, label] of METHOD_WORDS) if (re.test(s)) return label;
  return s;
}

function parsePayment(c: Cell): {
  status: PaymentStatus;
  method: string | null;
  flag?: string;
  assumption?: string;
} {
  const s = text(c)?.toLowerCase() ?? null;
  if (!s) return { status: "unknown", method: null };
  let method: string | null = null;
  for (const [re, label] of METHOD_WORDS) {
    if (re.test(s)) {
      method = label;
      break;
    }
  }
  if (/\badv(ance)?\b|partial|half|\d+\s*%|part paid|balance/.test(s)) {
    return { status: "partial", method, flag: `Only partly paid ("${text(c)}").` };
  }
  if (/^(no|not|unpaid|pending|due|n)\b/.test(s)) return { status: "unpaid", method };
  if (/^(yes|y|paid|done|received|recd|ok)\b|✓|✔/.test(s)) return { status: "paid", method };
  if (method) {
    return { status: "paid", method, assumption: `Took "${text(c)}" to mean paid by ${method}.` };
  }
  return { status: "unknown", method: null, flag: `Not sure if "${text(c)}" means paid or not.` };
}

function normalizeChannel(s: string | null): string | null {
  if (!s) return null;
  const l = s.toLowerCase();
  if (/insta|\big\b/.test(l)) return "Instagram";
  if (/whats ?app|\bwa\b/.test(l)) return "WhatsApp";
  if (/shopify|website|store/.test(l)) return "Shopify";
  if (/word of mouth|referr|friend|offline|in person/.test(l)) return "Word of mouth";
  return s;
}

function normalizeDelivery(s: string | null): string | null {
  if (!s) return null;
  const l = s.toLowerCase();
  if (/^(yes|y|sent|done)$/.test(l)) return "Sent";
  if (/^(no|n|not sent)\b/.test(l)) return s.length > 3 ? `Not sent (${s.replace(/^no\s*[-–:]?\s*/i, "")})` : "Not sent";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
