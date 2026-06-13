import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const fuelSaleSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    salesItems: [
      {
        nozzle: { type: mongoose.Schema.Types.ObjectId, ref: "Nozzle", required: false },
        nozzleName: { type: String,  trim: true },
        machineName: { type: String, default: "", trim: true },
        fuelType: { type: String, trim: true },
        openingMeterReading: { type: Number, },
        closingMeterReading: { type: Number,},
        soldLiters: { type: Number,  },
        fuelPricePerLiter: { type: Number,  },
        totalSaleAmount: { type: Number, },
      },
    ],
    nozzle: { type: mongoose.Schema.Types.ObjectId, ref: "Nozzle", required: false },
    nozzleName: { type: String, required: false, trim: true, default: "" },
    machineName: { type: String, default: "", trim: true },
    fuelType: { type: String, required: false, trim: true, default: "" },
    openingMeterReading: { type: Number, required: false, default: 0 },
    closingMeterReading: { type: Number, required: false, default: 0 },
    soldLiters: { type: Number, required: false, default: 0 },
    fuelPricePerLiter: { type: Number, required: false, default: 0 },
    totalSaleAmount: { type: Number, required: true },
    openingBalance: { type: Number, default: 0 },
    amountReceived: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    date: { type: Date, required: true },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("FuelSale", fuelSaleSchema);