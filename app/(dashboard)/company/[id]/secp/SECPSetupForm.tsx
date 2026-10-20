"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  companyId: string;
  defaultIncorporationDate: string;
  defaultFye: string;
  defaultCapital: string | null;
  defaultOffice: string | null;
  isEdit?: boolean;
  defaultOfficerCount?: number | null;
}

export function SECPSetupForm({
  companyId,
  defaultIncorporationDate,
  defaultFye,
  defaultCapital,
  defaultOffice,
  isEdit,
  defaultOfficerCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    incorporationDate: defaultIncorporationDate,
    financialYearEnd: defaultFye,
    paidUpCapital: defaultCapital ?? "",
    registeredOffice: defaultOffice ?? "",
    officerCount: defaultOfficerCount?.toString() ?? "",
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/secp/setup", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          officerCount: form.officerCount ? Number(form.officerCount) : null,
          incorporationDate: form.incorporationDate,
          financialYearEnd: form.financialYearEnd,
          paidUpCapital: form.paidUpCapital
            ? parseFloat(form.paidUpCapital)
            : undefined,
          registeredOffice: form.registeredOffice || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(
        `SECP profile saved — ${data.obligations} obligations generated`,
      );
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {isEdit ? (
          <span className="inline-flex cursor-pointer items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Settings className="h-3 w-3" /> Edit Profile
          </span>
        ) : (
          <span className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Setup SECP Profile
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit SECP Profile" : "Setup SECP Profile"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Incorporation Date *</Label>
            <Input
              type="date"
              required
              value={form.incorporationDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, incorporationDate: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Financial Year End *</Label>
            <Input
              type="date"
              required
              value={form.financialYearEnd}
              onChange={(e) =>
                setForm((f) => ({ ...f, financialYearEnd: e.target.value }))
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              E.g. 2024-06-30 for companies ending June 30
            </p>
          </div>
          <div>
            <Label>Paid-up Capital (PKR)</Label>
            <Input
              type="number"
              placeholder="e.g. 10000000"
              value={form.paidUpCapital}
              onChange={(e) =>
                setForm((f) => ({ ...f, paidUpCapital: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Registered Office</Label>
            <Input
              placeholder="City, Province"
              value={form.registeredOffice}
              onChange={(e) =>
                setForm((f) => ({ ...f, registeredOffice: e.target.value }))
              }
            />
          </div>
          <label className="block text-sm">
            Number of responsible officers (for the supplied AGM penalty
            estimate)
            <Input
              type="number"
              min="1"
              max="10000"
              value={form.officerCount}
              onChange={(e) =>
                setForm((f) => ({ ...f, officerCount: e.target.value }))
              }
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || pending}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Generate Calendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
