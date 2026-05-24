import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { FUEL_TYPES } from "@/lib/constants";

const fuelPurchaseSchema = new mongoose.Schema(
  {
    fuelType: { type: String, enum: FUEL_TYPES, required: true },
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