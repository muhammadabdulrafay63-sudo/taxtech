"use client";
import { formatPKR } from "@/lib/money";

import { isSupportedTaxPeriod } from "@/lib/tax-policy";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Calculator } from "lucide-react";
import { toast } from "sonner";
import type { WHTEngineResult } from "@/lib/whtEngine";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface Props {
  companyId: string;
  year: number;
  month: number;
  hasBatch: boolean;
  batchStatus: string | null;
}

export function MonthlyBatchActions({
  companyId,
  year,
  month,
  hasBatch,
  batchStatus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRunning, setIsRunning] = useState(false);

  const isLoading = isPending || isRunning;
  const canRecalc = hasBatch && batchStatus === "draft";

  const handleCalculate = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/wht/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, year, month }),
      });
      const data: WHTEngineResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Calculation failed");

      const monthName = `${MONTH_NAMES[month - 1]} ${year}`;
      toast.success(
        `${monthName} — ${formatPKR(data.totalWht)} WHT on ${formatPKR(data.totalGross)} gross`,
        {
          description: `${data.linesCreated} lines · ${data.linesSkipped} skipped${data.needsReview > 0 ? ` · ⚠ ${data.needsReview} need review` : ""}`,
          duration: 6000,
        },
      );
      if (data.warnings.length > 0) {
        data.warnings.forEach((w) => toast.warning(w));
      }
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
      window.dispatchEvent(
        new CustomEvent("taxtech:help", {
          detail:
            "Tax batch generation was blocked. Check pending review decisions, locked periods and active categories.",
        }),
      );
    } finally {
      setIsRunning(false);
    }
  };

  if (batchStatus === "approved" || batchStatus === "paid") return null;

  if (!isSupportedTaxPeriod(year, month))
    return (
      <span className="text-xs text-amber-700">Source schedule required</span>
    );

  return (
    <button
      onClick={handleCalculate}
      disabled={isLoading}
      className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : canRecalc ? (
        <RefreshCw className="h-3 w-3" />
      ) : (
        <Calculator className="h-3 w-3" />
      )}
      {canRecalc ? "Recalculate" : "Calculate WHT"}
    </button>
  );
}
