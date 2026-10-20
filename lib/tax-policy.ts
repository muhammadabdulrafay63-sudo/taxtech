/** Conservative supported window for the supplied Finance Act 2024 / TY2025 references. */
export const SOURCE_PERIOD = {
  start: "2024-07-01",
  end: "2025-06-30",
} as const;
export function isSupportedTaxPeriod(year: number, month: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    return false;
  const date = `${year}-${String(month).padStart(2, "0")}-01`;
  return date >= SOURCE_PERIOD.start && date <= SOURCE_PERIOD.end;
}
export function hasRecipientEvidence(
  ruleType: string,
  vendor?: {
    recipientType: string;
    recipientTypeVerifiedAt: Date | string | null;
  } | null,
) {
  return (
    ruleType === "all" ||
    !!(vendor?.recipientTypeVerifiedAt && vendor.recipientType === ruleType)
  );
}
