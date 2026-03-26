import { AppShell } from "@/components/app-shell";
import { ForecastWorkspace } from "@/components/brewing/forecast-workspace";

export default function ForecastPage() {
  return (
    <AppShell title="需要予測" description="過去の月次売上実績から来季需要を推計し、銘柄単位・月単位で補正を設定します。">
      <ForecastWorkspace />
    </AppShell>
  );
}
