import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { PAYMENT_METHODS } from "@/lib/constants";

const paymentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, default: "Cash" },
    note: { type: String, default: "" },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default getModel("Payment", paymentSchema);