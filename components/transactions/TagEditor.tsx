"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

interface Rule {
  ruleKey: string;
  section: string;
  description: string;
}

interface TagEditorProps {
  txnId: string;
  currentTag: string | null;
  hasVendor: boolean;
  rules: Rule[];
}

const NONE = "__none__";

// Group rules by section for the dropdown
function groupBySection(rules: Rule[]): Record<string, Rule[]> {
  return rules.reduce<Record<string, Rule[]>>((acc, r) => {
    (acc[r.section] ??= []).push(r);
    return acc;
  }, {});
}

export function TagEditor({
  txnId,
  currentTag,
  hasVendor,
  rules,
}: TagEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(currentTag ?? NONE);
  const [open, setOpen] = useState(false);

  const grouped = groupBySection(rules);

  const handleChange = async (newValue: string) => {
    const ruleKey = newValue === NONE ? null : newValue;
    setValue(newValue);
    setOpen(false);

    // Ask about vendor memory only if there's a vendor and we're setting a tag
    const updateVendorMemory =
      hasVendor &&
      ruleKey !== null &&
      window.confirm(
        "Apply this tag to all future transactions from the same vendor? (Updates vendor memory)",
      );

    try {
      const res = await fetch(`/api/transactions/${txnId}/tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleKey, updateVendorMemory }),
      });
      if (!res.ok) throw new Error("Failed to update tag");
      toast.success(ruleKey ? `Tag updated to ${ruleKey}` : "Tag cleared");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Could not update tag");
      setValue(currentTag ?? NONE); // revert
    }
  };

  const displayTag = value === NONE ? null : value;
  const pct = displayTag ? 50 : 0; // Tag choice is not an approval or measured accuracy.

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onValueChange={(v) => v && handleChange(v)}
        open={open}
        onOpenChange={setOpen}
      >
        <SelectTrigger className="h-7 w-48 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-muted focus:ring-0 focus:ring-offset-0">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : displayTag ? (
              <>
                <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                <span
                  className={`truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    pct >= 80
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : pct >= 50
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {displayTag}
                </span>
              </>
            ) : (
              <>
                <X className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Untagged</span>
              </>
            )}
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-80 w-72">
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">
              — Clear tag (review required) —
            </span>
          </SelectItem>
          {Object.entries(grouped).map(([section, sectionRules]) => (
            <SelectGroup key={section}>
              <SelectLabel className="text-xs font-semibold text-muted-foreground">
                Section {section}
              </SelectLabel>
              {sectionRules.map((r) => (
                <SelectItem key={r.ruleKey} value={r.ruleKey}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{r.ruleKey}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {r.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
