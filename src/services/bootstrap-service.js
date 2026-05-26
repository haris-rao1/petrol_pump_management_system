import bcrypt from "bcryptjs";
import User from "@/models/User";
import Pump from "@/models/Pump";
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
import { connectMongo } from "@/lib/mongodb";
import { DEFAULT_ADMIN } from "@/lib/constants";

const DEFAULT_PUMP = {
  name: "Petrol Pump 1",
  code: "PP-001",
  address: "",
  status: "Active",
  notes: "Default pump created on first run.",
};

async function backfillPumpScope(pumpId) {
  const scope = { $or: [{ pumpId: { $exists: false } }, { pumpId: null }] };
  await Promise.all([
    FuelPurchase.updateMany(scope, { $set: { pumpId } }),
    FuelSale.updateMany(scope, { $set: { pumpId } }),
    Tank.updateMany(scope, { $set: { pumpId } }),
    Nozzle.updateMany(scope, { $set: { pumpId } }),
    Shift.updateMany(scope, { $set: { pumpId } }),
    Expense.updateMany(scope, { $set: { pumpId } }),
    Customer.updateMany(scope, { $set: { pumpId } }),
    Payment.updateMany(scope, { $set: { pumpId } }),
    Employee.updateMany(scope, { $set: { pumpId } }),
    StockAdjustment.updateMany(scope, { $set: { pumpId } }),
    User.updateMany({ $and: [{ $or: [{ pumpId: { $exists: false } }, { pumpId: null }] }, { role: { $ne: DEFAULT_ADMIN.role } }] }, { $set: { pumpId } }),
  ]);
}

export async function ensureDefaultPump() {
  await connectMongo();

  let pump = await Pump.findOne({ code: DEFAULT_PUMP.code });
  if (!pump) {
    pump = await Pump.create(DEFAULT_PUMP);
  }

  await backfillPumpScope(pump._id);
  return pump;
}

export async function ensureDefaultAdmin() {
  await connectMongo();

  const existingUserCount = await User.countDocuments();
  if (existingUserCount > 0) {
    return null;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

  return User.create({
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    password: hashedPassword,
    role: DEFAULT_ADMIN.role,
    status: "Active",
  });
}