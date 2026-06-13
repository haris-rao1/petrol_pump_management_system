import { z } from "zod";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, ROLES, STATUS_OPTIONS } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const sharedDate = z.string().min(1, "Date is required");

const optionalNumber = (schema) =>
  z.preprocess((value) => (value === "" || value === null ? undefined : value), schema).optional();

const normalizeSalesItems = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (item && typeof item === "object" ? item : {}))
    .filter((item) => {
      return [
        "nozzleName",
        "nozzle",
        "fuelType",
        "openingMeterReading",
        "closingMeterReading",
        "fuelPricePerLiter",
      ].some((key) => item[key] !== undefined && item[key] !== null && item[key] !== "" && item[key] !== 0);
    });
};

export const moduleSchemas = {
  pumps: z.object({
    name: z.string().min(2, "Pump name is required"),
    code: z.string().min(2, "Pump code is required"),
    address: z.string().optional().default(""),
    status: z.enum(["Active", "Inactive"]),
    notes: z.string().optional().default(""),
  }),
  "fuel-purchases": z.object({
    fuelType: z.string().min(2, "Fuel type is required"),
    quantityLiters: z.coerce.number().positive("Quantity must be greater than zero"),
    pricePerLiter: z.coerce.number().positive("Price must be greater than zero"),
    supplierName: z.string().min(2, "Supplier name is required"),
    invoiceNumber: z.string().min(2, "Invoice number is required"),
    date: sharedDate,
    notes: z.string().optional().default(""),
  }),
  "fuel-sales": z.object({
    salesItems: z.preprocess(normalizeSalesItems, z.array(z.object({
      nozzleName: z.string().min(2, "Nozzle name is required"),
      machineName: z.string().optional().default(""),
      nozzle: z.string().optional().default(""),
      fuelType: z.string().min(2, "Product is required"),
      openingMeterReading: optionalNumber(z.coerce.number().nonnegative("Opening reading must be zero or greater")),
      closingMeterReading: optionalNumber(z.coerce.number().nonnegative("Closing reading must be zero or greater")),
      fuelPricePerLiter: optionalNumber(z.coerce.number().nonnegative("Price must be zero or greater")),
    }))).optional(),
    nozzleName: z.string().min(2, "Nozzle name is required").optional(),
    machineName: z.string().optional().default(""),
    nozzle: z.string().optional().default(""),
    fuelType: z.string().min(2, "Product is required").optional(),
    openingMeterReading: optionalNumber(z.coerce.number().nonnegative("Opening reading must be zero or greater")),
    closingMeterReading: optionalNumber(z.coerce.number().nonnegative("Closing reading must be zero or greater")),
    fuelPricePerLiter: optionalNumber(z.coerce.number().nonnegative("Price must be zero or greater")),
    openingBalance: z.coerce.number().nonnegative("Opening balance cannot be negative").optional().default(0),
    amountReceived: z.coerce.number().nonnegative().default(0),
    totalSaleAmount: z.coerce.number().nonnegative().optional().default(0),
    pendingAmount: z.coerce.number().nonnegative().optional().default(0),
    date: sharedDate,
    notes: z.string().optional().default(""),
  }).superRefine((values, ctx) => {
    const hasSalesItems = Array.isArray(values.salesItems) && values.salesItems.length > 0;
    const hasOpeningBalance = Number(values.openingBalance || 0) > 0;
    const hasSaleReading = values.nozzleName !== undefined || values.openingMeterReading !== undefined;

    if (!hasSalesItems && !hasOpeningBalance && !hasSaleReading) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nozzleName"],
        message: "At least one sale item, opening balance, or opening meter reading is required",
      });
    }
  }),
  tanks: z.object({
    fuelType: z.string().min(2, "Fuel type is required"),
    currentStock: z.coerce.number().nonnegative("Current stock cannot be negative"),
    capacityLiters: z.coerce.number().nonnegative("Capacity cannot be negative").default(0),
    lowStockThreshold: z.coerce.number().nonnegative().default(5000),
    notes: z.string().optional().default(""),
  }),
  nozzles: z.object({
    nozzleName: z.coerce.string().min(1, "Nozzle name is required"),
    machineName: z.coerce.string().min(1, "Machine name is required"),
    fuelType: z.string().min(2, "Fuel type is required"),
    currentMeterReading: z.coerce.number().nonnegative("Meter reading cannot be negative"),
    status: z.enum(STATUS_OPTIONS),
  }),
  
  expenses: z.object({
    expenseTitle: z.string().min(2, "Expense title is required"),
    category: z.enum(EXPENSE_CATEGORIES),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    description: z.string().optional().default(""),
    date: sharedDate,
  }),
  customers: z.object({
    name: z.string().min(2, "Customer name is required"),
    phone: z.string().min(7, "Phone number is required"),
    address: z.string().optional().default(""),
    vehicleNumber: z.string().optional().default(""),
    companyName: z.string().optional().default(""),
    pendingBalance: z.coerce.number().default(0),
  }),
  payments: z.object({
    customer: z.string().min(2, "Customer is required"),
    vehicleNumber: z.string().optional().default(""),
    amount: z.coerce.number().positive("Payment amount must be greater than zero"),
    method: z.enum(PAYMENT_METHODS),
    note: z.string().optional().default(""),
    date: sharedDate,
  }),
  employees: z.object({
    name: z.string().min(2, "Employee name is required"),
    cnic: z.string().min(5, "CNIC is required"),
    phone: z.string().min(7, "Phone number is required"),
    role: z.enum([ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATOR]),
    salary: z.coerce.number().nonnegative().default(0),
    joiningDate: sharedDate,
    status: z.enum(STATUS_OPTIONS),
  }),
  "stock-adjustments": z.object({
    fuelType: z.string().min(2, "Fuel type is required"),
    adjustmentQuantity: z.coerce.number(),
    reason: z.string().min(2, "Reason is required"),
    date: sharedDate,
  }),
  products: z.object({
    name: z.string().min(2, "Product name is required"),
    code: z.string().optional().default(""),
    status: z.enum(["Active", "Inactive"]),
    notes: z.string().optional().default(""),
  }),
  users: z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum([ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATOR]),
    status: z.enum(STATUS_OPTIONS),
    pumpId: z.string().optional().default(""),
  }).superRefine((values, ctx) => {
    if (values.role !== ROLES.ADMIN && !values.pumpId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pumpId"],
        message: "Pump is required for manager and operator accounts",
      });
    }
  }),
};

