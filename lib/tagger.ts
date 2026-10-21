import type {
  ParsedRow,
  TagResult,
  TaggerAccountMapping,
  TaggerRule,
  TaggerVendorMemory,
} from "./types";

// ─── Normalise strings for matching ───────────────────────────────────────────
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Sales-tax applicability cannot be inferred from vendor province or income category.
// Reuse only a reviewed case; every entry still requires a fresh invoice assessment.
import { salesPolicies } from "./ty2025";
export function deriveStWhtTag(
  incomeTag: string | null,
  _vendorProvince: string | null,
  vendorPreferredStRule: string | null,
): string | null {
  return incomeTag &&
    vendorPreferredStRule &&
    vendorPreferredStRule in salesPolicies
    ? vendorPreferredStRule
    : null;
}

// ─── Three-layer tagging engine ───────────────────────────────────────────────
//
// Layer 1: Deterministic — account_code → rule (highest confidence)
// Layer 2: Vendor memory — known vendor → preferred rule
// Layer 3: Keyword matching on description (fallback)

export function tagTransaction(
  row: ParsedRow,
  accountMappings: TaggerAccountMapping[],
  vendorMemory: TaggerVendorMemory[],
  rules: TaggerRule[],
): TagResult {
  // ── Layer 1: Account code mapping ─────────────────────────────────────────
  if (row.accountCode) {
    const acctMatch = accountMappings.find(
      (m) => m.accountCode.toLowerCase() === row.accountCode.toLowerCase(),
    );
    if (acctMatch) {
      return {
        ruleKey: acctMatch.ruleKey,
        confidence: 1.0,
        source: "account_mapping",
      };
    }
  }

  // ── Layer 2: Vendor memory ─────────────────────────────────────────────────
  const vendorName = row.extractedVendorName;
  if (vendorName) {
    const normVendor = normalise(vendorName);
    const vendorMatch = vendorMemory.find(
      (v) => v.preferredRule && normalise(v.name) === normVendor,
    );
    if (vendorMatch?.preferredRule) {
      return {
        ruleKey: vendorMatch.preferredRule,
        confidence: 0.85,
        source: "vendor_memory",
      };
    }
  }

  // ── Layer 3: Keyword matching ──────────────────────────────────────────────
  const normDesc = normalise(row.description);
  let bestMatch: { ruleKey: string; matchCount: number } | null = null;

  for (const rule of rules) {
    if (!rule.keywords?.length) continue;
    const matchCount = rule.keywords.filter((kw) =>
      normDesc.includes(normalise(kw)),
    ).length;
    if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.matchCount)) {
      bestMatch = { ruleKey: rule.ruleKey, matchCount };
    }
  }

  if (bestMatch) {
    // Confidence scales with number of keyword matches: 1 match = 0.5, 2 = 0.65, 3+ = 0.8
    const confidence = Math.min(0.5 + (bestMatch.matchCount - 1) * 0.15, 0.8);
    return { ruleKey: bestMatch.ruleKey, confidence, source: "keyword" };
  }

  return { ruleKey: null, confidence: 0, source: "none" };
}

// ─── Batch tagging for import ──────────────────────────────────────────────────
export function tagBatch(
  rows: ParsedRow[],
  accountMappings: TaggerAccountMapping[],
  vendorMemory: TaggerVendorMemory[],
  rules: TaggerRule[],
): (ParsedRow & { tag: TagResult; stWhtTag: string | null })[] {
  return rows.map((row) => {
    const tag = tagTransaction(row, accountMappings, vendorMemory, rules);

    // Find the matched vendor to resolve province + preferred ST rule
    const vendorMatch = row.extractedVendorName
      ? vendorMemory.find(
          (v) => normalise(v.name) === normalise(row.extractedVendorName!),
        )
      : undefined;

    const stWhtTag = deriveStWhtTag(
      tag.ruleKey,
      vendorMatch?.province ?? null,
      vendorMatch?.preferredStRule ?? null,
    );

    return { ...row, tag, stWhtTag };
  });
}
