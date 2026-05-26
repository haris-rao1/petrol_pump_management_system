import { Activity, Fuel, PieChart, PiggyBank, Receipt, Wallet } from "lucide-react";
import { getDashboardSummary } from "@/services/dashboard-service";
import { StatCard } from "@/components/stat-card";
import { DashboardCharts } from "@/components/dashboard-charts";
import { formatCurrency, formatDate, formatRawNumber } from "@/utils/format";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const summary = await getDashboardSummary(user?.activePumpId || null);

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-5">
        <StatCard title="Petrol Stock" value={`${formatRawNumber(summary.stock.petrol)} L`} subtitle="Current underground tank stock" icon={Fuel} tone="green" />
        <StatCard title="Diesel Stock" value={`${formatRawNumber(summary.stock.diesel)} L`} subtitle="Current underground tank stock" icon={Fuel} tone="amber" />
        <StatCard title="Today's Sales" value={formatCurrency(summary.totals.todaySales)} subtitle="Manual shift entries captured today" icon={Receipt} tone="blue" />
        <StatCard title="Today's Profit" value={formatCurrency(summary.totals.todayProfit)} subtitle="Sales - purchases - expenses" icon={PiggyBank} tone="green" />
        <StatCard title="Credit Pending" value={formatCurrency(summary.totals.creditPending)} subtitle="Outstanding customer balances" icon={Wallet} tone="rose" />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="glass-panel rounded-4xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">Operations Snapshot</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">What the pump owner sees today</h2>
            </div>
            <Activity className="h-5 w-5 text-(--brand)" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Monthly Sales", formatCurrency(summary.totals.monthSales)],
              ["Monthly Profit", formatCurrency(summary.totals.monthlyProfit)],
              ["Recent Expenses", formatCurrency(summary.totals.recentExpensesTotal)],
              ["Report Date", formatDate(new Date())],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl bg-(--panel-muted) p-4 dark:bg-white/5">
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel rounded-4xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">Recent Activity</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Latest purchases and expenses</h2>
            </div>
            <PieChart className="h-5 w-5 text-(--brand)" />
          </div>

          <div className="space-y-3">
            {summary.recent.purchases.slice(0, 3).map((item) => (
              <Row key={item._id} label={`Purchase - ${item.supplierName}`} value={formatCurrency(item.totalAmount)} />
            ))}
            {summary.recent.expenses.slice(0, 3).map((item) => (
              <Row key={item._id} label={`Expense - ${item.expenseTitle}`} value={formatCurrency(item.amount)} />
            ))}
          </div>
        </article>
      </section>

      <DashboardCharts charts={summary.charts} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-3xl bg-(--panel-muted) px-4 py-3 dark:bg-white/5">
      <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}