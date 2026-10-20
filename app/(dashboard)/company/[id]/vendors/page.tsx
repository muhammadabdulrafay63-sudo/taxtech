import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { VendorFilerToggle } from "./VendorFilerToggle";
import { VendorStrnToggle } from "./VendorStrnToggle";
import { AddVendorDialog } from "./AddVendorDialog";

import { VendorTypeEditor } from "./VendorTypeEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VendorsPage({ params }: Props) {
  const [session, { id: companyId }] = await Promise.all([auth(), params]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  const rows = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      taxId: vendors.taxId,
      strn: vendors.strn,
      recipientType: vendors.recipientType,
      recipientTypeVerifiedAt: vendors.recipientTypeVerifiedAt,
      isFiler: vendors.isFiler,
      isStRegistered: vendors.isStRegistered,
      province: vendors.province,
      isExempt: vendors.isExempt,
      isNonResident: vendors.isNonResident,
      atlLastCheckedAt: vendors.atlLastCheckedAt,
      strnLastCheckedAt: vendors.strnLastCheckedAt,
    })
    .from(vendors)
    .where(eq(vendors.companyId, companyId))
    .orderBy(vendors.name);

  const filerCount = rows.filter((v) => v.isFiler === true).length;
  const nonFilerCount = rows.filter((v) => v.isFiler === false).length;
  const unknownCount = rows.filter((v) => v.isFiler === null).length;
  const stRegisteredCount = rows.filter(
    (v) => v.isStRegistered === true,
  ).length;
  const stUnknownCount = rows.filter((v) => v.isStRegistered === null).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Set filer status for each vendor — it determines which WHT rate
            applies.
          </p>
        </div>
        <AddVendorDialog companyId={companyId} />
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge className="bg-green-100 text-green-800">
            {filerCount} Income filer
          </Badge>
          <Badge className="bg-red-100 text-red-800">
            {nonFilerCount} Non-filer
          </Badge>
          <Badge variant="secondary">{unknownCount} Unknown ATL</Badge>
          <Badge className="bg-blue-100 text-blue-800">
            {stRegisteredCount} ST Reg.
          </Badge>
          {stUnknownCount > 0 && (
            <Badge variant="secondary">{stUnknownCount} Unknown STRN</Badge>
          )}
        </div>
      </div>

      {(unknownCount > 0 || stUnknownCount > 0) && (
        <div className="space-y-2">
          {unknownCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              ⚠ <span className="font-semibold">{unknownCount} vendors</span>{" "}
              have unknown Income Tax filer status — non-filer rate applied as
              safe default.
            </div>
          )}
          {stUnknownCount > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
              ⚠ <span className="font-semibold">{stUnknownCount} vendors</span>{" "}
              have unknown STRN status — full ST WHT (100% of ST) applied as
              safe default.
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No vendors yet</p>
            <p className="text-sm text-muted-foreground">
              Vendors are created automatically when you import a GL file.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Vendor Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Recipient type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    NTN / CNIC
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    STRN
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Province
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Income WHT (ATL)
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    ST WHT (STRN)
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3">
                      <VendorTypeEditor
                        id={v.id}
                        type={v.recipientType}
                        verified={!!v.recipientTypeVerifiedAt}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {v.taxId || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {v.strn || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {v.province || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <VendorFilerToggle vendorId={v.id} isFiler={v.isFiler} />
                    </td>
                    <td className="px-4 py-3">
                      <VendorStrnToggle
                        vendorId={v.id}
                        isStRegistered={v.isStRegistered}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {v.isExempt && (
                          <Badge className="bg-purple-100 text-purple-800 text-[10px]">
                            Exempt
                          </Badge>
                        )}
                        {v.isNonResident && (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                            Non-res
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">
            Income Tax ATL (Filer Status)
          </p>
          <p>
            1. Go to{" "}
            <a
              href="https://fbr.gov.pk"
              target="_blank"
              className="text-primary underline"
            >
              fbr.gov.pk
            </a>{" "}
            → Active Taxpayer List (Income Tax)
          </p>
          <p>2. Search by NTN (companies) or CNIC (individuals)</p>
          <p>3. Toggle Filer / Non-filer using the Income WHT column</p>
          <p>4. ATL updated every Monday — re-check monthly</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">
            ST STRN (Sales Tax Registration)
          </p>
          <p>
            1. Go to{" "}
            <a
              href="https://fbr.gov.pk"
              target="_blank"
              className="text-primary underline"
            >
              fbr.gov.pk
            </a>{" "}
            → Active Taxpayer List (Sales Tax)
          </p>
          <p>2. Search by STRN or NTN — separate list from Income Tax ATL</p>
          <p>3. Toggle ST Reg. / Unregistered using the ST WHT column</p>
          <p>4. Also add STRN number in vendor profile for records</p>
          <p>
            5. <strong>Unregistered = full ST withheld</strong> (vs 1/5th for
            registered)
          </p>
        </div>
      </div>
    </div>
  );
}
