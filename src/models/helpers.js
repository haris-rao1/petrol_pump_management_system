import mongoose from "mongoose";

export function getModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}