CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "challan_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"section" text NOT NULL,
	"payment_head_code" text,
	"total_gross" numeric(18, 2) NOT NULL,
	"total_wht" numeric(18, 2) NOT NULL,
	"cpr_number" text,
	"payment_date" date,
	"bank_name" text,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ntn" text,
	"strn" text,
	"financial_year_end" date,
	"incorporation_date" date,
	"registered_office" text,
	"paid_up_capital" numeric(18, 2),
	"atl_last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_account_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_code" text NOT NULL,
	"rule_key" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "company_account_mappings_company_id_account_code_unique" UNIQUE("company_id","account_code")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cnic" text,
	"designation" text,
	"monthly_gross" numeric(18, 2),
	"annual_projected" numeric(18, 2),
	"tax_year" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gl_transaction_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_txn_id" uuid NOT NULL,
	"rule_key" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gl_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_file" text,
	"txn_date" date NOT NULL,
	"description" text,
	"account_code" text,
	"ref" text,
	"folio" text,
	"debit" numeric(18, 2) DEFAULT '0',
	"credit" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"vendor_id" uuid,
	"extracted_vendor_name" text,
	"auto_tag" text,
	"tag_confidence" numeric(3, 2) DEFAULT '0',
	"tag_source" text,
	"is_split" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "salary_wht_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"gross_salary" numeric(18, 2) NOT NULL,
	"taxable_income" numeric(18, 2) NOT NULL,
	"wht_amount" numeric(18, 2) NOT NULL,
	"slab_applied" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "secp_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"incorporation_date" date NOT NULL,
	"financial_year_end" date NOT NULL,
	"paid_up_capital" numeric(18, 2),
	"registered_office" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "secp_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secp_company_id" uuid NOT NULL,
	"filing_type" text NOT NULL,
	"due_date" date NOT NULL,
	"trigger_date" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"filed_date" date,
	"penalty_accrued" numeric(12, 2) DEFAULT '0',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"password_hash" text,
	"role" text DEFAULT 'accountant' NOT NULL,
	"company_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"recipient_type" text DEFAULT 'company' NOT NULL,
	"is_filer" boolean,
	"is_non_resident" boolean DEFAULT false NOT NULL,
	"is_exempt" boolean DEFAULT false NOT NULL,
	"exemption_cert_expiry" date,
	"preferred_rule" text,
	"atl_last_checked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "vendors_company_id_tax_id_unique" UNIQUE("company_id","tax_id")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wht_batch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"wht_line_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wht_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_gross" numeric(18, 2) DEFAULT '0',
	"total_wht" numeric(18, 2) DEFAULT '0',
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wht_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"gl_txn_id" uuid,
	"gl_split_id" uuid,
	"vendor_id" uuid,
	"rule_id" integer,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"gross_amount" numeric(18, 2) NOT NULL,
	"wht_rate" numeric(6, 3) NOT NULL,
	"wht_amount" numeric(18, 2) NOT NULL,
	"tax_status" text NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"override_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wht_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_key" text NOT NULL,
	"section" text NOT NULL,
	"sub_section" text,
	"description" text NOT NULL,
	"recipient_type" text DEFAULT 'all' NOT NULL,
	"rate_filer" numeric(6, 3) NOT NULL,
	"rate_non_filer" numeric(6, 3) NOT NULL,
	"threshold_amount" numeric(18, 2) DEFAULT '0',
	"is_tiered" boolean DEFAULT false NOT NULL,
	"tiered_rates" jsonb,
	"uses_slab_rates" boolean DEFAULT false NOT NULL,
	"keywords" text[] DEFAULT '{}',
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wht_rules_rule_key_unique" UNIQUE("rule_key")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challan_records" ADD CONSTRAINT "challan_records_batch_id_wht_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."wht_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_account_mappings" ADD CONSTRAINT "company_account_mappings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transaction_splits" ADD CONSTRAINT "gl_transaction_splits_gl_txn_id_gl_transactions_id_fk" FOREIGN KEY ("gl_txn_id") REFERENCES "public"."gl_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_wht_lines" ADD CONSTRAINT "salary_wht_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_wht_lines" ADD CONSTRAINT "salary_wht_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secp_companies" ADD CONSTRAINT "secp_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secp_obligations" ADD CONSTRAINT "secp_obligations_secp_company_id_secp_companies_id_fk" FOREIGN KEY ("secp_company_id") REFERENCES "public"."secp_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_batch_items" ADD CONSTRAINT "wht_batch_items_batch_id_wht_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."wht_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_batch_items" ADD CONSTRAINT "wht_batch_items_wht_line_id_wht_lines_id_fk" FOREIGN KEY ("wht_line_id") REFERENCES "public"."wht_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_batches" ADD CONSTRAINT "wht_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_batches" ADD CONSTRAINT "wht_batches_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_lines" ADD CONSTRAINT "wht_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_lines" ADD CONSTRAINT "wht_lines_gl_txn_id_gl_transactions_id_fk" FOREIGN KEY ("gl_txn_id") REFERENCES "public"."gl_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_lines" ADD CONSTRAINT "wht_lines_gl_split_id_gl_transaction_splits_id_fk" FOREIGN KEY ("gl_split_id") REFERENCES "public"."gl_transaction_splits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_lines" ADD CONSTRAINT "wht_lines_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_lines" ADD CONSTRAINT "wht_lines_rule_id_wht_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."wht_rules"("id") ON DELETE no action ON UPDATE no action;