"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
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

export function AddEmployeeForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cnic: "",
    designation: "",
    monthlyGross: "",
    annualProjected: "",
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: form.name,
          cnic: form.cnic || null,
          designation: form.designation || null,
          monthlyGross: form.monthlyGross
            ? parseFloat(form.monthlyGross)
            : null,
          annualProjected: form.annualProjected
            ? parseFloat(form.annualProjected)
            : null,
          taxYear: 2025,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Employee added");
      setOpen(false);
      setForm({
        name: "",
        cnic: "",
        designation: "",
        monthlyGross: "",
        annualProjected: "",
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <UserPlus className="h-4 w-4" /> Add Employee
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Tax Year 2025 — Finance Act 2024 schedules supplied for this
            release.
          </p>
          <div>
            <Label>Full Name *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CNIC</Label>
              <Input
                placeholder="42101-1234567-8"
                value={form.cnic}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cnic: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Designation</Label>
              <Input
                value={form.designation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, designation: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Monthly Gross (PKR)</Label>
              <Input
                type="number"
                min="0"
                value={form.monthlyGross}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monthlyGross: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Annual Projected (optional)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Override if bonus etc."
                value={form.annualProjected}
                onChange={(e) =>
                  setForm((f) => ({ ...f, annualProjected: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || pending}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{" "}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
