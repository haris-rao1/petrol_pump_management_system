import { endOfDay, endOfMonth, eachDayOfInterval, eachMonthOfInterval, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { connectMongo } from "@/lib/mongodb";
import FuelPurchase from "@/models/FuelPurchase";
import FuelSale from "@/models/FuelSale";
import Tank from "@/models/Tank";
import Expense from "@/models/Expense";
import Customer from "@/models/Customer";

function dateKey(date, pattern = "yyyy-MM-dd") {
  return format(date, pattern);
}

async function sumByDate(model, field, startDate, endDate, extraQuery = {}) {
  const rows = await model.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        ...extraQuery,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        total: { $sum: `$${field}` },
      },
    },
  ]);

  const map = new Map(rows.map((row) => [row._id, Number(row.total || 0)]));

  return eachDayOfInterval({ start: startDate, end: endDate }).map((day) => ({
    label: dateKey(day, "dd MMM"),
    value: map.get(dateKey(day)) || 0,
  }));
}

async function sumByMonth(model, field, months = 6, extraQuery = {}) {
  const endDate = endOfMonth(new Date());
  const startDate = startOfMonth(subMonths(endDate, months - 1));
  const rows = await model.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        ...extraQuery,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
        total: { $sum: `$${field}` },
      },
    },
  ]);

  const map = new Map(rows.map((row) => [row._id, Number(row.total || 0)]));

  return eachMonthOfInterval({ start: startDate, end: endDate }).map((month) => ({
    label: dateKey(month, "MMM yyyy"),
    value: map.get(dateKey(month, "yyyy-MM")) || 0,
  }));
}

async function sumRange(model, field, startDate, endDate, extraQuery = {}) {
  const result = await model.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate }, ...extraQuery } },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);

  return Number(result[0]?.total || 0);
}

export async function getDashboardSummary() {
  await connectMongo();

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const chartStart = subDays(todayStart, 6);

  const [petrolTank, dieselTank, todaySales, monthSales, todayPurchases, todayExpenses, monthPurchases, monthExpenses, creditSummary] = await Promise.all([
    Tank.findOne({ fuelType: "Petrol" }).lean(),
    Tank.findOne({ fuelType: "Diesel" }).lean(),
    sumRange(FuelSale, "totalSaleAmount", todayStart, todayEnd),
    sumRange(FuelSale, "totalSaleAmount", monthStart, monthEnd),
    sumRange(FuelPurchase, "totalAmount", todayStart, todayEnd),
    sumRange(Expense, "amount", todayStart, todayEnd),
    sumRange(FuelPurchase, "totalAmount", monthStart, monthEnd),
    sumRange(Expense, "amount", monthStart, monthEnd),
    Customer.aggregate([{ $group: { _id: null, total: { $sum: "$pendingBalance" } } }]),
  ]);

  const [dailySales, monthlySales, dailyExpenses, monthlyExpenses, fuelConsumption, recentPurchases, recentExpenses, recentSales] = await Promise.all([
    sumByDate(FuelSale, "totalSaleAmount", chartStart, todayStart),
    sumByMonth(FuelSale, "totalSaleAmount", 6),
    sumByDate(Expense, "amount", chartStart, todayStart),
    sumByMonth(Expense, "amount", 6),
    FuelSale.aggregate([
      { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: "$fuelType", total: { $sum: "$soldLiters" } } },
      { $sort: { _id: 1 } },
    ]),
    FuelPurchase.find().sort({ date: -1 }).limit(5).lean(),
    Expense.find().sort({ date: -1 }).limit(5).lean(),
    FuelSale.find().sort({ date: -1 }).limit(5).lean(),
  ]);

  const todayProfit = todaySales - todayPurchases - todayExpenses;
  const monthlyProfit = monthSales - monthPurchases - monthExpenses;

  return {
    stock: {
      petrol: Number(petrolTank?.currentStock || 0),
      diesel: Number(dieselTank?.currentStock || 0),
    },
    totals: {
      todaySales,
      monthSales,
      todayProfit,
      monthlyProfit,
      creditPending: Number(creditSummary[0]?.total || 0),
      recentExpensesTotal: recentExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    },
    charts: {
      dailySales,
      monthlySales,
      dailyExpenses,
      monthlyExpenses,
      fuelConsumption: fuelConsumption.map((item) => ({
        label: item._id,
        value: Number(item.total || 0),
      })),
    },
    recent: {
      purchases: recentPurchases,
      expenses: recentExpenses,
      sales: recentSales,
    },
  };
}