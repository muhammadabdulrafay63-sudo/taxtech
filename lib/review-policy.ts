export type ReviewStatus = "pending" | "approved" | "excluded";
export interface AISuggestion {
  ruleKey: string | null;
  explanation: string;
  missingInformation: string[];
  confidence: number;
  model: string;
  generatedAt: string;
}
export function needsAIReview(row: {
  autoTag: string | null;
  tagConfidence: string | null;
  reviewStatus: string;
}) {
  return (
    row.reviewStatus === "pending" &&
    (!row.autoTag || Number(row.tagConfidence) < 0.85)
  );
}
export function canAccessCompany(
  user: { companyId?: string | null; role?: string },
  companyId: string,
) {
  // Even administrators operate within their assigned company.
  return !!companyId && user.companyId === companyId;
}
export function isValidISODate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
