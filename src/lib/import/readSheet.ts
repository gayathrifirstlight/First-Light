import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { Cell, SheetData } from "./types";

const MAX_ROWS = 5000;

/** Read an uploaded .xlsx or .csv file into plain rows of cells, one entry per tab. */
export async function readSpreadsheet(
  fileName: string,
  bytes: ArrayBuffer,
): Promise<SheetData[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return [{ name: fileName.replace(/\.csv$/i, ""), rows: readCsv(new TextDecoder().decode(bytes)) }];
  }
  if (lower.endsWith(".xlsx")) {
    return readXlsx(bytes);
  }
  throw new Error("Please upload an .xlsx (Excel) or .csv file. From Google Sheets, use File → Download → .xlsx or .csv.");
}

function readCsv(text: string): Cell[][] {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  return parsed.data.slice(0, MAX_ROWS).map((row) => row.map((v) => (v.trim() === "" ? null : v.trim())));
}

async function readXlsx(bytes: ArrayBuffer): Promise<SheetData[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheets: SheetData[] = [];
  workbook.eachSheet((ws) => {
    const rows: Cell[][] = [];
    const width = ws.columnCount;
    for (let r = 1; r <= Math.min(ws.rowCount, MAX_ROWS); r++) {
      const row = ws.getRow(r);
      const cells: Cell[] = [];
      for (let c = 1; c <= width; c++) cells.push(toCell(row.getCell(c).value));
      rows.push(cells);
    }
    sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

function toCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isoDate(value);
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  if (typeof value === "object") {
    if ("result" in value) return toCell((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in value) return toCell(value.richText.map((t) => t.text).join(""));
    if ("text" in value) return toCell((value as ExcelJS.CellHyperlinkValue).text);
    if ("error" in value) return null;
  }
  return String(value);
}

/** Excel stores dates without a time zone, so read them back in UTC. */
function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
