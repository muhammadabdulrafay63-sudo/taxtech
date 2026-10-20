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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface STRule {
  id: number;
  ruleKey: string;
  authority: string;
  province: string | null;
  category: string;
  description: string;
  stRate: string;
  whtFactor: string;
  appliesTo: string;
  keywords: string[] | null;
  active: boolean;
  notes: string | null;
}

export function STRuleEditor({ rule }: { rule: STRule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: rule.description,
    stRate: parseFloat(rule.stRate),
    whtFactor: parseFloat(rule.whtFactor),
    appliesTo: rule.appliesTo as "registered" | "unregistered" | "all",
    keywords: (rule.keywords ?? []).join(", "),
    active: rule.active,
    notes: rule.notes ?? "",
  });

  const effective = (form.stRate * form.whtFactor).toFixed(2);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/st-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          stRate: form.stRate,
          whtFactor: form.whtFactor,
          appliesTo: form.appliesTo,
          keywords: form.keywords.split(",").map((k: string) => k.trim()).filter(Boolean),
          active: form.active,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed");
      toast.success("ST WHT rule updated");
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
          <DialogTitle>Edit ST Rule — {rule.ruleKey}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>ST Rate (%)</Label>
              <Input
                type="number" step="0.001" min="0" max="100"
                value={form.stRate}
                onChange={(e) => setForm((f) => ({ ...f, stRate: parseFloat(e.target.value) }))}
              />
            </div>
            <div>
              <Label>WHT Factor</Label>
              <Input
                type="number" step="0.001" min="0" max="1"
                value={form.whtFactor}
                onChange={(e) => setForm((f) => ({ ...f, whtFactor: parseFloat(e.target.value) }))}
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">0.2 = 1/5th · 1.0 = full</p>
            </div>
            <div>
              <Label>Effective Rate</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-semibold">
                {effective}%
              </div>
            </div>
          </div>

          <div>
            <Label>Applies to</Label>
            <Select
              value={form.appliesTo}
              onValueChange={(v) => v && setForm((f) => ({ ...f, appliesTo: v as typeof form.appliesTo }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="registered">Registered suppliers only</SelectItem>
                <SelectItem value="unregistered">Unregistered suppliers only</SelectItem>
                <SelectItem value="all">All suppliers</SelectItem>
              </SelectContent>
            </Select>
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
