import mongoose from "mongoose";
import { getModel } from "@/models/helpers";

const customerSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    vehicleNumber: { type: String, default: "" },
    companyName: { type: String, default: "" },
    creditDate: { type: Date, default: null },
    pendingBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default getModel("Customer", customerSchema);