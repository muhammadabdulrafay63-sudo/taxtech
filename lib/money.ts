/** Decimal arithmetic for persisted batch values, without binary floating-point rounding. */
function scaled(value: string, places: number): bigint {
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error("Invalid decimal value.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  if (fraction.slice(places).replaceAll("0", "").length)
    throw new Error("Unsupported decimal precision.");
  const result =
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.slice(0, places).padEnd(places, "0"));
  return negative ? -result : result;
}
function money(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
function divideRounded(value: bigint, denominator: bigint) {
  const absolute = value < 0n ? -value : value;
  const result = (absolute + denominator / 2n) / denominator;
  return value < 0n ? -result : result;
}
export function percentageTax(gross: string, rate: string) {
  return money(divideRounded(scaled(gross, 2) * scaled(rate, 3), 100000n));
}
export function fractionOfTax(tax: string, factor: string) {
  return money(divideRounded(scaled(tax, 2) * scaled(factor, 4), 10000n));
}
export function sumMoney(values: string[]) {
  return money(values.reduce((sum, value) => sum + scaled(value, 2), 0n));
}
export function subtractMoney(expected: string, paid: string) {
  return money(scaled(expected, 2) - scaled(paid, 2));
}

export class LedgerAmountError extends Error {}
const MAX_STORED_CENTS = 999999999999999999n;
export function assertStoredMoney(value: string): string {
  const cents = scaled(value, 2);
  if (cents > MAX_STORED_CENTS || cents < -MAX_STORED_CENTS)
    throw new LedgerAmountError(
      "Amount exceeds the supported maximum of 9,999,999,999,999,999.99.",
    );
  return money(cents);
}
/** Decimal strings stay exact. Excel numeric cells have a conservative precision limit. */
export function parseLedgerMoney(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "0.00";
  if (typeof raw !== "string" && typeof raw !== "number")
    throw new LedgerAmountError("Enter a valid debit or credit amount.");
  if (
    typeof raw === "number" &&
    (!Number.isFinite(raw) || Math.abs(raw) > 999999999999.99)
  )
    throw new LedgerAmountError(
      "Large Excel amounts must be stored as text to preserve every cent. Numeric cells support up to 999,999,999,999.99.",
    );
  const value = String(raw)
    .trim()
    .replace(/^\((.*)\)$/, "-$1");
  if (!value) return "0.00";
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))
    throw new LedgerAmountError(
      "Debit and credit must be valid numbers with at most two decimal places; fix the source rather than rounding during import.",
    );
  return assertStoredMoney(value.replaceAll(",", "").replace(/^\+/, ""));
}
/** Exact grouping and two decimal places, including amounts beyond Number precision. */
export function formatMoney(value: string | number): string {
  const normalized = money(scaled(String(value), 2));
  const [whole, fraction] = normalized.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
export function formatPKR(value: string | number | null | undefined): string {
  return `PKR ${formatMoney(value ?? "0")}`;
}
export function compareMoney(a: string, b: string): number {
  const left = scaled(a, 2),
    right = scaled(b, 2);
  return left < right ? -1 : left > right ? 1 : 0;
}
