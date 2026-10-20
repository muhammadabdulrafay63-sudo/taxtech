"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface Rule {
  id: number;
  ruleKey: string;
  description: string;
  rateFiler: string;
  rateNonFiler: string;
  thresholdAmount: string | null;
  keywords: string[] | null;
  active: boolean;
  notes: string | null;
}

export function RuleEditor({ rule }: { rule: Rule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: rule.description,
    rateFiler: parseFloat(rule.rateFiler),
    rateNonFiler: parseFloat(rule.rateNonFiler),
    thresholdAmount: parseFloat(rule.thresholdAmount ?? "0"),
    keywords: (rule.keywords ?? []).join(", "),
    active: rule.active,
    notes: rule.notes ?? "",
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          rateFiler: form.rateFiler,
          rateNonFiler: form.rateNonFiler,
          thresholdAmount: form.thresholdAmount,
          keywords: form.keywords.split(",").map((k: string) => k.trim()).filter(Boolean),
          active: form.active,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed");
      toast.success("Rule updated");
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
      <DialogTrigger className="rounded p-1 hover:bg-muted">
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Rule — {rule.ruleKey}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Filer Rate (%)</Label>
              <Input
                type="number" step="0.001" min="0" max="100"
                value={form.rateFiler}
                onChange={(e) => setForm((f) => ({ ...f, rateFiler: parseFloat(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Non-filer Rate (%)</Label>
              <Input
                type="number" step="0.001" min="0" max="100"
                value={form.rateNonFiler}
                onChange={(e) => setForm((f) => ({ ...f, rateNonFiler: parseFloat(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <Label>Threshold Amount (PKR)</Label>
            <Input
              type="number" min="0"
              value={form.thresholdAmount}
              onChange={(e) => setForm((f) => ({ ...f, thresholdAmount: parseFloat(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Keywords (comma-separated)</Label>
            <Input
              value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              placeholder="rent, lease, property, office"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || pending}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
