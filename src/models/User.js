import mongoose from "mongoose";
import { getModel } from "@/models/helpers";
import { ROLES, STATUS_OPTIONS } from "@/lib/constants";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.OPERATOR },
    status: { type: String, enum: STATUS_OPTIONS, default: "Active" },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export default getModel("User", userSchema);