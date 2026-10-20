"use client";
import { parseLedgerMoney, formatPKR } from "@/lib/money";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, HelpCircle } from "lucide-react";
import type { ColumnMapping, SheetPreview } from "@/lib/types";
import { extractVendorName, parseLedgerDate, isBBFRow } from "@/lib/parser";

interface PreviewStepProps {
  sheet: SheetPreview;
  mapping: Partial<ColumnMapping>;
}

function formatAmount(raw: unknown): string {
  try {
    return formatPKR(parseLedgerMoney(raw));
  } catch {
    return "Invalid amount — fix source before import";
  }
}

function formatDate(raw: unknown, date1904 = false): string {
  return parseLedgerDate(raw, date1904) || "Invalid date — skipped";
}

export function PreviewStep({ sheet, mapping }: PreviewStepProps) {
  const rows = sheet.sampleRows.slice(0, 20);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing first {rows.length} of {sheet.totalRows} rows from{" "}
          <span className="font-medium">{sheet.sheetName}</span>. BBF/opening
          balance rows will be skipped automatically. Amounts require at most
          two decimal places; invalid amounts block the whole import. Store
          large Excel amounts as text.
        </p>
        <Badge variant="outline">{sheet.totalRows} total rows</Badge>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28">Account</TableHead>
              <TableHead className="w-28 text-right">Debit</TableHead>
              <TableHead className="w-28 text-right">Credit</TableHead>
              <TableHead className="w-36">Vendor (extracted)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const desc = mapping.description
                ? String(row[mapping.description] ?? "")
                : "";
              const vendor = extractVendorName(desc);
              const isBBF = isBBFRow(row, mapping);

              return (
                <TableRow
                  key={i}
                  className={isBBF ? "opacity-40 line-through" : undefined}
                >
                  <TableCell className="text-xs">
                    {mapping.date
                      ? formatDate(row[mapping.date], sheet.date1904)
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-xs">{desc || "—"}</p>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {mapping.accountCode
                      ? String(row[mapping.accountCode] ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-green-700">
                    {mapping.debit ? formatAmount(row[mapping.debit]) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-red-600">
                    {mapping.credit ? formatAmount(row[mapping.credit]) : "—"}
                  </TableCell>
                  <TableCell>
                    {vendor ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                        <span className="truncate text-xs">{vendor}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <HelpCircle className="h-3 w-3" />
                        <span className="text-xs">Not detected</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
