"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function VendorTypeEditor({
  id,
  type,
  verified,
}: {
  id: string;
  type: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(verified ? type : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/vendors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientType: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1">
      <select
        aria-label={`Verified recipient type for vendor ${id}`}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="max-w-full rounded border p-1 text-xs"
      >
        <option value="">Verify from evidence</option>
        <option value="company">Company</option>
        <option value="individual_aop">Individual / AOP</option>
        <option value="non_resident">Non-resident</option>
      </select>
      <button
        type="button"
        disabled={!selected || busy}
        onClick={save}
        className="block text-xs underline disabled:opacity-50"
      >
        {busy ? "Saving…" : "Confirm recipient type"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
