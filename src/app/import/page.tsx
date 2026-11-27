import { requireUser } from "@/lib/supabase/server";
import ImportWizard from "./ImportWizard";

export const metadata = { title: "Import orders · First Light" };

export default async function ImportPage() {
  await requireUser();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Import orders from a spreadsheet</h1>
      <p className="text-muted">
        Bring in the Instagram, WhatsApp and word-of-mouth orders you keep in Excel or Google Sheets.
      </p>
      <div className="pt-4">
        <ImportWizard />
      </div>
    </div>
  );
}
