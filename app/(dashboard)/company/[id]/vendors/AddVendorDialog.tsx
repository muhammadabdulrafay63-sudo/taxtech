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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROVINCES = ["Sindh", "Punjab", "ICT", "KPK", "Balochistan", "AJK", "GB"];

export function AddVendorDialog({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    taxId: "",
    strn: "",
    province: "",
    recipientType: "" as "" | "company" | "individual_aop" | "non_resident",
    isFiler: "" as "" | "true" | "false",
    isStRegistered: "" as "" | "true" | "false",
    notes: "",
  });

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const reset = () =>
    setForm({
      name: "",
      taxId: "",
      strn: "",
      province: "",
      recipientType: "",
      isFiler: "",
      isStRegistered: "",
      notes: "",
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: form.name,
          taxId: form.taxId || null,
          strn: form.strn || null,
          province: form.province || null,
          recipientType: form.recipientType,
          isFiler:
            form.isFiler === "true"
              ? true
              : form.isFiler === "false"
                ? false
                : null,
          isStRegistered:
            form.isStRegistered === "true"
              ? true
              : form.isStRegistered === "false"
                ? false
                : null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error((data as { error?: string }).error ?? "Failed");
      toast.success(`Vendor "${form.name}" created`);
      reset();
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
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <UserPlus className="h-4 w-4" /> Add Vendor
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {/* Name */}
          <div>
            <Label>Vendor / Supplier Name *</Label>
            <Input
              required
              placeholder="e.g. KPMG Pakistan (Pvt) Ltd"
              {...f("name")}
            />
          </div>

          {/* NTN + STRN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>NTN / CNIC</Label>
              <Input placeholder="1234567-8" {...f("taxId")} />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                For Income Tax ATL check
              </p>
            </div>
            <div>
              <Label>STRN</Label>
              <Input placeholder="1234567890123" {...f("strn")} />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                For Sales Tax ATL check
              </p>
            </div>
          </div>

          {/* Type + Province */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Recipient Type</Label>
              <Select
                value={form.recipientType}
                onValueChange={(v) =>
                  v &&
                  setForm((p) => ({
                    ...p,
                    recipientType: v as typeof form.recipientType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Verify recipient type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="individual_aop">
                    Individual / AOP
                  </SelectItem>
                  <SelectItem value="non_resident">Non-resident</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Province</Label>
              <Select
                value={form.province}
                onValueChange={(v) =>
                  v &&
                  setForm((p) => ({
                    ...p,
                    province: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unknown</SelectItem>
                  {PROVINCES.map((pr) => (
                    <SelectItem key={pr} value={pr}>
                      {pr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Determines ST WHT authority
              </p>
            </div>
          </div>

          {/* Income WHT + ST WHT status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Income Tax ATL Status</Label>
              <Select
                value={form.isFiler}
                onValueChange={(v) =>
                  v &&
                  setForm((p) => ({ ...p, isFiler: v as typeof form.isFiler }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unknown</SelectItem>
                  <SelectItem value="true">Filer</SelectItem>
                  <SelectItem value="false">Non-filer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sales Tax Registration</Label>
              <Select
                value={form.isStRegistered}
                onValueChange={(v) =>
                  v &&
                  setForm((p) => ({
                    ...p,
                    isStRegistered: v as typeof form.isStRegistered,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unknown</SelectItem>
                  <SelectItem value="true">ST Registered</SelectItem>
                  <SelectItem value="false">Unregistered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Input
              placeholder="Any internal notes about this vendor"
              {...f("notes")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create Vendor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
