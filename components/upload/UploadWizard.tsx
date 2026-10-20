"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { MappingStep } from "./MappingStep";
import { PreviewStep } from "./PreviewStep";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  RotateCcw,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ColumnMapping,
  ParsePreviewResult,
  ImportResult,
  SheetPreview,
} from "@/lib/types";

const STEPS = ["Upload", "Map Columns", "Preview", "Confirm"];

interface UploadWizardProps {
  companyId: string;
}

export function UploadWizard({ companyId }: UploadWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ParsePreviewResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const currentSheet: SheetPreview | undefined =
    preview?.sheets.find((s) => s.sheetName === selectedSheet) ??
    preview?.sheets[0];

  const requiredMapped =
    !!mapping.date &&
    !!mapping.description &&
    !!mapping.accountCode &&
    !!mapping.debit &&
    !!mapping.credit;

  // ── Step 1: Upload & parse ──────────────────────────────────────────────────
  const handleFile = async (f: File) => {
    setError("");
    setFile(f);
    setIsLoading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/upload-gl/preview", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      const result = data as ParsePreviewResult;
      setPreview(result);
      const firstSheet = result.sheets[0];
      setSelectedSheet(firstSheet?.sheetName ?? "");
      setMapping(firstSheet?.suggestedMapping ?? {});
      setStep(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed. Select the file again to retry.",
      );
      toast.error(String(err));
      window.dispatchEvent(
        new CustomEvent("taxtech:help", {
          detail:
            "The ledger upload did not complete. Check the file format and mapped columns.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sheet change: re-apply suggested mapping ────────────────────────────────
  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    const s = preview?.sheets.find((s) => s.sheetName === sheet);
    if (s) setMapping(s.suggestedMapping ?? {});
  };

  // ── Step 4: Import ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    setError("");
    if (!file || !currentSheet) return;
    setIsLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("companyId", companyId);
      form.append("sheetName", currentSheet.sheetName);
      form.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/upload-gl/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data as ImportResult);
      setStep(4);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import failed. You can retry.",
      );
      toast.error(String(err));
      window.dispatchEvent(
        new CustomEvent("taxtech:help", {
          detail:
            "The ledger upload did not complete. Check the file format and mapped columns.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setPreview(null);
    setMapping({});
    setImportResult(null);
    setSelectedSheet("");
    setError("");
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === 4 && importResult) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Import complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your ledger is imported. Review and approve the entries before
            generating a tax batch.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 rounded-xl border bg-muted/30 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {importResult.imported}
            </p>
            <p className="text-xs text-muted-foreground">Rows imported</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Tag className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold text-primary">
                {importResult.tagged}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Auto-tagged</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {importResult.skipped}
            </p>
            <p className="text-xs text-muted-foreground">Rows skipped</p>
          </div>
        </div>
        {importResult.errors.length > 0 && (
          <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {importResult.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Upload another file
          </Button>
          <Button
            onClick={() => {
              router.push(`/company/${companyId}/review`);
            }}
          >
            Review ledger →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {/* Stepper */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "border-2 border-primary text-primary"
                        : "border border-muted-foreground/30 text-muted-foreground/50"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span
                  className={`text-sm ${
                    i === step
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
              )}
            </div>
          ))}
        </div>
        <Progress value={(step / STEPS.length) * 100} className="h-1" />
      </div>

      {/* Step content */}
      <div className="rounded-xl border bg-background p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">
                Upload your GL extract
              </h2>
              <p className="text-sm text-muted-foreground">
                Export your General Ledger from your accounting software as
                .xlsx or .csv
              </p>
            </div>
            <FileDropzone onFile={handleFile} isLoading={isLoading} />
            <a className="text-sm underline" href="/sample-ledger.csv" download>
              Download a synthetic sample ledger
            </a>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing file…
              </div>
            )}
          </div>
        )}

        {step === 1 && preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Map your columns</h2>
                <p className="text-sm text-muted-foreground">
                  We auto-detected most mappings from your file. Verify and
                  adjust.
                </p>
              </div>
              <Badge variant="secondary">{file?.name}</Badge>
            </div>
            <MappingStep
              sheets={preview.sheets}
              selectedSheet={selectedSheet}
              onSheetChange={handleSheetChange}
              mapping={mapping}
              onMappingChange={setMapping}
            />
          </div>
        )}

        {step === 2 && currentSheet && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Preview parsed data</h2>
              <p className="text-sm text-muted-foreground">
                Check that dates, amounts, and vendor names look right.
              </p>
            </div>
            <PreviewStep sheet={currentSheet} mapping={mapping} />
          </div>
        )}

        {step === 3 && currentSheet && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Confirm import</h2>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
              <Row label="File" value={file?.name ?? ""} />
              <Row label="Sheet" value={currentSheet.sheetName} />
              <Row
                label="Rows to import"
                value={String(currentSheet.totalRows)}
              />
              <Row
                label="Mapped fields"
                value={Object.values(mapping).filter(Boolean).join(", ")}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Importing will auto-tag transactions against WHT rules and create
              vendor records for any new vendor names extracted from
              descriptions. You can review and correct tags on the Transactions
              page.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step > 0 && step < 4 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={isLoading}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !requiredMapped}
            >
              Continue
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                "Import transactions"
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-32 flex-shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}
