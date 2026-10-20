"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, FileDown } from "lucide-react";
import { toast } from "sonner";

export function ChallanActions({
  batchId,
  haChallans,
}: {
  batchId: string;
  haChallans: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const generate = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/wht/batch/${batchId}/challans`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`${data.created} challan(s) generated`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <button
      onClick={generate}
      disabled={running}
      className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
    >
      {running ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : haChallans ? (
        <RefreshCw className="h-3 w-3" />
      ) : (
        <FileDown className="h-3 w-3" />
      )}
      {haChallans ? "Regenerate" : "Generate Challans"}
    </button>
  );
}
