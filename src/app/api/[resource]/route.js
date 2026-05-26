import bcrypt from "bcryptjs";
import { connectMongo } from "@/lib/mongodb";
import { authenticateRequest } from "@/lib/auth";
import { failure, success } from "@/lib/response";
import { resourceModelMap } from "@/models";
import { getModuleConfig } from "@/utils/module-config";
import { increaseTankStock, decreaseTankStock, applyStockAdjustment, calculateSoldLiters, updateNozzleReading } from "@/lib/stock";
import mongoose from "mongoose";
import { escapeRegex, ensureFiniteNumber } from "@/utils/db";
import Customer from "@/models/Customer";
import Pump from "@/models/Pump";
import { resolvePumpId, toPumpObjectId, applyPumpScope, withPumpId } from "@/lib/pump";

function normalizePumpIdForSave(value) {
  if (!value) return null;
  // If an object was passed (populated pump), prefer its _id
  if (typeof value === "object") {
    if (value._id) return toPumpObjectId(String(value._id));
    // If it's already an ObjectId-like object, return as-is
    return value;
  }
  return toPumpObjectId(String(value));
}

function parseObjectId(value) {
  return typeof value === "string" && value.length === 24 ? value : null;
}

function buildQuery(resource, searchParams) {
  const config = getModuleConfig(resource);
  const query = {};

  if (searchParams.get("search") && config?.searchFields?.length) {
    const raw = searchParams.get("search");
    const search = escapeRegex(raw);
    query.$or = config.searchFields.map((field) => ({ [field]: { $regex: search, $options: "i" } }));
  }

  if (config?.filters?.length) {
    for (const filter of config.filters) {
      const value = searchParams.get(filter.name);
      if (value) {
        query[filter.name] = value;
      }
    }
  }

  return query;
}

const pumpScopedResources = new Set(["fuel-purchases", "fuel-sales", "tanks", "nozzles", "shifts", "expenses", "customers", "payments", "employees", "stock-adjustments"]);

function requirePumpSelection(resource, pumpId) {
  if (pumpScopedResources.has(resource) && !pumpId) {
    return failure("Select a petrol pump first", 400);
  }

  return null;
}

