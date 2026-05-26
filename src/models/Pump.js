import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const pumpSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true },
    address: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export default getModel("Pump", pumpSchema);