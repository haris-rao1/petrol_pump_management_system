import { EXPENSE_CATEGORIES, FUEL_TYPES, PAYMENT_METHODS, ROLE_OPTIONS, STATUS_OPTIONS } from "@/lib/constants";
import { formatCurrency, formatDate, formatNumber, formatRawNumber } from "@/utils/format";

const dateField = { type: "date" };

function getFuelSaleTotalAmount(record = {}) {
  const soldLiters = Number(record.soldLiters ?? Number(record.closingMeterReading || 0) - Number(record.openingMeterReading || 0));
  const pricePerLiter = Number(record.fuelPricePerLiter || 0);
  return soldLiters * pricePerLiter;
}

function getFuelSalePendingAmount(record = {}) {
  const totalAmount = Number(record.totalSaleAmount ?? getFuelSaleTotalAmount(record));
  const amountReceived = Number(record.amountReceived || 0);
  return Math.max(totalAmount - amountReceived, 0);
}

export const moduleConfigs = {
  pumps: {
    title: "Pump Management",
    description: "Create and manage each petrol pump separately.",
    endpoint: "pumps",
    searchFields: ["name", "code", "address"],
    filters: [
      { name: "status", label: "Status", type: "select", options: ["", "Active", "Inactive"] },
    ],
    fields: [
      { name: "name", label: "Pump Name", type: "text" },
      { name: "code", label: "Pump Code", type: "text" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "name", label: "Pump Name" },
      { key: "code", label: "Code" },
      { key: "status", label: "Status" },
      { key: "address", label: "Address" },
    ],
  },
  "fuel-purchases": {
    title: "Fuel Purchase Management",
    description: "Record supplier deliveries and update tank stock automatically.",
    endpoint: "fuel-purchases",
    searchFields: ["supplierName", "invoiceNumber", "fuelType"],
    filters: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
    ],
    fields: [
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
      { name: "quantityLiters", label: "Quantity (Liters)", type: "number" },
      { name: "pricePerLiter", label: "Price Per Liter", type: "number" },
      { name: "supplierName", label: "Supplier Name", type: "text" },
      { name: "invoiceNumber", label: "Invoice Number", type: "text" },
      { name: "date", label: "Date", ...dateField },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "date", label: "Date", formatter: formatDate },
      { key: "fuelType", label: "Fuel Type" },
      { key: "quantityLiters", label: "Liters", formatter: formatRawNumber },
      { key: "pricePerLiter", label: "Rate", formatter: formatCurrency },
      { key: "totalAmount", label: "Total", formatter: formatCurrency },
      { key: "supplierName", label: "Supplier" },
      { key: "invoiceNumber", label: "Invoice" },
    ],
  },
  "fuel-sales": {
    title: "Fuel Sales Management",
    description: "Enter manual meter readings and calculate sold liters automatically.",
    endpoint: "fuel-sales",
    searchFields: ["fuelType"],
    filters: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
    ],
    fields: [
      { name: "nozzleName", label: "Nozzle Name", type: "select", optionsSource: "nozzles" },
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
      { name: "openingMeterReading", label: "Opening Meter Reading", type: "number" },
      { name: "closingMeterReading", label: "Closing Meter Reading", type: "number" },
      { name: "fuelPricePerLiter", label: "Fuel Price Per Liter", type: "number" },
      { name: "amountReceived", label: "Amount Received", type: "number" },
      { name: "totalSaleAmount", label: "Total Amount", type: "number", readOnly: true },
      { name: "pendingAmount", label: "Pending Amount", type: "number", readOnly: true },
      { name: "date", label: "Date", ...dateField },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "date", label: "Date", formatter: formatDate },
      { key: "nozzleName", label: "Nozzle" },
      { key: "fuelType", label: "Fuel" },
      { key: "soldLiters", label: "Sold Liters", formatter: formatRawNumber },
      { key: "totalSaleAmount", label: "Total Amount", formatter: (_, record) => formatCurrency(getFuelSaleTotalAmount(record)) },
      { key: "amountReceived", label: "Amount Received", formatter: formatCurrency },
      { key: "pendingAmount", label: "Pending Amount", formatter: (_, record) => formatCurrency(getFuelSalePendingAmount(record)) },
    ],
  },
  tanks: {
    title: "Tank Stock Management",
    description: "Track current stock, tank capacity, and low stock alerts.",
    endpoint: "tanks",
    searchFields: ["fuelType", "notes"],
    filters: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
    ],
    fields: [
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
      { name: "currentStock", label: "Current Stock", type: "number" },
      { name: "capacityLiters", label: "Capacity Liters", type: "number" },
      { name: "lowStockThreshold", label: "Low Stock Threshold", type: "number" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "fuelType", label: "Fuel Type" },
      { key: "currentStock", label: "Current Stock", formatter: formatRawNumber },
      { key: "capacityLiters", label: "Capacity", formatter: formatRawNumber },
      { key: "lowStockThreshold", label: "Low Threshold", formatter: formatRawNumber },
      { key: "updatedAt", label: "Updated", formatter: formatDate },
    ],
  },
  nozzles: {
    title: "Nozzle / Dispenser Management",
    description: "Keep nozzle machines, fuel type, and meter readings up to date.",
    endpoint: "nozzles",
    searchFields: ["nozzleName", "machineName", "fuelType"],
    filters: [
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
      { name: "status", label: "Status", type: "select", options: ["", ...STATUS_OPTIONS] },
    ],
    fields: [
      { name: "nozzleName", label: "Nozzle Name", type: "text" },
      { name: "machineName", label: "Machine Name", type: "text" },
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
      { name: "currentMeterReading", label: "Current Meter Reading", type: "number" },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
    columns: [
      { key: "nozzleName", label: "Nozzle" },
      { key: "machineName", label: "Machine" },
      { key: "fuelType", label: "Fuel Type" },
      { key: "currentMeterReading", label: "Meter", formatter: formatRawNumber },
      { key: "status", label: "Status" },
    ],
  },
  
  expenses: {
    title: "Expense Management",
    description: "Capture daily operational expenses and categories.",
    endpoint: "expenses",
    searchFields: ["expenseTitle", "category", "description"],
    filters: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
      { name: "category", label: "Category", type: "select", options: ["", ...EXPENSE_CATEGORIES] },
    ],
    fields: [
      { name: "expenseTitle", label: "Expense Title", type: "text" },
      { name: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES },
      { name: "amount", label: "Amount", type: "number" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "date", label: "Date", ...dateField },
    ],
    columns: [
      { key: "date", label: "Date", formatter: formatDate },
      { key: "expenseTitle", label: "Title" },
      { key: "category", label: "Category" },
      { key: "amount", label: "Amount", formatter: formatCurrency },
    ],
  },
  customers: {
    title: "Credit Customer Management",
    description: "Manage customers purchasing fuel on credit and their outstanding balance.",
    endpoint: "customers",
    searchFields: ["name", "phone", "vehicleNumber", "companyName"],
    filters: [],
    fields: [
      { name: "name", label: "Customer Name", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "vehicleNumber", label: "Vehicle Number", type: "text" },
      { name: "companyName", label: "Company Name", type: "text" },
      { name: "pendingBalance", label: "Pending Balance", type: "number" },
    ],
    columns: [
      { key: "name", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "vehicleNumber", label: "Vehicle" },
      { key: "companyName", label: "Company" },
      { key: "pendingBalance", label: "Pending", formatter: formatCurrency },
    ],
  },
  // payments module removed; payment actions now available from the Customers page
  employees: {
    title: "Employee Management",
    description: "Manage employee profiles, attendance, salary, and assignments.",
    endpoint: "employees",
    searchFields: ["name", "cnic", "phone", "role"],
    filters: [
      { name: "role", label: "Role", type: "select", options: ["", "Admin", "Manager", "Operator"] },
      { name: "status", label: "Status", type: "select", options: ["", ...STATUS_OPTIONS] },
    ],
    fields: [
      { name: "name", label: "Name", type: "text" },
      { name: "cnic", label: "CNIC", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS },
      { name: "salary", label: "Salary", type: "number" },
      { name: "joiningDate", label: "Joining Date", ...dateField },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
    columns: [
      { key: "name", label: "Employee" },
      { key: "role", label: "Role" },
      { key: "salary", label: "Salary", formatter: formatCurrency },
      { key: "status", label: "Status" },
    ],
  },
  "stock-adjustments": {
    title: "Stock Adjustment",
    description: "Make manual fuel stock corrections with a clear reason and audit trail.",
    endpoint: "stock-adjustments",
    searchFields: ["fuelType", "reason"],
    filters: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
    ],
    fields: [
      { name: "fuelType", label: "Fuel Type", type: "select", optionsSource: "products" },
      { name: "adjustmentQuantity", label: "Adjustment Quantity", type: "number" },
      { name: "reason", label: "Reason", type: "textarea" },
      { name: "date", label: "Date", ...dateField },
    ],
    columns: [
      { key: "date", label: "Date", formatter: formatDate },
      { key: "fuelType", label: "Fuel Type" },
      { key: "adjustmentQuantity", label: "Adjustment", formatter: formatRawNumber },
      { key: "reason", label: "Reason" },
    ],
  },
  products: {
    title: "Product & Rate Master",
    description: "Define petrol, diesel, and any other fuel/product.",
    endpoint: "products",
    searchFields: ["name", "code", "status"],
    filters: [
      { name: "status", label: "Status", type: "select", options: ["", "Active", "Inactive"] },
    ],
    fields: [
      { name: "name", label: "Product Name", type: "text" },
      { name: "code", label: "Code", type: "text" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "name", label: "Product" },
      { key: "code", label: "Code" },
      { key: "status", label: "Status" },
    ],
  },
  users: {
    title: "User Settings",
    description: "Create or manage application users and access roles.",
    endpoint: "users",
    searchFields: ["name", "email", "role", "status"],
    filters: [
      { name: "role", label: "Role", type: "select", options: ["", ...ROLE_OPTIONS] },
      { name: "status", label: "Status", type: "select", options: ["", ...STATUS_OPTIONS] },
    ],
    fields: [
      { name: "name", label: "Name", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "password", label: "Password", type: "password" },
      { name: "pumpId", label: "Pump", type: "select", optionsSource: "pumps" },
      { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "pumpId", label: "Pump" },
      { key: "role", label: "Role" },
      { key: "status", label: "Status" },
    ],
  },
};

export function getModuleConfig(resource) {
  return moduleConfigs[resource];
}