async function createRecord(resource, body, user, session, pumpId) {
  const model = resourceModelMap[resource];

  switch (resource) {
    case "users": {
      const hashedPassword = await bcrypt.hash(body.password, 12);
      const pumpForDoc = normalizePumpIdForSave(body.pumpId) || null;
      try {
        console.log("[DEBUG] pumpForDoc ->", pumpForDoc, "type:", typeof pumpForDoc, "isObjectId:", pumpForDoc && pumpForDoc.constructor && pumpForDoc.constructor.name);
      } catch (e) {}
      const doc = new model({ ...body, password: hashedPassword, pumpId: pumpForDoc });
      try {
        console.log("[DEBUG] Doc before save ->", { ...doc.toObject ? doc.toObject() : doc });
      } catch (e) {}
      await doc.save(session ? { session } : {});
      try {
        const obj = doc.toObject ? doc.toObject() : doc;
        // remove sensitive fields if present
        if (obj.password) delete obj.password;
        console.log("[DEBUG] Saved user doc ->", obj);
      } catch (e) {}
      return doc;
    }
    case "pumps": {
      const doc = new model(body);
      await doc.save(session ? { session } : {});
      return doc;
    }
    case "fuel-purchases": {
      const qty = ensureFiniteNumber(body.quantityLiters, "quantityLiters");
      const price = ensureFiniteNumber(body.pricePerLiter, "pricePerLiter");
      const totalAmount = qty * price;
      const record = new model(withPumpId({ ...body, totalAmount, date: new Date(body.date), createdBy: user._id }, pumpId));
      await record.save(session ? { session } : {});
      await increaseTankStock(body.fuelType, qty, session, pumpId);
      return record;
    }
    case "fuel-sales": {
      const soldLiters = calculateSoldLiters(body.openingMeterReading, body.closingMeterReading);
      const price = ensureFiniteNumber(body.fuelPricePerLiter, "fuelPricePerLiter");
      const totalSaleAmount = soldLiters * price;
      await decreaseTankStock(body.fuelType, soldLiters, session, pumpId);

      const nozzleName = body.nozzleName || body.nozzle || "";
      const record = new model({
        ...body,
        nozzleName,
        soldLiters,
        totalSaleAmount,
        date: new Date(body.date),
        createdBy: user._id,
        pumpId: pumpId || null,
      });
      await record.save(session ? { session } : {});

      if (body.nozzle) {
        await updateNozzleReading(body.nozzle, body.closingMeterReading, session, pumpId);
      }

      if (body.paymentType === "Credit" && body.customer) {
        const customer = await Customer.findOne({ $or: [{ _id: parseObjectId(body.customer) || undefined }, { name: body.customer }], pumpId: pumpId || null }).session(session || null);
        if (customer) {
          customer.pendingBalance = Number(customer.pendingBalance || 0) + Number(body.pendingAmount || 0);
          await customer.save(session ? { session } : {});
        }
      }

      return record;
    }
    case "stock-adjustments": {
      const { record } = await applyStockAdjustment({
        fuelType: body.fuelType,
        adjustmentQuantity: Number(body.adjustmentQuantity),
        reason: body.reason,
        date: new Date(body.date),
      }, user._id, session, pumpId);
      return record;
    }
    case "payments": {
      const customerQuery = parseObjectId(body.customer) ? { _id: body.customer, pumpId: pumpId || null } : { name: body.customer, pumpId: pumpId || null };
      const customer = await Customer.findOne(customerQuery).session(session || null);

      const payment = new model({
        customer: customer?._id,
        amount: ensureFiniteNumber(body.amount, "amount"),
        method: body.method,
        note: body.note,
        date: new Date(body.date),
        createdBy: user._id,
        pumpId: pumpId || null,
      });
      await payment.save(session ? { session } : {});

      if (customer) {
        customer.pendingBalance = Math.max(0, Number(customer.pendingBalance || 0) - Number(body.amount));
        await customer.save(session ? { session } : {});
      }

      return payment;
    }
    case "tanks":
      {
        const doc = new model({ ...body, currentStock: Number(body.currentStock), capacityLiters: Number(body.capacityLiters), lowStockThreshold: Number(body.lowStockThreshold), pumpId: pumpId || null });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "employees":
      {
        const doc = new model({ ...body, salary: Number(body.salary), joiningDate: new Date(body.joiningDate), pumpId: pumpId || null });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "expenses":
      {
        const doc = new model({ ...body, amount: Number(body.amount), date: new Date(body.date), createdBy: user._id, pumpId: pumpId || null });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "customers":
      {
        const doc = new model({ ...body, pendingBalance: Number(body.pendingBalance), pumpId: pumpId || null });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "nozzles":
      {
        const doc = new model({ ...body, currentMeterReading: Number(body.currentMeterReading), pumpId: pumpId || null });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "shifts":
      {
        const doc = new model({ ...body, startTime: new Date(body.startTime), endTime: body.endTime ? new Date(body.endTime) : undefined, pumpId: pumpId || null });
        await doc.save(session ? { session } : {});
        return doc;
      }
    default:
      {
        const doc = new model(withPumpId(body, pumpId));
        await doc.save(session ? { session } : {});
        return doc;
      }
  }
}

async function updateRecord(resource, id, body, session, pumpId) {
  const model = resourceModelMap[resource];
  if (body && body.pumpId !== undefined) {
    body.pumpId = normalizePumpIdForSave(body.pumpId);
  }
  if (resource === "users" && body.password) {
    body.password = await bcrypt.hash(body.password, 12);
  }
  const options = { returnDocument: 'after' };
  if (session) options.session = session;
  const filter = pumpScopedResources.has(resource) && pumpId ? { _id: id, pumpId } : { _id: id };
  const updated = await model.findOneAndUpdate(filter, body, options);
  if (resource === "users") {
    try {
      const uobj = updated?.toObject ? updated.toObject() : updated;
      if (uobj?.password) delete uobj.password;
      console.log("[DEBUG] Updated user ->", uobj);
    } catch (e) {}
  }
  return updated;
}

async function getResourceName(params) {
  const resolvedParams = await params;
  return resolvedParams.resource;
}

export async function GET(request, { params }) {
  const user = await authenticateRequest(request);
  if (!user) {
    return failure("Unauthorized", 401);
  }

  const resource = await getResourceName(params);
  const model = resourceModelMap[resource];
  if (!model) {
    return failure("Unknown resource", 404);
  }

  await connectMongo();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const pumpId = resolvePumpId(user);
  const scoped = pumpScopedResources.has(resource);

  if (id) {
    const query = scoped && pumpId ? { _id: id, pumpId } : { _id: id };
    const item = await model.findOne(query).lean();
    if (resource === "users" && item?.pumpId) {
      const pump = await Pump.findById(item.pumpId).select("name code").lean();
      item.pumpId = pump || item.pumpId;
    }
    return success({ item });
  }

  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  const query = scoped && pumpId ? applyPumpScope(buildQuery(resource, searchParams), pumpId) : buildQuery(resource, searchParams);
  const sort = getModuleConfig(resource)?.sort || { createdAt: -1 };

  const [items, total] = await Promise.all([
    model.find(query).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    model.countDocuments(query),
  ]);

  if (resource === "users") {
    const pumpIds = [...new Set(items.map((item) => item.pumpId?.toString?.()).filter(Boolean))];
    if (pumpIds.length) {
      const pumps = await Pump.find({ _id: { $in: pumpIds } }).select("name code").lean();
      const pumpMap = new Map(pumps.map((pump) => [pump._id.toString(), pump]));
      for (const item of items) {
        const pumpKey = item.pumpId?.toString?.();
        if (pumpKey && pumpMap.has(pumpKey)) {
          item.pumpId = pumpMap.get(pumpKey);
        }
      }
    }
  }

  return success({ items, total, page, limit });
}

export async function POST(request, { params }) {
  const user = await authenticateRequest(request);
  if (!user) {
    return failure("Unauthorized", 401);
  }

  const resource = await getResourceName(params);
  const model = resourceModelMap[resource];
  if (!model) {
    return failure("Unknown resource", 404);
  }

  await connectMongo();
  const body = await request.json();
  if (body && body.pumpId) {
    try {
      body.pumpId = String(body.pumpId);
    } catch (e) {
      // ignore
    }
  }
  if (resource === "users") {
    try {
      console.log("[DEBUG] POST /api/users body.pumpId ->", body.pumpId);
    } catch (e) {}
  }
  const pumpId = toPumpObjectId(body.pumpId || resolvePumpId(user));
  const pumpRequirementError = requirePumpSelection(resource, pumpId);
  if (pumpRequirementError) {
    return pumpRequirementError;
  }
  const transactionalResources = ["fuel-purchases", "fuel-sales", "payments", "stock-adjustments"];
  let record;
  const session = await mongoose.startSession();
  try {
    if (transactionalResources.includes(resource)) {
      await session.withTransaction(async () => {
        record = await createRecord(resource, body, user, session, pumpId);
      });
    } else {
      record = await createRecord(resource, body, user, null, pumpId);
    }
  } finally {
    session.endSession();
  }

  return success({ record }, 201);
}

export async function PATCH(request, { params }) {
  const user = await authenticateRequest(request);
  if (!user) {
    return failure("Unauthorized", 401);
  }

  const resource = await getResourceName(params);
  const model = resourceModelMap[resource];
  if (!model) {
    return failure("Unknown resource", 404);
  }

  await connectMongo();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return failure("Missing id", 400);
  }

  const body = await request.json();
  if (body && body.pumpId) {
    try {
      body.pumpId = String(body.pumpId);
    } catch (e) {
      // ignore
    }
  }
  if (resource === "users") {
    try {
      console.log("[DEBUG] PATCH /api/users body.pumpId ->", body.pumpId);
    } catch (e) {}
  }
  const transactionalResources = ["fuel-purchases", "fuel-sales", "payments", "stock-adjustments"];
  const pumpId = toPumpObjectId(body.pumpId || resolvePumpId(user));
  const pumpRequirementError = requirePumpSelection(resource, pumpId);
  if (pumpRequirementError) {
    return pumpRequirementError;
  }

  const session = await mongoose.startSession();
  let record;
  try {
    if (transactionalResources.includes(resource)) {
      await session.withTransaction(async () => {
        record = await updateRecord(resource, id, body, session, pumpId);
      });
    } else {
      record = await updateRecord(resource, id, body, null, pumpId);
    }
  } finally {
    session.endSession();
  }

  return success({ record });
}

export async function DELETE(request, { params }) {
  const user = await authenticateRequest(request);
  if (!user) {
    return failure("Unauthorized", 401);
  }

  const resource = await getResourceName(params);
  const model = resourceModelMap[resource];
  if (!model) {
    return failure("Unknown resource", 404);
  }

  await connectMongo();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return failure("Missing id", 400);
  }

  const pumpId = toPumpObjectId(searchParams.get("pumpId") || resolvePumpId(user));
  const pumpRequirementError = requirePumpSelection(resource, pumpId);
  if (pumpRequirementError) {
    return pumpRequirementError;
  }
  const filter = pumpScopedResources.has(resource) && pumpId ? { _id: id, pumpId } : { _id: id };
  await model.findOneAndDelete(filter);
  return success({ deleted: true });
}