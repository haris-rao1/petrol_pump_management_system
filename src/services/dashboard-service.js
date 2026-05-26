import { endOfDay, endOfMonth, eachDayOfInterval, eachMonthOfInterval, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { connectMongo } from "@/lib/mongodb";
import FuelPurchase from "@/models/FuelPurchase";
import FuelSale from "@/models/FuelSale";
import Tank from "@/models/Tank";
import Expense from "@/models/Expense";
import Customer from "@/models/Customer";
import { toPumpObjectId } from "@/lib/pump";

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

export async function getDashboardSummary(pumpId = null) {
  await connectMongo();
  const pumpObjectId = toPumpObjectId(pumpId);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const chartStart = subDays(todayStart, 6);

  const [petrolTank, dieselTank, todaySales, monthSales, todayPurchases, todayExpenses, monthPurchases, monthExpenses, creditSummary] = await Promise.all([
    Tank.findOne(pumpObjectId ? { fuelType: "Petrol", pumpId: pumpObjectId } : { fuelType: "Petrol" }).lean(),
    Tank.findOne(pumpObjectId ? { fuelType: "Diesel", pumpId: pumpObjectId } : { fuelType: "Diesel" }).lean(),
    sumRange(FuelSale, "totalSaleAmount", todayStart, todayEnd, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumRange(FuelSale, "totalSaleAmount", monthStart, monthEnd, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumRange(FuelPurchase, "totalAmount", todayStart, todayEnd, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumRange(Expense, "amount", todayStart, todayEnd, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumRange(FuelPurchase, "totalAmount", monthStart, monthEnd, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumRange(Expense, "amount", monthStart, monthEnd, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    Customer.aggregate([{ $match: pumpObjectId ? { pumpId: pumpObjectId } : {} }, { $group: { _id: null, total: { $sum: "$pendingBalance" } } }]),
  ]);

  const [dailySales, monthlySales, dailyExpenses, monthlyExpenses, fuelConsumption, recentPurchases, recentExpenses, recentSales] = await Promise.all([
    sumByDate(FuelSale, "totalSaleAmount", chartStart, todayStart, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumByMonth(FuelSale, "totalSaleAmount", 6, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumByDate(Expense, "amount", chartStart, todayStart, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    sumByMonth(Expense, "amount", 6, pumpObjectId ? { pumpId: pumpObjectId } : {}),
    FuelSale.aggregate([
      { $match: pumpObjectId ? { date: { $gte: monthStart, $lte: monthEnd }, pumpId: pumpObjectId } : { date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: "$fuelType", total: { $sum: "$soldLiters" } } },
      { $sort: { _id: 1 } },
    ]),
    FuelPurchase.find(pumpObjectId ? { pumpId: pumpObjectId } : {}).sort({ date: -1 }).limit(5).lean(),
    Expense.find(pumpObjectId ? { pumpId: pumpObjectId } : {}).sort({ date: -1 }).limit(5).lean(),
    FuelSale.find(pumpObjectId ? { pumpId: pumpObjectId } : {}).sort({ date: -1 }).limit(5).lean(),
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