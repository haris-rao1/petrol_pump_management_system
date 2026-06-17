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
import Product from "@/models/Product";
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

async function findSaleCustomer(customerValue, pumpId, session) {
  if (!customerValue) return null;
  const query = parseObjectId(customerValue)
    ? { _id: customerValue, pumpId: pumpId || null }
    : { name: customerValue, pumpId: pumpId || null };
  return Customer.findOne(query).session(session || null);
}

async function syncFuelSalePayment(existingSale, body, session, pumpId) {
  if (!existingSale) return;

  const paymentModel = resourceModelMap["payments"];
  const requestedAmount = body.amountReceived !== undefined ? Number(body.amountReceived) : undefined;
  const newAmount = requestedAmount !== undefined && Number.isFinite(requestedAmount)
    ? Math.max(requestedAmount, 0)
    : undefined;
  const oldAmount = Number(existingSale.amountReceived || 0);
  const shouldSync = newAmount !== undefined || body.customer !== undefined || body.note !== undefined || body.method !== undefined || body.date !== undefined;
  if (!shouldSync) return;

  const payment = await paymentModel.findOne({ saleId: existingSale._id, pumpId: pumpId || null, type: "receive" }).session(session || null);
  const targetCustomer = await findSaleCustomer(body.customer !== undefined ? body.customer : existingSale.customer, pumpId, session);
  const oldPaymentCustomer = payment?.customer ? await Customer.findById(payment.customer).session(session || null) : null;
  const customerChanged = oldPaymentCustomer && targetCustomer && String(oldPaymentCustomer._id) !== String(targetCustomer._id);

  if (payment) {
    const oldPaymentAmount = Number(payment.amount || 0);
    const amountDelta = newAmount !== undefined ? newAmount - oldPaymentAmount : 0;

    if (newAmount !== undefined && newAmount > 0) {
      if (targetCustomer) payment.customer = targetCustomer._id;
      if (body.method) payment.method = body.method;
      if (body.note) payment.note = body.note;
      if (body.date) payment.date = new Date(body.date);
      payment.amount = newAmount;
      await payment.save({ session });

      if (customerChanged) {
        oldPaymentCustomer.pendingBalance = Number(oldPaymentCustomer.pendingBalance || 0) + oldPaymentAmount;
        await oldPaymentCustomer.save({ session });
        targetCustomer.pendingBalance = Number(targetCustomer.pendingBalance || 0) - newAmount;
        await targetCustomer.save({ session });
      } else if (amountDelta !== 0) {
        const adjustCustomer = targetCustomer || oldPaymentCustomer;
        if (adjustCustomer) {
          adjustCustomer.pendingBalance = Number(adjustCustomer.pendingBalance || 0) - amountDelta;
          await adjustCustomer.save({ session });
        }
      }
    } else if (newAmount === 0) {
      const paymentCustomer = oldPaymentCustomer || targetCustomer;
      const restoreAmount = Number(payment.amount || 0);
      await payment.deleteOne({ session });
      if (paymentCustomer) {
        paymentCustomer.pendingBalance = Number(paymentCustomer.pendingBalance || 0) + restoreAmount;
        await paymentCustomer.save({ session });
      }
    } else {
      if (body.note || body.method || body.date || customerChanged) {
        if (body.method) payment.method = body.method;
        if (body.note) payment.note = body.note;
        if (body.date) payment.date = new Date(body.date);
        if (targetCustomer) payment.customer = targetCustomer._id;
        await payment.save({ session });
      }
    }
  } else if (newAmount !== undefined && newAmount > 0) {
    const paymentData = {
      customer: targetCustomer?._id,
      saleId: existingSale._id,
      amount: newAmount,
      method: body.method || "Cash",
      type: "receive",
      note: body.note || `Payment for sale ${existingSale._id}`,
      date: body.date ? new Date(body.date) : new Date(existingSale.date || Date.now()),
      createdBy: existingSale.createdBy,
      pumpId: pumpId || null,
    };
    const createdPayment = new paymentModel(paymentData);
    await createdPayment.save({ session });
    if (targetCustomer) {
      targetCustomer.pendingBalance = Number(targetCustomer.pendingBalance || 0) - newAmount;
      await targetCustomer.save({ session });
    }
  }
}

