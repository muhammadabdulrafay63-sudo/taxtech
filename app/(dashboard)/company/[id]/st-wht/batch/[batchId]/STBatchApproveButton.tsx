"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function STBatchApproveButton({
  batchId,
}: {
  batchId: string;
  companyId: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const approve = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/st-wht/batch/${batchId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("ST WHT batch approved");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button onClick={approve} disabled={saving}>
      {saving ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="mr-1.5 h-4 w-4" />
      )}
      Approve Batch
    </Button>
  );
}
