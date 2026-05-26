import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { FUEL_TYPES } from "@/lib/constants";

const stockAdjustmentSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    fuelType: { type: String, enum: FUEL_TYPES, required: true },
    adjustmentQuantity: { type: Number, required: true },
    reason: { type: String, required: true },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("StockAdjustment", stockAdjustmentSchema);