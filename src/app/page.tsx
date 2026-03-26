import { AppShell } from "@/components/app-shell";
import { ImportWorkspace } from "@/components/brewing/import-workspace";

export default function HomePage() {
  return (
    <AppShell
      title="データ取込"
      description="月次売上実績と現在在庫を取り込み、すべて L 単位で需要予測と必要醸造量計算の準備を行います。"
    >
      <ImportWorkspace />
    </AppShell>
  );
}
