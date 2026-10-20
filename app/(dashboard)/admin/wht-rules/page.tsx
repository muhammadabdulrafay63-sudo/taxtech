import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { whtRules, stWhtRules } from "@/db/schema";
import { asc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RuleEditor } from "./RuleEditor";
import { STRuleEditor } from "./STRuleEditor";

const AUTHORITY_COLORS: Record<string, string> = {
  FBR:  "bg-blue-100 text-blue-800",
  SRB:  "bg-emerald-100 text-emerald-800",
  PRA:  "bg-purple-100 text-purple-800",
  KPRA: "bg-orange-100 text-orange-800",
  BRA:  "bg-rose-100 text-rose-800",
};

export default async function AdminWHTRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "superadmin") redirect("/dashboard");

  const [incomeRules, stRules] = await Promise.all([
    db.select().from(whtRules).orderBy(asc(whtRules.section), asc(whtRules.ruleKey)),
    db.select().from(stWhtRules).orderBy(asc(stWhtRules.authority), asc(stWhtRules.ruleKey)),
  ]);

  const bySection = incomeRules.reduce<Record<string, typeof incomeRules>>((acc, r) => {
    (acc[r.section] ??= []).push(r);
    return acc;
  }, {});

  const byAuthority = stRules.reduce<Record<string, typeof stRules>>((acc, r) => {
    (acc[r.authority] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">WHT Rules Master</h1>
        <p className="text-sm text-muted-foreground">
          Finance Act 2024. Changes affect future calculations only — approved batches are unaffected.
        </p>
      </div>

      {/* ── Income Tax WHT Rules ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Income Tax WHT Rules</h2>
          <Badge variant="secondary">{incomeRules.length} rules</Badge>
          <span className="text-xs text-muted-foreground">Income Tax Ordinance 2001 · FBR IRIS · Challan by 7th</span>
        </div>

        {Object.entries(bySection).sort(([a], [b]) => a.localeCompare(b)).map(([section, sectionRules]) => (
          <div key={section}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Section {section}
            </h3>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Rule Key</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Recipient</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Filer %</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Non-filer %</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Threshold</th>
                      <th className="px-4 py-2 text-center font-medium text-muted-foreground">Active</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sectionRules.map((r) => (
                      <tr key={r.id} className={`border-b last:border-0 ${!r.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-2 font-mono text-xs text-primary">{r.ruleKey}</td>
                        <td className="px-4 py-2 max-w-xs">
                          <p className="truncate">{r.description}</p>
                          {r.keywords && r.keywords.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              {r.keywords.slice(0, 4).join(", ")}{r.keywords.length > 4 ? "…" : ""}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {r.recipientType.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-green-700">{parseFloat(r.rateFiler).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right font-semibold text-red-700">{parseFloat(r.rateNonFiler).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                          {parseFloat(r.thresholdAmount ?? "0") > 0
                            ? `PKR ${parseFloat(r.thresholdAmount!).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block h-2 w-2 rounded-full ${r.active ? "bg-green-500" : "bg-muted-foreground"}`} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <RuleEditor rule={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* ── Sales Tax WHT Rules ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Sales Tax WHT Rules</h2>
          <Badge variant="secondary">{stRules.length} rules</Badge>
          <span className="text-xs text-muted-foreground">Sales Tax Act 1990 + Provincial ST Acts · Filed with ST return by 15th</span>
        </div>

        {Object.entries(byAuthority).sort(([a], [b]) => a.localeCompare(b)).map(([authority, authRules]) => (
          <div key={authority}>
            <div className="mb-2 flex items-center gap-2">
              <Badge className={AUTHORITY_COLORS[authority] ?? "bg-muted text-muted-foreground"}>
                {authority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {authRules[0]?.province ?? ""} — {authRules.length} rules
              </span>
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Rule Key</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Applies to</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">ST Rate %</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">WHT Factor</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Effective %</th>
                      <th className="px-4 py-2 text-center font-medium text-muted-foreground">Active</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {authRules.map((r) => {
                      const effective = parseFloat(r.stRate) * parseFloat(r.whtFactor);
                      const isFullWht = parseFloat(r.whtFactor) === 1;
                      return (
                        <tr key={r.id} className={`border-b last:border-0 ${!r.active ? "opacity-50" : ""}`}>
                          <td className="px-4 py-2 font-mono text-xs text-primary">{r.ruleKey}</td>
                          <td className="px-4 py-2 max-w-xs">
                            <p className="truncate">{r.description}</p>
                            {r.keywords && r.keywords.length > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                {r.keywords.slice(0, 4).join(", ")}{r.keywords.length > 4 ? "…" : ""}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-xs capitalize">{r.category}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground capitalize">{r.appliesTo}</td>
                          <td className="px-4 py-2 text-right">{parseFloat(r.stRate).toFixed(0)}%</td>
                          <td className="px-4 py-2 text-right text-xs">
                            {isFullWht
                              ? <span className="font-semibold text-red-700">Full (1/1)</span>
                              : <span className="font-semibold text-amber-700">1/5th (0.2)</span>}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {effective.toFixed(2)}%
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block h-2 w-2 rounded-full ${r.active ? "bg-green-500" : "bg-muted-foreground"}`} />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <STRuleEditor rule={r} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
