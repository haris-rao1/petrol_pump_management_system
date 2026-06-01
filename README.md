# Petrol Pump Management System

Production-ready Next.js app for managing petrol pump operations with pump-scoped records, admin pump switching, dashboards, reports, and role-based access.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Configure `MONGODB_URI` in `.env`.
- Default admin login is defined in `src/lib/constants.js`.
- Records are isolated by `pumpId` in a single shared database.

## Sales Workflow

- Open `Shift Sales` to enter a meter-reading based sale.
- Choose a nozzle first; the previous reading is loaded from the nozzle record.
- Enter only the closing reading; the app calculates sold liters automatically.
- Define product names and rates in `Settings > Products & Rates`.
- The sale rate is taken from the product master so sale amount and daily reports stay consistent.
