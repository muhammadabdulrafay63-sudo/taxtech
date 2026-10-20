"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface Props {
  companyId: string;
  currentQ: string;
  currentTag: string;
  rules: { ruleKey: string; description: string }[];
  untaggedCount: number;
}

export function TransactionFilters({
  currentQ,
  currentTag,
  rules,
  untaggedCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const push = useCallback(
    (q: string, tag: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tag) params.set("tag", tag);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const quickFilters = [
    { label: "All", value: "" },
    { label: `Untagged (${untaggedCount})`, value: "untagged" },
    ...rules
      .slice(0, 8)
      .map((rule) => ({ label: rule.description, value: rule.ruleKey })),
  ];

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search description, vendor, account…"
          defaultValue={currentQ}
          className="pl-9 pr-8"
          onChange={(e) => push(e.target.value, currentTag)}
        />
        {currentQ && (
          <button
            onClick={() => push("", currentTag)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((f) => (
          <button
            key={f.value}
            onClick={() =>
              push(currentQ, f.value === currentTag ? "" : f.value)
            }
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              currentTag === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
