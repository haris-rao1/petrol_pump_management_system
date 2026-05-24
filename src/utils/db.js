export function escapeRegex(text) {
  if (typeof text !== "string") return text;
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ensureFiniteNumber(value, name = "value") {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${name} must be a finite number`);
  }
  return n;
}
