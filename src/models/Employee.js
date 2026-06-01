import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { ROLES, STATUS_OPTIONS } from "@/lib/constants";

const employeeSchema = new mongoose.Schema(
  {
    pumpId: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", default: null, index: true },
    name: { type: String, required: true, trim: true },
    cnic: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.OPERATOR },
    salary: { type: Number, default: 0 },
    joiningDate: { type: Date, required: true },
    status: { type: String, enum: STATUS_OPTIONS, default: "Active" },
    attendance: [
      {
        date: { type: Date, default: Date.now },
        status: { type: String, default: "Present" },
        notes: { type: String, default: "" },
      },
    ],
    salaryRecords: [
      {
        month: { type: String, required: true },
        amount: { type: Number, required: true },
        status: { type: String, default: "Pending" },
        paidAt: { type: Date },
      },
    ],
  },
  { timestamps: true },
);

export default getModel("Employee", employeeSchema);