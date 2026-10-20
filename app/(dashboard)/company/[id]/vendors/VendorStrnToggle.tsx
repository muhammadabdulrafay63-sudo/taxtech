"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const OPTIONS = [
  {
    value: "true",
    label: "ST Reg.",
    cls: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "false",
    label: "Unreg.",
    cls: "bg-red-100 text-red-800 border-red-200",
  },
  {
    value: "null",
    label: "Unknown",
    cls: "bg-muted text-muted-foreground border",
  },
];

export function VendorStrnToggle({
  vendorId,
  isStRegistered,
}: {
  vendorId: string;
  isStRegistered: boolean | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const current =
    isStRegistered === true
      ? "true"
      : isStRegistered === false
        ? "false"
        : "null";

  const handleChange = async (val: string) => {
    if (val === current) return;
    setSaving(true);
    try {
      const isStRegisteredVal =
        val === "true" ? true : val === "false" ? false : null;
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStRegistered: isStRegisteredVal }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("STRN status updated");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Could not update STRN status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {saving || isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
              current === opt.value
                ? opt.cls + " ring-2 ring-offset-1 ring-primary/30"
                : "border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))
      )}
    </div>
  );
}
