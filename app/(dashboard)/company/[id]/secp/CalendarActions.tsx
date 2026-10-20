"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { eventRules } from "@/lib/secp";
import { Button } from "@/components/ui/button";
export function CalendarActions() {
  const router = useRouter();
  const [kind, setKind] = useState("event");
  const [type, setType] = useState("FORM_29");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [label, setLabel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() + 2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/secp/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "annual"
            ? { kind, year }
            : kind === "manual"
              ? { kind, label, dueDate: date, notes }
              : { kind, filingType: type, triggerDate: date, notes },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-medium">
        Add a company event or extend the calendar
      </summary>
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          Calendar action
          <select
            className="block w-full rounded border p-2"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="event">Event from supplied schedule</option>
            <option value="annual">Add fiscal year</option>
            <option value="manual">Other filing / prerequisite</option>
          </select>
        </label>
        {kind === "annual" ? (
          <label>
            Fiscal year
            <input
              required
              type="number"
              min={1900}
              max={2200}
              className="block w-full rounded border p-2"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
        ) : (
          <>
            {kind === "event" ? (
              <label>
                Event
                <select
                  className="block w-full rounded border p-2"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {Object.entries(eventRules).map(([key, v]) => (
                    <option value={key} key={key}>
                      {v.label} (+{v.days} days)
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Filing or prerequisite
                <input
                  required
                  className="block w-full rounded border p-2"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={100}
                />
              </label>
            )}
            <label>
              {kind === "event" ? "Actual event date" : "Verified due date"}
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full rounded border p-2"
              />
            </label>
            <label>
              Evidence and instructions
              <textarea
                required
                minLength={3}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full rounded border p-2"
              />
            </label>
          </>
        )}
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Record supporting evidence and handle the filing externally. In-app
          calendar reminders do not send email. Use Other filing for
          incorporation documents, EGM notice/minutes, share-transfer
          prerequisites, name change or winding up; their conditions require
          professional review.
        </p>
        {error && (
          <p role="alert" className="text-destructive sm:col-span-2">
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : "Add to calendar"}
        </Button>
      </form>
    </details>
  );
}
