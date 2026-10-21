import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  incomePolicies,
  salesPolicies,
  TAX_POLICY_VERSION,
} from "../lib/ty2025";
/** Atomic, repeatable upgrade. Never delete financial lines, batches or approved history. */
export async function applyTY2025Configuration(
  sql: NeonQueryFunction<false, false>,
) {
  const income = Object.entries(incomePolicies).map(([ruleKey, p]) => ({
    ruleKey,
    ...p,
  }));
  const sales = Object.entries(salesPolicies).map(([ruleKey, p]) => ({
    ruleKey,
    ...p,
  }));
  await sql.transaction([
    sql`LOCK TABLE workflow_locks IN EXCLUSIVE MODE`,
    sql`DO $$ BEGIN IF EXISTS(SELECT 1 FROM workflow_locks WHERE expires_at > now()) THEN RAISE EXCEPTION 'Company writes in progress; retry configuration migration later'; END IF; END $$`,
    sql`LOCK TABLE wht_rules, st_wht_rules IN SHARE ROW EXCLUSIVE MODE`,
    sql`ALTER TABLE gl_transactions ADD COLUMN IF NOT EXISTS tax_assessment jsonb`,
    sql`INSERT INTO audit_logs (action,entity_type,payload) SELECT 'CONFIGURE_TY2025','tax_policy',jsonb_build_object('version',${TAX_POLICY_VERSION}::text,'previousIncome',(SELECT jsonb_agg(to_jsonb(r)) FROM wht_rules r),'previousSales',(SELECT jsonb_agg(to_jsonb(r)) FROM st_wht_rules r))`,
    sql`UPDATE wht_rules SET active=false WHERE NOT (rule_key = ANY(${income.map((r) => r.ruleKey)}::text[]))`,
    sql`UPDATE st_wht_rules SET active=false WHERE NOT (rule_key = ANY(${sales.map((r) => r.ruleKey)}::text[]))`,
    sql`INSERT INTO wht_rules (rule_key,section,description,recipient_type,rate_filer,rate_non_filer,threshold_amount,is_tiered,uses_slab_rates,keywords,notes,active)
      SELECT x."ruleKey",x.section,x.description,x."recipientType",x."rateFiler"::numeric,x."rateNonFiler"::numeric,0,false,false,ARRAY(SELECT jsonb_array_elements_text(x.keywords)),x.notes,true
      FROM jsonb_to_recordset(${JSON.stringify(income)}::jsonb) AS x("ruleKey" text,section text,description text,"recipientType" text,"rateFiler" text,"rateNonFiler" text,keywords jsonb,notes text)
      ON CONFLICT (rule_key) DO UPDATE SET section=excluded.section,description=excluded.description,recipient_type=excluded.recipient_type,rate_filer=excluded.rate_filer,rate_non_filer=excluded.rate_non_filer,threshold_amount=0,is_tiered=false,tiered_rates=null,uses_slab_rates=false,keywords=excluded.keywords,notes=excluded.notes,active=true`,
    sql`INSERT INTO st_wht_rules (rule_key,authority,province,category,description,st_rate,wht_factor,applies_to,keywords,notes,active)
      SELECT x."ruleKey",x.authority,x.province,'reviewed_case',x.description,x."stRate"::numeric,x."whtFactor"::numeric,'registered',ARRAY[]::text[],x.notes,true
      FROM jsonb_to_recordset(${JSON.stringify(sales)}::jsonb) AS x("ruleKey" text,authority text,province text,description text,"stRate" text,"whtFactor" text,notes text)
      ON CONFLICT (rule_key) DO UPDATE SET authority=excluded.authority,province=excluded.province,description=excluded.description,st_rate=excluded.st_rate,wht_factor=excluded.wht_factor,applies_to=excluded.applies_to,notes=excluded.notes,active=true`,
    sql`INSERT INTO audit_logs (company_id,action,entity_type,entity_id,payload)
      SELECT t.company_id,'TY2025_REVIEW_REQUIRED','gl_transaction',t.id::text,jsonb_build_object('previousDecision',t.review_status,'previousReviewer',t.reviewed_by,'previousReviewedAt',t.reviewed_at,'previousNote',t.review_note,'version',${TAX_POLICY_VERSION}::text)
      FROM gl_transactions t WHERE t.review_status='approved' AND (t.auto_tag IS NOT NULL OR t.st_wht_tag IS NOT NULL) AND t.tax_assessment IS NULL
      AND NOT EXISTS(SELECT 1 FROM wht_batches b WHERE b.company_id=t.company_id AND b.year=extract(year FROM t.txn_date) AND b.month=extract(month FROM t.txn_date) AND b.status<>'draft')
      AND NOT EXISTS(SELECT 1 FROM st_wht_batches b WHERE b.company_id=t.company_id AND b.year=extract(year FROM t.txn_date) AND b.month=extract(month FROM t.txn_date) AND b.status<>'draft')`,
    sql`UPDATE gl_transactions t SET review_status='pending',reviewed_at=null,reviewed_by=null
      WHERE t.review_status='approved' AND (t.auto_tag IS NOT NULL OR t.st_wht_tag IS NOT NULL) AND t.tax_assessment IS NULL
      AND NOT EXISTS(SELECT 1 FROM wht_batches b WHERE b.company_id=t.company_id AND b.year=extract(year FROM t.txn_date) AND b.month=extract(month FROM t.txn_date) AND b.status<>'draft')
      AND NOT EXISTS(SELECT 1 FROM st_wht_batches b WHERE b.company_id=t.company_id AND b.year=extract(year FROM t.txn_date) AND b.month=extract(month FROM t.txn_date) AND b.status<>'draft')`,
  ]);
}
