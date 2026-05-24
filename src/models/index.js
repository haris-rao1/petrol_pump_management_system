import User from "@/models/User";
import FuelPurchase from "@/models/FuelPurchase";
import FuelSale from "@/models/FuelSale";
import Tank from "@/models/Tank";
import Nozzle from "@/models/Nozzle";
import Shift from "@/models/Shift";
import Expense from "@/models/Expense";
import Customer from "@/models/Customer";
import Payment from "@/models/Payment";
import Employee from "@/models/Employee";
import StockAdjustment from "@/models/StockAdjustment";

export { default as User } from "@/models/User";
export { default as FuelPurchase } from "@/models/FuelPurchase";
export { default as FuelSale } from "@/models/FuelSale";
export { default as Tank } from "@/models/Tank";
export { default as Nozzle } from "@/models/Nozzle";
export { default as Shift } from "@/models/Shift";
export { default as Expense } from "@/models/Expense";
export { default as Customer } from "@/models/Customer";
export { default as Payment } from "@/models/Payment";
export { default as Employee } from "@/models/Employee";
export { default as StockAdjustment } from "@/models/StockAdjustment";

export const resourceModelMap = {
  users: User,
  "fuel-purchases": FuelPurchase,
  "fuel-sales": FuelSale,
  tanks: Tank,
  nozzles: Nozzle,
  shifts: Shift,
  expenses: Expense,
  customers: Customer,
  payments: Payment,
  employees: Employee,
  "stock-adjustments": StockAdjustment,
};