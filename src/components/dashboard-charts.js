"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const colors = ["#16a34a", "#f59e0b", "#0f766e", "#2563eb", "#7c3aed"];

function Panel({ title, children }) {
  return (
    <section className="glass-panel min-w-0 rounded-[28px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="min-h-70 min-w-0">{children}</div>
    </section>
  );
}

export function DashboardCharts({ charts }) {
  const monthlySalesWithExpenses = charts.monthlySales.map((item, index) => ({
    ...item,
    expenses: charts.monthlyExpenses[index]?.value || 0,
  }));

  const profitTrend = charts.monthlySales.map((item, index) => ({
    label: item.label,
    value: (item.value || 0) - (charts.monthlyExpenses[index]?.value || 0),
  }));

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <Panel title="Daily Sales Trend">
        <div className="min-h-65 min-w-0">
          <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={charts.dailySales}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" opacity={0.2} />
            <XAxis dataKey="label" tickMargin={12} />
            <YAxis tickMargin={12} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#16a34a" fill="url(#salesFill)" strokeWidth={3} />
          </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Monthly Sales vs Expenses">
        <div className="min-h-65 min-w-0">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlySalesWithExpenses}>
            <CartesianGrid strokeDasharray="4 4" opacity={0.2} />
            <XAxis dataKey="label" tickMargin={12} />
            <YAxis tickMargin={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" name="Sales" fill="#16a34a" radius={[12, 12, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Fuel Consumption">
        <div className="min-h-65 min-w-0">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
            <Pie data={charts.fuelConsumption} dataKey="value" nameKey="label" innerRadius={60} outerRadius={100} paddingAngle={4}>
              {charts.fuelConsumption.map((entry, index) => (
                <Cell key={entry.label} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Profit Trend">
        <div className="min-h-65 min-w-0">
          <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={profitTrend}>
            <defs>
              <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.42} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" opacity={0.2} />
            <XAxis dataKey="label" tickMargin={12} />
            <YAxis tickMargin={12} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#0f766e" fill="url(#profitFill)" strokeWidth={3} />
          </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}