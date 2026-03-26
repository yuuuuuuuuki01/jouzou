import { BREW_SEASON_END, BREW_SEASON_START } from "@/lib/brewing/season";
import type { BrewPlanResult, BrewRequirement, InventorySnapshot, PlanRequest } from "@/lib/brewing/types";

function roundQuantity(value: number) {
  return Number(value.toFixed(2));
}

export function generateBrewPlan({
  forecast,
  inventoryRecords,
  safetyStockMonthsByProduct = {}
}: PlanRequest): BrewPlanResult {
  const inventoryMap = new Map<string, InventorySnapshot>(inventoryRecords.map((record) => [record.productCode, record]));

  const requirements: BrewRequirement[] = forecast.productForecasts.map((productForecast) => {
    const inventory = inventoryMap.get(productForecast.productCode);
    const currentStock = inventory?.stockQty ?? 0;
    const safetyStockMonths = safetyStockMonthsByProduct[productForecast.productCode] ?? 1;
    const safetyStock = roundQuantity(productForecast.recentAverageMonthlySales * safetyStockMonths);
    const requiredBrewQty = roundQuantity(Math.max(0, productForecast.forecastTotal + safetyStock - currentStock));
    const adjustmentApplied = productForecast.points.some((point) => point.adjustmentsApplied.length > 0);
    const notes: string[] = [];

    if (!inventory) {
      notes.push("在庫データ未登録のため 0 として計算");
    }
    if (currentStock > productForecast.forecastTotal + safetyStock) {
      notes.push("現時点在庫で来季需要を上回る見込み");
    }
    if (requiredBrewQty > 0) {
      notes.push("欠品回避のため追加醸造が必要");
    }
    if (adjustmentApplied) {
      notes.push("手動補正済み予測を反映");
    }

    return {
      productCode: productForecast.productCode,
      productName: productForecast.productName,
      seasonStart: BREW_SEASON_START,
      seasonEnd: BREW_SEASON_END,
      forecastTotal: roundQuantity(productForecast.forecastTotal),
      currentStock: roundQuantity(currentStock),
      safetyStockMonths: roundQuantity(safetyStockMonths),
      safetyStock,
      requiredBrewQty,
      adjustmentApplied,
      notes
    };
  });

  return {
    seasonStart: BREW_SEASON_START,
    seasonEnd: BREW_SEASON_END,
    generatedAt: new Date().toISOString(),
    requirements: requirements.sort((left, right) => right.requiredBrewQty - left.requiredBrewQty)
  };
}
