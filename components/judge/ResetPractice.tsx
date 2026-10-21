"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function ResetPractice() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function reset() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/judge-demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "RESET_SYNTHETIC_APRIL" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(
        "April practice restored with three pending entries. March's completed example was preserved.",
      );
      setConfirmed(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">Start the practice again</h2>
      <p className="text-sm">
        This deletes April 2025 demo entries, batches and mock payment records
        in this synthetic workspace, including any April uploads. It restores
        three pending entries. March and other companies are preserved.
        Uploaded-file duplicate receipts are retained.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I understand that all April 2025 practice results will be replaced.
      </label>
      <Button disabled={!confirmed || busy} onClick={reset}>
        {busy ? "Restoring..." : "Reset April practice"}
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
