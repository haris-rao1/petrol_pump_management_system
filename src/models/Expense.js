import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

const expenseSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    expenseTitle: { type: String, required: true, trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("Expense", expenseSchema);