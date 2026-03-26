# jouzou

Next.js app for sake demand forecasting and required brew volume planning.

## Features

- Upload monthly sales history and current inventory as CSV or Excel
- Validate required columns, duplicates, future dates, and missing months
- Forecast next season demand for `2026-10` through `2027-09`
- Apply product-level and month-level manual overrides
- Calculate required brew quantity from forecast, current stock, and safety stock
- Export the final brew plan as CSV

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
