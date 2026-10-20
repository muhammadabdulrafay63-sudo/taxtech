import { formatMoney } from "@/lib/money";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    borderBottom: "2px solid #1a1a1a",
    paddingBottom: 12,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666" },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    backgroundColor: "#f3f4f6",
    padding: "6 8",
    marginBottom: 6,
  },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 160, color: "#555" },
  value: { flex: 1, fontWeight: "bold" },
  table: { border: "1px solid #ddd", marginTop: 4 },
  tHead: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #ddd",
    padding: "5 8",
  },
  tRow: {
    flexDirection: "row",
    borderBottom: "1px solid #eee",
    padding: "5 8",
  },
  tCell: { flex: 1, fontSize: 8, paddingRight: 4 },
  tCellR: { flex: 2, fontSize: 7, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#f0fdf4",
    borderTop: "2px solid #16a34a",
    padding: "6 8",
  },
  totalLabel: { flex: 5, fontWeight: "bold", fontSize: 10 },
  totalValue: {
    flex: 2,
    fontWeight: "bold",
    fontSize: 8,
    textAlign: "right",
    color: "#16a34a",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1px solid #eee",
    paddingTop: 8,
    fontSize: 8,
    color: "#999",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notice: {
    marginTop: 20,
    padding: 10,
    border: "1px dashed #fbbf24",
    backgroundColor: "#fffbeb",
  },
  noticeText: { fontSize: 9, color: "#92400e" },
});

export interface ChallanLine {
  ruleKey: string;
  description: string;
  vendorName: string | null;
  grossAmount: string;
  whtRate: string;
  whtAmount: string;
  taxStatus: string;
}

export interface ChallanDocumentProps {
  companyName: string;
  companyNtn: string | null;
  period: string; // e.g. "July 2024"
  section: string;
  paymentHeadCode: string | null;
  lines: ChallanLine[];
  totalGross: string;
  totalWht: string;
  generatedAt: string;
}

export function ChallanDocument({
  companyName,
  companyNtn,
  period,
  section,
  paymentHeadCode,
  lines,
  totalGross,
  totalWht,
  generatedAt,
}: ChallanDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>WHT Payment Challan</Text>
          <Text style={s.subtitle}>
            Federal Board of Revenue — Income Tax Ordinance 2001
          </Text>
        </View>

        {/* Company & Period */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment Details</Text>
          <View style={s.row}>
            <Text style={s.label}>Company Name</Text>
            <Text style={s.value}>{companyName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>NTN</Text>
            <Text style={s.value}>{companyNtn || "Not provided"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Tax Period</Text>
            <Text style={s.value}>{period}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Tax Head / Section</Text>
            <Text style={s.value}>
              Section {section} — Income Tax Withholding
            </Text>
          </View>
          {paymentHeadCode && (
            <View style={s.row}>
              <Text style={s.label}>Payment Head Code</Text>
              <Text style={s.value}>{paymentHeadCode}</Text>
            </View>
          )}
          <View style={s.row}>
            <Text style={s.label}>Deposit Deadline</Text>
            <Text style={s.value}>7th of the following month</Text>
          </View>
        </View>

        {/* Lines */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Transaction Breakdown</Text>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.tCell, { flex: 2 }]}>Vendor / Description</Text>
              <Text style={s.tCell}>Section</Text>
              <Text style={s.tCell}>Status</Text>
              <Text style={s.tCell}>Rate %</Text>
              <Text style={s.tCellR}>Gross (PKR)</Text>
              <Text style={s.tCellR}>WHT (PKR)</Text>
            </View>
            {lines.map((l, i) => (
              <View key={i} style={s.tRow}>
                <Text style={[s.tCell, { flex: 2 }]}>
                  {l.vendorName || l.description.slice(0, 35)}
                </Text>
                <Text style={s.tCell}>{l.ruleKey}</Text>
                <Text style={s.tCell}>{l.taxStatus}</Text>
                <Text style={s.tCell}>{l.whtRate}%</Text>
                <Text style={s.tCellR}>{formatMoney(l.grossAmount)}</Text>
                <Text style={s.tCellR}>{formatMoney(l.whtAmount)}</Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Withholding Tax Payable</Text>
              <Text style={s.tCellR}>{formatMoney(totalGross)}</Text>
              <Text style={[s.totalValue]}>PKR {formatMoney(totalWht)}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={s.notice}>
          <Text style={[s.noticeText, { fontWeight: "bold", marginBottom: 4 }]}>
            Payment Instructions
          </Text>
          <Text style={s.noticeText}>
            1. Log in to FBR IRIS at iris.fbr.gov.pk
          </Text>
          <Text style={s.noticeText}>
            2. Go to Payment → Create Payment → select Withholding Tax
          </Text>
          <Text style={s.noticeText}>
            3. Enter the amount shown above under the respective section
          </Text>
          <Text style={s.noticeText}>
            4. Generate CPR and deposit at any designated bank branch
          </Text>
          <Text style={s.noticeText}>
            5. Save the CPR number and update it in TaxTech after payment
          </Text>
        </View>

        <View style={s.footer}>
          <Text>Generated by TaxTech · {generatedAt}</Text>
          <Text>
            This is a system-generated document for reference only. Verify
            figures before payment.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
