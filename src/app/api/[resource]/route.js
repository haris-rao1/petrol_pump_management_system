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

async function createRecord(resource, body, user, session) {
  const model = resourceModelMap[resource];

  switch (resource) {
    case "users": {
      const hashedPassword = await bcrypt.hash(body.password, 12);
      const doc = new model({ ...body, password: hashedPassword });
      await doc.save(session ? { session } : {});
      return doc;
    }
    case "fuel-purchases": {
      const qty = ensureFiniteNumber(body.quantityLiters, "quantityLiters");
      const price = ensureFiniteNumber(body.pricePerLiter, "pricePerLiter");
      const totalAmount = qty * price;
      const record = new model({ ...body, totalAmount, date: new Date(body.date), createdBy: user._id });
      await record.save(session ? { session } : {});
      await increaseTankStock(body.fuelType, qty, session);
      return record;
    }
    case "fuel-sales": {
      const soldLiters = calculateSoldLiters(body.openingMeterReading, body.closingMeterReading);
      const price = ensureFiniteNumber(body.fuelPricePerLiter, "fuelPricePerLiter");
      const totalSaleAmount = soldLiters * price;
      await decreaseTankStock(body.fuelType, soldLiters, session);

      const nozzleName = body.nozzleName || body.nozzle || "";
      const record = new model({
        ...body,
        nozzleName,
        soldLiters,
        totalSaleAmount,
        date: new Date(body.date),
        createdBy: user._id,
      });
      await record.save(session ? { session } : {});

      if (body.nozzle) {
        await updateNozzleReading(body.nozzle, body.closingMeterReading, session);
      }

      if (body.paymentType === "Credit" && body.customer) {
        const customer = await Customer.findOne({ $or: [{ _id: parseObjectId(body.customer) || undefined }, { name: body.customer }] }).session(session || null);
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
      }, user._id, session);
      return record;
    }
    case "payments": {
      const customerQuery = parseObjectId(body.customer) ? { _id: body.customer } : { name: body.customer };
      const customer = await Customer.findOne(customerQuery).session(session || null);

      const payment = new model({
        customer: customer?._id,
        amount: ensureFiniteNumber(body.amount, "amount"),
        method: body.method,
        note: body.note,
        date: new Date(body.date),
        createdBy: user._id,
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
        const doc = new model({ ...body, currentStock: Number(body.currentStock), capacityLiters: Number(body.capacityLiters), lowStockThreshold: Number(body.lowStockThreshold) });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "employees":
      {
        const doc = new model({ ...body, salary: Number(body.salary), joiningDate: new Date(body.joiningDate) });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "expenses":
      {
        const doc = new model({ ...body, amount: Number(body.amount), date: new Date(body.date), createdBy: user._id });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "customers":
      {
        const doc = new model({ ...body, pendingBalance: Number(body.pendingBalance) });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "nozzles":
      {
        const doc = new model({ ...body, currentMeterReading: Number(body.currentMeterReading) });
        await doc.save(session ? { session } : {});
        return doc;
      }
    case "shifts":
      {
        const doc = new model({ ...body, startTime: new Date(body.startTime), endTime: body.endTime ? new Date(body.endTime) : undefined });
        await doc.save(session ? { session } : {});
        return doc;
      }
    default:
      {
        const doc = new model(body);
        await doc.save(session ? { session } : {});
        return doc;
      }
  }
}

async function updateRecord(resource, id, body, session) {
  const model = resourceModelMap[resource];
  if (resource === "users" && body.password) {
    body.password = await bcrypt.hash(body.password, 12);
  }
  const options = { returnDocument: 'after' };
  if (session) options.session = session;
  return model.findByIdAndUpdate(id, body, options);
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

  if (id) {
    const item = await model.findById(id).lean();
    return success({ item });
  }

  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  const query = buildQuery(resource, searchParams);
  const sort = getModuleConfig(resource)?.sort || { createdAt: -1 };

  const [items, total] = await Promise.all([
    model.find(query).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    model.countDocuments(query),
  ]);

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
  const transactionalResources = ["fuel-purchases", "fuel-sales", "payments", "stock-adjustments"];
  let record;
  const session = await mongoose.startSession();
  try {
    if (transactionalResources.includes(resource)) {
      await session.withTransaction(async () => {
        record = await createRecord(resource, body, user, session);
      });
    } else {
      record = await createRecord(resource, body, user, null);
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
  const transactionalResources = ["fuel-purchases", "fuel-sales", "payments", "stock-adjustments"];

  const session = await mongoose.startSession();
  let record;
  try {
    if (transactionalResources.includes(resource)) {
      await session.withTransaction(async () => {
        record = await updateRecord(resource, id, body, session);
      });
    } else {
      record = await updateRecord(resource, id, body, null);
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

  await model.findByIdAndDelete(id);
  return success({ deleted: true });
}