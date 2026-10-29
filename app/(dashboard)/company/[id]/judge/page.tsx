import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/page-access";
import { judgeFixture } from "@/lib/judge-fixture";
import { ResetPractice } from "@/components/judge/ResetPractice";
import { db } from "@/db";
import { whtBatches } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export default async function JudgeGuide({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireCompany(id);
  if (id !== judgeFixture.companyId || session.user?.id !== judgeFixture.userId)
    redirect("/dashboard");
  const base = `/company/${id}`;
  const [prepared] = await db
    .select({ id: whtBatches.id })
    .from(whtBatches)
    .where(
      and(
        eq(whtBatches.companyId, id),
        eq(whtBatches.year, 2025),
        eq(whtBatches.month, 3),
      ),
    )
    .limit(1);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">Judge testing guide</h1>
      <p>
        Every vendor, status and invoice here is invented. No real taxpayer
        checks, filings or payments are performed. TaxTech provides AI-Assisted
        Withholding Tax Preparation. This demo is configured for FY2024–25
        (Tax Year 2025). Tax constants can be modified for any tax year, along
        with its rules and effective dates, through a validated developer
        configuration update. Other years are not enabled in this demo.
      </p>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">
          1. Inspect the completed example - March 2025
        </h2>
        <p className="text-sm">
          The prepared income batch is PKR 16,250 on PKR 233,000 gross payments.
          Sales-tax withholding is PKR 3,600 to FBR and PKR 3,000 to SRB. Open
          the approved batch and internal PDF summary.
        </p>
        <Link
          className="underline"
          href={
            prepared
              ? `${base}/wht/batch/${prepared.id}`
              : `${base}/wht/monthly`
          }
        >
          Open income batches
        </Link>
        <span> / </span>
        <Link className="underline" href={`${base}/challans`}>
          Open PDF summaries
        </Link>
      </section>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">2. Try it yourself - April 2025</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Open April review and choose Review unclear entries with AI. The
            runtime uses NVIDIA Nemotron on Nebius Token Factory.
          </li>
          <li>
            Read the explanations and questions. Use the invented invoice facts
            below to record the final treatment; AI never approves.
          </li>
          <li>
            For office goods: income category Ordinary goods - company, gross
            118,000. FBR active supplier to a company buyer NOT ST-registered:
            base 100,000, invoice tax 18,000.
          </li>
          <li>
            For the professional engagement: the supporting invoice is a
            statutory audit fee, not IT or another specified 4% service. Choose
            Other services - company, gross 115,000. SRB ordinary
            private-company-agent case: base 100,000, invoice tax 15,000.
          </li>
          <li>
            Assume both providers are resident companies, historically
            registered/active where relevant, without exemption; thresholds and
            withholding-agent eligibility are met. These are synthetic
            assumptions, not registry verification. Confirm eligibility and add
            a note identifying these demo facts.
          </li>
          <li>
            Exclude the internal bank transfer with a reason. Generate the
            income batch; separately calculate the FBR and SRB sales batches.
            Expected totals match March.
          </li>
          <li>
            Open Ask TaxTech and ask how to finish an unclear review. Observe
            its guidance and links.
          </li>
        </ol>
        <Link className="underline" href={`${base}/review?period=2025-04`}>
          Open April practice
        </Link>
      </section>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">3. Optional upload test - May 2025</h2>
        <p className="text-sm">
          Download the three-row CSV and upload it with Date, Description,
          Account Code, Debit, Credit and Reference mappings. Its May dates keep
          it separate from March and April. Re-importing identical bytes and
          mappings is deliberately rejected.
        </p>
        <Link className="underline" href="/judge-demo-ledger.csv">
          Download synthetic ledger
        </Link>
        <span> / </span>
        <Link className="underline" href={`${base}/upload`}>
          Open upload
        </Link>
      </section>
      <ResetPractice />
    </div>
  );
}
