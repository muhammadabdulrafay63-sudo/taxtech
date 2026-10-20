import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requestAllowed } from "./request-access";
export async function requireCompany(
  companyId: string,
  allowPasswordChange = false,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (
    !(await requestAllowed(
      session.user.id,
      `/company/${companyId}`,
      "GET",
      companyId,
    ))
  )
    redirect("/dashboard");
  if (
    !allowPasswordChange &&
    (session.user as { mustChangePassword?: boolean }).mustChangePassword
  )
    redirect(`/company/${companyId}/settings`);
  return session;
}
