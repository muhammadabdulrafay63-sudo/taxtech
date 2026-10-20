import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanySettingsForm } from "./CompanySettingsForm";

import { PasswordForm } from "@/components/layout/PasswordForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const [session, { id: companyId }] = await Promise.all([auth(), params]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId, true);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) redirect("/dashboard");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Company Settings</h1>
        {(session.user as { mustChangePassword?: boolean })
          .mustChangePassword && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Change your legacy password below before using this account.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Manage your company profile and tax registration details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanySettingsForm companyId={companyId} company={company} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account security</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
