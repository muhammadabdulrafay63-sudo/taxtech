"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  batchId: string;
  companyId: string;
}

export function BatchApproveButton({ batchId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const handleApprove = async () => {
    if (
      !confirm(
        "Approve this batch? This confirms the WHT figures are correct and ready for payment.",
      )
    )
      return;
    setRunning(true);
    try {
      const res = await fetch(`/api/wht/batch/${batchId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approval failed");
      toast.success("Batch approved — ready for challan generation");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <button
      onClick={handleApprove}
      disabled={isPending || running}
      className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
    >
      {isPending || running ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      Approve batch
    </button>
  );
}
