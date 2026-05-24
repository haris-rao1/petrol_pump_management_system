import { format } from "date-fns";

export function formatCurrency(value = 0) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatNumber(value = 0) {
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatRawNumber(value = 0) {
  return String(value ?? 0);
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }

  return format(new Date(value), "dd MMM yyyy");
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return format(new Date(value), "dd MMM yyyy, hh:mm a");
}

export function toCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
}