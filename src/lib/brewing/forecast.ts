import { BREW_SEASON_END, BREW_SEASON_START, formatYearMonth, getSeasonMonths } from "@/lib/brewing/season";
import type {
  ForecastAdjustment,
  ForecastPoint,
  ForecastRequest,
  ForecastResult,
  MonthlySalesRecord,
  Product,
  ProductForecast
} from "@/lib/brewing/types";

function clamp(value: number, min = 0, max = Number.POSITIVE_INFINITY) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const weights = values.map((_, index) => index + 1);
  const denominator = weights.reduce((sum, weight) => sum + weight, 0);
  const numerator = values.reduce((sum, value, index) => sum + value * weights[index], 0);
  return numerator / denominator;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function medianAbsoluteDeviation(values: number[], center: number) {
  if (values.length === 0) {
    return 0;
  }

  return median(values.map((value) => Math.abs(value - center)));
}

function roundQuantity(value: number) {
  return Number(value.toFixed(2));
}

function clipOutliers(records: MonthlySalesRecord[]) {
  const grouped = new Map<number, number[]>();
  records.forEach((record) => {
    const values = grouped.get(record.month) ?? [];
    values.push(record.salesQty);
    grouped.set(record.month, values);
  });

  return records.map((record) => {
    const monthValues = grouped.get(record.month) ?? [];
    const center = median(monthValues);
    const deviation = medianAbsoluteDeviation(monthValues, center);
    const fallbackSpread = Math.max(center * 0.5, 1);
    const spread = deviation === 0 ? fallbackSpread : deviation * 3;
    const lower = Math.max(0, center - spread);
    const upper = center + spread;
    return {
      ...record,
      salesQty: clamp(record.salesQty, lower, upper)
    };
  });
}

function buildSeasonalIndices(records: MonthlySalesRecord[]) {
  const overallAverage = average(records.map((record) => record.salesQty)) || 1;
  const byMonth = new Map<number, number[]>();

  records.forEach((record) => {
    const values = byMonth.get(record.month) ?? [];
    values.push(record.salesQty);
    byMonth.set(record.month, values);
  });

  const rawIndices = new Map<number, number>();
  for (let month = 1; month <= 12; month += 1) {
    const values = byMonth.get(month) ?? [];
    rawIndices.set(month, values.length === 0 ? 1 : average(values) / overallAverage);
  }

  const normalizer = average(Array.from(rawIndices.values())) || 1;
  const normalized: Record<number, number> = {};
  for (let month = 1; month <= 12; month += 1) {
    normalized[month] = roundQuantity((rawIndices.get(month) ?? 1) / normalizer);
  }

  return normalized;
}

function getRecentAverageMonthlySales(records: MonthlySalesRecord[]) {
  const recent = records.slice(-12);
  return roundQuantity(average(recent.map((record) => record.salesQty)));
}

function getYearlyTrendRate(deseasonalized: number[]) {
  const recent = deseasonalized.slice(-12);
  const previous = deseasonalized.slice(-24, -12);

  if (recent.length === 0 || previous.length === 0) {
    return 0;
  }

  const previousAverage = average(previous);
  if (previousAverage === 0) {
    return 0;
  }

  return clamp((average(recent) - previousAverage) / previousAverage, -0.35, 0.35);
}

function describeAdjustment(adjustment: ForecastAdjustment) {
  if (adjustment.mode === "percent") {
    return `${adjustment.yearMonth ?? "all"} ${adjustment.value >= 0 ? "+" : ""}${adjustment.value}%`;
  }

  return `${adjustment.yearMonth ?? "all"} ${adjustment.value >= 0 ? "+" : ""}${adjustment.value}`;
}

function applyAdjustments(baseValue: number, productCode: string, yearMonth: string, adjustments: ForecastAdjustment[]) {
  const relevant = adjustments.filter(
    (adjustment) => adjustment.productCode === productCode && (!adjustment.yearMonth || adjustment.yearMonth === yearMonth)
  );

  const ordered = [
    ...relevant.filter((adjustment) => !adjustment.yearMonth),
    ...relevant.filter((adjustment) => adjustment.yearMonth)
  ];

  let adjusted = baseValue;
  const applied: string[] = [];

  ordered.forEach((adjustment) => {
    if (adjustment.mode === "percent") {
      adjusted *= 1 + adjustment.value / 100;
    } else {
      adjusted += adjustment.value;
    }

    applied.push(describeAdjustment(adjustment));
  });

  return {
    adjusted: roundQuantity(clamp(adjusted)),
    applied
  };
}

function buildProductForecast(product: Product, records: MonthlySalesRecord[], adjustments: ForecastAdjustment[]): ProductForecast {
  const sorted = [...records].sort((left, right) => left.occurredOn.localeCompare(right.occurredOn));
  const clipped = clipOutliers(sorted);
  const seasonalIndices = buildSeasonalIndices(clipped);
  const deseasonalized = clipped.map((record) => {
    const index = seasonalIndices[record.month] || 1;
    return index === 0 ? record.salesQty : record.salesQty / index;
  });
  const recentAverageMonthlySales = getRecentAverageMonthlySales(clipped);
  const baseLevel = weightedAverage(deseasonalized.slice(-12));
  const yearlyTrendRate = getYearlyTrendRate(deseasonalized);
  const byYearMonth = new Map(sorted.map((record) => [record.yearMonth, record.salesQty]));

  const points: ForecastPoint[] = getSeasonMonths().map((target, index) => {
    const trendFactor = 1 + yearlyTrendRate * ((index + 1) / 12);
    const trendLevel = roundQuantity(baseLevel * trendFactor);
    const baseForecastQty = roundQuantity(clamp(trendLevel * (seasonalIndices[target.month] || 1)));
    const applied = applyAdjustments(baseForecastQty, product.productCode, target.yearMonth, adjustments);

    return {
      ...product,
      year: target.year,
      month: target.month,
      yearMonth: target.yearMonth,
      baseForecastQty,
      adjustedForecastQty: applied.adjusted,
      seasonalIndex: seasonalIndices[target.month] || 1,
      trendLevel,
      lastYearQty: byYearMonth.get(formatYearMonth(target.year - 1, target.month)) ?? null,
      adjustmentsApplied: applied.applied
    };
  });

  return {
    ...product,
    forecastTotal: roundQuantity(points.reduce((sum, point) => sum + point.adjustedForecastQty, 0)),
    recentAverageMonthlySales,
    yearlyTrendRate: roundQuantity(yearlyTrendRate),
    seasonalIndices,
    points
  };
}

export function generateForecast({ salesRecords, adjustments = [] }: ForecastRequest): ForecastResult {
  const grouped = new Map<string, MonthlySalesRecord[]>();

  salesRecords.forEach((record) => {
    const list = grouped.get(record.productCode) ?? [];
    list.push(record);
    grouped.set(record.productCode, list);
  });

  const productForecasts = Array.from(grouped.entries())
    .map(([productCode, records]) =>
      buildProductForecast(
        {
          productCode,
          productName: records[0]?.productName ?? productCode
        },
        records,
        adjustments
      )
    )
    .sort((left, right) => right.forecastTotal - left.forecastTotal);

  return {
    seasonStart: BREW_SEASON_START,
    seasonEnd: BREW_SEASON_END,
    generatedAt: new Date().toISOString(),
    adjustments,
    productForecasts
  };
}
