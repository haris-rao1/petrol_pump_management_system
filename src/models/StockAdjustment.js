import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const stockAdjustmentSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    fuelType: { type: String, required: true, trim: true },
    adjustmentQuantity: { type: Number, required: true },
    reason: { type: String, required: true },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("StockAdjustment", stockAdjustmentSchema);