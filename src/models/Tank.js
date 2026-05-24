import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { FUEL_TYPES } from "@/lib/constants";

const tankSchema = new mongoose.Schema(
  {
    fuelType: { type: String, enum: FUEL_TYPES, unique: true, required: true },
    currentStock: { type: Number, default: 0 },
    capacityLiters: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5000 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export default getModel("Tank", tankSchema);