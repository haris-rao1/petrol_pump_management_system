import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const tankSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    fuelType: { type: String, required: true, trim: true },
    currentStock: { type: Number, default: 0 },
    capacityLiters: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5000 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

tankSchema.index({ pumpId: 1, fuelType: 1 }, { unique: true });

export default getModel("Tank", tankSchema);