"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { useBrewPlanner } from "@/components/brewing/brew-planner-provider";
import { SectionCard, StatCard, formatNumber } from "@/components/brewing/shared";
import { generateBrewPlan } from "@/lib/brewing/plan";
import type { BrewPlanResult } from "@/lib/brewing/types";

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

    Promise.resolve()
      .then(() =>
        generateBrewPlan({
          forecast,
          inventoryRecords: inventoryImport.records,
          safetyStockMonthsByProduct
        })
      )
      .then((result) => {
        if (!cancelled) {
          setPlan(result);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "必要醸造量の計算に失敗しました。");
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
        label: "必要醸造量合計",
        value: plan ? formatNumber(plan.requirements.reduce((sum, item) => sum + item.requiredBrewQty, 0)) : "0",
        detail: "予測需要 + 安全在庫 - 現在在庫"
      },
      {
        label: "補正反映銘柄数",
        value: plan ? formatNumber(plan.requirements.filter((item) => item.adjustmentApplied).length) : "0",
        detail: "手動補正が計画に反映された銘柄"
      },
      {
        label: "在庫で充足可能",
        value: plan ? formatNumber(plan.requirements.filter((item) => item.requiredBrewQty === 0).length) : "0",
        detail: "現在在庫で来季需要を賄える銘柄"
      }
    ],
    [plan]
  );

  if (!forecast) {
    return (
      <SectionCard title="必要醸造量">
        <p className="muted">需要予測がまだありません。</p>
        <Link href="/forecast" className="button">
          需要予測へ移動
        </Link>
      </SectionCard>
    );
  }

  if (!inventoryImport?.records.length) {
    return (
      <SectionCard title="必要醸造量">
        <p className="muted">在庫スナップショットがまだ取り込まれていません。</p>
        <Link href="/" className="button">
          データ取込へ戻る
        </Link>
      </SectionCard>
    );
  }

  return (
    <div className="page-stack">
      <section className="hero hero-plan">
        <p className="eyebrow">必要醸造量</p>
        <h3>補正済み需要を、銘柄ごとの醸造必要量に落とし込む。</h3>
        <p>
          安全在庫月数は銘柄ごとに調整できます。値を変えるたびに必要醸造量を再計算し、そのまま CSV で出力できます。
        </p>
        <div className="hero-actions">
          {plan ? (
            <button type="button" className="button secondary-button" onClick={() => downloadCsv(plan)}>
              <Download size={16} />
              CSV を出力
            </button>
          ) : null}
          {loading ? <span className="pill warn">再計算中...</span> : <span className="pill ok">計画作成済み</span>}
        </div>
      </section>

      <section className="metrics">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {error ? <p className="feedback risk-text">{error}</p> : null}

      <SectionCard title="銘柄別 必要醸造量">
        <table className="table">
          <thead>
            <tr>
              <th>銘柄</th>
              <th>来季予測合計</th>
              <th>現在在庫</th>
              <th>安全在庫月数</th>
              <th>安全在庫</th>
              <th>必要醸造量</th>
              <th>備考</th>
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
