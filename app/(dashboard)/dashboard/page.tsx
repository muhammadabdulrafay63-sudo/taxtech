import { formatPKR } from "@/lib/money";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { glTransactions, whtBatches, secpObligations, secpCompanies } from "@/db/schema";
import { eq, count, and, lte, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileUp,
  ReceiptText,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) redirect("/login");
  if((session.user as {mustChangePassword?:boolean}).mustChangePassword)redirect(`/company/${companyId}/settings`);

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  // Fetch real stats
  const [txnCount, draftBatchCount, overdueSECP, reviewCounts, totalTax, secpSetup, batchCount] = await Promise.all([
    db.select({ count: count() }).from(glTransactions).where(eq(glTransactions.companyId, companyId)),
    db.select({ count: count() }).from(whtBatches).where(
      and(eq(whtBatches.companyId, companyId), eq(whtBatches.status, "draft"))
    ),
    db.select({ count: count() }).from(secpObligations)
      .innerJoin(secpCompanies, eq(secpObligations.secpCompanyId, secpCompanies.id))
      .where(
        and(
          eq(secpCompanies.companyId, companyId),
          eq(secpObligations.status, "pending"),
          lte(secpObligations.dueDate, new Date().toISOString().split("T")[0])
        )
      ),
    db.select({pending:sql<number>`count(*) filter (where review_status='pending')`}).from(glTransactions).where(eq(glTransactions.companyId,companyId)),
    db.select({total:sql<string>`coalesce(sum(${whtBatches.totalWht}),0)`}).from(whtBatches).where(eq(whtBatches.companyId,companyId)),
    db.select({count:count()}).from(secpCompanies).where(eq(secpCompanies.companyId,companyId)),
    db.select({count:count()}).from(whtBatches).where(eq(whtBatches.companyId,companyId)),
  ]);

  const hasTransactions = (txnCount[0]?.count ?? 0) > 0;
  const draftBatches = draftBatchCount[0]?.count ?? 0;
  const secpOverdue = overdueSECP[0]?.count ?? 0;

  // Getting started steps
  const steps = [
    {
      label: "Upload your first GL extract",
      done: hasTransactions,
      href: `/company/${companyId}/upload`,
      cta: "Upload GL",
    },
    {
      label: "Review and approve ledger entries",
      done: hasTransactions && Number(reviewCounts[0]?.pending) === 0,
      href: `/company/${companyId}/review`,
      cta: "Review ledger",
      disabled: !hasTransactions,
    },
    {
      label: "Generate your first monthly WHT batch",
      done: Number(batchCount[0]?.count) > 0,
      href: `/company/${companyId}/wht/monthly`,
      cta: "Go to WHT",
      disabled: !hasTransactions,
    },
    {
      label: "Set up SECP compliance calendar",
      done: Number(secpSetup[0]?.count) > 0,
      href: `/company/${companyId}/secp`,
      cta: "Set up SECP",
    },
  ];

  const nextStep = steps.find((s) => !s.done && !s.disabled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {firstName}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s your compliance status at a glance.</p>
        </div>
        {nextStep && (
          <Link
            href={nextStep.href}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {nextStep.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Next deadline banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
        <Clock className="h-4 w-4 flex-shrink-0 text-amber-600" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Demo tax schedules: verify the applicable rates and deadlines before filing. This app does not submit returns or make payments.
        </span>
        <Badge variant="outline" className="ml-auto flex-shrink-0 border-amber-400 text-amber-700 dark:text-amber-400">
          Demo schedules
        </Badge>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="GL Transactions"
          value={txnCount[0]?.count ?? 0}
          icon={<FileUp className="h-4 w-4 text-muted-foreground" />}
          status={(txnCount[0]?.count ?? 0) > 0 ? "ok" : "neutral"}
          hint={hasTransactions ? "Transactions in the system" : "No GL uploaded yet"}
          href={hasTransactions ? `/company/${companyId}/transactions` : `/company/${companyId}/upload`}
          linkLabel={hasTransactions ? "View all" : "Upload now"}
        />
        <StatCard
          title="Draft WHT Batches"
          value={draftBatches}
          icon={<ReceiptText className="h-4 w-4 text-muted-foreground" />}
          status={draftBatches > 0 ? "warn" : "neutral"}
          hint={draftBatches > 0 ? "Batches awaiting approval" : "No pending batches"}
          href={`/company/${companyId}/wht/monthly`}
          linkLabel="View batches"
        />
        <StatCard
          title="WHT Calculated"
          value={formatPKR(totalTax[0]?.total ?? "0")}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          status="neutral"
          hint={Number(batchCount[0]?.count)>0?"Total across generated income batches":"Run a monthly batch to calculate"}
          href={`/company/${companyId}/wht/monthly`}
          linkLabel="Calculate WHT"
        />
        <StatCard
          title="SECP Overdue"
          value={secpOverdue}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          status={secpOverdue > 0 ? "error" : "neutral"}
          hint={secpOverdue > 0 ? "Filings past their configured due date" : Number(secpSetup[0]?.count)>0?"No overdue recorded filings":"SECP calendar not set up yet"}
          href={`/company/${companyId}/secp`}
          linkLabel="View SECP"
        />
      </div>

      {/* Getting started checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
                  ) : (
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-xs text-muted-foreground">
                      {i + 1}
                    </div>
                  )}
                  <span className={`text-sm ${step.done ? "text-muted-foreground line-through" : step.disabled ? "text-muted-foreground/50" : ""}`}>
                    {step.label}
                  </span>
                </div>
                {!step.done && !step.disabled && (
                  <Link
                    href={step.href}
                    className="flex-shrink-0 inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted"
                  >
                    {step.cta}
                  </Link>
                )}
                {step.disabled && (
                  <Badge variant="secondary" className="flex-shrink-0 text-xs">Locked</Badge>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title, value, icon, status, hint, href, linkLabel,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  status: "ok" | "warn" | "error" | "neutral";
  hint: string;
  href: string;
  linkLabel: string;
}) {
  const valueColor = { ok: "text-green-600", warn: "text-amber-600", error: "text-red-600", neutral: "text-foreground" }[status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {linkLabel} →
        </Link>
      </CardContent>
    </Card>
  );
}
