/**
 * Seed Sales Tax WHT Rules
 * Based on: Sales_Tax_WHT_Database.xlsx
 * Finance Act 2024 | FBR + SRB + PRA + KPRA + BRA
 *
 * ST WHT Formula: wht_amount = gross_amount × (st_rate/100) × wht_factor
 * - wht_factor 0.2 = 1/5th of ST charged (registered suppliers — standard)
 * - wht_factor 1.0 = full ST withheld (unregistered, special categories, services)
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { stWhtRules } from "./schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient);

const rules = [
  // ─── FBR FEDERAL — GOODS ───────────────────────────────────────────────────
  {
    ruleKey: "fbr_goods_registered",
    authority: "FBR",
    province: "National",
    category: "goods",
    description:
      "Supply of goods by ST-registered supplier (standard 1/5th WHT)",
    stRate: "17.000",
    whtFactor: "0.2000", // 1/5th = 3.4% of gross
    appliesTo: "registered",
    keywords: [
      "goods",
      "purchase",
      "material",
      "stock",
      "inventory",
      "raw material",
      "packaging",
      "supply",
    ],
    notes:
      "Standard FBR ST WHT. Supplier charges 17% ST on invoice — buyer withholds 1/5th (20% of ST = 3.4% of gross). Supplier claims remaining 4/5ths as input.",
  },
  {
    ruleKey: "fbr_goods_unregistered",
    authority: "FBR",
    province: "National",
    category: "goods",
    description: "Supply of goods by ST-unregistered supplier (full 17% WHT)",
    stRate: "17.000",
    whtFactor: "1.0000", // Full 17% of gross
    appliesTo: "unregistered",
    keywords: ["goods unregistered", "unregistered supplier"],
    notes:
      "Unregistered supplier — buyer must withhold full 17% ST. High compliance risk — avoid unregistered suppliers. Supplier cannot show ST on invoice but buyer still liable.",
  },
  {
    ruleKey: "fbr_goods_steel",
    authority: "FBR",
    province: "National",
    category: "specific",
    description:
      "Supply of steel / iron products (full ST withholding — special regime)",
    stRate: "17.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "steel",
      "iron",
      "rebar",
      "bars",
      "rods",
      "sheets",
      "girder",
      "pipe",
      "structural",
    ],
    notes:
      "Special regime for steel products — full ST withheld at source regardless of registration status.",
  },
  {
    ruleKey: "fbr_goods_scrap",
    authority: "FBR",
    province: "National",
    category: "specific",
    description: "Supply of scrap / waste material (full ST withholding)",
    stRate: "17.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["scrap", "waste", "recycling", "salvage", "junk", "discarded"],
    notes: "Full ST withholding on scrap and waste purchases.",
  },
  {
    ruleKey: "fbr_goods_edible_oil",
    authority: "FBR",
    province: "National",
    category: "goods",
    description: "Supply of edible oil, ghee, margarine (1/5th ST WHT)",
    stRate: "17.000",
    whtFactor: "0.2000",
    appliesTo: "registered",
    keywords: [
      "edible oil",
      "cooking oil",
      "ghee",
      "margarine",
      "vegetable oil",
    ],
    notes: "Standard 1/5th WHT on edible oil and ghee purchases.",
  },
  {
    ruleKey: "fbr_goods_petroleum",
    authority: "FBR",
    province: "National",
    category: "specific",
    description: "Petroleum products — OMC to dealer/distributor (full ST)",
    stRate: "17.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "petrol",
      "diesel",
      "fuel",
      "petroleum",
      "lubricant",
      "oil marketing",
      "OMC",
      "HSD",
      "motor spirit",
    ],
    notes:
      "Oil marketing companies withhold full ST on supply to dealers. Full 17% withheld.",
  },

  // ─── FBR FEDERAL — SERVICES (ICT / Islamabad) ────────────────────────────
  {
    ruleKey: "fbr_ict_services_general",
    authority: "FBR",
    province: "ICT",
    category: "services",
    description:
      "Taxable services in Islamabad Capital Territory — general (full 16% ST WHT)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["islamabad", "ICT", "federal capital", "federal territory"],
    notes:
      "ICT services tax at 16%. Full withholding by registered withholding agents in Islamabad.",
  },
  {
    ruleKey: "fbr_ict_consulting",
    authority: "FBR",
    province: "ICT",
    category: "services",
    description:
      "Consulting / professional / legal / IT services in ICT (full 16% ST)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "consulting",
      "advisory",
      "legal",
      "law firm",
      "accountant",
      "audit",
      "tax",
      "IT services",
      "software",
      "management consultant",
    ],
    notes:
      "Professional services in Islamabad — full ICT ST withheld. Also covers IT services, accounting, legal fees.",
  },
  {
    ruleKey: "fbr_ict_construction",
    authority: "FBR",
    province: "ICT",
    category: "services",
    description: "Construction / renovation services in ICT (full 16% ST)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "construction",
      "renovation",
      "civil works",
      "fit-out",
      "fitout",
      "interior",
      "contractor",
    ],
    notes:
      "Civil works, renovation, fit-out projects in Islamabad — full ST withholding.",
  },
  {
    ruleKey: "fbr_ict_advertising",
    authority: "FBR",
    province: "ICT",
    category: "services",
    description: "Advertising / media services in ICT (full 16% ST)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "advertising",
      "media",
      "marketing",
      "digital marketing",
      "print",
      "TV",
      "radio",
      "billboard",
    ],
    notes: "Print, electronic, digital advertising in ICT — full ST withheld.",
  },
  {
    ruleKey: "fbr_ict_courier",
    authority: "FBR",
    province: "ICT",
    category: "services",
    description: "Courier / freight / logistics services in ICT (full 16% ST)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "courier",
      "freight",
      "logistics",
      "transport",
      "cargo",
      "delivery",
      "TCS",
      "Leopard",
    ],
    notes: "Transport and courier services in ICT — full ST withholding.",
  },

  // ─── SRB — SINDH REVENUE BOARD ───────────────────────────────────────────
  {
    ruleKey: "srb_services_general",
    authority: "SRB",
    province: "Sindh",
    category: "services",
    description: "Taxable services in Sindh — general (full 13% SST WHT)",
    stRate: "13.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["karachi", "sindh", "SRB", "sindh revenue"],
    notes:
      "Sindh Services Tax at 13%. Full withholding by SRB-registered withholding agents. File on srb.gov.pk by 15th.",
  },
  {
    ruleKey: "srb_consulting",
    authority: "SRB",
    province: "Sindh",
    category: "services",
    description:
      "Consulting / professional / legal / accounting services in Sindh (full 13%)",
    stRate: "13.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "consulting",
      "advisory",
      "legal",
      "lawyer",
      "accountant",
      "CA",
      "audit",
      "management",
    ],
    notes:
      "Legal, accounting, IT, management consulting in Sindh — full SRB ST withheld.",
  },
  {
    ruleKey: "srb_construction",
    authority: "SRB",
    province: "Sindh",
    category: "services",
    description: "Construction / civil works in Sindh (full 13% SST)",
    stRate: "13.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "construction",
      "renovation",
      "civil works",
      "contractor",
      "fit-out",
    ],
    notes: "Civil construction, renovation in Sindh — SRB ST withheld.",
  },
  {
    ruleKey: "srb_it_services",
    authority: "SRB",
    province: "Sindh",
    category: "services",
    description: "IT / software / telecom services in Sindh (full 13% SST)",
    stRate: "13.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "IT",
      "software",
      "technology",
      "telecom",
      "internet",
      "data",
      "hosting",
      "cloud",
    ],
    notes: "Software development, IT services, telecom in Sindh.",
  },
  {
    ruleKey: "srb_restaurants",
    authority: "SRB",
    province: "Sindh",
    category: "services",
    description: "Restaurant / catering / hospitality in Sindh (full 13% SST)",
    stRate: "13.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "restaurant",
      "catering",
      "food",
      "hotel",
      "hospitality",
      "event",
      "banquet",
    ],
    notes:
      "Restaurant bills and catering in Sindh paid by withholding agent — SRB ST withheld.",
  },

  // ─── PRA — PUNJAB REVENUE AUTHORITY ──────────────────────────────────────
  {
    ruleKey: "pra_services_general",
    authority: "PRA",
    province: "Punjab",
    category: "services",
    description: "Taxable services in Punjab — general (full 16% PST WHT)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["lahore", "punjab", "PRA", "punjab revenue"],
    notes:
      "Punjab Services Tax at 16%. File on pra.punjab.gov.pk by 15th. Different portal from FBR IRIS.",
  },
  {
    ruleKey: "pra_consulting",
    authority: "PRA",
    province: "Punjab",
    category: "services",
    description:
      "Consulting / professional / legal / accounting services in Punjab (full 16%)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "consulting",
      "advisory",
      "legal",
      "lawyer",
      "accountant",
      "CA",
      "audit",
    ],
    notes: "CA firms, lawyers, consultants in Lahore — PRA ST withheld.",
  },
  {
    ruleKey: "pra_construction",
    authority: "PRA",
    province: "Punjab",
    category: "services",
    description: "Construction / renovation services in Punjab (full 16% PST)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "construction",
      "renovation",
      "civil works",
      "contractor",
      "fit-out",
    ],
    notes: "Renovation, civil works, fit-out in Lahore — PRA withholding.",
  },
  {
    ruleKey: "pra_it_services",
    authority: "PRA",
    province: "Punjab",
    category: "services",
    description: "IT / software services in Punjab (full 16% PST)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: [
      "IT",
      "software",
      "technology",
      "telecom",
      "internet",
      "hosting",
    ],
    notes: "Tech companies in Lahore — PRA ST on services.",
  },
  {
    ruleKey: "pra_freight",
    authority: "PRA",
    province: "Punjab",
    category: "services",
    description:
      "Freight / logistics / courier services in Punjab (full 16% PST)",
    stRate: "16.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["courier", "freight", "logistics", "transport", "cargo"],
    notes: "Transport, courier in Punjab — PRA ST applies.",
  },

  // ─── KPRA — KPK REVENUE AUTHORITY ────────────────────────────────────────
  {
    ruleKey: "kpra_services_general",
    authority: "KPRA",
    province: "KPK",
    category: "services",
    description: "Taxable services in Khyber Pakhtunkhwa — general (full 15%)",
    stRate: "15.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["peshawar", "KPK", "khyber", "pakhtunkhwa", "KPRA"],
    notes: "KPK services tax at 15%. File on kpra.gov.pk.",
  },
  {
    ruleKey: "kpra_consulting",
    authority: "KPRA",
    province: "KPK",
    category: "services",
    description: "Professional / consulting services in KPK (full 15%)",
    stRate: "15.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["consulting", "advisory", "legal", "accountant"],
    notes: "Professional services in KPK.",
  },
  {
    ruleKey: "kpra_hotel_restaurant",
    authority: "KPRA",
    province: "KPK",
    category: "services",
    description: "Hotel / restaurant / hospitality in KPK (full 15%)",
    stRate: "15.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["hotel", "restaurant", "catering", "hospitality"],
    notes: "Hospitality services in KPK.",
  },

  // ─── BRA — BALOCHISTAN REVENUE AUTHORITY ─────────────────────────────────
  {
    ruleKey: "bra_services_general",
    authority: "BRA",
    province: "Balochistan",
    category: "services",
    description: "Taxable services in Balochistan — general (full 15%)",
    stRate: "15.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["quetta", "balochistan", "BRA"],
    notes: "BRA services tax at 15%. File on bra.gov.pk.",
  },
  {
    ruleKey: "bra_hotel_restaurant",
    authority: "BRA",
    province: "Balochistan",
    category: "services",
    description: "Hotel / restaurant / hospitality in Balochistan (full 15%)",
    stRate: "15.000",
    whtFactor: "1.0000",
    appliesTo: "all",
    keywords: ["hotel", "restaurant", "catering", "hospitality"],
    notes: "Hospitality services in Balochistan.",
  },
];

async function main() {
  console.log(`Seeding ${rules.length} ST WHT rules…`);

  // Never cascade-delete financial history when seeding reference data.
  await db
    .insert(stWhtRules)
    .values(rules)
    .onConflictDoNothing({ target: stWhtRules.ruleKey });
  console.log("✓ ST WHT rules seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
