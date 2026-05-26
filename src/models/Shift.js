import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const shiftSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    shiftName: { type: String, required: true, trim: true },
    operatorName: { type: String, required: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    status: { type: String, default: "Open" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export default getModel("Shift", shiftSchema);