export const resourceFormDefaults = {
  pumps: {
    name: "",
    code: "",
    address: "",
    status: "Active",
    notes: "",
  },
  "fuel-purchases": {
    fuelType: "Petrol",
    quantityLiters: 0,
    pricePerLiter: 0,
    supplierName: "",
    invoiceNumber: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  },
  "fuel-sales": {
    salesItems: [
      {
        nozzleName: "",
        machineName: "",
        nozzle: "",
        fuelType: "",
        openingMeterReading: 0,
        closingMeterReading: 0,
        fuelPricePerLiter: 0,
      },
    ],
    nozzleName: undefined,
    machineName: undefined,
    nozzle: undefined,
    fuelType: undefined,
    openingMeterReading: undefined,
    closingMeterReading: undefined,
    fuelPricePerLiter: undefined,
    openingBalance: 0,
    amountReceived: 0,
    totalSaleAmount: 0,
    pendingAmount: 0,
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  },
  tanks: {
    fuelType: "Petrol",
    currentStock: 0,
    capacityLiters: 0,
    lowStockThreshold: 5000,
    notes: "",
  },
  nozzles: {
    nozzleName: "",
    machineName: "",
    fuelType: "Petrol",
    currentMeterReading: 0,
    status: "Active",
  },
  
  expenses: {
    expenseTitle: "",
    category: "Miscellaneous",
    amount: 0,
    description: "",
    date: new Date().toISOString().slice(0, 10),
  },
  customers: {
    name: "",
    phone: "",
    address: "",
    vehicleNumber: "",
    companyName: "",
    pendingBalance: 0,
  },
  payments: {
    customer: "",
    vehicleNumber: "",
    amount: 0,
    method: "Cash",
    note: "",
    date: new Date().toISOString().slice(0, 10),
  },
  employees: {
    name: "",
    cnic: "",
    phone: "",
    role: "Operator",
    salary: 0,
    joiningDate: new Date().toISOString().slice(0, 10),
    status: "Active",
  },
  "stock-adjustments": {
    fuelType: "Petrol",
    adjustmentQuantity: 0,
    reason: "",
    date: new Date().toISOString().slice(0, 10),
  },
  products: {
    name: "Petrol",
    code: "",
    status: "Active",
    notes: "",
  },
  users: {
    name: "",
    email: "",
    password: "",
    role: "Operator",
    status: "Active",
    pumpId: "",
  },
};