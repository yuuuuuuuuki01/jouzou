import { AppShell } from "@/components/app-shell";
import { ForecastWorkspace } from "@/components/brewing/forecast-workspace";

export default function ForecastPage() {
  return (
    <AppShell
      title="Demand Forecast"
      description="Estimate next season demand from monthly sales history, then apply product-level and month-level overrides."
    >
      <ForecastWorkspace />
    </AppShell>
  );
}
