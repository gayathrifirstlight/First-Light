import type { Cell, DataRow, DetectedTable } from "./types";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "OCTOBER ORDERS" -> 10, "Nov" -> 11, "sept" -> 9, anything else -> null. */
export function monthFromText(text: string): number | null {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const w of words) {
    if (w.length < 3) continue;
    const idx = MONTHS.findIndex((m) => m.startsWith(w));
    if (idx >= 0) return idx + 1;
  }
  return null;
}

const nonEmpty = (cells: Cell[]) => cells.filter((c) => c !== null && String(c).trim() !== "");

function looksLikeValue(c: Cell): boolean {
  if (typeof c === "number") return true;
  const s = String(c).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) || /^[\d.,₹\s]+$/.test(s);
}

function isHeaderCandidate(cells: Cell[]): boolean {
  const filled = nonEmpty(cells);
  return filled.length >= 3 && filled.every((c) => typeof c === "string" && !looksLikeValue(c));
}

const normalizeHeader = (cells: Cell[]) =>
  cells.map((c) => (c === null ? "" : String(c).trim().toLowerCase())).join("|");

function isTotalRow(cells: Cell[]): boolean {
  const first = nonEmpty(cells)[0];
  return typeof first === "string" && /^(grand\s*)?(sub)?total\b|^sum\b/i.test(first.trim());
}

/**
 * Find the header row and the order rows below it. Handles the way solo sellers
 * often keep sheets: a title row, month blocks ("NOVEMBER") with the header
 * repeated, blank spacer rows and a hand-typed TOTAL row.
 * Returns null when the tab doesn't look like an order table (e.g. a notes tab).
 */
export function detectTable(rows: Cell[][]): DetectedTable | null {
  const headerRowIndex = rows.findIndex(isHeaderCandidate);
  if (headerRowIndex < 0) return null;

  // Work out how many columns the table really uses.
  let width = 0;
  for (const row of rows) {
    for (let i = row.length - 1; i >= 0; i--) {
      if (row[i] !== null) {
        width = Math.max(width, i + 1);
        break;
      }
    }
  }
  const headerCells = rows[headerRowIndex].slice(0, width);
  const headers = Array.from({ length: width }, (_, i) => {
    const h = headerCells[i];
    return h === null || h === undefined ? `Column ${columnLetter(i)}` : String(h).trim();
  });
  const headerKey = normalizeHeader(headerCells);

  // Section headings above the header (like "OCTOBER ORDERS") set the month too.
  let sectionMonth: number | null = null;
  for (let r = 0; r < headerRowIndex; r++) {
    const filled = nonEmpty(rows[r]);
    if (filled.length === 1 && typeof filled[0] === "string") {
      sectionMonth = monthFromText(filled[0]) ?? sectionMonth;
    }
  }

  const dataRows: DataRow[] = [];
  const skippedRows: DetectedTable["skippedRows"] = [];
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const cells = rows[r].slice(0, width);
    while (cells.length < width) cells.push(null);
    const filled = nonEmpty(cells);
    const rowNumber = r + 1;

    if (filled.length === 0) continue; // blank spacer row, nothing to report
    if (normalizeHeader(cells) === headerKey) {
      skippedRows.push({ rowNumber, reason: "Repeated header row" });
      continue;
    }
    if (isTotalRow(cells)) {
      skippedRows.push({ rowNumber, reason: "Looks like a total row you typed, not an order" });
      continue;
    }
    if (filled.length === 1 && typeof filled[0] === "string") {
      const month = monthFromText(filled[0]);
      if (month) {
        sectionMonth = month;
        skippedRows.push({ rowNumber, reason: `Section heading "${filled[0]}"` });
        continue;
      }
    }
    dataRows.push({ rowNumber, cells, sectionMonth });
  }

  return { headerRowIndex, headers, dataRows, skippedRows };
}

export function columnLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
