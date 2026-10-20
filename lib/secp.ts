/** Calendar rules from the supplied SECP workbook. UTC calendar dates. */
export interface SECPObligation {
  filingType: string;
  dueDate: string;
  triggerDate?: string;
  notes: string;
  periodYear?: number;
  provisional?: boolean;
}
export function addCalendarDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function addCalendarMonths(date: string, months: number) {
  const d = new Date(date + "T00:00:00Z"),
    day = d.getUTCDate();
  const end =
    day ===
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0),
  );
  if (!end) target.setUTCDate(Math.min(day, target.getUTCDate()));
  return target.toISOString().slice(0, 10);
}
export const eventRules = {
  FORM_29: { days: 15, label: "Officer change" },
  FORM_21: { days: 15, label: "Registered office change" },
  FORM_9: { days: 30, label: "Share allotment" },
  SPECIAL_RESOLUTION: { days: 15, label: "Special resolution" },
  FORM_10: { days: 30, label: "Charge registration" },
  FORM_15: { days: 30, label: "Satisfaction of charge" },
  BENEFICIAL_OWNERSHIP_CHANGE: {
    days: 15,
    label: "Beneficial ownership change",
  },
  ALTERATION_MOA: { days: 15, label: "Alteration of memorandum" },
} as const;
export function generateAnnualObligations(
  financialYearEnd: Date,
  forYear: number,
  incorporationDate?: string,
): SECPObligation[] {
  const month = financialYearEnd.getUTCMonth();
  const day = financialYearEnd.getUTCDate();
  const fye = new Date(
    Date.UTC(
      forYear,
      month,
      Math.min(day, new Date(Date.UTC(forYear, month + 1, 0)).getUTCDate()),
    ),
  )
    .toISOString()
    .slice(0, 10);
  if (incorporationDate && fye < incorporationDate) return [];
  const priorFye = `${forYear - 1}-${fye.slice(5)}`;
  const first = !!incorporationDate && priorFye < incorporationDate;
  const agm = first
    ? addCalendarMonths(incorporationDate!, 18)
    : addCalendarMonths(fye, 4);
  return [
    {
      filingType: "AGM",
      dueDate: agm,
      periodYear: forYear,
      notes: first
        ? "First AGM: within 18 months of incorporation. Record the actual meeting date to set dependent deadlines."
        : "AGM: financial year end + 4 months. Record the actual meeting date to set dependent deadlines.",
    },
    ...[
      { filingType: "FORM_A", days: 30, label: "Annual return" },
      { filingType: "AUDITED_ACCOUNTS", days: 30, label: "Audited accounts" },
      { filingType: "FORM_28", days: 15, label: "Auditor appointment" },
    ].map((r) => ({
      filingType: r.filingType,
      dueDate: addCalendarDays(agm, r.days),
      triggerDate: agm,
      periodYear: forYear,
      provisional: true,
      notes: `${r.label}: actual AGM + ${r.days} days. Provisional until the actual AGM is recorded.`,
    })),
    {
      filingType: "BENEFICIAL_OWNERSHIP",
      dueDate: fye,
      periodYear: forYear,
      notes:
        "Annual review of beneficial ownership register. Changes create a separate 15-day deadline. Flat penalty is contingent on detected non-compliance, not automatically accrued.",
    },
  ];
}
export function calcPenalty(
  filingType: string,
  dueDate: string,
  officerCount?: number,
  asOf = new Date().toISOString().slice(0, 10),
): number {
  const days = Math.max(
    0,
    Math.round((Date.parse(asOf) - Date.parse(dueDate)) / 86400000),
  );
  if (!days) return 0;
  if (
    filingType === "BENEFICIAL_OWNERSHIP" ||
    filingType === "BENEFICIAL_OWNERSHIP_CHANGE"
  )
    return 0;
  if (filingType === "AGM") return officerCount ? officerCount * 10000 : 0;
  if (filingType === "FORM_10" || filingType === "FORM_15") return 0;
  return days * 1000;
}
