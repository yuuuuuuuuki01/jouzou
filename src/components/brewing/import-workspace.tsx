"use client";

import Link from "next/link";
import { startTransition, useMemo, useState, type ReactNode } from "react";
import { Database, FileSpreadsheet, RefreshCcw, Trash2, UploadCloud } from "lucide-react";

import { useBrewPlanner } from "@/components/brewing/brew-planner-provider";
import { HeaderMappingTable, IssueList, SectionCard, StatCard, formatNumber } from "@/components/brewing/shared";
import type { InventoryImportResult, InventorySnapshot, MonthlySalesRecord, SalesImportResult } from "@/lib/brewing/types";

async function uploadImport<T>(url: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  return (await response.json()) as T;
}

function previewDate(record: MonthlySalesRecord | InventorySnapshot) {
  return "yearMonth" in record ? record.yearMonth : record.snapshotDate;
}

function previewQuantity(record: MonthlySalesRecord | InventorySnapshot) {
  return "salesQty" in record ? record.salesQty : record.stockQty;
}

function UploadCard({
  title,
  caption,
  icon,
  endpoint,
  file,
  setFile,
  result,
  onImported
}: {
  title: string;
  caption: string;
  icon: ReactNode;
  endpoint: string;
  file: File | null;
  setFile: (file: File | null) => void;
  result: SalesImportResult | InventoryImportResult | null;
  onImported: (result: SalesImportResult | InventoryImportResult) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const nextResult = await uploadImport<SalesImportResult | InventoryImportResult>(endpoint, file);
      startTransition(() => {
        onImported(nextResult);
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard
      title={title}
      action={
        <button type="button" className="ghost-button" onClick={() => setFile(null)}>
          <RefreshCcw size={16} />
          Clear selection
        </button>
      }
    >
      <div className="upload-banner">
        <div className="upload-icon">{icon}</div>
        <div>
          <p className="muted">{caption}</p>
          <p className="helper-text">The first sheet in CSV/XLSX is parsed and validated.</p>
        </div>
      </div>

      <label className="file-picker">
        <UploadCloud size={18} />
        <span>{file?.name ?? "Choose file"}</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          hidden
        />
      </label>

      <div className="button-row">
        <button type="button" className="button" disabled={pending} onClick={handleUpload}>
          {pending ? "Validating..." : "Validate and import"}
        </button>
      </div>

      {error ? <p className="feedback risk-text">{error}</p> : null}

      {result ? (
        <div className="stack">
          <div className="pill-row">
            <span className="pill ok">accepted {result.summary.acceptedRows}</span>
            <span className="pill neutral">rows {result.summary.totalRows}</span>
            <span className="pill warn">warnings {result.summary.warningCount}</span>
            <span className="pill risk">errors {result.summary.errorCount}</span>
          </div>

          <HeaderMappingTable mappings={result.headerMappings} />
          <IssueList issues={result.issues} />

          <table className="table compact-table">
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Product Name</th>
                <th>Period</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {result.records.slice(0, 6).map((record) => (
                <tr key={`${record.productCode}-${previewDate(record)}`}>
                  <td>{record.productCode}</td>
                  <td>{record.productName}</td>
                  <td>{previewDate(record)}</td>
                  <td>{formatNumber(previewQuantity(record))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </SectionCard>
  );
}

export function ImportWorkspace() {
  const { clearAll, inventoryImport, salesImport, setInventoryImport, setSalesImport } = useBrewPlanner();
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);

  const stats = useMemo(
    () => [
      {
        label: "Sales Rows",
        value: salesImport ? formatNumber(salesImport.records.length) : "0",
        detail: salesImport ? `${salesImport.products.length} products loaded` : "Upload monthly sales history"
      },
      {
        label: "Inventory Rows",
        value: inventoryImport ? formatNumber(inventoryImport.records.length) : "0",
        detail: inventoryImport ? `${inventoryImport.products.length} products loaded` : "Upload current stock snapshot"
      },
      {
        label: "Next Step",
        value: salesImport ? "Ready" : "Waiting",
        detail: salesImport ? "Move to forecast and apply overrides" : "Sales import is required first"
      }
    ],
    [inventoryImport, salesImport]
  );

  return (
    <div className="page-stack">
      <section className="hero hero-brew">
        <p className="eyebrow">Season 2026-10 to 2027-09</p>
        <h3>Connect current stock to next season demand before deciding brew volume.</h3>
        <p>
          Import monthly sales history and current inventory first. The next screen will forecast monthly demand from
          seasonality and recent trend, then let planners override product-level and month-level assumptions.
        </p>
        <div className="hero-actions">
          <Link href="/forecast" className="button secondary-button">
            Open forecast
          </Link>
          <button type="button" className="ghost-button ghost-button-light" onClick={clearAll}>
            <Trash2 size={16} />
            Reset all data
          </button>
        </div>
      </section>

      <section className="metrics">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="split split-balanced">
        <UploadCard
          title="Monthly Sales History"
          caption="Required columns: product_code, product_name, year, month, sales_qty"
          icon={<FileSpreadsheet size={20} />}
          endpoint="/api/import/sales"
          file={salesFile}
          setFile={setSalesFile}
          result={salesImport}
          onImported={(result) => setSalesImport(result as SalesImportResult)}
        />
        <UploadCard
          title="Current Inventory Snapshot"
          caption="Required columns: product_code, product_name, stock_qty, snapshot_date"
          icon={<Database size={20} />}
          endpoint="/api/import/inventory"
          file={inventoryFile}
          setFile={setInventoryFile}
          result={inventoryImport}
          onImported={(result) => setInventoryImport(result as InventoryImportResult)}
        />
      </section>
    </div>
  );
}
