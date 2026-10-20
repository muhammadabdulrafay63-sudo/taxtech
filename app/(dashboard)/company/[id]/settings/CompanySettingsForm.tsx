"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Company {
  name: string;
  ntn: string | null;
  strn: string | null;
  financialYearEnd: string | null;
  incorporationDate: string | null;
  registeredOffice: string | null;
  paidUpCapital: string | null;
}

export function CompanySettingsForm({
  companyId,
  company,
}: {
  companyId: string;
  company: Company;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: company.name,
    ntn: company.ntn ?? "",
    strn: company.strn ?? "",
    financialYearEnd: company.financialYearEnd ?? "",
    incorporationDate: company.incorporationDate ?? "",
    registeredOffice: company.registeredOffice ?? "",
    paidUpCapital: company.paidUpCapital ?? "",
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/company/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          ntn: form.ntn || null,
          strn: form.strn || null,
          financialYearEnd: form.financialYearEnd || null,
          incorporationDate: form.incorporationDate || null,
          registeredOffice: form.registeredOffice || null,
          paidUpCapital: form.paidUpCapital
            ? parseFloat(form.paidUpCapital)
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Company profile updated");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Company Name *</Label>
          <Input required {...field("name")} />
        </div>
        <div>
          <Label>NTN (National Tax Number)</Label>
          <Input placeholder="1234567-8" {...field("ntn")} />
        </div>
        <div>
          <Label>STRN (Sales Tax Reg. No.)</Label>
          <Input placeholder="1234567890123" {...field("strn")} />
        </div>
        <div>
          <Label>Incorporation Date</Label>
          <Input type="date" {...field("incorporationDate")} />
        </div>
        <div>
          <Label>Financial Year End</Label>
          <Input type="date" {...field("financialYearEnd")} />
          <p className="mt-1 text-xs text-muted-foreground">
            E.g. 2024-06-30 for June year-end companies
          </p>
        </div>
        <div>
          <Label>Paid-up Capital (PKR)</Label>
          <Input type="number" min="0" {...field("paidUpCapital")} />
        </div>
        <div>
          <Label>Registered Office</Label>
          <Input placeholder="City, Province" {...field("registeredOffice")} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving || pending}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
