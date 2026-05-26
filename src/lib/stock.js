import Tank from "@/models/Tank";
import Nozzle from "@/models/Nozzle";
import StockAdjustment from "@/models/StockAdjustment";
import { connectMongo } from "@/lib/mongodb";

export async function ensureTank(fuelType, session, pumpId = null) {
  await connectMongo();
  const query = Tank.findOne({ fuelType, pumpId: pumpId || null });
  if (session) query.session(session);
  const tank = await query;

  if (tank) {
    return tank;
  }

  const newTank = new Tank({ fuelType, pumpId: pumpId || null, currentStock: 0, capacityLiters: 0, lowStockThreshold: 5000 });
  await newTank.save(session ? { session } : {});
  return newTank;
}

function ensureFiniteNumber(value, name = "value") {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${name} must be a finite number`);
  }
  return n;
}

export async function increaseTankStock(fuelType, quantityLiters, session, pumpId = null) {
  const qty = ensureFiniteNumber(quantityLiters, "quantityLiters");
  const tank = await ensureTank(fuelType, session, pumpId);
  tank.currentStock = Number(tank.currentStock || 0) + qty;
  await tank.save(session ? { session } : {});
  return tank;
}

export async function decreaseTankStock(fuelType, quantityLiters, session, pumpId = null) {
  const qty = ensureFiniteNumber(quantityLiters, "quantityLiters");
  const tank = await ensureTank(fuelType, session, pumpId);
  const remaining = Number(tank.currentStock || 0) - qty;

  if (remaining < 0) {
    throw new Error(`Insufficient ${fuelType} stock`);
  }

  tank.currentStock = remaining;
  await tank.save(session ? { session } : {});
  return tank;
}

export async function applyStockAdjustment(input, userId, session, pumpId = null) {
  const tank = await ensureTank(input.fuelType, session, pumpId);
  const adjustmentQuantity = ensureFiniteNumber(input.adjustmentQuantity, "adjustmentQuantity");
  const nextStock = Number(tank.currentStock || 0) + adjustmentQuantity;

  if (nextStock < 0) {
    throw new Error(`Adjustment would make ${input.fuelType} stock negative`);
  }

  tank.currentStock = nextStock;
  await tank.save(session ? { session } : {});

  const record = new StockAdjustment({ ...input, createdBy: userId, pumpId: pumpId || null });
  await record.save(session ? { session } : {});
  return { tank, record };
}

export async function updateNozzleReading(nozzleId, meterReading, session, pumpId = null) {
  if (!nozzleId) {
    return null;
  }

  const query = Nozzle.findOne({ _id: nozzleId, pumpId: pumpId || null });
  if (session) query.session(session);
  const nozzle = await query;
  if (!nozzle) {
    return null;
  }

  nozzle.currentMeterReading = meterReading;
  await nozzle.save(session ? { session } : {});
  return nozzle;
}

export function calculateSoldLiters(openingMeterReading, closingMeterReading) {
  const soldLiters = Number(closingMeterReading) - Number(openingMeterReading);

  if (!Number.isFinite(soldLiters) || soldLiters < 0) {
    throw new Error("Closing reading must be a finite number greater than or equal to opening reading");
  }

  return soldLiters;
}