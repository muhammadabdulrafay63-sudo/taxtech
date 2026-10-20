import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { secpCompanies, secpObligations, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { SECPSetupForm } from "./SECPSetupForm";
import { ObligationRow } from "./ObligationRow";
import { CalendarActions } from "./CalendarActions";
import { calcPenalty } from "@/lib/secp";

interface Props {
  params: Promise<{ id: string }>;
}

const FILING_LABELS: Record<string, string> = {
  AGM: "Annual General Meeting",
  FORM_A: "Annual Return (Form A)",
  AUDITED_ACCOUNTS: "Audited Financial Statements",
  FORM_28: "Auditor Appointment (Form 28)",
  FORM_29: "Director Change (Form 29)",
  BENEFICIAL_OWNERSHIP: "Beneficial Ownership Register",
  BENEFICIAL_OWNERSHIP_CHANGE: "Beneficial ownership change",
  FORM_21: "Registered office change",
  FORM_15: "Satisfaction of charge",
  SPECIAL_RESOLUTION: "Special resolution",
  ALTERATION_MOA: "Alteration of memorandum",
  FORM_9: "Allotment of Shares (Form 9)",
  FORM_10: "Transfer of Shares (Form 10)",
};

export default async function SECPPage({ params }: Props) {
  const [session, { id: companyId }] = await Promise.all([auth(), params]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const [secpCo] = await db
    .select()
    .from(secpCompanies)
    .where(eq(secpCompanies.companyId, companyId))
    .limit(1);

  const obligations = secpCo
    ? await db
        .select()
        .from(secpObligations)
        .where(eq(secpObligations.secpCompanyId, secpCo.id))
        .orderBy(secpObligations.dueDate)
    : [];

  // Recalculate live penalty for each obligation
  const today = new Date();
  const enriched = obligations.map((o) => ({
    ...o,
    isOverdue:
      !["filed", "waived"].includes(o.status) &&
      !o.provisional &&
      o.origin !== "legacy" &&
      new Date(o.dueDate) < today,
    penalty:
      ["filed", "waived"].includes(o.status) ||
      o.provisional ||
      o.origin === "legacy"
        ? 0
        : calcPenalty(
            o.filingType,
            o.dueDate,
            secpCo?.officerCount ?? undefined,
          ),
  }));

  const overdueCount = enriched.filter((o) => o.isOverdue).length;
  const filedCount = enriched.filter(
    (o) =>
      o.status === "filed" &&
      o.filedDate?.startsWith(String(today.getFullYear())),
  ).length;
  const totalPenalty = enriched
    .filter((o) => o.isOverdue)
    .reduce((s, o) => s + o.penalty, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">SECP Compliance</h1>
        <p className="text-sm text-muted-foreground">
          Supplied SECP schedule. Dependent deadlines remain provisional until
          you record the actual AGM.
        </p>
      </div>

      {!secpCo ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Setup SECP Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter your company&apos;s incorporation date and financial year
              end to auto-generate your compliance calendar.
            </p>
            <SECPSetupForm
              companyId={companyId}
              defaultIncorporationDate={company?.incorporationDate ?? ""}
              defaultFye={company?.financialYearEnd ?? ""}
              defaultCapital={company?.paidUpCapital ?? ""}
              defaultOffice={company?.registeredOffice ?? ""}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <CalendarActions />
          <p className="text-xs text-muted-foreground">
            Penalty figures are estimates from your supplied workbook. Officer
            count is required for an AGM estimate. Beneficial ownership
            penalties depend on detected non-compliance. No fees or penalties
            are charged by this app.
          </p>
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Overdue Filings</p>
                <p
                  className={`mt-1 text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {overdueCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Filed this Year</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {filedCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Accrued Penalty Risk
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${totalPenalty > 0 ? "text-red-600" : "text-muted-foreground"}`}
                >
                  {totalPenalty > 0
                    ? `PKR ${totalPenalty.toLocaleString()}`
                    : "Nil"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Profile card */}
          <Card>
            <CardContent className="flex flex-wrap gap-6 pt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Company</p>
                <p className="font-semibold">{company?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Incorporation Date</p>
                <p className="font-semibold">{secpCo.incorporationDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Financial Year End</p>
                <p className="font-semibold">{secpCo.financialYearEnd}</p>
              </div>
              {secpCo.paidUpCapital && (
                <div>
                  <p className="text-muted-foreground">Paid-up Capital</p>
                  <p className="font-semibold">
                    PKR {parseFloat(secpCo.paidUpCapital).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="ml-auto flex items-center">
                <SECPSetupForm
                  companyId={companyId}
                  defaultIncorporationDate={secpCo.incorporationDate ?? ""}
                  defaultFye={secpCo.financialYearEnd ?? ""}
                  defaultCapital={secpCo.paidUpCapital ?? ""}
                  defaultOffice={secpCo.registeredOffice ?? ""}
                  defaultOfficerCount={secpCo.officerCount}
                  isEdit
                />
              </div>
            </CardContent>
          </Card>

          {/* Obligations table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filing Calendar</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Filing
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Penalty
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((o) => (
                    <ObligationRow
                      key={o.id}
                      id={o.id}
                      label={FILING_LABELS[o.filingType] ?? o.filingType}
                      dueDate={o.dueDate}
                      status={o.status}
                      filedDate={o.filedDate}
                      penalty={o.penalty}
                      notes={o.notes}
                      isOverdue={o.isOverdue}
                      provisional={o.provisional || o.origin === "legacy"}
                      legacy={o.origin === "legacy"}
                    />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
