# jouzou

酒造向けの需要予測と必要醸造量計画を扱う Next.js アプリです。醸造量と在庫量の単位はすべて L で統一しています。

## Features

- 月次売上実績と現在在庫を CSV / Excel で取込
- 必須列、重複、未来日付、月欠損を検証
- `2026-10` から `2027-09` の来季需要を予測
- 銘柄単位・月単位の手動補正
- 予測、現在在庫、安全在庫から必要醸造量を算出
- 最終計画を CSV で出力

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm run build
npm run test
```
