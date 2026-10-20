import {
  parseLedgerMoney,
  subtractMoney,
  assertStoredMoney,
  LedgerAmountError,
} from "./money";
import { isValidISODate } from "./review-policy";
import * as XLSX from "xlsx";
import type {
  ColumnMapping,
  ParsedRow,
  ParsePreviewResult,
  SheetPreview,
} from "./types";

// ─── Vendor name extraction ────────────────────────────────────────────────────
// Pattern: "VendorName - transaction description"
// e.g. "Jaffer Business Systems (Private) Limited - Payment for purchase of..."
const TRANSACTION_VERBS = [
  "purchase",
  "payment",
  "receipt",
  "transfer",
  "adjustment",
  "debit",
  "credit",
  "deposit",
  "withdrawal",
  "being",
];

export function extractVendorName(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const dashIdx = description.indexOf(" - ");
  if (dashIdx > 2 && dashIdx < 70) {
    const candidate = description.substring(0, dashIdx).trim();
    const lower = candidate.toLowerCase();
    const startsWithVerb = TRANSACTION_VERBS.some((v) => lower.startsWith(v));
    if (!startsWithVerb && candidate.length > 2) return candidate;
  }
  return null;
}

// ─── BBF row detection ─────────────────────────────────────────────────────────
export function isBBFRow(
  row: Record<string, unknown>,
  mapping: Partial<ColumnMapping>,
): boolean {
  const ref = String(row[mapping.ref ?? ""] ?? "")
    .trim()
    .toUpperCase();
  const desc = String(row[mapping.description ?? ""] ?? "")
    .toLowerCase()
    .trim();
  return (
    ref === "BBF" ||
    desc === "bbf" ||
    desc.includes("brought balance forward") ||
    desc.includes("opening balance") ||
    desc === "b/f" ||
    desc === "b.f."
  );
}

