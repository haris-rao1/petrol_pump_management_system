import { ROLES } from "@/lib/constants";

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
  return userRole === ROLES.MANAGER;
}

export function isAdmin(userRole) {
  return userRole === ROLES.ADMIN;
}