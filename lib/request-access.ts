import { db } from "@/db";
import {
  challanRecords,
  whtBatches,
  stWhtBatches,
  glTransactions,
  vendors,
  secpObligations,
  secpCompanies,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessCompany } from "./review-policy";

export async function requestAllowed(
  userId: string,
  pathname: string,
  method: string,
  bodyCompany?: string | null,
) {
  const [user] = await db
    .select({ companyId: users.companyId, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.companyId) return false;
  if (/^\/(api\/)?admin\//.test(pathname) && user.role !== "superadmin")
    return false;
  if (
    method !== "GET" &&
    user.role === "viewer" &&
    pathname !== "/api/ai/assistant" &&
    pathname !== "/api/account/password" &&
    pathname !== "/api/account/tour"
  )
    return false;
  if (bodyCompany && !canAccessCompany(user, bodyCompany)) return false;
  const companyPath = pathname.match(/^\/(?:api\/)?company\/([^/]+)/);
  if (companyPath && !canAccessCompany(user, companyPath[1])) return false;
  const txn = pathname.match(/^\/api\/transactions\/([0-9a-f-]{36})(?:\/|$)/i);
  const vendor = pathname.match(/^\/api\/vendors\/([^/]+)/);
  const batch = pathname.match(/\/(wht|st-wht)\/batch\/([^/]+)/);
  const challan = pathname.match(/^\/api\/wht\/challan\/([^/]+)/);
  const obligation = pathname.match(/^\/api\/secp\/obligations\/([^/]+)/);
  let owner: string | undefined;
  if (txn) {
    const [r] = await db
      .select({ companyId: glTransactions.companyId })
      .from(glTransactions)
      .where(eq(glTransactions.id, txn[1]))
      .limit(1);
    owner = r?.companyId;
  } else if (vendor) {
    const [r] = await db
      .select({ companyId: vendors.companyId })
      .from(vendors)
      .where(eq(vendors.id, vendor[1]))
      .limit(1);
    owner = r?.companyId;
  } else if (batch) {
    const table = batch[1] === "st-wht" ? stWhtBatches : whtBatches;
    const [r] = await db
      .select({ companyId: table.companyId })
      .from(table)
      .where(eq(table.id, batch[2]))
      .limit(1);
    owner = r?.companyId;
  } else if (challan) {
    const [r] = await db
      .select({ companyId: whtBatches.companyId })
      .from(challanRecords)
      .innerJoin(whtBatches, eq(challanRecords.batchId, whtBatches.id))
      .where(eq(challanRecords.id, challan[1]))
      .limit(1);
    owner = r?.companyId;
  } else if (obligation) {
    const [r] = await db
      .select({ companyId: secpCompanies.companyId })
      .from(secpObligations)
      .innerJoin(
        secpCompanies,
        eq(secpObligations.secpCompanyId, secpCompanies.id),
      )
      .where(eq(secpObligations.id, obligation[1]))
      .limit(1);
    owner = r?.companyId;
  }
  return txn || vendor || batch || challan || obligation
    ? !!owner && canAccessCompany(user, owner)
    : true;
}
