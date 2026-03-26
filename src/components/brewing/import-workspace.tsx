"use client";

import Link from "next/link";
import { startTransition, useMemo, useState, type ReactNode } from "react";
import { Database, FileSpreadsheet, RefreshCcw, Trash2, UploadCloud } from "lucide-react";

import { useBrewPlanner } from "@/components/brewing/brew-planner-provider";
import { HeaderMappingTable, IssueList, SectionCard, StatCard, formatNumber } from "@/components/brewing/shared";
import { importInventoryRecords, importSalesRecords } from "@/lib/brewing/parser";
import type { InventoryImportResult, InventorySnapshot, MonthlySalesRecord, SalesImportResult } from "@/lib/brewing/types";

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
  file,
  setFile,
  result,
  onImported,
  importer
}: {
  title: string;
  caption: string;
  icon: ReactNode;
  file: File | null;
  setFile: (file: File | null) => void;
  result: SalesImportResult | InventoryImportResult | null;
  onImported: (result: SalesImportResult | InventoryImportResult) => void;
  importer: (buffer: ArrayBuffer) => SalesImportResult | InventoryImportResult;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      setError("先にファイルを選択してください。");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const nextResult = importer(buffer);
      startTransition(() => {
        onImported(nextResult);
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "取込に失敗しました。");
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
          選択解除
        </button>
      }
    >
      <div className="upload-banner">
        <div className="upload-icon">{icon}</div>
        <div>
          <p className="muted">{caption}</p>
          <p className="helper-text">CSV / XLSX の先頭シートをブラウザ上で検証して取り込みます。</p>
        </div>
      </div>

      <label className="file-picker">
        <UploadCloud size={18} />
        <span>{file?.name ?? "ファイルを選択"}</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          hidden
        />
      </label>

      <div className="button-row">
        <button type="button" className="button" disabled={pending} onClick={handleUpload}>
          {pending ? "検証中..." : "検証して取り込む"}
        </button>
      </div>

      {error ? <p className="feedback risk-text">{error}</p> : null}

      {result ? (
        <div className="stack">
          <div className="pill-row">
            <span className="pill ok">取込 {result.summary.acceptedRows} 件</span>
            <span className="pill neutral">全 {result.summary.totalRows} 行</span>
            <span className="pill warn">警告 {result.summary.warningCount}</span>
            <span className="pill risk">エラー {result.summary.errorCount}</span>
          </div>

          <HeaderMappingTable mappings={result.headerMappings} />
          <IssueList issues={result.issues} />

          <table className="table compact-table">
            <thead>
              <tr>
                <th>銘柄コード</th>
                <th>銘柄名</th>
                <th>対象年月</th>
                <th>数量</th>
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
        label: "売上実績行数",
        value: salesImport ? formatNumber(salesImport.records.length) : "0",
        detail: salesImport ? `${salesImport.products.length} 銘柄を読込済み` : "月次売上実績をアップロード"
      },
      {
        label: "在庫行数",
        value: inventoryImport ? formatNumber(inventoryImport.records.length) : "0",
        detail: inventoryImport ? `${inventoryImport.products.length} 銘柄を読込済み` : "現在在庫をアップロード"
      },
      {
        label: "次の操作",
        value: salesImport ? "準備完了" : "待機中",
        detail: salesImport ? "需要予測画面で補正を設定" : "まず売上実績の取込が必要"
      }
    ],
    [inventoryImport, salesImport]
  );

  return (
    <div className="page-stack">
      <section className="hero hero-brew">
        <p className="eyebrow">対象期間 2026-10 から 2027-09</p>
        <h3>現在在庫と来季需要をつないで、必要な醸造量を先に見積もる。</h3>
        <p>
          月次売上実績と現在在庫を取り込むと、次の画面で季節性と直近トレンドから月別需要を推計できます。
          その後、銘柄単位・月単位で補正し、必要醸造量へ反映します。
        </p>
        <div className="hero-actions">
          <Link href="/forecast" className="button secondary-button">
            需要予測へ進む
          </Link>
          <button type="button" className="ghost-button ghost-button-light" onClick={clearAll}>
            <Trash2 size={16} />
            すべてリセット
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
          title="月次売上実績"
          caption="必須列: product_code, product_name, year, month, sales_qty"
          icon={<FileSpreadsheet size={20} />}
          file={salesFile}
          setFile={setSalesFile}
          result={salesImport}
          onImported={(result) => setSalesImport(result as SalesImportResult)}
          importer={importSalesRecords}
        />
        <UploadCard
          title="現在在庫スナップショット"
          caption="必須列: product_code, product_name, stock_qty, snapshot_date"
          icon={<Database size={20} />}
          file={inventoryFile}
          setFile={setInventoryFile}
          result={inventoryImport}
          onImported={(result) => setInventoryImport(result as InventoryImportResult)}
          importer={importInventoryRecords}
        />
      </section>
    </div>
  );
}
