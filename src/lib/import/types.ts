// Shared types for the spreadsheet order import.
//
// The import has three steps:
//   1. Read the file into plain rows of cells (readSheet.ts).
//   2. Find the header row and suggest which column means what (detectTable.ts,
//      suggestMapping.ts / aiMapping.ts). The seller confirms or fixes this.
//   3. Turn each row into an order, flagging anything unclear (normalize.ts).

/** One spreadsheet cell after reading. Dates are turned into "YYYY-MM-DD" text. */
export type Cell = string | number | null;

export type SheetData = {
  name: string;
  rows: Cell[][];
};

/** The order fields First Light understands. "ignore" means "don't import this column". */
export const ORDER_FIELDS = [
  "order_date",
  "customer_name",
  "customer_contact",
  "channel",
  "product",
  "variant",
  "quantity",
  "unit_price",
  "discount",
  "total_amount",
  "payment_status",
  "payment_method",
  "delivery_status",
  "notes",
] as const;

export type OrderField = (typeof ORDER_FIELDS)[number];
export type MappingTarget = OrderField | "ignore";

export const FIELD_LABELS: Record<MappingTarget, string> = {
  order_date: "Order date",
  customer_name: "Customer name",
  customer_contact: "Instagram handle / phone",
  channel: "Sales channel",
  product: "Product",
  variant: "Size / variant",
  quantity: "Quantity",
  unit_price: "Price per item",
  discount: "Discount",
  total_amount: "Order total",
  payment_status: "Paid?",
  payment_method: "Payment method",
  delivery_status: "Delivery status",
  notes: "Notes",
  ignore: "Don't import",
};

export type Confidence = "high" | "medium" | "low";

export type ColumnMapping = {
  columnIndex: number;
  header: string;
  target: MappingTarget;
  confidence: Confidence;
  /** Short plain-English reason shown to the seller. */
  reason: string;
};

export type MappingSuggestion = {
  source: "ai" | "rules";
  columns: ColumnMapping[];
};

/** A header row plus the data rows under it, with context from the sheet. */
export type DetectedTable = {
  headerRowIndex: number;
  headers: string[];
  dataRows: DataRow[];
  /** Rows we skipped on purpose (blank, repeated headers, totals). */
  skippedRows: { rowNumber: number; reason: string }[];
};

export type DataRow = {
  /** 1-based row number as the seller sees it in Excel / Google Sheets. */
  rowNumber: number;
  cells: Cell[];
  /** Month from a section heading above the row, e.g. "NOVEMBER" -> 11. */
  sectionMonth: number | null;
};

export type PaymentStatus = "paid" | "unpaid" | "partial" | "unknown";
export type OrderStatus = "active" | "cancelled";

export type NormalizedOrder = {
  rowNumber: number;
  order_date: string | null; // YYYY-MM-DD
  customer_name: string | null;
  customer_contact: string | null;
  channel: string | null;
  product: string | null;
  variant: string | null;
  quantity: number | null;
  unit_price: number | null;
  discount: number | null;
  total_amount: number | null;
  payment_status: PaymentStatus;
  payment_method: string | null;
  delivery_status: string | null;
  notes: string | null;
  status: OrderStatus;
  /** Reasons the seller should look at this row before importing. Empty = clean. */
  flags: string[];
  /** Small assumptions we made that are probably fine (shown, not flagged). */
  assumptions: string[];
  raw: Record<string, Cell>;
};