function getFuelSaleTotals(body) {
  const openingMeterReading = body.openingMeterReading !== undefined && body.openingMeterReading !== null
    ? Number(body.openingMeterReading)
    : 0;
  const closingMeterReading = body.closingMeterReading !== undefined && body.closingMeterReading !== null
    ? Number(body.closingMeterReading)
    : openingMeterReading;
  const soldLiters = calculateSoldLiters(openingMeterReading, closingMeterReading);
  const pricePerLiter = soldLiters === 0
    ? 0
    : ensureFiniteNumber(body.fuelPricePerLiter, "fuelPricePerLiter");
  const openingBalance = Number(body.openingBalance || 0);
  const totalSaleAmount = soldLiters * pricePerLiter + openingBalance;
  const amountReceivedValue = Number(body.amountReceived);
  const amountReceived = Number.isFinite(amountReceivedValue) ? Math.max(amountReceivedValue, 0) : 0;
  const pendingAmount = Math.max(totalSaleAmount - amountReceived, 0);

  return {
    soldLiters,
    fuelPricePerLiter: pricePerLiter,
    totalSaleAmount,
    amountReceived,
    pendingAmount,
  };
}

async function refreshNozzleReading(nozzleId, session, pumpId) {
  if (!nozzleId) {
    return null;
  }

  const fuelSaleModel = resourceModelMap["fuel-sales"];
  const latestSaleQuery = fuelSaleModel.findOne({ nozzle: nozzleId });
  if (pumpId) {
    latestSaleQuery.where({ pumpId });
  }
  latestSaleQuery.sort({ closingMeterReading: -1 });
  if (session) {
    latestSaleQuery.session(session);
  }

  const latest = await latestSaleQuery.lean();
  const meterReading = latest ? latest.closingMeterReading : 0;
  return updateNozzleReading(nozzleId, meterReading, session, pumpId);
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
        // Special handling for date range filters
        if (filter.name === "startDate" || filter.name === "endDate") {
          // we'll add date range after loop
          continue;
        }
        query[filter.name] = value;
      }
    }
  }

  // handle explicit date range query params (startDate/endDate)
  const start = searchParams.get("startDate");
  const end = searchParams.get("endDate");
  if (start || end) {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    const dateQuery = {};
    if (startDate && !Number.isNaN(startDate.getTime())) dateQuery.$gte = startDate;
    if (endDate && !Number.isNaN(endDate.getTime())) dateQuery.$lte = endDate;
    if (Object.keys(dateQuery).length) {
      query.date = dateQuery;
    }
  }

  // allow filtering by customer id for resources like payments
  const customerParam = searchParams.get("customer");
  if (customerParam) {
    const cid = parseObjectId(customerParam) || customerParam;
    if (cid) query.customer = cid;
  }

  return query;
}

