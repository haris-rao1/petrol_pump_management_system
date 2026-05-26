import mongoose from "mongoose";

export function getModel(name, schema) {
  // Ensure the model uses the latest schema definition during dev/hot-reload.
  // If a model with the same name exists, remove it so it can be recreated.
  if (mongoose.models[name]) {
    try {
      delete mongoose.models[name];
    } catch (e) {
      // ignore
    }
  }
  return mongoose.model(name, schema);
}