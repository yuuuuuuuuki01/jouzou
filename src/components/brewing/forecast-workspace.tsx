"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useBrewPlanner } from "@/components/brewing/brew-planner-provider";
import { ForecastChart, SectionCard, StatCard, formatNumber } from "@/components/brewing/shared";
import { generateForecast } from "@/lib/brewing/forecast";
import type { ForecastAdjustment, ProductForecast } from "@/lib/brewing/types";

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
        <option value="percent">％補正</option>
        <option value="absolute">数量加減</option>
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
        保存
      </button>
      <button type="button" className="ghost-button" onClick={onClear}>
        解除
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

    Promise.resolve()
      .then(() =>
        generateForecast({
          salesRecords: salesImport.records,
          adjustments
        })
      )
      .then((result) => {
        if (cancelled) {
          return;
        }

        setForecast(result);
        setSelectedProductCode((current) => current ?? result.productForecasts[0]?.productCode ?? null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "需要予測の計算に失敗しました。");
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
        label: "対象銘柄数",
        value: forecast ? formatNumber(forecast.productForecasts.length) : "0",
        detail: "季節性と直近トレンドを反映"
      },
      {
        label: "来季予測合計",
        value: forecast ? formatNumber(forecast.productForecasts.reduce((sum, item) => sum + item.forecastTotal, 0)) : "0",
        detail: "2026-10 から 2027-09 の補正後合計"
      },
      {
        label: "手動補正数",
        value: formatNumber(adjustments.length),
        detail: adjustments.length > 0 ? "手動補正が有効" : "手動補正なし"
      }
    ],
    [adjustments.length, forecast]
  );

  if (!salesImport?.records.length) {
    return (
      <SectionCard title="需要予測">
        <p className="muted">売上実績がまだ取り込まれていません。</p>
        <Link href="/" className="button">
          データ取込へ戻る
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
        <p className="eyebrow">需要予測スタジオ</p>
        <h3>季節性を確認しながら、現場判断を補正として上乗せする。</h3>
        <p>
          ベース予測は、外れ値を抑えた過去実績、月別季節指数、直近の加重トレンドから自動算出します。
          販促、イベント、販路変更などは銘柄単位または月単位で補正してください。
        </p>
        <div className="hero-actions">
          <Link href="/plan" className="button secondary-button">
            必要醸造量へ進む
          </Link>
          {loading ? <span className="pill warn">再計算中...</span> : <span className="pill ok">予測完了</span>}
        </div>
      </section>

      <section className="metrics">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {error ? <p className="feedback risk-text">{error}</p> : null}

      <section className="split split-forecast">
        <SectionCard title="銘柄別予測">
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
                  <p className="muted">トレンド {(product.yearlyTrendRate * 100).toFixed(1)}%</p>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {selectedProduct ? (
          <SectionCard title={`${selectedProduct.productName} の詳細`}>
            <div className="inline-stats">
              <div>
                <p className="eyebrow">直近月販平均</p>
                <strong>{formatNumber(selectedProduct.recentAverageMonthlySales)}</strong>
              </div>
              <div>
                <p className="eyebrow">来季予測合計</p>
                <strong>{formatNumber(selectedProduct.forecastTotal)}</strong>
              </div>
            </div>

            <ForecastChart points={selectedProduct.points} />

            {productAdjustment ? (
              <div className="adjustment-row">
                <strong>銘柄全体の補正</strong>
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
                  <th>年月</th>
                  <th>前年実績</th>
                  <th>ベース予測</th>
                  <th>補正後</th>
                  <th>月別補正</th>
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
