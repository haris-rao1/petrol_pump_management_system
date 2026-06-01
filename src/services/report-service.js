import { endOfDay, startOfDay } from "date-fns";
import { connectMongo } from "@/lib/mongodb";
import FuelSale from "@/models/FuelSale";
import FuelPurchase from "@/models/FuelPurchase";
import Expense from "@/models/Expense";
import Payment from "@/models/Payment";
import { applyPumpScope, toPumpObjectId } from "@/lib/pump";

export async function getReportData(filters = {}, pumpId = null) {
  await connectMongo();
  const pumpObjectId = toPumpObjectId(pumpId);

  const startDate = filters.startDate
    ? startOfDay(new Date(filters.startDate))
    : startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const endDate = filters.endDate ? endOfDay(new Date(filters.endDate)) : endOfDay(new Date());

  const dateQuery = { date: { $gte: startDate, $lte: endDate } };
  const saleQuery = { ...dateQuery };
  const purchaseQuery = { ...dateQuery };
  const expenseQuery = { ...dateQuery };
  const paymentQuery = { ...dateQuery };

  if (pumpObjectId) {
    Object.assign(saleQuery, { pumpId: pumpObjectId });
    Object.assign(purchaseQuery, { pumpId: pumpObjectId });
    Object.assign(expenseQuery, { pumpId: pumpObjectId });
    Object.assign(paymentQuery, { pumpId: pumpObjectId });
  }

  if (filters.fuelType) {
    saleQuery.fuelType = filters.fuelType;
    purchaseQuery.fuelType = filters.fuelType;
  }

  const [sales, purchases, expenses, payments] = await Promise.all([
    FuelSale.find(saleQuery).sort({ date: -1 }).lean(),
    FuelPurchase.find(purchaseQuery).sort({ date: -1 }).lean(),
    Expense.find(expenseQuery).sort({ date: -1 }).lean(),
    Payment.find(paymentQuery).populate("customer", "name vehicleNumber").sort({ date: -1 }).lean(),
  ]);

  const purchaseCostByFuel = purchases.reduce((map, purchase) => {
    const fuelType = purchase.fuelType || "Unknown";
    const existing = map.get(fuelType) || { liters: 0, cost: 0 };
    return map.set(fuelType, {
      liters: existing.liters + Number(purchase.quantityLiters || 0),
      cost: existing.cost + Number(purchase.totalAmount || 0),
    });
  }, new Map());

  const averagePurchaseCost = new Map();
  for (const [fuelType, stats] of purchaseCostByFuel.entries()) {
    averagePurchaseCost.set(fuelType, stats.liters > 0 ? stats.cost / stats.liters : 0);
  }

  const salesWithProfit = sales.map((sale) => {
    const unitCost = averagePurchaseCost.get(sale.fuelType) || 0;
    const saleCost = Number(sale.soldLiters || 0) * unitCost;
    const saleProfit = Number(sale.totalSaleAmount || 0) - saleCost;

    return {
      ...sale,
      section: "Sales",
      description: `${sale.soldLiters || 0}L @ ${sale.fuelPricePerLiter || 0}`,
      saleCost,
      saleProfit,
    };
  });

  const purchaseRows = purchases.map((purchase) => ({
    ...purchase,
    section: "Purchases",
    description: purchase.supplierName || "Purchase",
  }));

  const expenseRows = expenses.map((expense) => ({
    ...expense,
    section: "Expenses",
    description: expense.expenseTitle || "Expense",
  }));

  const paymentRows = payments.map((payment) => ({
    ...payment,
    section: "Payments",
    description: payment.customer?.name || payment.note || "Payment Received",
    customerName: payment.customer?.name || "",
  }));

  const rows = [
    ...salesWithProfit,
    ...purchaseRows,
    ...expenseRows,
    ...paymentRows,
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totals = {
    salesRevenue: salesWithProfit.reduce((sum, sale) => sum + Number(sale.totalSaleAmount || 0), 0),
    purchasesCost: purchases.reduce((sum, purchase) => sum + Number(purchase.totalAmount || 0), 0),
    expenses: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    paymentsReceived: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    salesCost: salesWithProfit.reduce((sum, sale) => sum + Number(sale.saleCost || 0), 0),
    salesProfit: salesWithProfit.reduce((sum, sale) => sum + Number(sale.saleProfit || 0), 0),
  };

  return {
    rows,
    sales: salesWithProfit,
    purchases,
    expenses,
    payments: paymentRows,
    totals,
    totalProfit: totals.salesProfit - totals.expenses,
  };
}