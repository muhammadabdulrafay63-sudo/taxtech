/** Public identifiers and invented data only. Credentials are stored separately. */
export const judgeFixture = {
  companyId: "2c7794f2-c5c3-4985-84d6-d2757066eb18",
  userId: "81edc9d2-761d-4061-9688-d4184a92a8a7",
  goodsVendorId: "3c59f719-c133-45ca-852e-8e33dc0d2c0d",
  servicesVendorId: "ae8f8515-c433-4b6a-8bb5-9eedfdbcfac2",
  companyName: "TaxTech Judge Demo - synthetic data only",
  preparedPeriod: "2025-03",
  practicePeriod: "2025-04",
  incomeTotal: "16250.00",
} as const;
export const judgeExamples = [
  {
    day: "07",
    description: "Demo Stationery - Payment against office supplies invoice",
    accountCode: "DEMO-GOODS",
    amount: "100000.00",
    vendorId: judgeFixture.goodsVendorId,
    incomeKey: "153_goods_company",
    salesKey: "ty25_fbr_active_unregistered_buyer",
    incomeGross: "118000.00",
    salesTax: "18000.00",
  },
  {
    day: "08",
    description: "Demo Assurance - Annual professional engagement renewal",
    accountCode: "DEMO-SERVICES",
    amount: "100000.00",
    vendorId: judgeFixture.servicesVendorId,
    incomeKey: "153_services_company",
    salesKey: "ty25_srb_standard",
    incomeGross: "115000.00",
    salesTax: "15000.00",
  },
  {
    day: "09",
    description: "Internal transfer between own bank accounts",
    accountCode: "DEMO-TRANSFER",
    amount: "25000.00",
    vendorId: null,
    incomeKey: null,
    salesKey: null,
    incomeGross: null,
    salesTax: null,
  },
] as const;
export function mayResetJudgePractice(
  user:
    | { id?: string; companyId?: string | null; role?: string }
    | null
    | undefined,
  confirmation: unknown,
) {
  return (
    !!user &&
    user.id === judgeFixture.userId &&
    user.companyId === judgeFixture.companyId &&
    user.role === "accountant" &&
    confirmation === "RESET_SYNTHETIC_APRIL"
  );
}
