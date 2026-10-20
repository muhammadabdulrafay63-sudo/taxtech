import { z } from "zod";
import { completeJSON } from "./nebius";
export const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        id: z.string().uuid(),
        ruleKey: z.string().nullable(),
        explanation: z.string().min(1).max(1200),
        missingInformation: z.array(z.string().max(300)).max(5),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(10),
});
export const CLASSIFICATION_PROMPT = `You assist an accountant reviewing ledger entries. Choose only from the supplied active income withholding rule keys. These are configured rules, not verified current tax law. Never invent a rule, rate, vendor status or province. Do not calculate tax. If the description is ambiguous, return ruleKey null and specific missingInformation questions. A suggestion is never an approval. Return {"suggestions":[{"id":"the exact supplied id","ruleKey":null,"explanation":"short plain English reasoning","missingInformation":["question"],"confidence":0.0}]}. Return exactly one suggestion per input entry. A rule with usesSlabRates or isTiered must be flagged for specialist review. Only the supplied recipientType metadata is verified. If it is null, ask for the vendor recipient type and return null for recipient-specific rules. Never infer a company from purchase wording or a business name. Keep explanation under 250 characters and questions concise.`;
export function validateSuggestions(
  result: z.infer<typeof suggestionSchema>,
  ids: string[],
  ruleKeys: string[],
) {
  const allowed = new Set(ruleKeys);
  if (
    result.suggestions.length !== ids.length ||
    new Set(result.suggestions.map((s) => s.id)).size !== ids.length ||
    result.suggestions.some(
      (s) =>
        !ids.includes(s.id) || (s.ruleKey !== null && !allowed.has(s.ruleKey)),
    )
  ) {
    throw new Error(
      "AI returned unknown or duplicate entries or rules. No suggestions were saved.",
    );
  }
  return result.suggestions;
}
export async function classifyEntries(entries: unknown[], rules: unknown[]) {
  return completeJSON(
    CLASSIFICATION_PROMPT,
    { entries, rules },
    suggestionSchema,
  );
}

/** Fail closed on recipient-specific suggestions unless verified vendor metadata supports them. */
export function enforceRecipientEvidence(
  suggestions: z.infer<typeof suggestionSchema>["suggestions"],
  entries: { id: string; recipientType: string | null }[],
  rules: { ruleKey: string; recipientType: string }[],
) {
  return suggestions.map((s) => {
    const rule = rules.find((r) => r.ruleKey === s.ruleKey);
    const entry = entries.find((e) => e.id === s.id);
    if (
      rule &&
      rule.recipientType !== "all" &&
      rule.recipientType !== entry?.recipientType
    ) {
      return {
        ...s,
        ruleKey: null,
        confidence: 0,
        explanation:
          "The payment may fit this category, but verified recipient details are required before a specific rule can be suggested.",
        missingInformation: [
          ...new Set([
            "Confirm the vendor's recipient type from supporting evidence (company, individual/AOP or non-resident).",
            ...s.missingInformation,
          ]),
        ].slice(0, 5),
      };
    }
    return s;
  });
}
