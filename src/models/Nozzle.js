import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { STATUS_OPTIONS } from "@/lib/constants";

const nozzleSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    nozzleName: { type: String, required: true, trim: true },
    machineName: { type: String, required: true, trim: true },
    fuelType: { type: String, required: true, trim: true },
    currentMeterReading: { type: Number, default: 0 },
    status: { type: String, enum: STATUS_OPTIONS, default: "Active" },
  },
  { timestamps: true },
);

export default getModel("Nozzle", nozzleSchema);