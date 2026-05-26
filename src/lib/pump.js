import mongoose from "mongoose";

export function resolvePumpId(user) {
  return user?.activePumpId || user?.pumpId || null;
}

export function toPumpObjectId(pumpId) {
  if (!pumpId) {
    return null;
  }

  return typeof pumpId === "string" ? new mongoose.Types.ObjectId(pumpId) : pumpId;
}

export function applyPumpScope(query = {}, pumpId) {
  if (!pumpId) {
    return query;
  }

  return { ...query, pumpId };
}

export function withPumpId(record = {}, pumpId) {
  if (!pumpId) {
    return record;
  }

  return { ...record, pumpId };
}