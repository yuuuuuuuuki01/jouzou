import * as XLSX from "xlsx";

import { formatYearMonth } from "@/lib/brewing/season";
import type {
  HeaderMapping,
  ImportIssue,
  InventoryImportResult,
  InventorySnapshot,
  MonthlySalesRecord,
  Product,
  SalesImportResult
} from "@/lib/brewing/types";

type RawRow = Record<string, unknown>;

const SALES_COLUMNS: Record<string, string[]> = {
  product_code: ["product_code", "productcode", "銘柄コード", "商品コード", "code"],
  product_name: ["product_name", "productname", "銘柄名", "商品名", "name"],
  year: ["year", "年度", "年"],
  month: ["month", "月"],
  sales_qty: ["sales_qty", "salesqty", "売上数量", "販売数量", "出荷数量", "qty"]
};

const INVENTORY_COLUMNS: Record<string, string[]> = {
  product_code: ["product_code", "productcode", "銘柄コード", "商品コード", "code"],
  product_name: ["product_name", "productname", "銘柄名", "商品名", "name"],
  stock_qty: ["stock_qty", "stockqty", "在庫数量", "在庫量", "stock"],
  snapshot_date: ["snapshot_date", "snapshotdate", "棚卸日", "在庫基準日", "date"]
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (normalized.length === 0) {
      return Number.NaN;
    }

    return Number(normalized);
  }

  return Number.NaN;
}

function toStringValue(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const candidate = new Date(value);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }

  return null;
}

function makeIssue(level: "error" | "warning", message: string, row?: number, field?: string): ImportIssue {
  return { level, message, row, field };
}

function summarize(totalRows: number, acceptedRows: number, issues: ImportIssue[]) {
  return {
    totalRows,
    acceptedRows,
    errorCount: issues.filter((issue) => issue.level === "error").length,
    warningCount: issues.filter((issue) => issue.level === "warning").length
  };
}

function readRows(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, {
    cellDates: true,
    type: "array"
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: false
  });

  return rows;
}

function resolveColumnMappings(rows: RawRow[], aliases: Record<string, string[]>) {
  const firstRow = rows[0] ?? {};
  const headers = Object.keys(firstRow);
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const headerMappings: HeaderMapping[] = headers.map((header) => ({ source: header, target: null }));
  const columnByTarget = new Map<string, string>();
  const issues: ImportIssue[] = [];

  Object.entries(aliases).forEach(([target, options]) => {
    const match = options.find((option) => normalizedHeaders.has(normalizeHeader(option)));
    if (!match) {
      issues.push(makeIssue("error", `必須列 ${target} が見つかりません`, undefined, target));
      return;
    }

    const source = normalizedHeaders.get(normalizeHeader(match));
    if (!source) {
      issues.push(makeIssue("error", `必須列 ${target} が見つかりません`, undefined, target));
      return;
    }

    columnByTarget.set(target, source);
    const headerMapping = headerMappings.find((mapping) => mapping.source === source);
    if (headerMapping) {
      headerMapping.target = target;
    }
  });

  return { headerMappings, columnByTarget, issues };
}

function uniqueProducts<T extends Product>(records: T[]) {
  const map = new Map<string, Product>();
  records.forEach((record) => {
    if (!map.has(record.productCode)) {
      map.set(record.productCode, {
        productCode: record.productCode,
        productName: record.productName
      });
    }
  });

  return Array.from(map.values()).sort((left, right) => left.productCode.localeCompare(right.productCode));
}