export function parseLedgerDate(raw: unknown, date1904 = false): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? "" : raw.toISOString().split("T")[0];
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "";
    const date = XLSX.SSF.parse_date_code(raw, { date1904 }) as {
      y: number;
      m: number;
      d: number;
    } | null;
    if (!date) return "";
    const value = `${String(date.y).padStart(4, "0")}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    return isValidISODate(value) ? value : "";
  }
  const str = String(raw).trim();
  // Try common formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const patterns = [
    {
      re: /^(\d{4})-(\d{2})-(\d{2})$/,
      fn: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}`,
    },
    {
      re: /^(\d{2})\/(\d{2})\/(\d{4})$/,
      fn: (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}`,
    },
    {
      re: /^(\d{2})-(\d{2})-(\d{4})$/,
      fn: (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}`,
    },
    {
      re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      fn: (m: RegExpMatchArray) =>
        `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
    },
  ];
  for (const { re, fn } of patterns) {
    const m = str.match(re);
    if (m) {
      const value = fn(m);
      return isValidISODate(value) ? value : "";
    }
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) {
    const day = str.slice(0, 10);
    if (isValidISODate(day) && !Number.isNaN(Date.parse(str))) return day;
  }
  return "";
}

// ─── Header row detection ──────────────────────────────────────────────────────
const HEADER_KEYWORDS = [
  "date",
  "debit",
  "credit",
  "amount",
  "description",
  "details",
  "narration",
  "particulars",
  "code",
  "account",
  "ref",
  "folio",
  "voucher",
  "gl",
  "dr",
  "cr",
];

function scoreRow(row: unknown[]): number {
  return row.reduce<number>((score, cell) => {
    if (!cell) return score;
    const lower = String(cell).toLowerCase().trim();
    return score + (HEADER_KEYWORDS.some((k) => lower.includes(k)) ? 1 : 0);
  }, 0);
}

function detectHeaderRow(rows: unknown[][]): number {
  let bestScore = 0;
  let bestIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = scoreRow(rows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ─── Column mapping auto-suggest ───────────────────────────────────────────────
const COLUMN_MATCHERS: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "txn date", "transaction date", "trans date", "value date"],
  description: [
    "details",
    "description",
    "narration",
    "particulars",
    "remarks",
    "memo",
  ],
  accountCode: [
    "gl-code",
    "gl code",
    "account code",
    "account no",
    "acc code",
    "account",
  ],
  debit: ["debit", "debit ", "dr", "dr amount", "debit amount"],
  credit: ["credit", "credit ", "cr", "cr amount", "credit amount"],
  ref: ["ref", "reference", "voucher", "vch no", "document", "doc"],
  folio: ["folio", "voucher no", "vch", "jv no", "bpv"],
};

function suggestMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const normalised = headers.map((h) => h?.toLowerCase().trim() ?? "");

  for (const [field, matchers] of Object.entries(COLUMN_MATCHERS) as [
    keyof ColumnMapping,
    string[],
  ][]) {
    for (const matcher of matchers) {
      const idx = normalised.findIndex((h) => h.includes(matcher));
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

/** Reject ambiguous labels before any row is converted to a keyed object. */
export class LedgerHeaderError extends Error {}
function readHeaders(row: unknown[], sheetName: string): string[] {
  const headers = row.map((h) => (h == null ? "" : String(h)));
  const seen = new Map<string, number>();
  headers.forEach((label, index) => {
    const key = label.trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) return; // unnamed columns cannot be mapped
    const previous = seen.get(key);
    if (previous !== undefined)
      throw new LedgerHeaderError(
        `Sheet "${sheetName}": duplicate column name "${label.trim()}" in columns ${previous + 1} and ${index + 1}. Give each named column a unique heading in the source file, then upload again. No rows were saved.`,
      );
    seen.set(key, index);
  });
  return headers;
}

// ─── Main parser ───────────────────────────────────────────────────────────────

export function parseGLBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): ParsePreviewResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: true,
  });
  const date1904 = !!workbook.Workbook?.WBProps?.date1904;

  const sheets: SheetPreview[] = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    });

    if (raw.length < 2) {
      return {
        sheetName,
        date1904,
        detectedHeaders: [],
        suggestedMapping: {},
        sampleRows: [],
        totalRows: 0,
      };
    }

    const headerRowIdx = detectHeaderRow(raw as unknown[][]);
    const headers = readHeaders(raw[headerRowIdx] as unknown[], sheetName);
    const dataRows = (raw as unknown[][])
      .slice(headerRowIdx + 1)
      .filter((r) => r.some((c) => c !== null && c !== undefined && c !== ""));

    const suggestedMapping = suggestMapping(headers);

    const sampleRows = dataRows.slice(0, 50).map((row) => {
      const obj: Record<string, unknown> = Object.create(null);
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    return {
      sheetName,
      date1904,
      detectedHeaders: headers,
      suggestedMapping,
      sampleRows,
      totalRows: dataRows.length,
    };
  });

  return { sheets, fileName };
}

// ─── Map raw rows → ParsedRow[] ────────────────────────────────────────────────

export function mapRows(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  date1904 = false,
): { rows: ParsedRow[]; skipped: number } {
  let skipped = 0;
  const rows: ParsedRow[] = [];

  rawRows.forEach((raw, i) => {
    // Skip BBF / opening balance rows
    if (isBBFRow(raw, mapping)) {
      skipped++;
      return;
    }

    let debit: string, credit: string, amount: string;
    try {
      debit = parseLedgerMoney(raw[mapping.debit]);
      credit = parseLedgerMoney(raw[mapping.credit]);
      amount = assertStoredMoney(subtractMoney(debit, credit));
    } catch (error) {
      if (error instanceof LedgerAmountError)
        throw new LedgerAmountError(
          `Data row ${i + 1}: ${error.message} No rows from this file were saved.`,
        );
      throw error;
    }

    // Skip zero-amount rows
    if (debit === "0.00" && credit === "0.00") {
      skipped++;
      return;
    }

    const txnDate = parseLedgerDate(raw[mapping.date], date1904);
    if (!isValidISODate(txnDate)) {
      skipped++;
      return;
    }

    const description = String(raw[mapping.description] ?? "").trim();

    rows.push({
      rowIndex: i,
      txnDate,
      description,
      accountCode: String(raw[mapping.accountCode] ?? "").trim(),
      ref: mapping.ref ? String(raw[mapping.ref] ?? "").trim() : "",
      folio: mapping.folio ? String(raw[mapping.folio] ?? "").trim() : "",
      debit,
      credit,
      amount,
      extractedVendorName: extractVendorName(description),
    });
  });

  return { rows, skipped };
}

// ─── Parse a sheet into ParsedRows (used by import route) ─────────────────────

export function parseSheet(
  buffer: ArrayBuffer,
  sheetName: string,
  mapping: ColumnMapping,
): { rows: ParsedRow[]; skipped: number } {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: true,
  });
  const ws = workbook.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const headerRowIdx = detectHeaderRow(raw);
  const headers = readHeaders(
    (raw[headerRowIdx] as unknown[]) ?? [],
    sheetName,
  );
  const dataRows = raw
    .slice(headerRowIdx + 1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && c !== ""));

  const rawMapped = dataRows.map((row) => {
    const obj: Record<string, unknown> = Object.create(null);
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });

  for (const column of Object.values(mapping).filter(Boolean)) {
    if (!headers.includes(column!))
      throw new Error("A mapped column is missing from this sheet.");
  }
  return mapRows(rawMapped, mapping, !!workbook.Workbook?.WBProps?.date1904);
}
