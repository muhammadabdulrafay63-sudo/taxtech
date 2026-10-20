"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { ColumnMapping, SheetPreview } from "@/lib/types";

const FIELDS: {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
  hint: string;
}[] = [
  {
    key: "date",
    label: "Transaction Date",
    required: true,
    hint: "The date of each GL entry",
  },
  {
    key: "description",
    label: "Description",
    required: true,
    hint: "Narration / Details / Particulars",
  },
  {
    key: "accountCode",
    label: "GL Account Code",
    required: true,
    hint: "e.g. 306-000",
  },
  {
    key: "debit",
    label: "Debit Amount",
    required: true,
    hint: "The debit column (use a zero-filled column if none)",
  },
  {
    key: "credit",
    label: "Credit Amount",
    required: true,
    hint: "Credit column",
  },
  {
    key: "ref",
    label: "Reference / Voucher",
    required: false,
    hint: "e.g. JV, BPV reference number",
  },
  {
    key: "folio",
    label: "Folio / Voucher No",
    required: false,
    hint: "Voucher number",
  },
];

const NONE = "__none__";

interface MappingStepProps {
  sheets: SheetPreview[];
  selectedSheet: string;
  onSheetChange: (sheet: string) => void;
  mapping: Partial<ColumnMapping>;
  onMappingChange: (mapping: Partial<ColumnMapping>) => void;
}

export function MappingStep({
  sheets,
  selectedSheet,
  onSheetChange,
  mapping,
  onMappingChange,
}: MappingStepProps) {
  const currentSheet =
    sheets.find((s) => s.sheetName === selectedSheet) ?? sheets[0];
  const headers = currentSheet?.detectedHeaders ?? [];

  const missingRequired = FIELDS.filter((f) => f.required && !mapping[f.key]);

  return (
    <div className="space-y-6">
      {/* Sheet selector (only shown if multiple sheets) */}
      {sheets.length > 1 && (
        <div className="space-y-1.5">
          <Label>Sheet to import</Label>
          <Select
            value={selectedSheet}
            onValueChange={(v) => v && onSheetChange(v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sheets.map((s) => (
                <SelectItem key={s.sheetName} value={s.sheetName}>
                  {s.sheetName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({s.totalRows} rows)
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Column mapping grid */}
      <div>
        <p className="mb-3 text-sm text-muted-foreground">
          We detected {headers.length} columns. Map each field to the correct
          column. Highlighted fields are auto-detected — adjust if needed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const value = (mapping[field.key] as string | undefined) ?? "";
            const autoDetected = !!currentSheet?.suggestedMapping[field.key];

            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">{field.label}</Label>
                  {field.required && (
                    <span className="text-xs text-destructive">*</span>
                  )}
                  {autoDetected && value && (
                    <Badge variant="secondary" className="py-0 text-[10px]">
                      auto
                    </Badge>
                  )}
                </div>
                <Select
                  value={value || NONE}
                  onValueChange={(v) =>
                    onMappingChange({
                      ...mapping,
                      [field.key]: v === NONE ? undefined : v,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue>{value || "Not mapped"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {!field.required && (
                      <SelectItem value={NONE}>
                        <span className="text-muted-foreground">
                          — not mapped —
                        </span>
                      </SelectItem>
                    )}
                    {headers
                      .filter((h) => h)
                      .map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {field.hint}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation warning */}
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Map required fields:{" "}
            <span className="font-medium">
              {missingRequired.map((f) => f.label).join(", ")}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
