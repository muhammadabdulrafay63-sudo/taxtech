"use client";
import { formatPKR } from "@/lib/money";

import { isSupportedTaxPeriod } from "@/lib/tax-policy";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Calculator } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
  year: number;
  month: number;
  hasBatches: boolean;
}

export function STMonthlyActions({
  companyId,
  year,
  month,
  hasBatches,
}: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const calc = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/st-wht/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, year, month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const authList = Object.entries(data.batches as Record<string, string>)
        .map(([auth, wht]) => `${auth}: ${formatPKR(wht)}`)
        .join(" | ");
      toast.success(
        `${data.linesCreated} lines calculated${authList ? ` — ${authList}` : ""}`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setRunning(false);
    }
  };

  if (!isSupportedTaxPeriod(year, month))
    return (
      <span className="text-xs text-amber-700">Source schedule required</span>
    );

  return (
    <button
      onClick={calc}
      disabled={running}
      className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
    >
      {running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : hasBatches ? (
        <RefreshCw className="h-3.5 w-3.5" />
      ) : (
        <Calculator className="h-3.5 w-3.5" />
      )}
      {hasBatches ? "Recalculate" : "Calculate ST WHT"}
    </button>
  );
}