const pumpScopedResources = new Set(["fuel-purchases", "fuel-sales", "tanks", "nozzles", "expenses", "customers", "payments", "employees", "stock-adjustments"]);

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
      const doc = new model({ ...body, password: hashedPassword, pumpId: pumpForDoc });
      await doc.save(session ? { session } : {});
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
      const amountReceivedValue = Number(body.amountReceived);
      const amountReceived = Number.isFinite(amountReceivedValue) ? Math.max(amountReceivedValue, 0) : 0;
      const openingBalance = Number(body.openingBalance || 0);

      if (Array.isArray(body.salesItems) && body.salesItems.length) {
        let totalSoldLiters = 0;
        let totalSaleAmount = 0;
        let totalWeightedPrice = 0;
        let firstItem = null;
        const salesItems = [];
        const fuelTypes = new Set();

        for (const item of body.salesItems) {
          const itemBody = {
            ...item,
            date: body.date || item.date,
          };
          const fuelSaleTotals = getFuelSaleTotals(itemBody);
          const { soldLiters, fuelPricePerLiter, totalSaleAmount: itemTotal } = fuelSaleTotals;

          if (soldLiters > 0 && itemBody.fuelType) {
            await decreaseTankStock(itemBody.fuelType, soldLiters, session, pumpId);
          }

          const nozzleId = parseObjectId(itemBody.nozzle);
          if (nozzleId) {
            await updateNozzleReading(nozzleId, itemBody.closingMeterReading, session, pumpId);
          }

          salesItems.push({
            nozzle: nozzleId || undefined,
            nozzleName: itemBody.nozzleName || itemBody.nozzle || "",
            machineName: itemBody.machineName || "",
            fuelType: itemBody.fuelType || "",
            openingMeterReading: itemBody.openingMeterReading,
            closingMeterReading: itemBody.closingMeterReading,
            soldLiters,
            fuelPricePerLiter,
            totalSaleAmount: itemTotal,
          });

          totalSoldLiters += soldLiters;
          totalSaleAmount += itemTotal;
          totalWeightedPrice += soldLiters * fuelPricePerLiter;
          if (itemBody.fuelType) {
            fuelTypes.add(itemBody.fuelType);
          }
          if (!firstItem) {
            firstItem = itemBody;
          }
        }

        const averagePrice = totalSoldLiters > 0 ? totalWeightedPrice / totalSoldLiters : firstItem?.fuelPricePerLiter || 0;
        const summaryFuelType = fuelTypes.size === 1 ? [...fuelTypes][0] : fuelTypes.size === 0 ? "" : "Mixed";
        const recordTotalSaleAmount = totalSaleAmount + openingBalance;
        const recordData = {
          ...body,
          salesItems,
          fuelPricePerLiter: averagePrice,
          nozzleName: firstItem?.nozzleName || firstItem?.nozzle || "Batch",
          machineName: firstItem?.machineName || "",
          fuelType: summaryFuelType,
          openingMeterReading: firstItem?.openingMeterReading || 0,
          closingMeterReading: firstItem?.closingMeterReading || 0,
          soldLiters: totalSoldLiters,
          openingBalance: openingBalance,
          totalSaleAmount: recordTotalSaleAmount,
          amountReceived,
          pendingAmount: Math.max(recordTotalSaleAmount - amountReceived, 0),
          date: new Date(body.date),
          createdBy: user._id,
          pumpId: pumpId || null,
        };

        const firstNozzleId = parseObjectId(firstItem?.nozzle);
        if (firstNozzleId) {
          recordData.nozzle = firstNozzleId;
        } else {
          delete recordData.nozzle;
        }

        const record = new model(recordData);
        await record.save(session ? { session } : {});
        // create payment record for received amount (if any)
        try {
          const amt = Number(recordData.amountReceived || 0);
          if (amt > 0) {
            const paymentModel = resourceModelMap["payments"];
            let paymentCustomer = null;
            if (body.customer) {
              const customerQuery = parseObjectId(body.customer) ? { _id: body.customer, pumpId: pumpId || null } : { name: body.customer, pumpId: pumpId || null };
              paymentCustomer = await Customer.findOne(customerQuery).session(session || null);
            }

            const payment = new paymentModel({
              customer: paymentCustomer?._id,
              saleId: record._id,
              amount: amt,
              method: body.method || "Cash",
              type: "receive",
              note: body.note || `Payment for sale ${record._id}`,
              date: record.date || new Date(body.date),
              createdBy: user._id,
              pumpId: pumpId || null,
            });
            await payment.save(session ? { session } : {});

            if (paymentCustomer) {
              paymentCustomer.pendingBalance = Number(paymentCustomer.pendingBalance || 0) - amt;
              await paymentCustomer.save(session ? { session } : {});
            }
          }
        } catch (e) {
          console.error('Failed to create payment for sale:', e);
        }

        return record;
      }

      // If only an opening meter reading is provided (opening balance),
      // treat it as a non-sale balance: set closing equal to opening so
      // calculations produce zero sold liters and no stock change.
      if (body.openingMeterReading !== undefined && (body.closingMeterReading === undefined || body.closingMeterReading === null)) {
        body.closingMeterReading = body.openingMeterReading;
      }

      const fuelSaleTotals = getFuelSaleTotals(body);
      const { soldLiters, fuelPricePerLiter, totalSaleAmount, pendingAmount } = fuelSaleTotals;
      if (soldLiters > 0 && body.fuelType) {
        await decreaseTankStock(body.fuelType, soldLiters, session, pumpId);
      }

      const nozzleName = body.nozzleName || body.nozzle || "";
      const recordData = {
        ...body,
        fuelPricePerLiter,
        nozzleName,
        soldLiters,
        openingBalance: openingBalance,
        totalSaleAmount,
        amountReceived,
        pendingAmount,
        date: new Date(body.date),
        createdBy: user._id,
        pumpId: pumpId || null,
      };

      const nozzleId = parseObjectId(body.nozzle);
      if (nozzleId) {
        recordData.nozzle = nozzleId;
      } else {
        delete recordData.nozzle;
      }

      const record = new model(recordData);
      await record.save(session ? { session } : {});

      // create payment record for received amount (if any)
      try {
        const amt = Number(recordData.amountReceived || 0);
        if (amt > 0) {
          const paymentModel = resourceModelMap["payments"];
          let paymentCustomer = null;
          if (body.customer) {
            const customerQuery = parseObjectId(body.customer) ? { _id: body.customer, pumpId: pumpId || null } : { name: body.customer, pumpId: pumpId || null };
            paymentCustomer = await Customer.findOne(customerQuery).session(session || null);
          }

          const payment = new paymentModel({
            customer: paymentCustomer?._id,
            saleId: record._id,
            amount: amt,
            method: body.method || "Cash",
            type: "receive",
            note: body.note || `Payment for sale ${record._id}`,
            date: record.date || new Date(body.date),
            createdBy: user._id,
            pumpId: pumpId || null,
          });
          await payment.save(session ? { session } : {});

          if (paymentCustomer) {
            paymentCustomer.pendingBalance = Number(paymentCustomer.pendingBalance || 0) - amt;
            await paymentCustomer.save(session ? { session } : {});
          }
        }
      } catch (e) {
        console.error('Failed to create payment for sale:', e);
      }

      if (nozzleId) {
        await updateNozzleReading(nozzleId, body.closingMeterReading, session, pumpId);
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
      const paymentType = body.type === "credit" ? "credit" : "receive";

      const payment = new model({
        customer: customer?._id,
        saleId: parseObjectId(body.saleId) || undefined,
        amount: ensureFiniteNumber(body.amount, "amount"),
        method: body.method,
        type: paymentType,
        note: body.note,
        date: new Date(body.date),
        createdBy: user._id,
        pumpId: pumpId || null,
      });
      await payment.save(session ? { session } : {});

      if (customer) {
        const amt = Number(payment.amount || 0);
        if (paymentType === "receive") {
          customer.pendingBalance = Number(customer.pendingBalance || 0) - amt;
        } else {
          customer.pendingBalance = Number(customer.pendingBalance || 0) + amt;
        }
        await customer.save(session ? { session } : {});
      }

      return payment;
    }
    case "tanks":
      {
        const tankFilter = {
          pumpId: pumpId || null,
          fuelType: body.fuelType,
        };

        const tankUpdate = {
          ...body,
          currentStock: Number(body.currentStock),
          capacityLiters: Number(body.capacityLiters),
          lowStockThreshold: Number(body.lowStockThreshold),
          pumpId: pumpId || null,
        };

        const doc = await model.findOneAndUpdate(
          tankFilter,
          tankUpdate,
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
            ...(session ? { session } : {}),
          },
        );

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
  if (resource === "fuel-purchases") {
    // Get existing purchase record to compare quantities and fuel type
    const filter = pumpScopedResources.has(resource) && pumpId ? { _id: id, pumpId } : { _id: id };
    const existingPurchase = await model.findOne(filter).lean();
    
    if (existingPurchase) {
      const oldQuantity = Number(existingPurchase.quantityLiters || 0);
      const newQuantity = ensureFiniteNumber(body.quantityLiters, "quantityLiters");
      const oldFuelType = existingPurchase.fuelType;
      const newFuelType = body.fuelType || oldFuelType;
      
      // If fuel type changed, remove old fuel type stock and add new fuel type stock
      if (oldFuelType !== newFuelType) {
        // Remove quantity from old fuel type
        await decreaseTankStock(oldFuelType, oldQuantity, session, pumpId);
        // Add quantity to new fuel type
        await increaseTankStock(newFuelType, newQuantity, session, pumpId);
      } else {
        // Same fuel type, just adjust the difference
        const quantityDifference = newQuantity - oldQuantity;
        
        if (quantityDifference !== 0) {
          if (quantityDifference > 0) {
            // New quantity is greater, add the difference to stock
            await increaseTankStock(newFuelType, quantityDifference, session, pumpId);
          } else {
            // New quantity is less, remove the difference from stock
            await decreaseTankStock(newFuelType, Math.abs(quantityDifference), session, pumpId);
          }
        }
      }
    }
    
    // Calculate total amount
    const qty = ensureFiniteNumber(body.quantityLiters, "quantityLiters");
    const price = ensureFiniteNumber(body.pricePerLiter, "pricePerLiter");
    body.totalAmount = qty * price;
  }
  if (resource === "fuel-sales") {
    // Get existing sale record to reverse old stock adjustments
    const filter = pumpScopedResources.has(resource) && pumpId ? { _id: id, pumpId } : { _id: id };
    const existingSale = await model.findOne(filter).lean();
    
    // First, reverse the old stock changes
    if (existingSale) {
      if (Array.isArray(existingSale?.salesItems) && existingSale.salesItems.length) {
        for (const item of existingSale.salesItems) {
          if (item.fuelType && Number(item.soldLiters || 0) > 0) {
            await increaseTankStock(item.fuelType, Number(item.soldLiters || 0), session, pumpId);
          }
        }
      } else if (existingSale.fuelType && Number(existingSale.soldLiters || 0) > 0) {
        await increaseTankStock(existingSale.fuelType, Number(existingSale.soldLiters || 0), session, pumpId);
      }
    }
    
    // Now process new sales items and apply new stock changes
    if (Array.isArray(body.salesItems) && body.salesItems.length) {
      let totalSoldLiters = 0;
      let totalSaleAmount = 0;
      let totalWeightedPrice = 0;
      let firstItem = null;
      const fuelTypes = new Set();
      const amountReceivedValue = Number(body.amountReceived);
      const amountReceived = Number.isFinite(amountReceivedValue) ? Math.max(amountReceivedValue, 0) : 0;
      const openingBalance = Number(body.openingBalance || 0);

      for (const item of body.salesItems) {
        const fuelSaleTotals = getFuelSaleTotals(item);
        const { soldLiters, fuelPricePerLiter, totalSaleAmount: itemTotal } = fuelSaleTotals;

        // Decrease stock for new sale quantities only when the fuel type is present.
        if (soldLiters > 0 && item.fuelType) {
          await decreaseTankStock(item.fuelType, soldLiters, session, pumpId);
        }

        totalSoldLiters += soldLiters;
        totalSaleAmount += itemTotal;
        totalWeightedPrice += soldLiters * fuelPricePerLiter;
        if (item.fuelType) {
          fuelTypes.add(item.fuelType);
        }
        if (!firstItem) {
          firstItem = item;
        }
      }

      body.soldLiters = totalSoldLiters;
      body.fuelPricePerLiter = totalSoldLiters > 0 ? totalWeightedPrice / totalSoldLiters : firstItem?.fuelPricePerLiter || 0;
      body.openingBalance = openingBalance;
      body.totalSaleAmount = totalSaleAmount + openingBalance;
      body.amountReceived = amountReceived;
      body.pendingAmount = Math.max(body.totalSaleAmount - amountReceived, 0);
      body.nozzleName = firstItem?.nozzleName || firstItem?.nozzle || "Batch";
      body.machineName = firstItem?.machineName || "";
      body.fuelType = fuelTypes.size === 1 ? [...fuelTypes][0] : fuelTypes.size === 0 ? "" : "Mixed";
      body.openingMeterReading = firstItem?.openingMeterReading || 0;
      body.closingMeterReading = firstItem?.closingMeterReading || 0;
    } else {
      const fuelSaleTotals = getFuelSaleTotals(body);
      const { soldLiters, fuelPricePerLiter, totalSaleAmount, pendingAmount } = fuelSaleTotals;
      
      // Decrease stock for new sale quantity
      if (soldLiters > 0 && body.fuelType) {
        await decreaseTankStock(body.fuelType, soldLiters, session, pumpId);
      }
      
      body.soldLiters = fuelSaleTotals.soldLiters;
      body.fuelPricePerLiter = fuelSaleTotals.fuelPricePerLiter;
      body.openingBalance = Number(body.openingBalance || 0);
      body.totalSaleAmount = fuelSaleTotals.totalSaleAmount;
      body.amountReceived = fuelSaleTotals.amountReceived;
      body.pendingAmount = fuelSaleTotals.pendingAmount;
    }
  }
  const options = { returnDocument: 'after' };
  if (session) options.session = session;
  const filter = pumpScopedResources.has(resource) && pumpId ? { _id: id, pumpId } : { _id: id };
  let existingSale = null;
  if (resource === "fuel-sales") {
    existingSale = await model.findOne(filter).lean();
  }
  // Normalize nozzle fields to avoid Mongoose casting errors (empty string -> remove)
  if (Array.isArray(body?.salesItems)) {
    body.salesItems = body.salesItems.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const copy = { ...item };
      if (copy.nozzle !== undefined) {
        const nid = parseObjectId(copy.nozzle);
        if (nid) copy.nozzle = nid;
        else delete copy.nozzle;
      }
      return copy;
    });
  }
  if (body && body.nozzle !== undefined) {
    const nid = parseObjectId(body.nozzle);
    if (nid) body.nozzle = nid;
    else delete body.nozzle;
  }
  const updated = await model.findOneAndUpdate(filter, body, options);

  if (resource === "fuel-sales") {
    const oldNozzleId = parseObjectId(existingSale?.nozzle?.toString?.());
    const newNozzleId = parseObjectId(body.nozzle);
    if (newNozzleId) {
      await updateNozzleReading(newNozzleId, body.closingMeterReading, session, pumpId);
    }
    if (oldNozzleId && (!newNozzleId || String(oldNozzleId) !== String(newNozzleId))) {
      await refreshNozzleReading(oldNozzleId, session, pumpId);
    }
    await syncFuelSalePayment(existingSale, body, session, pumpId);
  }

  if (resource === "users") {
    if (updated?.password) {
      delete updated.password;
    }
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

  if (resource === "payments") {
    const customerIds = [...new Set(items.map((item) => {
      if (!item) return null;
      if (item.customer && typeof item.customer === 'object' && item.customer._id) return String(item.customer._id);
      if (item.customer) return String(item.customer);
      return null;
    }).filter(Boolean))];

    if (customerIds.length) {
      const customers = await Customer.find({ _id: { $in: customerIds } }).select("name vehicleNumber").lean();
      const customerMap = new Map(customers.map((c) => [String(c._id), c]));
      for (const item of items) {
        const cid = item.customer?.toString?.() || (item.customer && item.customer._id ? String(item.customer._id) : null);
        if (cid && customerMap.has(cid)) {
          const cust = customerMap.get(cid);
          item.customerName = cust.name;
          // keep customer populated with object for convenience
          item.customer = cust;
        } else if (!item.customerName) {
          item.customerName = item.customer || null;
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
  } catch (error) {
    console.error("POST error:", error);
    return failure(error?.message || "Unable to create record", 500);
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
  } catch (error) {
    console.error("PATCH error:", error);
    return failure(error?.message || "Unable to update record", 500);
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

  let deletedRecord = null;
    if (resource === "fuel-sales" || resource === "customers" || resource === "fuel-purchases") {
    deletedRecord = await model.findOne(filter).lean();
  }

  const transactionalResources = ["fuel-purchases", "fuel-sales", "payments", "stock-adjustments"];
  const session = await mongoose.startSession();
  
  try {
    if (transactionalResources.includes(resource)) {
      await session.withTransaction(async () => {
        await model.findOneAndDelete(filter).session(session);
        
        if (resource === "customers" && deletedRecord) {
          // remove payment history belonging to this customer
          const paymentModel = resourceModelMap["payments"];
          await paymentModel.deleteMany({ customer: deletedRecord._id, pumpId: pumpId || null }).session(session);
        }

        if (resource === "fuel-purchases" && deletedRecord) {
          // remove stock added by this purchase
          if (deletedRecord.fuelType && Number(deletedRecord.quantityLiters || 0) > 0) {
            await decreaseTankStock(deletedRecord.fuelType, Number(deletedRecord.quantityLiters || 0), session, pumpId);
          }
        }

        if (resource === "fuel-sales" && deletedRecord) {
          const paymentModel = resourceModelMap["payments"];
          const relatedPayments = await paymentModel.find({ saleId: deletedRecord._id, pumpId: pumpId || null }).session(session).lean();

          if (relatedPayments.length) {
            const customerIds = [...new Set(relatedPayments.map((payment) => payment.customer?.toString?.()).filter(Boolean))];
            const customers = customerIds.length
              ? await Customer.find({ _id: { $in: customerIds }, pumpId: pumpId || null }).session(session)
              : [];
            const customerMap = new Map(customers.map((cust) => [String(cust._id), cust]));

            for (const payment of relatedPayments) {
              const customer = payment.customer ? customerMap.get(String(payment.customer)) : null;
              if (!customer) continue;
              const amt = Number(payment.amount || 0);
              if (payment.type === "receive") {
                customer.pendingBalance = Number(customer.pendingBalance || 0) + amt;
              } else if (payment.type === "credit") {
                customer.pendingBalance = Number(customer.pendingBalance || 0) - amt;
              }
            }

            await Promise.all(customers.map((cust) => cust.save({ session })));
            await paymentModel.deleteMany({ saleId: deletedRecord._id, pumpId: pumpId || null }).session(session);
          }

          if (Array.isArray(deletedRecord?.salesItems) && deletedRecord.salesItems.length) {
            for (const item of deletedRecord.salesItems) {
              if (item.fuelType && Number(item.soldLiters || 0) > 0) {
                await increaseTankStock(item.fuelType, Number(item.soldLiters || 0), session, pumpId);
              }
            }
          } else if (deletedRecord.fuelType && Number(deletedRecord.soldLiters || 0) > 0) {
            await increaseTankStock(deletedRecord.fuelType, Number(deletedRecord.soldLiters || 0), session, pumpId);
          }

          const nozzleIds = new Set();
          if (Array.isArray(deletedRecord?.salesItems)) {
            for (const item of deletedRecord.salesItems) {
              const nozzleId = parseObjectId(item?.nozzle?.toString?.());
              if (nozzleId) nozzleIds.add(String(nozzleId));
            }
          }
          const topLevelNozzleId = parseObjectId(deletedRecord?.nozzle?.toString?.());
          if (topLevelNozzleId) {
            nozzleIds.add(String(topLevelNozzleId));
          }

          await Promise.all(
            [...nozzleIds].map((id) => refreshNozzleReading(parseObjectId(id), session, pumpId)),
          );
        }
      });
    } else {
      await model.findOneAndDelete(filter);

      if (resource === "customers" && deletedRecord) {
        // remove payment history belonging to this customer
        const paymentModel = resourceModelMap["payments"];
        await paymentModel.deleteMany({ customer: deletedRecord._id, pumpId: pumpId || null });
      }
    }
  } catch (error) {
    console.error("DELETE error:", error);
    session.endSession();
    return failure(error?.message || "Unable to delete record", 500);
  } finally {
    session.endSession();
  }

  return success({ deleted: true });
}