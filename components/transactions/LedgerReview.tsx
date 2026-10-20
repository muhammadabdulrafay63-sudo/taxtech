"use client";
import { formatPKR } from "@/lib/money";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { needsAIReview, type AISuggestion } from "@/lib/review-policy";
import { VendorAssignment, type VendorOption } from "./VendorAssignment";
type Entry = {
  id: string;
  txnDate: string;
  description: string | null;
  amount: string;
  autoTag: string | null;
  stWhtTag: string | null;
  tagConfidence: string | null;
  tagSource: string | null;
  reviewStatus: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  aiSuggestion: AISuggestion | null;
  vendorId: string | null;
};
type Rule = { ruleKey: string; description: string };
export function LedgerReview({
  companyId,
  vendors,
  period,
  periods,
  page,
  totalPages,
  counts,
  rows,
  rules,
  stRules,
  aiAvailable,
  batch,
}: {
  companyId: string;
  vendors: VendorOption[];
  period: string;
  periods: string[];
  page: number;
  totalPages: number;
  counts: {
    total: number;
    pending: number;
    approved: number;
    excluded: number;
  };
  rows: Entry[];
  rules: Rule[];
  stRules: Rule[];
  aiAvailable: boolean;
  batch: { id: string; status: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const unclear = rows
    .filter((t) => needsAIReview(t) && !t.aiSuggestion)
    .slice(0, 10);
  async function runAI() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ids: unclear.map((t) => t.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(
        `${data.reviewed} suggestions ready. Read each one and choose your treatment.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI review failed.");
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const [year, month] = period.split("-").map(Number);
      const res = await fetch("/api/wht/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, year, month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.batchId)
        router.push(`/company/${companyId}/wht/batch/${data.batchId}`);
      else {
        toast.info(
          "No eligible income withholding remains. Obsolete drafts were removed.",
        );
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate batch.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Ledger → review → tax batch
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            A clear decision for every entry
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI suggests. You approve. Configured rules calculate.
          </p>
        </div>
        <Link
          href={`/company/${companyId}/upload`}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <FileUp className="size-4" />
          Upload ledger
        </Link>
      </div>
      {periods.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center">
          <h2 className="font-medium">Start with a ledger</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload a file or try the synthetic sample to see the complete
            workflow.
          </p>
          <Link
            className="mt-4 inline-block underline"
            href={`/company/${companyId}/upload`}
          >
            Upload your first ledger →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm">
              Period{" "}
              <select
                aria-label="Review period"
                value={period}
                onChange={(e) => router.push(`?period=${e.target.value}`)}
                className="ml-2 rounded-md border bg-background p-2"
              >
                {periods.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>{counts.total} entries</span>
              <span className="font-medium text-amber-700">
                {counts.pending} pending
              </span>
              <span className="text-green-700">{counts.approved} approved</span>
              <span className="text-muted-foreground">
                {counts.excluded} excluded
              </span>
            </div>
          </div>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background p-5">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-2 font-medium">
                <Sparkles className="size-4" />A second look at unclear entries
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Send up to 10 unclear descriptions and account codes on this
                page to NVIDIA Nemotron on Nebius. No raw file, tax IDs or
                amounts are sent. Suggestions never approve or change your tax
                categories.
              </p>
            </div>
            <Button
              onClick={runAI}
              disabled={busy || !unclear.length || !aiAvailable}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Review unclear entries with AI
            </Button>
            {!aiAvailable && (
              <p className="text-sm text-muted-foreground">
                AI is unavailable. Manual review works below.
              </p>
            )}
          </section>
          {notice && (
            <p
              role="status"
              className="rounded-lg bg-green-50 p-3 text-sm text-green-900"
            >
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="space-y-3">
            {rows.map((row) => (
              <ReviewEntry
                key={`${row.id}-${row.reviewStatus}-${row.aiSuggestion?.generatedAt ?? "none"}-${row.autoTag}-${row.stWhtTag}-${row.vendorId}`}
                row={row}
                companyId={companyId}
                vendors={vendors}
                rules={rules}
                stRules={stRules}
                disabled={busy}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => router.push(`?period=${period}&page=${page - 1}`)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => router.push(`?period=${period}&page=${page + 1}`)}
            >
              Next
            </Button>
          </div>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background p-5">
            <div>
              <h2 className="font-medium">Ready for calculation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {counts.pending
                  ? `${counts.pending} entries still need a decision for ${period}.`
                  : `Every entry in ${period} has a review decision.`}
              </p>
            </div>
            {batch && batch.status !== "draft" ? (
              <Link
                className="rounded-md border px-4 py-2 text-sm"
                href={`/company/${companyId}/wht/batch/${batch.id}`}
              >
                View {batch.status} batch →
              </Link>
            ) : (
              <Button
                disabled={busy || counts.pending > 0 || !counts.approved}
                onClick={generate}
              >
                {batch
                  ? "Recalculate income tax draft"
                  : "Generate income tax batch"}
                <ArrowRight className="size-4" />
              </Button>
            )}
            <Link
              className="text-sm underline"
              href={`/company/${companyId}/st-wht/monthly`}
            >
              Sales tax batches →
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
function ReviewEntry({
  row,
  companyId,
  vendors,
  rules,
  stRules,
  disabled,
}: {
  row: Entry;
  companyId: string;
  vendors: VendorOption[];
  rules: Rule[];
  stRules: Rule[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [income, setIncome] = useState(
    row.aiSuggestion?.ruleKey ?? row.autoTag ?? "",
  );
  const [sales, setSales] = useState(row.stWhtTag ?? "");
  const [note, setNote] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = row.reviewStatus === "pending";
  async function decide(decision: "approved" | "excluded" | "pending") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/transactions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          decision,
          ruleKey: income || null,
          stRuleKey: sales || null,
          note:
            decision === "pending"
              ? "Treatment reopened for correction."
              : note,
          rememberVendor: remember,
          expectedSuggestionAt: row.aiSuggestion?.generatedAt ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-xl border bg-background p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {row.txnDate} ·{" "}
            {row.tagSource?.replaceAll("_", " ") ?? "Unclassified"}
          </p>
          <h3 className="mt-1 break-words font-medium">
            {row.description || "No description"}
          </h3>
        </div>
        <div className="text-right">
          <p className="tabular-nums font-medium">{formatPKR(row.amount)}</p>
          <p
            className={`mt-1 text-xs ${pending ? "text-amber-700" : "text-green-700"}`}
          >
            {pending
              ? "Needs your decision"
              : row.reviewStatus === "excluded"
                ? "Excluded from tax calculations"
                : "Approved by reviewer"}
          </p>
        </div>
      </div>
      <VendorAssignment
        id={row.id}
        companyId={companyId}
        vendorId={row.vendorId}
        vendors={vendors}
        disabled={disabled || busy}
      />
      {row.aiSuggestion && (
        <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
          <p className="flex gap-2 font-medium">
            <Sparkles className="size-4" />
            AI suggestion · {Math.round(row.aiSuggestion.confidence * 100)}%
            model-reported confidence
          </p>
          <p className="mt-2 whitespace-pre-wrap">
            {row.aiSuggestion.explanation}
          </p>
          {row.aiSuggestion.missingInformation.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-amber-800">
                Clarify before approving
              </p>
              <ul className="mt-1 list-disc pl-5">
                {row.aiSuggestion.missingInformation.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 break-all text-xs text-muted-foreground">
            {row.aiSuggestion.model} · This confidence is not measured accuracy.
          </p>
        </div>
      )}
      {pending ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void decide("approved");
          }}
          className="mt-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 space-y-1 text-xs font-medium">
              Income withholding treatment
              <select
                aria-label={`Income treatment for ${row.description}`}
                className="block min-w-0 max-w-full w-full rounded-md border bg-background p-2 text-sm"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                disabled={busy || disabled}
              >
                <option value="">Not applicable</option>
                {rules.map((r) => (
                  <option key={r.ruleKey} value={r.ruleKey}>
                    {r.description} ({r.ruleKey})
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium">
              Sales tax withholding treatment
              <select
                aria-label={`Sales tax treatment for ${row.description}`}
                className="block min-w-0 max-w-full w-full rounded-md border bg-background p-2 text-sm"
                value={sales}
                onChange={(e) => setSales(e.target.value)}
                disabled={busy || disabled}
              >
                <option value="">Not applicable</option>
                {stRules.map((r) => (
                  <option key={r.ruleKey} value={r.ruleKey}>
                    {r.description} ({r.ruleKey})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-xs font-medium">
            Review note
            <textarea
              aria-label={`Review note for ${row.description}`}
              className="block min-w-0 max-w-full w-full rounded-md border bg-background p-2 text-sm"
              rows={2}
              minLength={3}
              maxLength={1200}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain your decision and any information you checked."
            />
          </label>
          {row.vendorId && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember approved categories for this vendor&apos;s future entries
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy || disabled || note.trim().length < 3}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Approve treatment
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || disabled || note.trim().length < 3}
              onClick={() => decide("excluded")}
            >
              Exclude entry
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {row.reviewNote} ·{" "}
            {row.reviewedAt
              ? new Date(Date.parse(row.reviewedAt) + 5 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 16)
                  .replace("T", " ") + " PKT"
              : ""}
          </p>
          <Button
            variant="outline"
            disabled={busy || disabled}
            onClick={() => decide("pending")}
          >
            Reopen review
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
