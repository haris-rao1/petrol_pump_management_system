"use client";

import { useEffect, useState } from "react";
import { Download, Filter, FileText, RefreshCcw } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { formatCurrency, formatDate, toCsvValue } from "@/utils/format";

export function ReportCenter() {
  const [filters, setFilters] = useState({ startDate: "", endDate: "", fuelType: "", employee: "", shift: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
      const response = await fetch(`/api/reports?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load report");
      }
      setData(payload.data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchReport();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Section", "Value"],
      ["Sales Total", data.totals.sales],
      ["Purchases Total", data.totals.purchases],
      ["Expenses Total", data.totals.expenses],
      ["Profit", data.profit],
    ];
    const csv = rows.map((row) => row.map((cell) => toCsvValue(cell)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reports-${Date.now()}.csv`;
    link.click();
  }

  function exportPDF() {
    if (!data) return;
    const doc = new jsPDF();
    doc.text("Petrol Pump Reports", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Metric", "Value"]],
      body: [
        ["Sales Total", formatCurrency(data.totals.sales)],
        ["Purchases Total", formatCurrency(data.totals.purchases)],
        ["Expenses Total", formatCurrency(data.totals.expenses)],
        ["Profit", formatCurrency(data.profit)],
      ],
    });
    doc.save(`reports-${Date.now()}.pdf`);
  }

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-4xl p-6 md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-(--brand)">Reports & Analytics</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Profit and operational reporting</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Generate daily and monthly summaries with manual filters for date range, fuel type, employee, and shift.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={fetchReport} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium dark:bg-white/5">
              <RefreshCcw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium dark:bg-white/5">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={exportPDF} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium dark:bg-white/5">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-4xl p-5">
        <div className="grid gap-3 xl:grid-cols-5">
          {[
            ["startDate", "Start Date", "date"],
            ["endDate", "End Date", "date"],
            ["fuelType", "Fuel Type", "text"],
            ["employee", "Employee", "text"],
            ["shift", "Shift", "text"],
          ].map(([key, label, type]) => (
            <label key={key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5">
              <Filter className="h-4 w-4 text-slate-500" />
              <input
                type={type}
                value={filters[key]}
                onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
                placeholder={label}
                className="w-full bg-transparent outline-none"
              />
            </label>
          ))}
        </div>
      </section>

      {loading || !data ? (
        <section className="glass-panel rounded-4xl p-8 text-center text-slate-500">Loading report data...</section>
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Sales Total" value={formatCurrency(data.totals.sales)} />
            <MetricCard title="Purchases Total" value={formatCurrency(data.totals.purchases)} />
            <MetricCard title="Expenses Total" value={formatCurrency(data.totals.expenses)} />
            <MetricCard title="Profit" value={formatCurrency(data.profit)} />
          </section>

          <section className="glass-panel rounded-4xl p-5">
            <h2 className="mb-4 text-lg font-semibold">Report Rows</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/70 text-sm dark:divide-white/10">
                <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Fuel Type</th>
                    <th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {data.sales.slice(0, 10).map((row) => (
                    <tr key={row._id}>
                      <td className="px-4 py-3">Sales</td>
                      <td className="px-4 py-3">{formatDate(row.date)}</td>
                      <td className="px-4 py-3">{row.fuelType}</td>
                      <td className="px-4 py-3">{row.shiftName}</td>
                      <td className="px-4 py-3">{row.operatorName}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalSaleAmount)}</td>
                    </tr>
                  ))}
                  {data.purchases.slice(0, 5).map((row) => (
                    <tr key={row._id}>
                      <td className="px-4 py-3">Purchases</td>
                      <td className="px-4 py-3">{formatDate(row.date)}</td>
                      <td className="px-4 py-3">{row.fuelType}</td>
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">{row.supplierName}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  ))}
                  {data.expenses.slice(0, 5).map((row) => (
                    <tr key={row._id}>
                      <td className="px-4 py-3">Expenses</td>
                      <td className="px-4 py-3">{formatDate(row.date)}</td>
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">{row.expenseTitle}</td>
                      <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value }) {
  return (
    <article className="glass-panel rounded-[28px] p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <h3 className="mt-3 text-2xl font-semibold">{value}</h3>
    </article>
  );
}