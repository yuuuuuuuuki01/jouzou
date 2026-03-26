export interface Product {
  productCode: string;
  productName: string;
}

export interface MonthlySalesRecord extends Product {
  year: number;
  month: number;
  yearMonth: string;
  salesQty: number;
  occurredOn: string;
}

export interface InventorySnapshot extends Product {
  stockQty: number;
  snapshotDate: string;
}

export type ImportIssueLevel = "error" | "warning";

export interface ImportIssue {
  level: ImportIssueLevel;
  message: string;
  row?: number;
  field?: string;
}

export interface HeaderMapping {
  source: string;
  target: string | null;
}

export interface ImportSummary {
  totalRows: number;
  acceptedRows: number;
  errorCount: number;
  warningCount: number;
}

export interface SalesImportResult {
  kind: "sales";
  products: Product[];
  records: MonthlySalesRecord[];
  issues: ImportIssue[];
  headerMappings: HeaderMapping[];
  summary: ImportSummary;
}

export interface InventoryImportResult {
  kind: "inventory";
  products: Product[];
  records: InventorySnapshot[];
  issues: ImportIssue[];
  headerMappings: HeaderMapping[];
  summary: ImportSummary;
}

export type ForecastAdjustmentMode = "percent" | "absolute";

export interface ForecastAdjustment {
  productCode: string;
  yearMonth?: string;
  mode: ForecastAdjustmentMode;
  value: number;
}

export interface ForecastPoint extends Product {
  year: number;
  month: number;
  yearMonth: string;
  baseForecastQty: number;
  adjustedForecastQty: number;
  seasonalIndex: number;
  trendLevel: number;
  lastYearQty: number | null;
  adjustmentsApplied: string[];
}

export interface ProductForecast extends Product {
  forecastTotal: number;
  recentAverageMonthlySales: number;
  yearlyTrendRate: number;
  seasonalIndices: Record<number, number>;
  points: ForecastPoint[];
}

export interface ForecastResult {
  seasonStart: string;
  seasonEnd: string;
  generatedAt: string;
  adjustments: ForecastAdjustment[];
  productForecasts: ProductForecast[];
}

export interface BrewRequirement extends Product {
  seasonStart: string;
  seasonEnd: string;
  forecastTotal: number;
  currentStock: number;
  safetyStockMonths: number;
  safetyStock: number;
  requiredBrewQty: number;
  adjustmentApplied: boolean;
  notes: string[];
}

export interface BrewPlanResult {
  seasonStart: string;
  seasonEnd: string;
  generatedAt: string;
  requirements: BrewRequirement[];
}

export interface ForecastRequest {
  salesRecords: MonthlySalesRecord[];
  adjustments?: ForecastAdjustment[];
}

export interface PlanRequest {
  forecast: ForecastResult;
  inventoryRecords: InventorySnapshot[];
  safetyStockMonthsByProduct?: Record<string, number>;
}
