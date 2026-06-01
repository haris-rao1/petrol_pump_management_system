import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const productSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: "", trim: true },
    status: { type: String, default: "Active", trim: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

productSchema.index({ pumpId: 1, name: 1 }, { unique: true });

export default getModel("Product", productSchema);