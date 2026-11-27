import { NextResponse } from "next/server";
import { suggestMapping } from "@/lib/import/aiMapping";
import { detectTable } from "@/lib/import/detectTable";
import { readSpreadsheet } from "@/lib/import/readSheet";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Step 1 of the import: read the uploaded file, find the order table in the
 * chosen tab and suggest a column mapping. Nothing is saved here.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const wantedSheet = form.get("sheet");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is over 5 MB. Try exporting just the orders tab." }, { status: 400 });
  }

  let sheets;
  try {
    sheets = await readSpreadsheet(file.name, await file.arrayBuffer());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't read that file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const tables = sheets.map((s) => ({ name: s.name, table: detectTable(s.rows) }));
  const usable = tables.filter((t) => t.table && t.table.dataRows.length > 0);
  if (usable.length === 0) {
    return NextResponse.json(
      { error: "Couldn't find an order table in this file. It needs a header row like Date, Name, Product, Amount." },
      { status: 400 },
    );
  }

  const selected = usable.find((t) => t.name === wantedSheet) ?? usable[0];
  const table = selected.table!;
  const suggestion = await suggestMapping(table.headers, table.dataRows);

  return NextResponse.json({
    sheets: usable.map((t) => ({ name: t.name, rowCount: t.table!.dataRows.length })),
    sheetName: selected.name,
    table,
    suggestion,
  });
}
