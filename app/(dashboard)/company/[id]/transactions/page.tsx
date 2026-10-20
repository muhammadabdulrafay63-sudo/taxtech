import { formatPKR } from "@/lib/money";
import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { glTransactions, vendors, whtRules, stWhtRules } from "@/db/schema";
import { eq, desc, isNull, and, or, ilike, sql } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, HelpCircle, Upload } from "lucide-react";
import { TransactionFilters } from "./TransactionFilters";
import { TagEditor } from "@/components/transactions/TagEditor";
import { STTagEditor } from "@/components/transactions/STTagEditor";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}

const PAGE_SIZE = 50;



function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TransactionsPage({
  params,
  searchParams,
}: Props) {
  const [session, { id: companyId }, sp] = await Promise.all([
    auth(),
    params,
    searchParams,
  ]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const searchQ = sp.q?.trim() ?? "";
  const tagFilter = sp.tag ?? "";

  // Build where conditions
  const conditions = [eq(glTransactions.companyId, companyId)];
  if (searchQ) {
    conditions.push(
      or(
        ilike(glTransactions.description, `%${searchQ}%`),
        ilike(glTransactions.extractedVendorName, `%${searchQ}%`),
        ilike(glTransactions.accountCode, `%${searchQ}%`),
      )!,
    );
  }
  if (tagFilter === "untagged") {
    conditions.push(isNull(glTransactions.autoTag));
  } else if (tagFilter && tagFilter !== "all") {
    conditions.push(eq(glTransactions.autoTag, tagFilter));
  }

  const [rows, totalResult, untaggedResult, allRules, allStRules] =
    await Promise.all([
      db
        .select({
          id: glTransactions.id,
          txnDate: glTransactions.txnDate,
          description: glTransactions.description,
          accountCode: glTransactions.accountCode,
          ref: glTransactions.ref,
          debit: glTransactions.debit,
          credit: glTransactions.credit,
          amount: glTransactions.amount,
          extractedVendorName: glTransactions.extractedVendorName,
          autoTag: glTransactions.autoTag,
          tagConfidence: glTransactions.tagConfidence,
          tagSource: glTransactions.tagSource,
          stWhtTag: glTransactions.stWhtTag,
          vendorName: vendors.name,
        })
        .from(glTransactions)
        .leftJoin(vendors, eq(glTransactions.vendorId, vendors.id))
        .where(and(...conditions))
        .orderBy(desc(glTransactions.txnDate))
        .limit(PAGE_SIZE)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(glTransactions)
        .where(and(...conditions)),

      db
        .select({ count: sql<number>`count(*)` })
        .from(glTransactions)
        .where(
          and(
            eq(glTransactions.companyId, companyId),
            isNull(glTransactions.autoTag),
          ),
        ),

      db
        .select({
          ruleKey: whtRules.ruleKey,
          section: whtRules.section,
          description: whtRules.description,
        })
        .from(whtRules)
        .where(eq(whtRules.active, true))
        .orderBy(whtRules.section),

      db
        .select({
          ruleKey: stWhtRules.ruleKey,
          authority: stWhtRules.authority,
          description: stWhtRules.description,
          stRate: stWhtRules.stRate,
          whtFactor: stWhtRules.whtFactor,
        })
        .from(stWhtRules)
        .where(eq(stWhtRules.active, true))
        .orderBy(stWhtRules.authority, stWhtRules.ruleKey),
    ]);

  const total = Number(totalResult[0]?.count ?? 0);
  const untagged = Number(untaggedResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} rows · {untagged} untagged
          </p>
        </div>
        <Link
          href={`/company/${companyId}/upload`}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload more
        </Link>
      </div>

      {/* Untagged alert */}
      {untagged > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">{untagged} transactions</span> have
            no WHT tag. Review them below — untagged rows are excluded from WHT
            calculations.
          </p>
          <Link
            href={`/company/${companyId}/transactions?tag=untagged`}
            className="ml-auto flex-shrink-0 text-xs font-medium text-amber-800 underline hover:no-underline dark:text-amber-300"
          >
            Show untagged
          </Link>
        </div>
      )}

      <Link
        href={`/company/${companyId}/review`}
        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Review ledger and AI suggestions →
      </Link>

      {/* Filters */}
      <TransactionFilters
        companyId={companyId}
        currentQ={searchQ}
        currentTag={tagFilter}
        rules={allRules}
        untaggedCount={untagged}
      />

      {/* Table */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            {total === 0 ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No transactions yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload a GL file to get started
                  </p>
                </div>
                <Link
                  href={`/company/${companyId}/upload`}
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Upload GL
                </Link>
              </>
            ) : (
              <>
                <HelpCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No transactions match your filters
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of{" "}
              {total.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-28">Account</TableHead>
                    <TableHead className="w-36">Vendor</TableHead>
                    <TableHead className="w-28 text-right">
                      Amount (PKR)
                    </TableHead>
                    <TableHead className="w-48">Income WHT Tag</TableHead>
                    <TableHead className="w-44">ST WHT Tag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(row.txnDate)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm">
                          {row.description || "—"}
                        </p>
                        {row.ref && (
                          <p className="text-[11px] text-muted-foreground">
                            {row.ref}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.accountCode || "—"}
                      </TableCell>
                      <TableCell>
                        {row.vendorName || row.extractedVendorName ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                            <span className="truncate text-xs">
                              {row.vendorName ?? row.extractedVendorName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatPKR(row.amount)}
                      </TableCell>
                      <TableCell>
                        <TagEditor
                          txnId={row.id}
                          currentTag={row.autoTag}
                          hasVendor={
                            !!(row.vendorName || row.extractedVendorName)
                          }
                          rules={allRules}
                        />
                      </TableCell>
                      <TableCell>
                        <STTagEditor
                          txnId={row.id}
                          currentTag={row.stWhtTag}
                          rules={allStRules}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/company/${companyId}/transactions?page=${page - 1}${searchQ ? `&q=${searchQ}` : ""}${tagFilter ? `&tag=${tagFilter}` : ""}`}
                className="rounded border px-3 py-1 hover:bg-muted"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/company/${companyId}/transactions?page=${page + 1}${searchQ ? `&q=${searchQ}` : ""}${tagFilter ? `&tag=${tagFilter}` : ""}`}
                className="rounded border px-3 py-1 hover:bg-muted"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
