"use client";

import type { ReactNode } from "react";

import type { ForecastPoint, HeaderMapping, ImportIssue } from "@/lib/brewing/types";

export function StatCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <p className="eyebrow">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="muted">{detail}</p>
    </article>
  );
}

export function SectionCard({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card section-card">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function IssueList({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) {
    return <p className="muted">取り込み時のエラー・警告はありません。</p>;
  }

  return (
    <div className="stack">
      {issues.map((issue, index) => (
        <div key={`${issue.message}-${index}`} className={`note ${issue.level === "error" ? "note-risk" : "note-warn"}`}>
          <div className="inline-stats">
            <strong>{issue.level === "error" ? "エラー" : "警告"}</strong>
            {issue.row ? <span className="code">行 {issue.row}</span> : null}
          </div>
          <p className="muted">{issue.message}</p>
        </div>
      ))}
    </div>
  );
}

export function HeaderMappingTable({ mappings }: { mappings: HeaderMapping[] }) {
  return (
    <table className="table compact-table">
      <thead>
        <tr>
          <th>入力列</th>
          <th>対応先</th>
        </tr>
      </thead>
      <tbody>
        {mappings.map((mapping) => (
          <tr key={mapping.source}>
            <td>{mapping.source}</td>
            <td>{mapping.target ?? "未使用"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatVolume(value: number, digits = 0) {
  return `${formatNumber(value, digits)} L`;
}

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const width = 760;
  const height = 240;
  const padding = 28;
  const maxValue = Math.max(...points.flatMap((point) => [point.baseForecastQty, point.adjustedForecastQty, point.lastYearQty ?? 0]), 1);
  const stepX = (width - padding * 2) / Math.max(points.length - 1, 1);
  const scaleY = (value: number) => height - padding - (value / maxValue) * (height - padding * 2);

  const basePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${padding + stepX * index} ${scaleY(point.baseForecastQty)}`)
    .join(" ");
  const adjustedPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${padding + stepX * index} ${scaleY(point.adjustedForecastQty)}`)
    .join(" ");

  return (
    <div className="chart-panel">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="需要予測チャート">
        <defs>
          <linearGradient id="forecast-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(179, 89, 43, 0.35)" />
            <stop offset="100%" stopColor="rgba(179, 89, 43, 0.03)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 4 }).map((_, index) => {
          const y = padding + ((height - padding * 2) / 3) * index;
          return <line key={y} x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid" />;
        })}
        <path d={`${adjustedPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`} fill="url(#forecast-area)" />
        <path d={basePath} className="chart-line chart-line-muted" />
        <path d={adjustedPath} className="chart-line" />
        {points.map((point, index) => (
          <g key={point.yearMonth}>
            <circle cx={padding + stepX * index} cy={scaleY(point.adjustedForecastQty)} r="4" className="chart-point" />
            <text x={padding + stepX * index} y={height - 8} textAnchor="middle" className="chart-label">
              {point.yearMonth.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
