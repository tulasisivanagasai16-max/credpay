// Helpers to convert between INR (display) and paise (storage).
// Avoid floats in financial code — paise are integers stored as bigint.

export function inrToPaise(inr: number): bigint {
  // Round to nearest paise to handle FE float input safely.
  return BigInt(Math.round(inr * 100));
}

export function paiseToInr(paise: bigint | string | number): number {
  const v = typeof paise === "bigint" ? paise : BigInt(paise);
  return Number(v) / 100;
}

export function dbNumeric(v: bigint): string {
  return v.toString();
}
