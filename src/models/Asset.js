import mongoose from "mongoose";

// Business Asset schema — independent asset inventory for the company.
const AssetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: "" },
  description: { type: String, default: "" },
  serialNumber: { type: String, default: "" },
  purchaseDate: { type: Date },
  purchasePrice: { type: Number, default: 0 },
  currentValue: { type: Number, default: 0 },
  location: { type: String, default: "" },
  status: { type: String, default: "active" },
  documents: [{ type: String }], // optional URLs or references to separate file storage
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Asset || mongoose.model("Asset", AssetSchema);
