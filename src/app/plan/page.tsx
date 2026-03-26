import { AppShell } from "@/components/app-shell";
import { PlanWorkspace } from "@/components/brewing/plan-workspace";

export default function PlanPage() {
  return (
    <AppShell
      title="必要醸造量"
      description="補正済み需要予測と現在在庫、安全在庫設定から、すべて L 単位で来季の必要醸造量を算出します。"
    >
      <PlanWorkspace />
    </AppShell>
  );
}
