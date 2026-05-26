import { endOfDay, startOfDay } from "date-fns";
import { connectMongo } from "@/lib/mongodb";
import FuelSale from "@/models/FuelSale";
import FuelPurchase from "@/models/FuelPurchase";
import Expense from "@/models/Expense";
import { applyPumpScope, toPumpObjectId } from "@/lib/pump";

export async function getReportData(filters = {}, pumpId = null) {
  await connectMongo();
  const pumpObjectId = toPumpObjectId(pumpId);

  const startDate = filters.startDate ? startOfDay(new Date(filters.startDate)) : startOfDay(new Date());
  const endDate = filters.endDate ? endOfDay(new Date(filters.endDate)) : endOfDay(new Date());

  const saleQuery = {
    date: { $gte: startDate, $lte: endDate },
  };

  Object.assign(saleQuery, pumpObjectId ? { pumpId: pumpObjectId } : {});

  if (filters.fuelType) {
    saleQuery.fuelType = filters.fuelType;
  }

  if (filters.employee) {
    saleQuery.operatorName = filters.employee;
  }

  if (filters.shift) {
    saleQuery.shiftName = filters.shift;
  }

  const [sales, purchases, expenses] = await Promise.all([
    FuelSale.find(saleQuery).sort({ date: -1 }).lean(),
    FuelPurchase.find(applyPumpScope({ date: { $gte: startDate, $lte: endDate } }, pumpObjectId)).sort({ date: -1 }).lean(),
    Expense.find(applyPumpScope({ date: { $gte: startDate, $lte: endDate } }, pumpObjectId)).sort({ date: -1 }).lean(),
  ]);

  const totals = {
    sales: sales.reduce((sum, item) => sum + Number(item.totalSaleAmount || 0), 0),
    purchases: purchases.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    expenses: expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  };

  return {
    sales,
    purchases,
    expenses,
    totals,
    profit: totals.sales - totals.purchases - totals.expenses,
  };
}