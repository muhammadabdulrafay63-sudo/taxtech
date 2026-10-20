// ─── Parser types ─────────────────────────────────────────────────────────────

export interface ColumnMapping {
  date: string;
  description: string;
  accountCode: string;
  debit: string;
  credit: string;
  ref?: string;
  folio?: string;
}

export interface ParsedRow {
  rowIndex: number;
  txnDate: string; // ISO date string YYYY-MM-DD
  description: string;
  accountCode: string;
  ref: string;
  folio: string;
  debit: string;
  credit: string;
  amount: string; // exact decimal debit - credit; credits remain negative
  extractedVendorName: string | null;
}

export interface SheetPreview {
  date1904?: boolean;
  sheetName: string;
  detectedHeaders: string[];
  suggestedMapping: Partial<ColumnMapping>;
  sampleRows: Record<string, unknown>[];
  totalRows: number;
}

export interface ParsePreviewResult {
  sheets: SheetPreview[];
  fileName: string;
}

// ─── Tagger types ─────────────────────────────────────────────────────────────

export type TagSource =
  | "account_mapping"
  | "vendor_memory"
  | "keyword"
  | "none";

export interface TagResult {
  ruleKey: string | null;
  confidence: number; // 0–1
  source: TagSource;
}

export interface TaggerRule {
  id: number;
  ruleKey: string;
  keywords: string[];
}

export interface TaggerAccountMapping {
  accountCode: string;
  ruleKey: string;
}

export interface TaggerVendorMemory {
  name: string; // normalised vendor name
  preferredRule: string | null;
  preferredStRule: string | null;
  province: string | null; // Sindh | Punjab | ICT | KPK | Balochistan — for provincial ST routing
}

// ─── Import types ─────────────────────────────────────────────────────────────

export interface ImportRequest {
  companyId: string;
  sheetName: string;
  mapping: ColumnMapping;
  sourceFile: string;
}

export interface ImportResult {
  imported: number;
  skipped: number; // BBF / zero-amount rows
  tagged: number;
  errors: string[];
}
