import { AppShell } from "@/components/app-shell";
import { PlanWorkspace } from "@/components/brewing/plan-workspace";

export default function PlanPage() {
  return (
    <AppShell
      title="Brew Requirement"
      description="Subtract current stock and safety stock policy from the adjusted season forecast to compute required brew quantity."
    >
      <PlanWorkspace />
    </AppShell>
  );
}
