import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  numeric,
  serial,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AISuggestion } from "../lib/review-policy";
import type { TaxAssessment } from "../lib/tax-assessment";

// ─── Auth (NextAuth v5 required tables) ──────────────────────────────────────

export const operationalCounters = pgTable(
  "operational_counters",
  {
    minute: timestamp("minute", { withTimezone: true }).notNull(),
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [unique().on(t.minute, t.kind)],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  sessionVersion: integer("session_version").notNull().default(1),
  role: text("role").notNull().default("accountant"), // superadmin | company_admin | accountant | viewer
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ─── Core: Companies ─────────────────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ntn: text("ntn"),
  strn: text("strn"), // Sales Tax Registration Number
  financialYearEnd: date("financial_year_end"), // e.g. "2024-06-30"
  incorporationDate: date("incorporation_date"),
  registeredOffice: text("registered_office"),
  paidUpCapital: numeric("paid_up_capital", { precision: 18, scale: 2 }),
  atlLastSyncedAt: timestamp("atl_last_synced_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Vendors ─────────────────────────────────────────────────────────────────

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    taxId: text("tax_id"), // NTN or CNIC (for Income WHT)
    strn: text("strn"), // Sales Tax Registration Number (for ST WHT)
    recipientType: text("recipient_type").notNull().default("company"), // company | individual_aop | non_resident
    recipientTypeVerifiedAt: timestamp("recipient_type_verified_at", {
      mode: "date",
    }),
    isFiler: boolean("is_filer"), // null = unknown — for Income Tax ATL
    isStRegistered: boolean("is_st_registered"), // null = unknown — for ST ATL (STRN)
    province: text("province"), // Sindh | Punjab | KPK | Balochistan | ICT — for provincial ST
    isNonResident: boolean("is_non_resident").notNull().default(false),
    isExempt: boolean("is_exempt").notNull().default(false),
    exemptionCertExpiry: date("exemption_cert_expiry"),
    preferredRule: text("preferred_rule"), // FK to wht_rules.rule_key
    preferredStRule: text("preferred_st_rule"), // FK to st_wht_rules.rule_key
    atlLastCheckedAt: timestamp("atl_last_checked_at", { mode: "date" }),
    strnLastCheckedAt: timestamp("strn_last_checked_at", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [unique().on(t.companyId, t.taxId)],
);

// ─── GL Transactions ──────────────────────────────────────────────────────────

export const glTransactions = pgTable(
  "gl_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    sourceFile: text("source_file"),
    txnDate: date("txn_date").notNull(),
    description: text("description"),
    accountCode: text("account_code"),
    ref: text("ref"), // JV, BPV, etc.
    folio: text("folio"),
    debit: numeric("debit", { precision: 18, scale: 2 }).default("0"),
    credit: numeric("credit", { precision: 18, scale: 2 }).default("0"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(), // normalized
    vendorId: uuid("vendor_id").references(() => vendors.id),
    extractedVendorName: text("extracted_vendor_name"), // parsed from description
    autoTag: text("auto_tag"), // income WHT rule_key
    tagConfidence: numeric("tag_confidence", {
      precision: 3,
      scale: 2,
    }).default("0"),
    tagSource: text("tag_source"), // account_mapping | vendor_memory | keyword
    stWhtTag: text("st_wht_tag"), // ST WHT rule_key (null = not subject to ST WHT)
    reviewStatus: text("review_status").notNull().default("pending"),
    reviewNote: text("review_note"),
    taxAssessment: jsonb("tax_assessment").$type<TaxAssessment>(),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    aiSuggestion: jsonb("ai_suggestion").$type<AISuggestion>(),
    isSplit: boolean("is_split").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [
    index("gl_company_date_idx").on(t.companyId, t.txnDate),
    index("gl_company_review_idx").on(t.companyId, t.reviewStatus),
  ],
);

// ─── GL Transaction Splits (for blended invoices) ────────────────────────────

export const glTransactionSplits = pgTable("gl_transaction_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  glTxnId: uuid("gl_txn_id")
    .notNull()
    .references(() => glTransactions.id, { onDelete: "cascade" }),
  ruleKey: text("rule_key").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Company Account Mappings (deterministic tagging layer) ──────────────────

export const companyAccountMappings = pgTable(
  "company_account_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    accountCode: text("account_code").notNull(),
    ruleKey: text("rule_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [unique().on(t.companyId, t.accountCode)],
);

// ─── WHT Rules Master ─────────────────────────────────────────────────────────

export const whtRules = pgTable("wht_rules", {
  id: serial("id").primaryKey(),
  ruleKey: text("rule_key").unique().notNull(),
  section: text("section").notNull(), // e.g. "153"
  subSection: text("sub_section"), // e.g. "(1)(b)"
  description: text("description").notNull(),
  recipientType: text("recipient_type").notNull().default("all"), // all | company | individual_aop | non_resident
  rateFiler: numeric("rate_filer", { precision: 6, scale: 3 }).notNull(),
  rateNonFiler: numeric("rate_non_filer", { precision: 6, scale: 3 }).notNull(),
  thresholdAmount: numeric("threshold_amount", {
    precision: 18,
    scale: 2,
  }).default("0"),
  isTiered: boolean("is_tiered").notNull().default(false), // for Section 155 rent slabs
  tieredRates: jsonb("tiered_rates"), // [{upTo, rateFiler, rateNonFiler}]
  usesSlabRates: boolean("uses_slab_rates").notNull().default(false), // Section 149 salary
  keywords: text("keywords").array().default([]),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ─── WHT Lines (calculated per transaction) ───────────────────────────────────

export const whtLines = pgTable("wht_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  glTxnId: uuid("gl_txn_id").references(() => glTransactions.id),
  glSplitId: uuid("gl_split_id").references(() => glTransactionSplits.id),
  vendorId: uuid("vendor_id").references(() => vendors.id),
  ruleId: integer("rule_id").references(() => whtRules.id),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(),
  whtRate: numeric("wht_rate", { precision: 6, scale: 3 }).notNull(),
  whtAmount: numeric("wht_amount", { precision: 18, scale: 2 }).notNull(),
  taxStatus: text("tax_status").notNull(), // filer | non_filer | unknown
  needsReview: boolean("needs_review").notNull().default(false),
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  overrideNote: text("override_note"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Monthly Batches ──────────────────────────────────────────────────────────

export const whtBatches = pgTable(
  "wht_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    status: text("status").notNull().default("draft"), // draft | approved | paid
    totalGross: numeric("total_gross", { precision: 18, scale: 2 }).default(
      "0",
    ),
    totalWht: numeric("total_wht", { precision: 18, scale: 2 }).default("0"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [unique("wht_company_period_unique").on(t.companyId, t.year, t.month)],
);

export const whtBatchItems = pgTable("wht_batch_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => whtBatches.id, { onDelete: "cascade" }),
  whtLineId: uuid("wht_line_id")
    .notNull()
    .references(() => whtLines.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Sales Tax WHT Rules Master ──────────────────────────────────────────────
// Finance Act 2024 | SRB / PRA / KPRA / BRA / FBR ST

export const stWhtRules = pgTable("st_wht_rules", {
  id: serial("id").primaryKey(),
  ruleKey: text("rule_key").unique().notNull(),
  authority: text("authority").notNull(), // FBR | SRB | PRA | KPRA | BRA
  province: text("province"), // Sindh | Punjab | KPK | Balochistan | ICT | National
  category: text("category").notNull(), // goods | services | specific
  description: text("description").notNull(),
  stRate: numeric("st_rate", { precision: 6, scale: 3 }).notNull(), // e.g. 17.000 (FBR goods), 13.000 (SRB)
  whtFactor: numeric("wht_factor", { precision: 6, scale: 4 }).notNull(), // 0.2000 = 1/5th, 1.0000 = full
  appliesTo: text("applies_to").notNull().default("registered"), // registered | unregistered | all
  keywords: text("keywords").array().default([]),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ─── ST WHT Lines (calculated per transaction) ───────────────────────────────

export const stWhtLines = pgTable("st_wht_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  glTxnId: uuid("gl_txn_id").references(() => glTransactions.id),
  vendorId: uuid("vendor_id").references(() => vendors.id),
  ruleId: integer("rule_id").references(() => stWhtRules.id),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(), // pre-tax invoice value
  stRate: numeric("st_rate", { precision: 6, scale: 3 }).notNull(),
  stAmount: numeric("st_amount", { precision: 18, scale: 2 }).notNull(), // grossAmount × stRate
  whtFactor: numeric("wht_factor", { precision: 6, scale: 4 }).notNull(),
  whtAmount: numeric("wht_amount", { precision: 18, scale: 2 }).notNull(), // stAmount × whtFactor
  authority: text("authority").notNull(), // FBR | SRB | PRA | KPRA | BRA
  stRegisteredStatus: text("st_registered_status").notNull(), // registered | unregistered | unknown
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── ST WHT Batches (one per authority per month) ────────────────────────────

export const stWhtBatches = pgTable(
  "st_wht_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    authority: text("authority").notNull(), // FBR | SRB | PRA | KPRA | BRA
    status: text("status").notNull().default("draft"), // draft | approved | filed
    totalGross: numeric("total_gross", { precision: 18, scale: 2 }).default(
      "0",
    ),
    totalSt: numeric("total_st", { precision: 18, scale: 2 }).default("0"),
    totalWht: numeric("total_wht", { precision: 18, scale: 2 }).default("0"),
    filedDate: date("filed_date"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [
    unique("st_company_period_authority_unique").on(
      t.companyId,
      t.year,
      t.month,
      t.authority,
    ),
  ],
);

export const stWhtBatchItems = pgTable("st_wht_batch_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => stWhtBatches.id, { onDelete: "cascade" }),
  stWhtLineId: uuid("st_wht_line_id")
    .notNull()
    .references(() => stWhtLines.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Challans (one per section per batch) ─────────────────────────────────────

export const challanRecords = pgTable(
  "challan_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => whtBatches.id, { onDelete: "cascade" }),
    section: text("section").notNull(), // e.g. "153", "155", "233"
    paymentHeadCode: text("payment_head_code"), // FBR IRIS payment head
    totalGross: numeric("total_gross", { precision: 18, scale: 2 }).notNull(),
    totalWht: numeric("total_wht", { precision: 18, scale: 2 }).notNull(),
    cprNumber: text("cpr_number"), // filled after actual bank payment
    paymentDate: date("payment_date"),
    bankName: text("bank_name"),
    pdfUrl: text("pdf_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [unique("challan_batch_section_unique").on(t.batchId, t.section)],
);

// ─── Employees (Section 149 Salary WHT) ──────────────────────────────────────

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cnic: text("cnic"),
  designation: text("designation"),
  monthlyGross: numeric("monthly_gross", { precision: 18, scale: 2 }),
  annualProjected: numeric("annual_projected", { precision: 18, scale: 2 }),
  taxYear: integer("tax_year"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const salaryWhtLines = pgTable("salary_wht_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  grossSalary: numeric("gross_salary", { precision: 18, scale: 2 }).notNull(),
  taxableIncome: numeric("taxable_income", {
    precision: 18,
    scale: 2,
  }).notNull(),
  whtAmount: numeric("wht_amount", { precision: 18, scale: 2 }).notNull(),
  slabApplied: text("slab_applied"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(), // APPROVE_BATCH | EDIT_RULE | UPLOAD_GL | OVERRIDE_WHT_LINE | etc.
    entityType: text("entity_type"), // wht_batch | wht_rule | gl_transaction | vendor
    entityId: text("entity_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [index("audit_company_time_idx").on(t.companyId, t.createdAt)],
);

// ─── SECP Module ──────────────────────────────────────────────────────────────

export const secpCompanies = pgTable(
  "secp_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    incorporationDate: date("incorporation_date").notNull(),
    financialYearEnd: date("financial_year_end").notNull(),
    paidUpCapital: numeric("paid_up_capital", { precision: 18, scale: 2 }),
    registeredOffice: text("registered_office"),
    officerCount: integer("officer_count"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [unique("secp_company_unique").on(t.companyId)],
);

export const secpObligations = pgTable("secp_obligations", {
  id: uuid("id").primaryKey().defaultRandom(),
  secpCompanyId: uuid("secp_company_id")
    .notNull()
    .references(() => secpCompanies.id, { onDelete: "cascade" }),
  filingType: text("filing_type").notNull(), // FORM_A | FORM_29 | AGM | AUDITED_ACCOUNTS | FORM_28 | FORM_9 | FORM_21 | BENEFICIAL_OWNERSHIP | SPECIAL_RESOLUTION | FORM_10
  dueDate: date("due_date").notNull(),
  triggerDate: date("trigger_date"), // AGM date, officer change date, etc.
  status: text("status").notNull().default("pending"), // pending | filed | overdue | waived
  filedDate: date("filed_date"),
  penaltyAccrued: numeric("penalty_accrued", {
    precision: 12,
    scale: 2,
  }).default("0"),
  notes: text("notes"),
  periodYear: integer("period_year"),
  provisional: boolean("provisional").notNull().default(false),
  origin: text("origin").notNull().default("legacy"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  vendors: many(vendors),
  glTransactions: many(glTransactions),
  companyAccountMappings: many(companyAccountMappings),
  whtLines: many(whtLines),
  whtBatches: many(whtBatches),
  employees: many(employees),
  auditLogs: many(auditLogs),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  company: one(companies, {
    fields: [vendors.companyId],
    references: [companies.id],
  }),
  glTransactions: many(glTransactions),
  whtLines: many(whtLines),
}));

export const glTransactionsRelations = relations(
  glTransactions,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [glTransactions.companyId],
      references: [companies.id],
    }),
    vendor: one(vendors, {
      fields: [glTransactions.vendorId],
      references: [vendors.id],
    }),
    whtLines: many(whtLines),
    splits: many(glTransactionSplits),
  }),
);

export const whtLinesRelations = relations(whtLines, ({ one, many }) => ({
  company: one(companies, {
    fields: [whtLines.companyId],
    references: [companies.id],
  }),
  glTransaction: one(glTransactions, {
    fields: [whtLines.glTxnId],
    references: [glTransactions.id],
  }),
  vendor: one(vendors, {
    fields: [whtLines.vendorId],
    references: [vendors.id],
  }),
  rule: one(whtRules, { fields: [whtLines.ruleId], references: [whtRules.id] }),
  batchItems: many(whtBatchItems),
}));

export const whtBatchesRelations = relations(whtBatches, ({ one, many }) => ({
  company: one(companies, {
    fields: [whtBatches.companyId],
    references: [companies.id],
  }),
  items: many(whtBatchItems),
  challans: many(challanRecords),
}));

export const whtBatchItemsRelations = relations(whtBatchItems, ({ one }) => ({
  batch: one(whtBatches, {
    fields: [whtBatchItems.batchId],
    references: [whtBatches.id],
  }),
  whtLine: one(whtLines, {
    fields: [whtBatchItems.whtLineId],
    references: [whtLines.id],
  }),
}));

export const aiRequestLimits = pgTable("ai_request_limits", {
  bucket: text("bucket").primaryKey(),
  used: integer("used").notNull().default(0),
});
export const workflowLocks = pgTable("workflow_locks", {
  companyId: uuid("company_id")
    .primaryKey()
    .references(() => companies.id),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const ledgerImports = pgTable(
  "ledger_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.companyId, t.fingerprint)],
);
