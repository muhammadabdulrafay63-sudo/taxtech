import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UploadWizard } from "@/components/upload/UploadWizard";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UploadPage({ params }: Props) {
  const [session, { id }] = await Promise.all([auth(), params]);

  if (!session?.user) redirect("/login");
  await requireCompany(id);

  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) redirect("/dashboard");

  // Superadmin can access any company; others can only access their own
  const role = (session.user as { role?: string }).role;
  if (role !== "superadmin" && companyId !== id) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">GL Upload</h1>
        <p className="text-sm text-muted-foreground">
          Import your General Ledger extract to begin WHT calculation
        </p>
      </div>
      <UploadWizard companyId={id} />
    </div>
  );
}
