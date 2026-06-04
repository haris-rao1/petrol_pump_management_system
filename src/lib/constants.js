export const ROLES = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  OPERATOR: "Operator",
};

export const ROLE_OPTIONS = [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATOR];

export const FUEL_TYPES = ["Petrol", "Diesel"];

export const EXPENSE_CATEGORIES = [
  "Electricity",
  "Generator",
  "Maintenance",
  "Salary",
  "Tea",
  "Miscellaneous",
];

export const STATUS_OPTIONS = ["Active", "Inactive", "Pending", "Completed"];

export const PAYMENT_METHODS = ["Cash", "Credit", "Bank Transfer", "JazzCash", "Easypaisa"];

export const DEFAULT_ADMIN = {
  name: "System Admin",
  email: "admin@petrolpump.local",
  password: "Admin@12345",
  role: ROLES.ADMIN,
};

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", roles: ROLE_OPTIONS },
  { label: "Fuel Purchases", href: "/fuel-purchases", roles: ROLE_OPTIONS },
  { label: "Fuel Sales", href: "/fuel-sales", roles: ROLE_OPTIONS },
  { label: "Tank Stock", href: "/tanks", roles: ROLE_OPTIONS },
  { label: "Nozzles", href: "/nozzles", roles: ROLE_OPTIONS },
  { label: "Products", href: "/settings/products", roles: [ROLES.ADMIN, ROLES.MANAGER] },
  
  { label: "Expenses", href: "/expenses", roles: ROLE_OPTIONS },
  { label: "Credit Customers", href: "/customers", roles: ROLE_OPTIONS },
  { label: "Employees", href: "/employees", roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { label: "Stock Adjustments", href: "/stock-adjustments", roles: ROLE_OPTIONS },
  { label: "Reports", href: "/reports", roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { label: "Settings", href: "/settings", roles: [ROLES.ADMIN] },
];

export const API_RESOURCES = [
  "users",
  "fuel-purchases",
  "fuel-sales",
  "products",
  "tanks",
  "nozzles",
  
  "expenses",
  "customers",
  "payments",
  "employees",
  "stock-adjustments",
];