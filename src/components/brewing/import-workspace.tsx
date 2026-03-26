"use client";

import Link from "next/link";
import { startTransition, useMemo, useState, type ReactNode } from "react";
import { Database, FileSpreadsheet, Plus, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";

import { useBrewPlanner } from "@/components/brewing/brew-planner-provider";
import { HeaderMappingTable, IssueList, SectionCard, StatCard, formatNumber, formatVolume } from "@/components/brewing/shared";
import { importInventoryRecords, importSalesRecords } from "@/lib/brewing/parser";
import type { InventoryImportResult, InventorySnapshot, MonthlySalesRecord, SalesImportResult } from "@/lib/brewing/types";

type SalesDraft = {
  productCode: string;
  productName: string;
  year: string;
  month: string;
  salesQty: string;
};

type InventoryDraft = {
  productCode: string;
  productName: string;
  stockQty: string;
  snapshotDate: string;
};

function previewDate(record: MonthlySalesRecord | InventorySnapshot) {
  return "yearMonth" in record ? record.yearMonth : record.snapshotDate;
}

function previewQuantity(record: MonthlySalesRecord | InventorySnapshot) {
  return "salesQty" in record ? record.salesQty : record.stockQty;
}

function buildWorkbookBuffer(rows: Array<Array<string | number>>) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "input");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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
      setError(uploadError instanceof Error ? uploadError.message : "取込中にエラーが発生しました。");
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
          <p className="helper-text">CSV / XLSX の先頭シートをブラウザ内で検証して取り込みます。数量はすべて L 前提です。</p>
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
          {pending ? "取込中..." : "取込して反映"}
        </button>
      </div>

      {error ? <p className="feedback risk-text">{error}</p> : null}

      {result ? (
        <div className="stack">
          <div className="pill-row">
            <span className="pill ok">受理 {result.summary.acceptedRows} 行</span>
            <span className="pill neutral">全 {result.summary.totalRows} 行</span>
            <span className="pill warn">警告 {result.summary.warningCount}</span>
            <span className="pill risk">エラー {result.summary.errorCount}</span>
          </div>

          <HeaderMappingTable mappings={result.headerMappings} />
          <IssueList issues={result.issues} />

          <table className="table compact-table">
            <thead>
              <tr>
                <th>商品コード</th>
                <th>商品名</th>
                <th>対象年月</th>
                <th>数量 (L)</th>
              </tr>
            </thead>
            <tbody>
              {result.records.slice(0, 6).map((record) => (
                <tr key={`${record.productCode}-${previewDate(record)}`}>
                  <td>{record.productCode}</td>
                  <td>{record.productName}</td>
                  <td>{previewDate(record)}</td>
                  <td>{formatVolume(previewQuantity(record))}</td>
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
  const [salesRows, setSalesRows] = useState<SalesDraft[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryDraft[]>([]);
  const [salesDraft, setSalesDraft] = useState<SalesDraft>({
    productCode: "",
    productName: "",
    year: "",
    month: "",
    salesQty: ""
  });
  const [inventoryDraft, setInventoryDraft] = useState<InventoryDraft>({
    productCode: "",
    productName: "",
    stockQty: "",
    snapshotDate: ""
  });
  const [salesManualError, setSalesManualError] = useState<string | null>(null);
  const [inventoryManualError, setInventoryManualError] = useState<string | null>(null);

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
        label: "入力単位",
        value: "L",
        detail: "売上実績・在庫・醸造量はすべてリットルで扱います"
      }
    ],
    [inventoryImport, salesImport]
  );

  function appendSalesRow() {
    if (!salesDraft.productCode || !salesDraft.productName || !salesDraft.year || !salesDraft.month || !salesDraft.salesQty) {
      setSalesManualError("売上実績入力の各項目をすべて入力してください。");
      return;
    }

    setSalesManualError(null);
    setSalesRows((current) => [...current, salesDraft]);
    setSalesDraft({
      productCode: "",
      productName: "",
      year: "",
      month: "",
      salesQty: ""
    });
  }

  function appendInventoryRow() {
    if (!inventoryDraft.productCode || !inventoryDraft.productName || !inventoryDraft.stockQty || !inventoryDraft.snapshotDate) {
      setInventoryManualError("在庫入力の各項目をすべて入力してください。");
      return;
    }

    setInventoryManualError(null);
    setInventoryRows((current) => [...current, inventoryDraft]);
    setInventoryDraft({
      productCode: "",
      productName: "",
      stockQty: "",
      snapshotDate: ""
    });
  }

  function importSalesFromManualRows() {
    if (salesRows.length === 0) {
      setSalesManualError("取り込む売上実績行がありません。");
      return;
    }

    const buffer = buildWorkbookBuffer([
      ["product_code", "product_name", "year", "month", "sales_qty"],
      ...salesRows.map((row) => [row.productCode, row.productName, row.year, row.month, row.salesQty])
    ]);
    setSalesImport(importSalesRecords(buffer));
    setSalesManualError(null);
  }

  function importInventoryFromManualRows() {
    if (inventoryRows.length === 0) {
      setInventoryManualError("取り込む在庫行がありません。");
      return;
    }

    const buffer = buildWorkbookBuffer([
      ["product_code", "product_name", "stock_qty", "snapshot_date"],
      ...inventoryRows.map((row) => [row.productCode, row.productName, row.stockQty, row.snapshotDate])
    ]);
    setInventoryImport(importInventoryRecords(buffer));
    setInventoryManualError(null);
  }

  return (
    <div className="page-stack">
      <section className="hero hero-brew">
        <p className="eyebrow">対象シーズン 2026-10 から 2027-09</p>
        <h3>現在在庫と来季需要をつないで、必要な醸造量を先に見積もる。</h3>
        <p>
          月次売上実績と現在在庫を取り込むと、次の画面で季節性と直近トレンドから月別需要を推計できます。
          ファイル取込に加えて、下のフォームから実績や在庫を手入力することもできます。数量の単位はすべて L です。
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

      <section className="split split-balanced">
        <SectionCard title="売上実績を手入力">
          <p className="helper-text">月次売上実績を 1 行ずつ追加できます。数量は L で入力してください。</p>
          <div className="manual-grid manual-grid-sales">
            <label className="field">
              <span className="helper-text">商品コード</span>
              <input value={salesDraft.productCode} onChange={(event) => setSalesDraft((current) => ({ ...current, productCode: event.target.value }))} />
            </label>
            <label className="field">
              <span className="helper-text">商品名</span>
              <input value={salesDraft.productName} onChange={(event) => setSalesDraft((current) => ({ ...current, productName: event.target.value }))} />
            </label>
            <label className="field">
              <span className="helper-text">年</span>
              <input value={salesDraft.year} onChange={(event) => setSalesDraft((current) => ({ ...current, year: event.target.value }))} placeholder="2025" />
            </label>
            <label className="field">
              <span className="helper-text">月</span>
              <input value={salesDraft.month} onChange={(event) => setSalesDraft((current) => ({ ...current, month: event.target.value }))} placeholder="10" />
            </label>
            <label className="field">
              <span className="helper-text">数量 (L)</span>
              <input value={salesDraft.salesQty} onChange={(event) => setSalesDraft((current) => ({ ...current, salesQty: event.target.value }))} placeholder="1200" />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="button" onClick={appendSalesRow}>
              <Plus size={16} />
              1 行追加
            </button>
            <button type="button" className="ghost-button" onClick={importSalesFromManualRows}>
              この内容で取り込む
            </button>
          </div>
          {salesManualError ? <p className="feedback risk-text">{salesManualError}</p> : null}
          <table className="table compact-table">
            <thead>
              <tr>
                <th>商品コード</th>
                <th>商品名</th>
                <th>年</th>
                <th>月</th>
                <th>数量 (L)</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((row, index) => (
                <tr key={`${row.productCode}-${row.year}-${row.month}-${index}`}>
                  <td>{row.productCode}</td>
                  <td>{row.productName}</td>
                  <td>{row.year}</td>
                  <td>{row.month}</td>
                  <td>{row.salesQty} L</td>
                  <td>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setSalesRows((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {salesRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    まだ行がありません。上のフォームで実績を追加してください。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="在庫を手入力">
          <p className="helper-text">現在在庫を 1 行ずつ追加できます。在庫量は L で入力してください。</p>
          <div className="manual-grid manual-grid-inventory">
            <label className="field">
              <span className="helper-text">商品コード</span>
              <input value={inventoryDraft.productCode} onChange={(event) => setInventoryDraft((current) => ({ ...current, productCode: event.target.value }))} />
            </label>
            <label className="field">
              <span className="helper-text">商品名</span>
              <input value={inventoryDraft.productName} onChange={(event) => setInventoryDraft((current) => ({ ...current, productName: event.target.value }))} />
            </label>
            <label className="field">
              <span className="helper-text">在庫量 (L)</span>
              <input value={inventoryDraft.stockQty} onChange={(event) => setInventoryDraft((current) => ({ ...current, stockQty: event.target.value }))} placeholder="800" />
            </label>
            <label className="field">
              <span className="helper-text">基準日</span>
              <input type="date" value={inventoryDraft.snapshotDate} onChange={(event) => setInventoryDraft((current) => ({ ...current, snapshotDate: event.target.value }))} />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="button" onClick={appendInventoryRow}>
              <Plus size={16} />
              1 行追加
            </button>
            <button type="button" className="ghost-button" onClick={importInventoryFromManualRows}>
              この内容で取り込む
            </button>
          </div>
          {inventoryManualError ? <p className="feedback risk-text">{inventoryManualError}</p> : null}
          <table className="table compact-table">
            <thead>
              <tr>
                <th>商品コード</th>
                <th>商品名</th>
                <th>在庫量 (L)</th>
                <th>基準日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map((row, index) => (
                <tr key={`${row.productCode}-${row.snapshotDate}-${index}`}>
                  <td>{row.productCode}</td>
                  <td>{row.productName}</td>
                  <td>{row.stockQty} L</td>
                  <td>{row.snapshotDate}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setInventoryRows((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {inventoryRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    まだ行がありません。上のフォームで在庫を追加してください。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </SectionCard>
      </section>
    </div>
  );
}
