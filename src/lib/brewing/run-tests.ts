import assert from "node:assert/strict";

import * as XLSX from "xlsx";

import { generateForecast } from "@/lib/brewing/forecast";
import { generateBrewPlan } from "@/lib/brewing/plan";
import { importInventoryRecords, importSalesRecords } from "@/lib/brewing/parser";
import type { ForecastAdjustment, MonthlySalesRecord } from "@/lib/brewing/types";

function createSalesHistory(productCode: string, productName: string, startYear = 2023): MonthlySalesRecord[] {
  const records: MonthlySalesRecord[] = [];

  for (let year = startYear; year <= 2026; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      if (year === 2026 && month > 3) {
        continue;
      }

      const seasonalMultiplier = month === 12 ? 1.35 : month >= 6 && month <= 8 ? 0.8 : 1;
      const trendBase = 100 + (year - startYear) * 8;
      const salesQty = Number((trendBase * seasonalMultiplier).toFixed(2));

      records.push({
        productCode,
        productName,
        year,
        month,
        yearMonth: `${year}-${String(month).padStart(2, "0")}`,
        salesQty,
        occurredOn: `${year}-${String(month).padStart(2, "0")}-01`
      });
    }
  }

  return records;
}

function buildWorkbook(rows: Array<Array<string | number>>) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "data");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function runTest(name: string, testFn: () => void) {
  try {
    testFn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("sales import detects duplicate rows and missing months", () => {
  const result = importSalesRecords(
    buildWorkbook([
      ["product_code", "product_name", "year", "month", "sales_qty"],
      ["A01", "Junmai", 2024, 1, 100],
      ["A01", "Junmai", 2024, 1, 120],
      ["A01", "Junmai", 2024, 3, 130]
    ]),
    new Date("2026-03-01")
  );

  assert.equal(result.summary.acceptedRows, 2);
  assert.ok(result.issues.some((issue) => issue.message.includes("重複")));
  assert.ok(result.issues.some((issue) => issue.message.includes("月欠損")));
});

runTest("inventory import detects duplicate product codes", () => {
  const result = importInventoryRecords(
    buildWorkbook([
      ["product_code", "product_name", "stock_qty", "snapshot_date"],
      ["A01", "Junmai", 120, "2026-03-01"],
      ["A01", "Junmai", 150, "2026-03-01"]
    ]),
    new Date("2026-03-01")
  );

  assert.equal(result.summary.acceptedRows, 1);
  assert.ok(result.issues.some((issue) => issue.message.includes("重複")));
});

runTest("forecast keeps winter demand above summer and applies overrides", () => {
  const adjustments: ForecastAdjustment[] = [
    { productCode: "A01", mode: "percent", value: 10 },
    { productCode: "A01", yearMonth: "2026-12", mode: "absolute", value: 30 }
  ];
  const forecast = generateForecast({
    salesRecords: createSalesHistory("A01", "Ginjo"),
    adjustments
  });
  const december = forecast.productForecasts[0]?.points.find((point) => point.yearMonth === "2026-12");
  const july = forecast.productForecasts[0]?.points.find((point) => point.yearMonth === "2027-07");

  assert.ok(december);
  assert.ok(july);
  assert.ok((december?.adjustedForecastQty ?? 0) > (july?.adjustedForecastQty ?? 0));
  assert.ok((december?.adjustmentsApplied.length ?? 0) >= 2);
});

runTest("brew plan floors required quantity at zero when stock is sufficient", () => {
  const forecast = generateForecast({
    salesRecords: createSalesHistory("A01", "Daiginjo")
  });
  const plan = generateBrewPlan({
    forecast,
    inventoryRecords: [
      {
        productCode: "A01",
        productName: "Daiginjo",
        stockQty: 5000,
        snapshotDate: "2026-03-01"
      }
    ],
    safetyStockMonthsByProduct: {
      A01: 1
    }
  });

  assert.equal(plan.requirements[0]?.requiredBrewQty, 0);
});

console.log("All tests passed.");
