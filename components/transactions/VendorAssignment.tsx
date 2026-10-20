"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export type VendorOption = {
  id: string;
  name: string;
  recipientType: string;
  isFiler: boolean | null;
};
export function VendorAssignment({
  id,
  companyId,
  vendorId,
  vendors,
  disabled,
}: {
  id: string;
  companyId: string;
  vendorId: string | null;
  vendors: VendorOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(vendorId ?? "");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [filer, setFiler] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      let chosen = selected;
      if (selected === "new") {
        const res = await fetch("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            name,
            recipientType: type,
            isFiler: filer === "" ? null : filer === "true",
            notes: note,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        chosen = data.id;
      }
      const res = await fetch(`/api/transactions/${id}/vendor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: chosen || null, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save vendor.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-4 rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Vendor:{" "}
        {vendors.find((v) => v.id === vendorId)?.name ??
          "Missing — attach supporting supplier"}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Assign the actual supplier from evidence. Saving reopens review and
          clears the old AI suggestion. Approved periods stay locked.
        </p>
        <label className="block">
          Supplier
          <select
            aria-label={`Vendor for entry ${id}`}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="block w-full min-w-0 max-w-full rounded border p-2"
            disabled={disabled || busy}
          >
            <option value="">No vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.recipientType.replaceAll("_", " ")}
                {v.isFiler === null ? " · status unverified" : ""}
              </option>
            ))}
            <option value="new">Create a supplier…</option>
          </select>
        </label>
        {selected === "new" && (
          <>
            <label className="block">
              Supplier name
              <input
                aria-label="New supplier name"
                className="block w-full rounded border p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="block">
              Verified recipient type
              <select
                aria-label="New supplier recipient type"
                className="block w-full rounded border p-2"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">Choose from evidence</option>
                <option value="company">Company</option>
                <option value="individual_aop">Individual / AOP</option>
                <option value="non_resident">Non-resident</option>
              </select>
            </label>
            <label className="block">
              Verified income ATL status
              <select
                aria-label="New supplier filer status"
                className="block w-full rounded border p-2"
                value={filer}
                onChange={(e) => setFiler(e.target.value)}
              >
                <option value="">Not yet verified</option>
                <option value="true">Filer</option>
                <option value="false">Non-filer</option>
              </select>
            </label>
          </>
        )}
        <label className="block">
          Evidence / reason
          <textarea
            aria-label={`Vendor evidence for entry ${id}`}
            className="block w-full rounded border p-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1200}
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button
          type="button"
          onClick={save}
          disabled={
            disabled ||
            busy ||
            note.trim().length < 3 ||
            (selected === "new" && (!name.trim() || !type))
          }
        >
          {busy ? "Saving…" : "Save vendor and reopen review"}
        </Button>
      </div>
    </details>
  );
}
