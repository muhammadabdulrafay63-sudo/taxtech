"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface STRule {
  ruleKey: string;
  authority: string;
  description: string;
  stRate: string;
  whtFactor: string;
}

interface Props {
  txnId: string;
  currentTag: string | null;
  rules: STRule[];
}

const AUTHORITY_LABELS: Record<string, string> = {
  FBR: "FBR — Federal (Goods / ICT Services)",
  SRB: "SRB — Sindh",
  PRA: "PRA — Punjab",
  KPRA: "KPRA — KPK",
  BRA: "BRA — Balochistan",
};

function whtLabel(factor: string) {
  return parseFloat(factor) === 1 ? "Full ST" : "1/5th ST";
}

export function STTagEditor({ txnId, currentTag, rules }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const byAuthority = rules.reduce<Record<string, STRule[]>>((acc, r) => {
    (acc[r.authority] ??= []).push(r);
    return acc;
  }, {});

  const handleChange = async (value: string | null) => {
    const newTag = value === "__clear__" ? null : value;
    if (newTag === currentTag) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${txnId}/st-tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stWhtTag: newTag }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(
        newTag ? `ST WHT tag set to ${newTag}` : "ST WHT tag cleared",
      );
      startTransition(() => router.refresh());
    } catch {
      toast.error("Could not update ST tag");
    } finally {
      setSaving(false);
    }
  };

  if (saving || isPending) {
    return (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    );
  }

  return (
    <Select
      value={currentTag ?? "__none__"}
      onValueChange={(v) => v && handleChange(v)}
    >
      <SelectTrigger className="h-7 w-full max-w-[160px] border-dashed text-xs">
        <SelectValue>
          {currentTag ? (
            <span className="font-mono text-[10px] text-blue-700">
              {currentTag}
            </span>
          ) : (
            <span className="text-muted-foreground">No ST WHT</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72 w-72">
        <SelectItem value="__clear__">
          <span className="flex items-center gap-1 text-muted-foreground">
            <X className="h-3 w-3" /> No ST WHT (clear)
          </span>
        </SelectItem>
        {Object.entries(byAuthority)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([auth, authRules]) => (
            <SelectGroup key={auth}>
              <SelectLabel className="text-[10px]">
                {AUTHORITY_LABELS[auth] ?? auth}
              </SelectLabel>
              {authRules.map((r) => (
                <SelectItem key={r.ruleKey} value={r.ruleKey}>
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.ruleKey}
                    </span>
                    <span className="text-xs">
                      {r.description.slice(0, 50)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ST: {parseFloat(r.stRate).toFixed(0)}% ·{" "}
                      {whtLabel(r.whtFactor)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </Select>
  );
}
