import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { PAYMENT_METHODS } from "@/lib/constants";

const paymentSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, default: "Cash" },
    type: { type: String, enum: ["receive", "credit"], default: "receive" },
    note: { type: String, default: "" },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("Payment", paymentSchema);