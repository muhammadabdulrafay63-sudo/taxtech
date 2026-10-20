"use client";
import { todayPKT } from "@/lib/dates";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  id: string;
  label: string;
  dueDate: string;
  status: string;
  filedDate: string | null;
  penalty: number;
  notes: string | null;
  isOverdue: boolean;
  provisional?: boolean;
  legacy?: boolean;
}

function StatusIcon({
  status,
  isOverdue,
}: {
  status: string;
  isOverdue: boolean;
}) {
  if (status === "filed")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (isOverdue) return <AlertTriangle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
}

export function ObligationRow({
  id,
  label,
  dueDate,
  status,
  filedDate,
  penalty,
  notes,
  isOverdue,
  provisional,
  legacy,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayPKT());
  const [error, setError] = useState("");
  const [verifiedDue, setVerifiedDue] = useState(dueDate);
  const [evidence, setEvidence] = useState("");
  async function reconcile() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/secp/obligations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: verifiedDue, notes: evidence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reconcile.");
    } finally {
      setSaving(false);
    }
  }

  const markFiled = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/secp/obligations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "filed", filedDate: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Marked as filed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setSaving(false);
    }
  };

  const displayStatus = isOverdue && status !== "filed" ? "overdue" : status;

  return (
    <tr
      className={`border-b last:border-0 ${isOverdue ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusIcon status={status} isOverdue={isOverdue} />
          <div>
            <p className="font-medium">{label}</p>
            {notes && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {notes}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <p className={isOverdue ? "font-semibold text-red-600" : ""}>
          {dueDate}
          {provisional ? " · provisional" : ""}
        </p>
        {filedDate && (
          <p className="text-xs text-green-600">Filed: {filedDate}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge
          className={
            displayStatus === "filed"
              ? "bg-green-100 text-green-800"
              : displayStatus === "overdue"
                ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-800"
          }
        >
          {displayStatus}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {penalty > 0 ? (
          <span className="font-semibold text-red-600">
            PKR {penalty.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {legacy && !["filed", "waived"].includes(status) && (
          <details className="text-left text-xs">
            <summary className="cursor-pointer underline">
              Reconcile legacy deadline
            </summary>
            <label className="block">
              Verified due date
              <input
                className="block rounded border p-1"
                type="date"
                value={verifiedDue}
                onChange={(e) => setVerifiedDue(e.target.value)}
              />
            </label>
            <label className="block">
              Source evidence
              <textarea
                className="block rounded border p-1"
                value={evidence}
                maxLength={2000}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={saving || evidence.trim().length < 3}
              onClick={reconcile}
              className="underline disabled:opacity-50"
            >
              Confirm reviewed deadline
            </button>
          </details>
        )}
        {!["filed", "waived"].includes(status) && !provisional && (
          <span className="flex flex-wrap justify-end gap-2">
            <input
              type="date"
              aria-label={`Actual date for ${label}`}
              value={date}
              max={todayPKT()}
              onChange={(e) => setDate(e.target.value)}
              className="min-w-0 max-w-full rounded border p-1"
            />
            <button
              onClick={markFiled}
              disabled={saving || isPending}
              className="inline-flex items-center gap-1 text-xs text-primary underline hover:no-underline disabled:opacity-60"
            >
              {saving || isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              {label.includes("Annual General")
                ? "Record AGM held"
                : "Record filed"}
            </button>
          </span>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
