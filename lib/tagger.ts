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

// ─── ST WHT auto-tag derivation ───────────────────────────────────────────────
//
// Income WHT tag + vendor province → ST WHT rule key
//
// Goods (FBR national):
//   153_goods_*  → fbr_goods_registered   (engine adjusts to full WHT if STRN unknown at calc time)
//
// Services (provincial — jurisdiction = where service is rendered):
//   153_services_* / 153_contracts_* / 236_advertising_* →
//     Sindh   → srb_services_general
//     Punjab  → pra_services_general
//     ICT     → fbr_ict_services_general
//     KPK     → kpra_services_general
//     Baloch  → bra_services_general
//     unknown → null  (wrong authority = compliance risk, leave for manual tagging)
//
// No ST WHT:
//   155_* (rent), 149_* (salary), 233_* (bank), 234_* (transport), 231_* (indenting), 232_*
//

const PROVINCE_TO_SERVICES_RULE: Record<string, string> = {
  sindh: "srb_services_general",
  karachi: "srb_services_general",
  punjab: "pra_services_general",
  lahore: "pra_services_general",
  ict: "fbr_ict_services_general",
  islamabad: "fbr_ict_services_general",
  kpk: "kpra_services_general",
  "khyber pakhtunkhwa": "kpra_services_general",
  peshawar: "kpra_services_general",
  balochistan: "bra_services_general",
  quetta: "bra_services_general",
};

// Sections that attract ST WHT for services/contracts
const SERVICES_SECTIONS = [
  "153_services_",
  "153_contracts_",
  "236_advertising_",
];

// Sections that never attract ST WHT
const NO_ST_PREFIXES = ["149_", "155_", "233_", "234_", "231_", "232_", "149"];

export function deriveStWhtTag(
  incomeTag: string | null,
  vendorProvince: string | null,
  vendorPreferredStRule: string | null,
): string | null {
  if (!incomeTag) return null;

  // ── Vendor memory wins ───────────────────────────────────────────────────
  if (vendorPreferredStRule) return vendorPreferredStRule;

  // ── No ST WHT sections ───────────────────────────────────────────────────
  if (NO_ST_PREFIXES.some((p) => incomeTag.startsWith(p))) return null;

  // ── Goods → always FBR national ─────────────────────────────────────────
  if (incomeTag.startsWith("153_goods_")) return "fbr_goods_registered";

  // ── Services / contracts / advertising → provincial ──────────────────────
  const isServices = SERVICES_SECTIONS.some((p) => incomeTag.startsWith(p));
  if (isServices) {
    if (!vendorProvince) return null; // unknown province — leave for manual tagging
    const stRule = PROVINCE_TO_SERVICES_RULE[normalise(vendorProvince)];
    return stRule ?? null;
  }

  return null;
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
