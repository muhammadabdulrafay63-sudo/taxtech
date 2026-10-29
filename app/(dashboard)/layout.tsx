import { TAX_YEAR_CONFIGURATION_NOTICE } from "@/lib/product";
import { AppTour } from "@/components/onboarding/AppTour";
import { TOUR_SEEN_ACTION } from "@/lib/app-tour";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { AppAssistant } from "@/components/ai/AppAssistant";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/db";
import { companies, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { judgeFixture } from "@/lib/judge-fixture";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const companyId = (session.user as { companyId?: string }).companyId ?? "";

  let companyName = "My Company";
  if (companyId) {
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId));
    if (company) companyName = company.name;
  }

  const tourEnabled =
    !!companyId &&
    !(session.user as { mustChangePassword?: boolean }).mustChangePassword;
  const seenTour = tourEnabled
    ? await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.actorId, session.user.id!),
            eq(auditLogs.action, TOUR_SEEN_ACTION),
          ),
        )
        .limit(1)
    : [];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        companyId={companyId}
        companyName={companyName}
        userRole={(session.user as { role?: string }).role}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNavigation
          companyId={companyId}
          companyName={companyName}
          userRole={(session.user as { role?: string }).role}
        />
        <Topbar
          userName={session.user.name}
          userEmail={session.user.email}
          userRole={(session.user as { role?: string }).role}
          tourEnabled={tourEnabled}
        />
        <main className="min-w-0 flex-1 overflow-y-auto bg-muted/30 p-4 pb-24 sm:p-6 sm:pb-24">
          <p className="mb-4 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            {TAX_YEAR_CONFIGURATION_NOTICE}
          </p>
          {companyId === judgeFixture.companyId &&
            session.user.id === judgeFixture.userId && (
              <p className="mb-4 rounded-md border bg-background p-3 text-sm">
                <strong>Synthetic judge workspace.</strong> Start with the{" "}
                <Link
                  className="underline"
                  href={`/company/${companyId}/judge`}
                >
                  judge testing guide
                </Link>{" "}
                for the completed example, practice ledger and reset. Use
                invented data only.
              </p>
            )}
          {children}
        </main>
      </div>
      {tourEnabled && (
        <AppTour
          key={session.user.id}
          autoStart={!seenTour.length}
          companyId={companyId}
          viewer={(session.user as { role?: string }).role === "viewer"}
        />
      )}
      <AppAssistant />
      <Toaster richColors />
    </div>
  );
}
