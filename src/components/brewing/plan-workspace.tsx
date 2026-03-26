"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { useBrewPlanner } from "@/components/brewing/brew-planner-provider";
import { SectionCard, StatCard, formatNumber } from "@/components/brewing/shared";
import type { BrewPlanResult } from "@/lib/brewing/types";

async function requestPlan(forecast: unknown, inventoryRecords: unknown, safetyStockMonthsByProduct: Record<string, number>) {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      forecast,
      inventoryRecords,
      safetyStockMonthsByProduct
    })
  });

  if (!response.ok) {
    throw new Error("Brew requirement request failed");
  }

  return (await response.json()) as BrewPlanResult;
}

function downloadCsv(plan: BrewPlanResult) {
  const lines = [
    [
      "product_code",
      "product_name",
      "season_start",
      "season_end",
      "forecast_total",
      "current_stock",
      "safety_stock",
      "required_brew_qty",
      "adjustment_applied",
      "notes"
    ].join(","),
    ...plan.requirements.map((requirement) =>
      [
        requirement.productCode,
        `"${requirement.productName.replace(/"/g, '""')}"`,
        requirement.seasonStart,
        requirement.seasonEnd,
        requirement.forecastTotal,
        requirement.currentStock,
        requirement.safetyStock,
        requirement.requiredBrewQty,
        requirement.adjustmentApplied ? "yes" : "no",
        `"${requirement.notes.join(" / ").replace(/"/g, '""')}"`
      ].join(",")
    )
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "brew-plan-2026-2027.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PlanWorkspace() {
  const { forecast, hydrated, inventoryImport, plan, safetyStockMonthsByProduct, setPlan, setSafetyStockMonths } = useBrewPlanner();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !forecast || !inventoryImport?.records.length) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    requestPlan(forecast, inventoryImport.records, safetyStockMonthsByProduct)
      .then((result) => {
        if (!cancelled) {
          setPlan(result);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Brew requirement request failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [forecast, hydrated, inventoryImport, safetyStockMonthsByProduct, setPlan]);

  const stats = useMemo(
    () => [
      {
        label: "Required Brew Qty",
        value: plan ? formatNumber(plan.requirements.reduce((sum, item) => sum + item.requiredBrewQty, 0)) : "0",
        detail: "Forecast + safety stock - current stock"
      },
      {
        label: "Adjusted Products",
        value: plan ? formatNumber(plan.requirements.filter((item) => item.adjustmentApplied).length) : "0",
        detail: "Products influenced by manual forecast overrides"
      },
      {
        label: "Covered By Stock",
        value: plan ? formatNumber(plan.requirements.filter((item) => item.requiredBrewQty === 0).length) : "0",
        detail: "Products already covered by current inventory"
      }
    ],
    [plan]
  );

  if (!forecast) {
    return (
      <SectionCard title="Brew Requirement">
        <p className="muted">Demand forecast is not available yet.</p>
        <Link href="/forecast" className="button">
          Go to forecast
        </Link>
      </SectionCard>
    );
  }

  if (!inventoryImport?.records.length) {
    return (
      <SectionCard title="Brew Requirement">
        <p className="muted">Inventory snapshot has not been imported yet.</p>
        <Link href="/" className="button">
          Go to data import
        </Link>
      </SectionCard>
    );
  }

  return (
    <div className="page-stack">
      <section className="hero hero-plan">
        <p className="eyebrow">Brew Requirement</p>
        <h3>Turn adjusted demand into a clear brew quantity by product.</h3>
        <p>
          Safety stock months can be tuned per product. Every change immediately recalculates the required brew quantity
          and can be exported to CSV for handoff.
        </p>
        <div className="hero-actions">
          {plan ? (
            <button type="button" className="button secondary-button" onClick={() => downloadCsv(plan)}>
              <Download size={16} />
              Export CSV
            </button>
          ) : null}
          {loading ? <span className="pill warn">Recalculating...</span> : <span className="pill ok">Plan ready</span>}
        </div>
      </section>

      <section className="metrics">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {error ? <p className="feedback risk-text">{error}</p> : null}

      <SectionCard title="Required Brew Quantity by Product">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Forecast Total</th>
              <th>Current Stock</th>
              <th>Safety Months</th>
              <th>Safety Stock</th>
              <th>Required Brew Qty</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {plan?.requirements.map((requirement) => (
              <tr key={requirement.productCode}>
                <td>
                  <strong>{requirement.productName}</strong>
                  <p className="muted">{requirement.productCode}</p>
                </td>
                <td>{formatNumber(requirement.forecastTotal)}</td>
                <td>{formatNumber(requirement.currentStock)}</td>
                <td>
                  <input
                    className="compact-input"
                    type="number"
                    step="0.1"
                    value={safetyStockMonthsByProduct[requirement.productCode] ?? requirement.safetyStockMonths}
                    onChange={(event) => setSafetyStockMonths(requirement.productCode, Number(event.target.value))}
                  />
                </td>
                <td>{formatNumber(requirement.safetyStock, 1)}</td>
                <td>
                  <strong>{formatNumber(requirement.requiredBrewQty)}</strong>
                </td>
                <td className="notes-cell">{requirement.notes.join(" / ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
