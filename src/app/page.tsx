import { AppShell } from "@/components/app-shell";
import { ImportWorkspace } from "@/components/brewing/import-workspace";

export default function HomePage() {
  return (
    <AppShell
      title="Data Import"
      description="Import monthly sales history and current inventory to prepare the demand forecast and required brew plan."
    >
      <ImportWorkspace />
    </AppShell>
  );
}
