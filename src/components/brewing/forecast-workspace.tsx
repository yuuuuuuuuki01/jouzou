"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useBrewPlanner } from "@/components/brewing/brew-planner-provider";
import { ForecastChart, SectionCard, StatCard, formatNumber } from "@/components/brewing/shared";
import type { ForecastAdjustment, ForecastResult, ProductForecast } from "@/lib/brewing/types";

async function requestForecast(salesRecords: unknown, adjustments: ForecastAdjustment[]) {
  const response = await fetch("/api/forecast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      salesRecords,
      adjustments
    })
  });

  if (!response.ok) {
    throw new Error("Forecast request failed");
  }

  return (await response.json()) as ForecastResult;
}

function AdjustmentEditor({
  adjustment,
  onSave,
  onClear
}: {
  adjustment: ForecastAdjustment;
  onSave: (value: ForecastAdjustment) => void;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<ForecastAdjustment["mode"]>(adjustment.mode);
  const [value, setValue] = useState<string>(String(adjustment.value));

  useEffect(() => {
    setMode(adjustment.mode);
    setValue(String(adjustment.value));
  }, [adjustment]);

  return (
    <div className="inline-form">
      <select value={mode} onChange={(event) => setMode(event.target.value as ForecastAdjustment["mode"])}>
        <option value="percent">% override</option>
        <option value="absolute">Qty delta</option>
      </select>
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="0" />
      <button
        type="button"
        className="button small-button"
        onClick={() =>
          onSave({
            ...adjustment,
            mode,
            value: Number(value || "0")
          })
        }
      >
        Save
      </button>
      <button type="button" className="ghost-button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

export function ForecastWorkspace() {
  const { adjustments, forecast, hydrated, salesImport, setForecast, upsertAdjustment, clearAdjustment } = useBrewPlanner();
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !salesImport?.records.length) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    requestForecast(salesImport.records, adjustments)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setForecast(result);
        setSelectedProductCode((current) => current ?? result.productForecasts[0]?.productCode ?? null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Forecast request failed");
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
  }, [adjustments, hydrated, salesImport, setForecast]);

  const selectedProduct = useMemo<ProductForecast | null>(
    () => forecast?.productForecasts.find((product) => product.productCode === selectedProductCode) ?? forecast?.productForecasts[0] ?? null,
    [forecast, selectedProductCode]
  );

  const stats = useMemo(
    () => [
      {
        label: "Products",
        value: forecast ? formatNumber(forecast.productForecasts.length) : "0",
        detail: "Seasonality and recent trend applied"
      },
      {
        label: "Season Total",
        value: forecast ? formatNumber(forecast.productForecasts.reduce((sum, item) => sum + item.forecastTotal, 0)) : "0",
        detail: "Adjusted forecast total for 2026-10 to 2027-09"
      },
      {
        label: "Overrides",
        value: formatNumber(adjustments.length),
        detail: adjustments.length > 0 ? "Manual demand overrides active" : "No manual overrides"
      }
    ],
    [adjustments.length, forecast]
  );

  if (!salesImport?.records.length) {
    return (
      <SectionCard title="Demand Forecast">
        <p className="muted">Sales history has not been imported yet.</p>
        <Link href="/" className="button">
          Go to data import
        </Link>
      </SectionCard>
    );
  }

  const productAdjustment =
    adjustments.find((adjustment) => adjustment.productCode === selectedProduct?.productCode && !adjustment.yearMonth) ??
    (selectedProduct
      ? {
          productCode: selectedProduct.productCode,
          mode: "percent" as const,
          value: 0
        }
      : null);

  return (
    <div className="page-stack">
      <section className="hero hero-forecast">
        <p className="eyebrow">Forecast Studio</p>
        <h3>Review seasonality, then override demand where planners know more than the model.</h3>
        <p>
          The base forecast uses clipped historical sales, monthly seasonal indices, and a recent weighted trend. Add
          product-level or month-level overrides for promotions, events, or channel changes.
        </p>
        <div className="hero-actions">
          <Link href="/plan" className="button secondary-button">
            Open brew requirement
          </Link>
          {loading ? <span className="pill warn">Recalculating...</span> : <span className="pill ok">Forecast ready</span>}
        </div>
      </section>

      <section className="metrics">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {error ? <p className="feedback risk-text">{error}</p> : null}

      <section className="split split-forecast">
        <SectionCard title="Product Forecasts">
          <div className="product-list">
            {forecast?.productForecasts.map((product) => (
              <button
                key={product.productCode}
                type="button"
                className={`product-list-item ${selectedProduct?.productCode === product.productCode ? "active" : ""}`}
                onClick={() => setSelectedProductCode(product.productCode)}
              >
                <div>
                  <strong>{product.productName}</strong>
                  <p className="muted">{product.productCode}</p>
                </div>
                <div className="align-right">
                  <strong>{formatNumber(product.forecastTotal)}</strong>
                  <p className="muted">trend {(product.yearlyTrendRate * 100).toFixed(1)}%</p>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {selectedProduct ? (
          <SectionCard title={`${selectedProduct.productName} detail`}>
            <div className="inline-stats">
              <div>
                <p className="eyebrow">Recent Avg</p>
                <strong>{formatNumber(selectedProduct.recentAverageMonthlySales)}</strong>
              </div>
              <div>
                <p className="eyebrow">Forecast Total</p>
                <strong>{formatNumber(selectedProduct.forecastTotal)}</strong>
              </div>
            </div>

            <ForecastChart points={selectedProduct.points} />

            {productAdjustment ? (
              <div className="adjustment-row">
                <strong>Product-wide override</strong>
                <AdjustmentEditor
                  adjustment={productAdjustment}
                  onSave={(value) =>
                    upsertAdjustment({
                      productCode: selectedProduct.productCode,
                      mode: value.mode,
                      value: value.value
                    })
                  }
                  onClear={() => clearAdjustment(selectedProduct.productCode)}
                />
              </div>
            ) : null}

            <table className="table compact-table">
              <thead>
                <tr>
                  <th>Year Month</th>
                  <th>Last Year</th>
                  <th>Base</th>
                  <th>Adjusted</th>
                  <th>Monthly Override</th>
                </tr>
              </thead>
              <tbody>
                {selectedProduct.points.map((point) => {
                  const monthlyAdjustment =
                    adjustments.find(
                      (adjustment) =>
                        adjustment.productCode === selectedProduct.productCode && adjustment.yearMonth === point.yearMonth
                    ) ?? {
                      productCode: selectedProduct.productCode,
                      yearMonth: point.yearMonth,
                      mode: "percent" as const,
                      value: 0
                    };

                  return (
                    <tr key={point.yearMonth}>
                      <td>{point.yearMonth}</td>
                      <td>{point.lastYearQty == null ? "-" : formatNumber(point.lastYearQty)}</td>
                      <td>{formatNumber(point.baseForecastQty)}</td>
                      <td>
                        <strong>{formatNumber(point.adjustedForecastQty)}</strong>
                        {point.adjustmentsApplied.length > 0 ? (
                          <p className="muted">{point.adjustmentsApplied.join(", ")}</p>
                        ) : null}
                      </td>
                      <td>
                        <AdjustmentEditor
                          adjustment={monthlyAdjustment}
                          onSave={(value) =>
                            upsertAdjustment({
                              productCode: selectedProduct.productCode,
                              yearMonth: point.yearMonth,
                              mode: value.mode,
                              value: value.value
                            })
                          }
                          onClear={() => clearAdjustment(selectedProduct.productCode, point.yearMonth)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>
        ) : null}
      </section>
    </div>
  );
}
