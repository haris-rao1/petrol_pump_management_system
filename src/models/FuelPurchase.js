import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const fuelPurchaseSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    fuelType: { type: String, required: true, trim: true },
    quantityLiters: { type: Number, required: true },
    pricePerLiter: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    supplierName: { type: String, required: true, trim: true },
    invoiceNumber: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("FuelPurchase", fuelPurchaseSchema);