export function importSalesRecords(buffer: ArrayBuffer, now = new Date()): SalesImportResult {
  const rows = readRows(buffer);
  const { headerMappings, columnByTarget, issues } = resolveColumnMappings(rows, SALES_COLUMNS);
  const records: MonthlySalesRecord[] = [];

  if (issues.some((issue) => issue.level === "error")) {
    return {
      kind: "sales",
      products: [],
      records: [],
      issues,
      headerMappings,
      summary: summarize(rows.length, 0, issues)
    };
  }

  const duplicateKeys = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = toStringValue(row[columnByTarget.get("product_code") ?? ""]);
    const productName = toStringValue(row[columnByTarget.get("product_name") ?? ""]);
    const year = toNumber(row[columnByTarget.get("year") ?? ""]);
    const month = toNumber(row[columnByTarget.get("month") ?? ""]);
    const salesQty = toNumber(row[columnByTarget.get("sales_qty") ?? ""]);

    if (!productCode || !productName) {
      issues.push(makeIssue("error", "銘柄コードまたは銘柄名が空です", rowNumber));
      return;
    }
    if (!Number.isInteger(year)) {
      issues.push(makeIssue("error", "year は整数で指定してください", rowNumber, "year"));
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      issues.push(makeIssue("error", "month は 1-12 の整数で指定してください", rowNumber, "month"));
      return;
    }
    if (!Number.isFinite(salesQty) || salesQty < 0) {
      issues.push(makeIssue("error", "sales_qty は 0 以上の数値で指定してください", rowNumber, "sales_qty"));
      return;
    }

    const occurredOn = `${year}-${String(month).padStart(2, "0")}-01`;
    if (occurredOn > `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`) {
      issues.push(makeIssue("error", "未来月の売上実績は取り込めません", rowNumber, "year_month"));
      return;
    }

    const key = `${productCode}:${year}:${month}`;
    if (duplicateKeys.has(key)) {
      issues.push(makeIssue("error", "同じ銘柄・年月の行が重複しています", rowNumber));
      return;
    }
    duplicateKeys.add(key);

    records.push({
      productCode,
      productName,
      year,
      month,
      yearMonth: formatYearMonth(year, month),
      salesQty,
      occurredOn
    });
  });

  const byProduct = new Map<string, MonthlySalesRecord[]>();
  records.forEach((record) => {
    const list = byProduct.get(record.productCode) ?? [];
    list.push(record);
    byProduct.set(record.productCode, list);
  });

  byProduct.forEach((productRecords, productCode) => {
    const sorted = [...productRecords].sort((left, right) => left.occurredOn.localeCompare(right.occurredOn));
    const first = new Date(sorted[0].occurredOn);
    const last = new Date(sorted[sorted.length - 1].occurredOn);
    const monthDistance = (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;

    if (monthDistance !== sorted.length) {
      issues.push(makeIssue("warning", `${productCode} に月欠損があります`));
    }
    if (sorted.length < 36) {
      issues.push(makeIssue("warning", `${productCode} の実績が 3 年未満です`));
    }
  });

  return {
    kind: "sales",
    products: uniqueProducts(records),
    records: records.sort((left, right) =>
      left.productCode === right.productCode
        ? left.occurredOn.localeCompare(right.occurredOn)
        : left.productCode.localeCompare(right.productCode)
    ),
    issues,
    headerMappings,
    summary: summarize(rows.length, records.length, issues)
  };
}

export function importInventoryRecords(buffer: ArrayBuffer, now = new Date()): InventoryImportResult {
  const rows = readRows(buffer);
  const { headerMappings, columnByTarget, issues } = resolveColumnMappings(rows, INVENTORY_COLUMNS);
  const records: InventorySnapshot[] = [];

  if (issues.some((issue) => issue.level === "error")) {
    return {
      kind: "inventory",
      products: [],
      records: [],
      issues,
      headerMappings,
      summary: summarize(rows.length, 0, issues)
    };
  }

  const seenProducts = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = toStringValue(row[columnByTarget.get("product_code") ?? ""]);
    const productName = toStringValue(row[columnByTarget.get("product_name") ?? ""]);
    const stockQty = toNumber(row[columnByTarget.get("stock_qty") ?? ""]);
    const snapshotDate = parseDate(row[columnByTarget.get("snapshot_date") ?? ""]);

    if (!productCode || !productName) {
      issues.push(makeIssue("error", "銘柄コードまたは銘柄名が空です", rowNumber));
      return;
    }
    if (!Number.isFinite(stockQty) || stockQty < 0) {
      issues.push(makeIssue("error", "stock_qty は 0 以上の数値で指定してください", rowNumber, "stock_qty"));
      return;
    }
    if (!snapshotDate) {
      issues.push(makeIssue("error", "snapshot_date を日付として解釈できません", rowNumber, "snapshot_date"));
      return;
    }
    if (snapshotDate.getTime() > now.getTime()) {
      issues.push(makeIssue("error", "未来日の在庫スナップショットは取り込めません", rowNumber, "snapshot_date"));
      return;
    }
    if (seenProducts.has(productCode)) {
      issues.push(makeIssue("error", "同じ product_code の在庫行が重複しています", rowNumber, "product_code"));
      return;
    }
    seenProducts.add(productCode);

    records.push({
      productCode,
      productName,
      stockQty,
      snapshotDate: snapshotDate.toISOString().slice(0, 10)
    });
  });

  return {
    kind: "inventory",
    products: uniqueProducts(records),
    records: records.sort((left, right) => left.productCode.localeCompare(right.productCode)),
    issues,
    headerMappings,
    summary: summarize(rows.length, records.length, issues)
  };
}
