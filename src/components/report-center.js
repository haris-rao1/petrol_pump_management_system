"use client";

import { useEffect, useState } from "react";
import { Download, Filter, FileText, RefreshCcw } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { formatCurrency, formatDate, toCsvValue } from "@/utils/format";

const yesterdayString = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

export function ReportCenter() {
  const [filters, setFilters] = useState({ startDate: yesterdayString, endDate: yesterdayString, fuelType: "", section: "all" });
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
    }, 150);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Section", "Value"],
      ["Sales Revenue", data.totals.salesRevenue],
      ["Overall Sale", data.totals.overallSale],
      ["Purchase Cost", data.totals.purchasesCost],
      ["Expenses + Credit Customer", data.totals.expenses +data.totals.creditCustomer],
      ["Payments Received", data.totals.paymentsReceived],
      ["Sales Profit", data.totals.salesProfit + data.totals.paymentsReceived ],
      ["Net Profit", data.totalProfit],
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
        ["Sales Revenue", formatCurrency(data.totals.salesRevenue)],
        ["Overall Sale", formatCurrency(data.totals.overallSale)],
       
        ["Purchase Cost", formatCurrency(data.totals.purchasesCost)],
        ["Expenses + Credit Customer", formatCurrency(data.totals.expenses + data.totals.creditCustomer)],
        ["Payments Received", formatCurrency(data.totals.paymentsReceived)],
        ["Sales Profit", formatCurrency(data.totals.salesProfit + data.totals.paymentsReceived)],
        ["Net Profit", formatCurrency(data.totalProfit)],
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
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Generate daily and monthly summaries with manual filters for date range and fuel type.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={fetchReport} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium dark:bg-white/5">
              <RefreshCcw className="h-4 w-4" /> Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={!data || loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium dark:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={!data || loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium dark:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
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

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={filters.section}
              onChange={(event) => setFilters((current) => ({ ...current, section: event.target.value }))}
              className="w-full bg-transparent outline-none"
            >
              <option value="all">All</option>
              <option value="Sales">Sales</option>
              <option value="Purchases">Purchases</option>
              <option value="Expenses + Credit Customer">Expenses + Credit Customer</option>
              <option value="Payments">Payments</option>
            </select>
          </label>
        </div>
      </section>

      {loading || !data ? (
        <section className="glass-panel rounded-4xl p-8 text-center text-slate-500">Loading report data...</section>
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="Sales Revenue" value={formatCurrency(data.totals.salesRevenue)} />
            <MetricCard title="Payments Received" value={formatCurrency(data.totals.paymentsReceived)} />
            <MetricCard title="Sales Profit" value={formatCurrency(data.totals.salesProfit + data.totals.paymentsReceived)} />
             <MetricCard title="Expenses + Credit Customer" value={formatCurrency(data.totals.expenses + data.totals.creditCustomer)} />
             <MetricCard title="Purchase Cost" value={formatCurrency(data.totals.purchasesCost)} />
            <MetricCard title="Net Profit" value={formatCurrency(data.totalProfit)} />
            <MetricCard title="Overall Sale" value={formatCurrency(data.totals.overallSale)} />
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
                    <th className="px-4 py-3">Nozzle</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {data.rows.filter((row) => filters.section === "all" || row.section === filters.section).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No report data found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    data.rows.filter((row) => filters.section === "all" || row.section === filters.section).map((row) => (
                      <tr key={row._id}>
                        <td className="px-4 py-3">{row.section}</td>
                        <td className="px-4 py-3">{formatDate(row.date)}</td>
                        <td className="px-4 py-3">{row.fuelType || "-"}</td>
                        <td className="px-4 py-3">{row.nozzleName || "-"}</td>
                        <td className="px-4 py-3">{row.description || "-"}</td>
                        <td className="px-4 py-3">{formatCurrency(row.totalSaleAmount || row.totalAmount || row.amount || 0)}</td>
                        <td className="px-4 py-3">{row.section === "Sales" ? formatCurrency(row.saleProfit || 0) : "-"}</td>
                      </tr>
                    ))
                  )}
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