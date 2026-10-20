export const TOUR_SEEN_ACTION = "APP_TOUR_SEEN";
export function tourSteps(viewer: boolean) {
  return [
    {
      title: "Welcome to TaxTech",
      eyebrow: "Your workspace, in a few steps",
      description:
        "Follow a ledger from upload to a reviewed tax batch. This quick tour shows you where everything lives.",
      points: [
        "Your dashboard shows pending reviews, batches and compliance tasks.",
        viewer
          ? "You have read-only access. Ask your company administrator to make changes."
          : "You choose the tax treatment and approve every entry. AI offers suggestions.",
      ],
      page: null,
    },
    {
      title: "Start with your ledger",
      eyebrow: "01 · Upload",
      description: viewer
        ? "Your team uploads the ledger from GL Upload. You can inspect the imported entries in Transactions."
        : "Open GL Upload and choose an Excel or CSV file. Map the columns, check the preview, then confirm the import.",
      points: [
        "Give each column a unique heading and use amounts with at most two decimal places.",
        "Importing creates pending entries. It never approves them.",
      ],
      page: viewer ? "transactions" : "upload",
    },
    {
      title: "Review unclear entries with AI",
      eyebrow: "02 · Review",
      description:
        "Review ledger brings the pending entries together. AI can suggest an income-tax category and explain what information is missing.",
      points: [
        "Check both income-tax and sales-tax treatment against your evidence.",
        "Leave unclear entries pending. AI cannot approve, pay or file for you.",
      ],
      page: "review",
    },
    {
      title: "Confirm supplier details",
      eyebrow: "03 · Verify",
      description:
        "Open Vendors to check the supplier's recipient type, filer status and sales-tax registration before approving a batch.",
      points: [
        "A supplier name or known filer status does not prove recipient type.",
        "If details change after calculation, recalculate the draft.",
      ],
      page: "vendors",
    },
    {
      title: "Generate and check a batch",
      eyebrow: "04 · Calculate",
      description:
        "Income WHT and Sales Tax WHT have separate monthly batches. Review every entry for the month before calculating.",
      points: [
        "Check draft amounts and resolve missing supplier evidence before approval.",
        "The supplied schedules support July 2024–June 2025. Approved batches are locked.",
      ],
      page: "wht/monthly",
    },
    {
      title: "You’re ready to explore",
      eyebrow: "05 · Keep track",
      description:
        "Use Challans for internal summaries, Reconciliation for payments and differences, and SECP for your compliance calendar.",
      points: [
        "Payments and filings happen outside TaxTech. Record a CPR only after confirming the actual payment.",
        "Use Ask TaxTech for page guidance. Reopen this tour with App tour in the top bar.",
      ],
      page: "challans",
    },
  ] as const;
}
