import { ROLES } from "@/lib/constants";

function normalizeRole(userRole) {
  return String(userRole || "").trim().toLowerCase();
}

export function canAccessRole(userRole, allowedRoles = []) {
  if (!allowedRoles.length) {
    return true;
  }

  return allowedRoles.includes(userRole);
}

export function isOperator(userRole) {
  return userRole === ROLES.OPERATOR;
}

export function isManager(userRole) {
  return normalizeRole(userRole) === ROLES.MANAGER.toLowerCase();
}

export function isAdmin(userRole) {
  return normalizeRole(userRole) === ROLES.ADMIN.toLowerCase();
}