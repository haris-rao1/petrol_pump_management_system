import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const fuelSaleSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    nozzle: { type: mongoose.Schema.Types.ObjectId, ref: "Nozzle", required: false },
    nozzleName: { type: String, required: true, trim: true },
    machineName: { type: String, default: "", trim: true },
    fuelType: { type: String, required: true, trim: true },
    openingMeterReading: { type: Number, required: true },
    closingMeterReading: { type: Number, required: true },
    soldLiters: { type: Number, required: true },
    fuelPricePerLiter: { type: Number, required: true },
    totalSaleAmount: { type: Number, required: true },
    
    amountReceived: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    date: { type: Date, required: true },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("FuelSale", fuelSaleSchema);